"""
Export Agent: Export pipeline / sales / presales data to CSV/Excel/PDF with AI-generated summary.
Excel & PDF export untuk Presales KPI menyertakan chart per kategori.
Uses BytePlus ModelArk Skylark-pro for generating export insights.
"""
import base64
import csv
import io
import json
import re
import uuid
from datetime import datetime
from fastapi import HTTPException, status
from app.llm_client import chat_pro
from app.auth import can_view_all_data
from app.models import Opportunity, Stage, User, Account, PresalesKpi, AgentLog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import aliased
from typing import Literal

# Label & urutan kategori KPI (mirror app/api/v1/presales_kpi.py CATEGORIES)
KPI_CATEGORY_LABELS = {
    "bundling_solution": "Bundling Solution",
    "marketing_activities": "Marketing Activities",
    "certification": "Certification",
    "relationship_principal": "Relationship with Principal",
    "upselling_cross_selling": "Upselling & Cross-selling",
    "response_time": "Response Time",
}
KPI_CATEGORY_ORDER = list(KPI_CATEGORY_LABELS.keys())
KPI_STATUS_LABELS = {
    "not_started": "Not Started",
    "in_progress": "In Progress",
    "achieved": "Achieved",
    "overdue": "Overdue",
}
EXPORT_FORMATS = ("csv", "excel", "pdf")
_EXPORT_MIME = {
    "csv": "text/csv",
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}
_EXPORT_EXT = {"csv": "csv", "excel": "xlsx", "pdf": "pdf"}


async def _export_pipeline(
    db: AsyncSession,
    stage_filter: str | None = None,
    owner_id: str | None = None,
    closed_only: bool = False,
) -> list[dict]:
    """Export pipeline (opportunities) data. owner_id dipaksa oleh run_export_agent sesuai role."""
    PresalesUser = aliased(User)
    stmt = (
        select(Opportunity, Stage.name.label("stage_name"), User.name.label("owner_name"), Account.name.label("account_name"), PresalesUser.name.label("presales_name"))
        .outerjoin(Stage, Opportunity.stage_id == Stage.id)
        .outerjoin(User, Opportunity.owner_id == User.id)
        .outerjoin(Account, Opportunity.account_id == Account.id)
        .outerjoin(PresalesUser, Opportunity.presales_id == PresalesUser.id)
    )

    conditions = []
    if stage_filter and stage_filter != "all":
        if stage_filter == "open":
            conditions.append(Stage.is_closed.is_(False))
        elif stage_filter == "closed_won":
            conditions.append(Stage.is_won.is_(True))
        elif stage_filter == "closed_lost":
            conditions.append(Stage.is_closed.is_(True))
            conditions.append(Stage.is_won.is_(False))
        else:
            conditions.append(Stage.name == stage_filter)
    elif closed_only:
        conditions.append(Stage.is_closed.is_(True))

    if owner_id:
        conditions.append(Opportunity.owner_id == owner_id)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(Opportunity.created_at.desc())
    result = await db.execute(stmt)
    rows = result.all()

    data = []
    for opp, stage_name, owner_name, account_name, presales_name in rows:
        data.append({
            "id": str(opp.id),
            "opportunity_name": opp.name,
            "account": account_name or "",
            "stage": stage_name or "",
            "value": float(opp.value) if opp.value else 0,
            "currency": opp.currency or "IDR",
            "win_probability": float(opp.win_probability) if opp.win_probability else 0,
            "close_date": str(opp.close_date) if opp.close_date else "",
            "owner": owner_name or "",
            "presales": presales_name or "",
            "source": opp.source or "",
            "created_at": opp.created_at.isoformat() if opp.created_at else "",
        })

    return data


async def _export_presales_kpi(
    db: AsyncSession,
    category: str | None = None,
    quarter: str | None = None,
    year: int | None = None,
    user_id=None,
) -> list[dict]:
    """Export presales KPI data. user_id dipaksa oleh run_export_agent sesuai role."""
    stmt = (
        select(PresalesKpi, User.name.label("user_name"))
        .outerjoin(User, PresalesKpi.user_id == User.id)
    )

    conditions = []
    if user_id:
        conditions.append(PresalesKpi.user_id == user_id)
    if category and category != "all":
        conditions.append(PresalesKpi.category == category)
    if quarter:
        conditions.append(PresalesKpi.quarter == quarter)
    if year:
        conditions.append(PresalesKpi.year == year)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(PresalesKpi.category, PresalesKpi.created_at)
    result = await db.execute(stmt)
    rows = result.all()

    data = []
    for kpi, user_name in rows:
        progress = 0.0
        if kpi.target and float(kpi.target) > 0:
            progress = round((float(kpi.actual) / float(kpi.target)) * 100, 1)
        data.append({
            "id": str(kpi.id),
            "category": kpi.category,
            "item_name": kpi.item_name,
            "description": kpi.description or "",
            "target": float(kpi.target) if kpi.target else 0,
            "actual": float(kpi.actual) if kpi.actual else 0,
            "unit": kpi.unit,
            "progress_pct": min(progress, 100.0),
            "quarter": kpi.quarter,
            "year": kpi.year,
            "status": kpi.status,
            "assignee": user_name or "",
            "notes": kpi.notes or "",
            "created_at": kpi.created_at.isoformat() if kpi.created_at else "",
        })

    return data


async def _presales_display_name(db: AsyncSession, user_id) -> str:
    """Nama presales untuk label filter / nama file."""
    if not user_id:
        return "all"
    result = await db.execute(select(User.name).where(User.id == user_id))
    return result.scalar_one_or_none() or "all"


_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(value):
    """Netralkan spreadsheet formula injection: cell string yang diawali
    = + - @ tab/cr di-prefix kutip tunggal (OWASP CSV injection guidance)."""
    if isinstance(value, str) and value[:1] in _CSV_FORMULA_PREFIXES:
        return "'" + value
    return value


def _to_csv(data: list[dict]) -> str:
    """Convert list of dicts to CSV string (formula-injection safe)."""
    if not data:
        return "No data found"
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows({k: _csv_safe(v) for k, v in row.items()} for row in data)
    return output.getvalue()


# ---------------------------------------------------------------------------
# Presales KPI: agregasi per kategori untuk chart (dipakai Excel & PDF)
# ---------------------------------------------------------------------------
def _kpi_category_stats(data: list[dict]) -> list[dict]:
    """Ringkas KPI per kategori: jumlah item, status, avg progress, achievement rate."""
    stats = []
    for key in KPI_CATEGORY_ORDER:
        items = [d for d in data if d.get("category") == key]
        if not items:
            continue
        total = len(items)
        achieved = sum(1 for d in items if d.get("status") == "achieved")
        in_progress = sum(1 for d in items if d.get("status") == "in_progress")
        not_started = sum(1 for d in items if d.get("status") == "not_started")
        overdue = total - achieved - in_progress - not_started
        progresses = [float(d.get("progress_pct") or 0) for d in items]
        stats.append({
            "key": key,
            "label": KPI_CATEGORY_LABELS.get(key, key),
            "items": total,
            "achieved": achieved,
            "in_progress": in_progress,
            "not_started": not_started,
            "overdue": overdue,
            "avg_progress": round(sum(progresses) / total, 1),
            "achievement_rate": round((achieved / total) * 100, 1),
        })
    return stats


def _kpi_overall(data: list[dict]) -> dict:
    if not data:
        return {"total": 0, "achieved": 0, "in_progress": 0, "not_started": 0,
                "overdue": 0, "avg_progress": 0}
    total = len(data)
    achieved = sum(1 for d in data if d.get("status") == "achieved")
    in_progress = sum(1 for d in data if d.get("status") == "in_progress")
    not_started = sum(1 for d in data if d.get("status") == "not_started")
    overdue = total - achieved - in_progress - not_started
    avg = sum(float(d.get("progress_pct") or 0) for d in data) / total
    return {
        "total": total,
        "achieved": achieved,
        "in_progress": in_progress,
        "not_started": not_started,
        "overdue": overdue,
        "avg_progress": round(avg, 1),
    }


def _kpi_rows(data: list[dict]) -> list[list]:
    """Baris tabel KPI (dipakai sheet Data di Excel & tabel PDF)."""
    rows = []
    for d in data:
        rows.append([
            KPI_CATEGORY_LABELS.get(d.get("category"), d.get("category") or ""),
            _csv_safe(d.get("item_name") or ""),
            d.get("assignee") or "",
            float(d.get("target") or 0),
            float(d.get("actual") or 0),
            d.get("unit") or "",
            float(d.get("progress_pct") or 0),
            KPI_STATUS_LABELS.get(d.get("status"), d.get("status") or ""),
            d.get("quarter") or "",
            d.get("year") or "",
            _csv_safe(d.get("notes") or ""),
        ])
    return rows


KPI_ROW_HEADERS = [
    "Kategori", "Item", "Presales", "Target", "Actual", "Unit",
    "Progress (%)", "Status", "Quarter", "Year", "Notes",
]


def _kpi_slug(value: str | None, fallback: str = "all") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or fallback


def _export_file_name(data_type: str, file_format: str, filters: dict, label: str = "all") -> str:
    ts = datetime.utcnow().strftime("%Y%m%d")
    parts = [data_type]
    if data_type == "presales":
        parts.append(_kpi_slug(label, "all"))
        if filters.get("quarter"):
            parts.append(str(filters["quarter"]))
        if filters.get("year"):
            parts.append(str(filters["year"]))
    parts.append(ts)
    return f"{'_'.join(parts)}.{_EXPORT_EXT.get(file_format, 'csv')}"


# ---------------------------------------------------------------------------
# Excel: sheet Data + sheet Summary + sheet Chart (native Excel chart)
# ---------------------------------------------------------------------------
def _to_excel(data: list[dict], meta: dict) -> bytes:
    try:
        from openpyxl import Workbook
        from openpyxl.chart import BarChart, Reference
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "Export Excel butuh library 'openpyxl' di backend (pip install openpyxl)."
        ) from exc

    wb = Workbook()
    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    thin = Side(style="thin", color="D1D5DB")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    title_font = Font(bold=True, size=14)
    sub_font = Font(size=10, italic=True, color="4B5563")

    # --- Sheet Data ---
    ws = wb.active
    ws.title = "Data"
    ws["A1"] = "Presales KPI Report"
    ws["A1"].font = title_font
    ws["A2"] = meta.get("subtitle", "")
    ws["A2"].font = sub_font

    ws.append([])  # spacer row
    ws.append(KPI_ROW_HEADERS)
    header_row = ws.max_row
    for cell in ws[header_row]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border

    rows = _kpi_rows(data)
    if rows:
        for row in rows:
            ws.append(row)
    else:
        ws.append(["Tidak ada data untuk filter ini"] + [""] * (len(KPI_ROW_HEADERS) - 1))

    widths = [28, 34, 20, 10, 10, 8, 12, 12, 9, 7, 36]
    from openpyxl.utils import get_column_letter
    for idx, width in enumerate(widths[:len(KPI_ROW_HEADERS)], start=1):
        ws.column_dimensions[get_column_letter(idx)].width = width
    for r in range(header_row + 1, ws.max_row + 1):
        for c in range(1, len(KPI_ROW_HEADERS) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = border
            cell.alignment = Alignment(vertical="center", wrap_text=(c in (1, 2, 11)))
    ws.freeze_panes = f"A{header_row + 1}"
    if rows:
        ws.auto_filter.ref = f"A{header_row}:K{ws.max_row}"

    # --- Sheet Summary (kategori) ---
    stats = _kpi_category_stats(data)
    overall = _kpi_overall(data)
    ws_sum = wb.create_sheet("Summary")
    ws_sum["A1"] = "Ringkasan per Kategori"
    ws_sum["A1"].font = title_font
    ws_sum.append([])
    sum_headers = ["Kategori", "Items", "Achieved", "In Progress", "Not Started",
                   "Overdue", "Avg Progress (%)", "Achievement Rate (%)"]
    ws_sum.append(sum_headers)
    sum_header_row = ws_sum.max_row
    for cell in ws_sum[sum_header_row]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border
    for s in stats:
        ws_sum.append([s["label"], s["items"], s["achieved"], s["in_progress"],
                       s["not_started"], s["overdue"], s["avg_progress"],
                       s["achievement_rate"]])
    for idx, width in enumerate([30, 10, 11, 12, 12, 10, 16, 18], start=1):
        ws_sum.column_dimensions[get_column_letter(idx)].width = width

    ws_sum.append([])
    ws_sum.append(["Total Items", overall["total"]])
    ws_sum.append(["Achieved", overall["achieved"]])
    ws_sum.append(["In Progress", overall["in_progress"]])
    ws_sum.append(["Overdue", overall["overdue"]])
    ws_sum.append(["Overall Avg Progress (%)", overall["avg_progress"]])
    for r in range(ws_sum.max_row - 4, ws_sum.max_row + 1):
        ws_sum.cell(row=r, column=1).font = Font(bold=True)

    # --- Sheet Chart (native Excel charts) ---
    ws_chart = wb.create_sheet("Chart")
    ws_chart["A1"] = "Chart Presales KPI per Kategori"
    ws_chart["A1"].font = title_font
    ws_chart["A2"] = meta.get("subtitle", "")
    ws_chart["A2"].font = sub_font

    # Data chart ditaruh di kolom H..K (bisa disembunyikan agar sheet tetap rapi)
    chart_start_col = 8  # H
    ws_chart.cell(row=4, column=chart_start_col, value="Kategori").font = Font(bold=True)
    ws_chart.cell(row=4, column=chart_start_col + 1, value="Avg Progress (%)").font = Font(bold=True)
    ws_chart.cell(row=4, column=chart_start_col + 2, value="Achievement Rate (%)").font = Font(bold=True)
    ws_chart.cell(row=4, column=chart_start_col + 3, value="Achieved").font = Font(bold=True)
    ws_chart.cell(row=4, column=chart_start_col + 4, value="In Progress").font = Font(bold=True)
    ws_chart.cell(row=4, column=chart_start_col + 5, value="Overdue").font = Font(bold=True)
    for i, s in enumerate(stats, start=1):
        r = 4 + i
        ws_chart.cell(row=r, column=chart_start_col, value=s["label"])
        ws_chart.cell(row=r, column=chart_start_col + 1, value=s["avg_progress"])
        ws_chart.cell(row=r, column=chart_start_col + 2, value=s["achievement_rate"])
        ws_chart.cell(row=r, column=chart_start_col + 3, value=s["achieved"])
        ws_chart.cell(row=r, column=chart_start_col + 4, value=s["in_progress"])
        ws_chart.cell(row=r, column=chart_start_col + 5, value=s["overdue"])

    if stats:
        cats = Reference(ws_chart, min_col=chart_start_col, min_row=5,
                         max_row=4 + len(stats))

        chart1 = BarChart()
        chart1.type = "col"
        chart1.style = 10
        chart1.grouping = "clustered"
        chart1.title = "Progress per Kategori"
        chart1.y_axis.title = "%"
        chart1.x_axis.title = "Kategori"
        chart1.y_axis.scaling.min = 0
        chart1.y_axis.scaling.max = 100
        chart1.y_axis.majorGridlines = None
        data1 = Reference(ws_chart, min_col=chart_start_col + 1, max_col=chart_start_col + 2,
                          min_row=4, max_row=4 + len(stats))
        chart1.add_data(data1, titles_from_data=True)
        chart1.set_categories(cats)
        chart1.height = 9.5
        chart1.width = 24
        ws_chart.add_chart(chart1, "A4")

        chart2 = BarChart()
        chart2.type = "col"
        chart2.grouping = "stacked"
        chart2.overlap = 100
        chart2.title = "Status KPI per Kategori"
        chart2.y_axis.title = "Jumlah Item"
        chart2.x_axis.title = "Kategori"
        data2 = Reference(ws_chart, min_col=chart_start_col + 3, max_col=chart_start_col + 5,
                          min_row=4, max_row=4 + len(stats))
        chart2.add_data(data2, titles_from_data=True)
        chart2.set_categories(cats)
        chart2.height = 9.5
        chart2.width = 24
        ws_chart.add_chart(chart2, "A24")

    ws_chart.column_dimensions["A"].width = 4
    ws_chart.column_dimensions["B"].width = 4

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


# ---------------------------------------------------------------------------
# PDF: reportlab (chart + tabel, tanpa dependency matplotlib)
# ---------------------------------------------------------------------------
def _to_pdf(data: list[dict], meta: dict) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.graphics.charts.legends import Legend
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.graphics.shapes import Drawing
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "Export PDF butuh library 'reportlab' di backend (pip install reportlab)."
        ) from exc

    stats = _kpi_category_stats(data)
    overall = _kpi_overall(data)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=meta.get("title", "Presales KPI Report"),
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("KpiTitle", parent=styles["Title"], fontSize=18, spaceAfter=4)
    sub_style = ParagraphStyle("KpiSub", parent=styles["Normal"], fontSize=9,
                               textColor=colors.HexColor("#4B5563"), spaceAfter=10)
    section_style = ParagraphStyle("KpiSection", parent=styles["Heading2"], fontSize=12,
                                   spaceBefore=10, spaceAfter=6)
    cell_style = ParagraphStyle("KpiCell", parent=styles["Normal"], fontSize=7.5, leading=9)
    cell_bold = ParagraphStyle("KpiCellBold", parent=cell_style, fontName="Helvetica-Bold")
    head_style = ParagraphStyle("KpiHead", parent=cell_bold, fontSize=7.5,
                                textColor=colors.white)

    story = [
        Paragraph(meta.get("title", "Presales KPI Report"), title_style),
        Paragraph(meta.get("subtitle", ""), sub_style),
    ]

    # Kartu ringkasan
    summary_rows = [
        ["Total Item", str(overall["total"])],
        ["Achieved", str(overall["achieved"])],
        ["In Progress", str(overall["in_progress"])],
        ["Overdue", str(overall["overdue"])],
        ["Avg Progress", f"{overall['avg_progress']}%"],
    ]
    summary_table = Table(
        [[label for label, _ in summary_rows], [value for _, value in summary_rows]],
        colWidths=[doc.width / 5.0] * 5,
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F3F4F6")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#6B7280")),
        ("FONT", (0, 0), (-1, 0), "Helvetica", 7.5),
        ("FONT", (0, 1), (-1, 1), "Helvetica-Bold", 12),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)

    # Chart
    if stats:
        story.append(Paragraph("Chart per Kategori", section_style))
        drawing = Drawing(doc.width, 200)
        chart = VerticalBarChart()
        chart.x = 10
        chart.y = 34
        chart.width = doc.width - 130
        chart.height = 150
        chart.data = [
            [s["avg_progress"] for s in stats],
            [s["achievement_rate"] for s in stats],
        ]
        chart.categoryAxis.categoryNames = [s["label"] for s in stats]
        chart.categoryAxis.labels.fontSize = 7
        chart.categoryAxis.labels.angle = 30
        chart.categoryAxis.labels.dx = -2
        chart.categoryAxis.labels.dy = -8
        chart.categoryAxis.labels.boxAnchor = "ne"
        chart.valueAxis.valueMin = 0
        chart.valueAxis.valueMax = 100
        chart.valueAxis.valueStep = 20
        chart.valueAxis.labels.fontSize = 7
        chart.valueAxis.labelTextFormat = "%d%%"
        chart.barWidth = 8
        chart.groupSpacing = 6
        chart.bars[0].fillColor = colors.HexColor("#3B82F6")
        chart.bars[1].fillColor = colors.HexColor("#059669")
        chart.barLabels.fontSize = 6
        chart.barLabels.nudge = 6
        drawing.add(chart)

        legend = Legend()
        legend.x = doc.width - 110
        legend.y = 160
        legend.alignment = "left"
        legend.fontName = "Helvetica"
        legend.fontSize = 7
        legend.colorNamePairs = [
            (colors.HexColor("#3B82F6"), "Avg Progress (%)"),
            (colors.HexColor("#059669"), "Achievement Rate (%)"),
        ]
        drawing.add(legend)
        story.append(drawing)

        # Tabel ringkasan kategori
        story.append(Paragraph("Ringkasan per Kategori", section_style))
        head = ["Kategori", "Items", "Achieved", "In Progress", "Not Started",
                "Overdue", "Avg Progress (%)", "Achievement Rate (%)"]
        table_data = [[Paragraph(h, head_style) for h in head]]
        for s in stats:
            table_data.append([
                Paragraph(s["label"], cell_style), s["items"], s["achieved"],
                s["in_progress"], s["not_started"], s["overdue"],
                f"{s['avg_progress']}%", f"{s['achievement_rate']}%",
            ])
        cat_table = Table(table_data, colWidths=[
            doc.width * 0.30, doc.width * 0.08, doc.width * 0.09, doc.width * 0.10,
            doc.width * 0.10, doc.width * 0.08, doc.width * 0.13, doc.width * 0.12,
        ])
        cat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2937")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7.5),
            ("FONT", (0, 1), (-1, -1), "Helvetica", 7.5),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(cat_table)

    # Tabel detail
    story.append(Paragraph("Detail KPI", section_style))
    detail_head = ["Kategori", "Item", "Presales", "Target", "Actual", "Unit",
                   "Progress", "Status", "Q", "Year"]
    detail_data = [[Paragraph(h, head_style) for h in detail_head]]
    if data:
        for row in _kpi_rows(data):
            detail_data.append([
                Paragraph(str(row[0]), cell_style),
                Paragraph(str(row[1]), cell_style),
                Paragraph(str(row[2]), cell_style),
                row[3], row[4], Paragraph(str(row[5]), cell_style),
                f"{row[6]}%", Paragraph(str(row[7]), cell_style),
                Paragraph(str(row[8]), cell_style), Paragraph(str(row[9]), cell_style),
            ])
    else:
        detail_data.append([Paragraph("Tidak ada data untuk filter ini", cell_style)]
                           + [""] * (len(detail_head) - 1))
    detail_table = Table(detail_data, repeatRows=1, colWidths=[
        doc.width * 0.16, doc.width * 0.26, doc.width * 0.12, doc.width * 0.07,
        doc.width * 0.07, doc.width * 0.06, doc.width * 0.08, doc.width * 0.09,
        doc.width * 0.04, doc.width * 0.05,
    ])
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7.5),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 7),
        ("ALIGN", (3, 0), (6, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(detail_table)

    def _footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#9CA3AF"))
        canvas.drawString(14 * mm, 7 * mm, "WinMap SalesAgentic - Presales KPI Report")
        canvas.drawRightString(doc_obj.pagesize[0] - 14 * mm, 7 * mm, f"Halaman {doc_obj.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


async def _generate_export_summary(
    data_type: str,
    data: list[dict],
    filters: dict,
) -> dict:
    """Use LLM to generate a summary of the exported data."""
    if not data:
        return {
            "summary": "No data found for the selected filters.",
            "key_metrics": {},
            "recommendations": [],
        }

    # Build stats summary for the prompt
    if data_type == "pipeline":
        total_value = sum(d.get("value", 0) for d in data)
        stages = {}
        for d in data:
            s = d.get("stage", "Unknown")
            stages[s] = stages.get(s, 0) + 1
        avg_prob = sum(d.get("win_probability", 0) for d in data) / len(data) if data else 0
        stats = {
            "total_deals": len(data),
            "total_value": total_value,
            "avg_win_probability": round(avg_prob, 3),
            "stages_breakdown": stages,
            "filters_applied": filters,
        }
    else:
        categories = {}
        statuses = {}
        for d in data:
            c = d.get("category", "Unknown")
            categories[c] = categories.get(c, 0) + 1
            s = d.get("status", "Unknown")
            statuses[s] = statuses.get(s, 0) + 1
        avg_progress = sum(d.get("progress_pct", 0) for d in data) / len(data) if data else 0
        stats = {
            "total_kpis": len(data),
            "avg_progress": round(avg_progress, 1),
            "categories_breakdown": categories,
            "status_breakdown": statuses,
            "filters_applied": filters,
        }

    prompt = f"""
    Anda adalah Sales Export AI Agent. Buat ringkasan dari data yang di-export.

    Data type: {data_type}
    Statistics: {json.dumps(stats, indent=2)}

    Buat response JSON:
    {{
        "summary": "ringkasan 2-3 kalimat tentang data yang di-export",
        "key_metrics": {{
            "metric_name": "value description"
        }},
        "recommendations": ["rekomendasi 1", "rekomendasi 2", "rekomendasi 3"]
    }}
    """
    try:
        response = await chat_pro(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, Exception):
        return {
            "summary": f"Exported {len(data)} {data_type} records with filters: {json.dumps(filters)}",
            "key_metrics": stats,
            "recommendations": ["Review exported data for details"],
        }


async def run_export_agent(
    db: AsyncSession,
    current_user,
    data_type: Literal["pipeline", "presales"] = "pipeline",
    stage_filter: str | None = None,
    owner_id: uuid.UUID | None = None,
    category: str | None = None,
    quarter: str | None = None,
    year: int | None = None,
    presales_user_id: uuid.UUID | None = None,
    file_format: str = "csv",
) -> dict:
    """
    Export Agent: Export data to CSV/Excel/PDF + AI-generated summary.

    data_type:
      - "pipeline": Export opportunities (sales pipeline)
      - "presales": Export presales KPI tracking data (Excel/PDF menyertakan chart)

    Filters for pipeline:
      - stage_filter: "all", "open", "closed_won", "closed_lost", or specific stage name
      - owner_id: filter by sales rep (hanya superadmin/sales_manager boleh specify;
        role lain dipaksa ke data milik sendiri)

    Filters for presales:
      - category: "all" or specific category key
      - quarter: e.g. "Q3"
      - year: e.g. 2026
      - presales_user_id: filter by nama presales (hanya superadmin/sales_manager
        boleh specify; role lain dipaksa ke data milik sendiri)
      - file_format: "csv" | "excel" | "pdf"
    """
    if file_format not in EXPORT_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format export tidak dikenal: {file_format}. Pilihan: {', '.join(EXPORT_FORMATS)}",
        )
    if data_type == "pipeline" and file_format != "csv":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Export Excel/PDF saat ini hanya tersedia untuk Presales KPI.",
        )

    # Owner-scoping: non-superadmin/sales_manager selalu terbatas ke data sendiri,
    # owner_id dari client diabaikan.
    forced_owner_id = None if can_view_all_data(current_user) else current_user.id
    if forced_owner_id is not None:
        owner_id = forced_owner_id

    filters = {"data_type": data_type}

    if data_type == "pipeline":
        if stage_filter:
            filters["stage"] = stage_filter
        if owner_id:
            filters["owner_id"] = str(owner_id)
        data = await _export_pipeline(db, stage_filter=stage_filter, owner_id=owner_id)
        csv_content = _to_csv(data)
        ai_summary = await _generate_export_summary("pipeline", data, filters)
        file_bytes = csv_content.encode("utf-8")
        file_name = _export_file_name("pipeline", "csv", filters)
    else:
        if category and category != "all":
            filters["category"] = category
        if quarter:
            filters["quarter"] = quarter
        if year:
            filters["year"] = year

        # Non-superadmin selalu terbatas ke KPI milik sendiri.
        kpi_user_id = presales_user_id if can_view_all_data(current_user) else current_user.id
        presales_label = "all"
        if kpi_user_id:
            presales_label = await _presales_display_name(db, kpi_user_id)
            filters["presales_user_id"] = str(kpi_user_id)
            filters["presales_name"] = presales_label

        data = await _export_presales_kpi(
            db, category=category, quarter=quarter, year=year, user_id=kpi_user_id
        )
        csv_content = _to_csv(data)
        ai_summary = await _generate_export_summary("presales", data, filters)

        cat_label = (
            "Semua Kategori"
            if not category or category == "all"
            else KPI_CATEGORY_LABELS.get(category, category)
        )
        period = " ".join(str(x) for x in (quarter, year) if x) or "Semua Periode"
        meta = {
            "title": "Presales KPI Report",
            "subtitle": (
                f"Presales: {presales_label} | Kategori: {cat_label} | "
                f"Periode: {period} | {len(data)} item"
            ),
        }
        if file_format == "excel":
            file_bytes = _to_excel(data, meta)
        elif file_format == "pdf":
            file_bytes = _to_pdf(data, meta)
        else:
            file_bytes = csv_content.encode("utf-8")
        file_name = _export_file_name("presales", file_format, filters, presales_label)

    # Log
    log = AgentLog(
        agent_type="export",
        action=f"export_{data_type}",
        input=filters,
        output={
            "record_count": len(data),
            "ai_summary": ai_summary,
        },
        token_usage=0,
        status="success",
    )
    db.add(log)
    await db.commit()

    return {
        "data_type": data_type,
        "filters": filters,
        "record_count": len(data),
        "columns": list(data[0].keys()) if data else [],
        "data": data,
        "csv_content": csv_content,
        "file_format": file_format,
        "file_name": file_name,
        "mime_type": _EXPORT_MIME[file_format],
        "file_bytes_base64": base64.b64encode(file_bytes).decode("ascii"),
        "ai_summary": ai_summary,
        "exported_at": datetime.utcnow().isoformat(),
    }
