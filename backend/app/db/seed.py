"""Seed database dengan dummy data untuk testing."""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import engine, async_session, Base
from app.models import Account, Contact, Stage, User, Opportunity, Activity, Task, PresalesKpi
from sqlalchemy import select
from datetime import date, timedelta


async def seed():
    """Seed database dengan data dummy."""
    async with async_session() as db:
        # --- Stages (sudah ada dari init.sql, tapi pastikan) ---
        stages = (await db.execute(select(Stage).order_by(Stage.order))).scalars().all()
        if not stages:
            print("⚠️  Stages kosong, insert manual...")
            stage_data = [
                ("Prospecting", 1, 0.10, False, False),
                ("Qualification", 2, 0.25, False, False),
                ("Proposal", 3, 0.50, False, False),
                ("Negotiation", 4, 0.70, False, False),
                ("Closed Won", 5, 1.00, True, True),
                ("Closed Lost", 6, 0.00, True, False),
            ]
            for name, order, prob, is_closed, is_won in stage_data:
                stage = Stage(name=name, order=order, probability=prob, is_closed=is_closed, is_won=is_won)
                db.add(stage)
            await db.flush()
            stages = (await db.execute(select(Stage).order_by(Stage.order))).scalars().all()

        stage_map = {s.name: s for s in stages}
        print(f"✅ Stages: {len(stages)} loaded")

        # --- Users (Sales Reps) ---
        from app.auth import hash_password

        existing_users = (await db.execute(select(User))).scalars().all()
        if not existing_users:
            users_data = [
                ("Andi Wijaya", "andi.wijaya@renrnd.com", "sales_rep", 500000000),
                ("Siti Rahayu", "siti.rahayu@renrnd.com", "sales_rep", 500000000),
                ("Budi Santoso", "budi.santoso@renrnd.com", "sales_rep", 400000000),
                ("Dewi Lestari", "dewi.lestari@renrnd.com", "sales_manager", 1000000000),
                ("Eka Pratama", "eka.pratama@renrnd.com", "presales", 0),
                ("Fajar Nugroho", "fajar.nugroho@renrnd.com", "presales", 0),
            ]
            default_pwd = hash_password("password123")
            for name, email, role, quota in users_data:
                db.add(User(name=name, email=email, role=role, quota=quota, password_hash=default_pwd))
            await db.flush()
            print(f"✅ Users: {len(users_data)} created (default password: password123)")
        else:
            # Ensure existing users have password_hash
            updated = 0
            for u in existing_users:
                if not u.password_hash:
                    u.password_hash = hash_password("password123")
                    updated += 1
            if updated:
                await db.flush()
                print(f"✅ Users: {updated} existing users updated with default password (password123)")
            print(f"✅ Users: {len(existing_users)} already exist")

        users = (await db.execute(select(User))).scalars().all()
        user_map = {u.name: u for u in users}

        # --- Accounts ---
        existing_accounts = (await db.execute(select(Account))).scalars().all()
        if not existing_accounts:
            accounts_data = [
                ("PT Maju Jaya Teknologi", "Technology", "https://majujaya.id", "51-200", "Jakarta"),
                ("CV Sumber Makmur", "Manufacturing", "https://sumbermakmur.com", "11-50", "Bandung"),
                ("PT Global Digital", "Technology", "https://globaldigital.id", "201-500", "Jakarta"),
                ("PT Bumi Sehat Indonesia", "Healthcare", "https://bumisehat.id", "51-200", "Surabaya"),
                ("UD Sentosa Abadi", "Retail", None, "1-10", "Yogyakarta"),
                ("PT Kapital Investama", "Finance", "https://kapitalinv.id", "201-500", "Jakarta"),
                ("PT Nusantara Logistik", "Logistics", "https://nusantara-log.co.id", "501-1000", "Medan"),
                ("PT Cahaya Media Group", "Media", "https://cahayamedia.id", "51-200", "Jakarta"),
            ]
            for name, industry, website, size, region in accounts_data:
                db.add(Account(name=name, industry=industry, website=website, size=size, region=region))
            await db.flush()
            print(f"✅ Accounts: {len(accounts_data)} created")
        else:
            print(f"✅ Accounts: {len(existing_accounts)} already exist")

        accounts = (await db.execute(select(Account))).scalars().all()
        account_map = {a.name: a for a in accounts}

        # --- Contacts ---
        existing_contacts = (await db.execute(select(Contact))).scalars().all()
        if not existing_contacts:
            contacts_data = [
                ("PT Maju Jaya Teknologi", "Rudi Hartono", "rudi@majujaya.id", "081234567890", "CTO"),
                ("PT Maju Jaya Teknologi", "Maya Sari", "maya@majujaya.id", "081234567891", "Procurement Manager"),
                ("CV Sumber Makmur", "Joko Susilo", "joko@sumbermakmur.com", "082345678901", "Owner"),
                ("PT Global Digital", "Lisa Anggraini", "lisa@globaldigital.id", "083456789012", "VP Sales"),
                ("PT Bumi Sehat Indonesia", "dr. Agus Setiawan", "agus@bumisehat.id", "084567890123", "Director"),
                ("PT Kapital Investama", "Rina Wijaya", "rina@kapitalinv.id", "085678901234", "Head of IT"),
                ("PT Nusantara Logistik", "Tono Prabowo", "tono@nusantara-log.co.id", "086789012345", "COO"),
                ("PT Cahaya Media Group", "Sara Dewi", "sara@cahayamedia.id", "087890123456", "Marketing Director"),
            ]
            for account_name, contact_name, email, phone, role in contacts_data:
                account = account_map.get(account_name)
                if account:
                    db.add(Contact(
                        account_id=account.id, name=contact_name,
                        email=email, phone=phone, role=role,
                    ))
            await db.flush()
            print(f"✅ Contacts: {len(contacts_data)} created")
        else:
            print(f"✅ Contacts: {len(existing_contacts)} already exist")

        contacts = (await db.execute(select(Contact))).scalars().all()

        # --- Opportunities ---
        existing_opps = (await db.execute(select(Opportunity))).scalars().all()
        if not existing_opps:
            today = date.today()
            opps_data = [
                ("PT Maju Jaya Teknologi - Sistem CRM Enterprise", "PT Maju Jaya Teknologi", 250000000, "Prospecting", 0.10, "Andi Wijaya", 30, "ai_agent", "Eka Pratama"),
                ("PT Maju Jaya Teknologi - Mobile App Development", "PT Maju Jaya Teknologi", 180000000, "Qualification", 0.25, "Andi Wijaya", 45, "ai_agent", "Fajar Nugroho"),
                ("CV Sumber Makmur - ERP Implementation", "CV Sumber Makmur", 320000000, "Qualification", 0.25, "Siti Rahayu", 60, "ai_agent", "Eka Pratama"),
                ("PT Global Digital - Data Analytics Platform", "PT Global Digital", 450000000, "Proposal", 0.50, "Budi Santoso", 30, "ai_agent", "Fajar Nugroho"),
                ("PT Bumi Sehat Indonesia - Hospital Information System", "PT Bumi Sehat Indonesia", 680000000, "Negotiation", 0.70, "Andi Wijaya", 14, "ai_agent", "Eka Pratama"),
                ("PT Kapital Investama - Trading Dashboard", "PT Kapital Investama", 220000000, "Proposal", 0.50, "Budi Santoso", 45, "ai_agent", "Fajar Nugroho"),
                ("PT Nusantara Logistik - Fleet Management System", "PT Nusantara Logistik", 540000000, "Qualification", 0.25, "Siti Rahayu", 60, "ai_agent", "Eka Pratama"),
                ("PT Cahaya Media Group - Content Management System", "PT Cahaya Media Group", 150000000, "Prospecting", 0.10, "Budi Santoso", 30, "ai_agent", "Fajar Nugroho"),
                ("PT Maju Jaya Teknologi - Cloud Migration", "PT Maju Jaya Teknologi", 300000000, "Proposal", 0.50, "Andi Wijaya", 45, "ai_agent", "Eka Pratama"),
                ("PT Global Digital - API Gateway Setup", "PT Global Digital", 120000000, "Negotiation", 0.70, "Budi Santoso", 14, "ai_agent", "Fajar Nugroho"),
                ("CV Sumber Makmur - Inventory System", "CV Sumber Makmur", 80000000, "Prospecting", 0.10, "Siti Rahayu", 30, "ai_agent", "Eka Pratama"),
                ("PT Kapital Investama - Risk Assessment Tool", "PT Kapital Investama", 280000000, "Qualification", 0.25, "Andi Wijaya", 60, "ai_agent", "Fajar Nugroho"),
                ("PT Bumi Sehat Indonesia - Telemedicine App", "PT Bumi Sehat Indonesia", 420000000, "Proposal", 0.50, "Siti Rahayu", 45, "ai_agent", "Eka Pratama"),
                ("PT Nusantara Logistik - Warehouse Automation", "PT Nusantara Logistik", 650000000, "Negotiation", 0.70, "Andi Wijaya", 21, "ai_agent", "Fajar Nugroho"),
                ("PT Cahaya Media Group - Ad Management Platform", "PT Cahaya Media Group", 200000000, "Qualification", 0.25, "Budi Santoso", 60, "ai_agent", "Eka Pratama"),
                ("PT Maju Jaya Teknologi - DevOps Consulting", "PT Maju Jaya Teknologi", 95000000, "Closed Won", 1.00, "Andi Wijaya", -10, "ai_agent", "Fajar Nugroho"),
                ("PT Global Digital - Security Audit", "PT Global Digital", 75000000, "Closed Won", 1.00, "Budi Santoso", -15, "ai_agent", "Eka Pratama"),
                ("CV Sumber Makmur - Website Revamp", "CV Sumber Makmur", 45000000, "Closed Lost", 0.00, "Siti Rahayu", -5, "ai_agent", "Fajar Nugroho"),
                ("PT Kapital Investama - Mobile Trading App", "PT Kapital Investama", 350000000, "Proposal", 0.50, "Andi Wijaya", 30, "ai_agent", "Eka Pratama"),
                ("PT Nusantara Logistik - Driver App", "PT Nusantara Logistik", 180000000, "Qualification", 0.25, "Siti Rahayu", 45, "ai_agent", "Fajar Nugroho"),
            ]

            for name, account_name, value, stage_name, win_prob, owner_name, days_to_close, source, presales_name in opps_data:
                account = account_map.get(account_name)
                stage = stage_map.get(stage_name)
                owner = user_map.get(owner_name)
                presales = user_map.get(presales_name)
                close_date = today + timedelta(days=days_to_close)

                db.add(Opportunity(
                    name=name,
                    account_id=account.id if account else None,
                    stage_id=stage.id if stage else None,
                    value=value,
                    currency="IDR",
                    close_date=close_date,
                    win_probability=win_prob,
                    owner_id=owner.id if owner else None,
                    presales_id=presales.id if presales else None,
                    source=source,
                ))
            await db.flush()
            print(f"✅ Opportunities: {len(opps_data)} created")
        else:
            print(f"✅ Opportunities: {len(existing_opps)} already exist")

        # --- Activities ---
        existing_acts = (await db.execute(select(Activity))).scalars().all()
        if not existing_acts:
            opps = (await db.execute(select(Opportunity))).scalars().all()
            activities_data = [
                ("call", "Initial discovery call dengan prospect, diskusi kebutuhan CRM"),
                ("email", "Follow up email dengan proposal awal dan timeline"),
                ("meeting", "On-site meeting dengan CTO untuk demo sistem"),
                ("call", "Negotiation call untuk diskusi pricing"),
                ("email", "Kirim revised proposal dengan diskon 10%"),
                ("meeting", "Meeting dengan procurement team untuk final review"),
                ("note", "Prospect tertarik dengan fitur AI analytics, perlu demo lebih detail"),
                ("call", "Cold call dari lead inbound website"),
            ]
            for i, opp in enumerate(opps[:15]):
                for j, (act_type, desc) in enumerate(activities_data[:3]):
                    db.add(Activity(
                        opp_id=opp.id,
                        type=act_type,
                        description=desc,
                        created_by=opp.owner_id,
                    ))
            await db.flush()
            print(f"✅ Activities: {len(opps[:15]) * 3} created")
        else:
            print(f"✅ Activities: {len(existing_acts)} already exist")

        # --- Tasks ---
        existing_tasks = (await db.execute(select(Task))).scalars().all()
        if not existing_tasks:
            opps = (await db.execute(select(Opportunity))).scalars().all()
            tasks_data = [
                ("Follow up call dengan decision maker", 3),
                ("Kirim proposal formal", 5),
                ("Schedule demo session", 7),
                ("Prepare quotation", 2),
                ("Send contract draft", 10),
            ]
            for i, opp in enumerate(opps[:10]):
                task_title, days = tasks_data[i % len(tasks_data)]
                db.add(Task(
                    opp_id=opp.id,
                    title=task_title,
                    due_date=date.today() + timedelta(days=days),
                    status="open",
                    assigned_to=opp.owner_id,
                ))
            await db.flush()
            print(f"✅ Tasks: {len(opps[:10])} created")
        else:
            print(f"✅ Tasks: {len(existing_tasks)} already exist")

        # --- Presales KPIs ---
        existing_kpis = (await db.execute(select(PresalesKpi))).scalars().all()
        if not existing_kpis:
            # Assign presales role users as presales reps
            presales_users = [u for u in users if u.role == "presales"]
            kpis_data = [
                # 1. Bundling Solution
                ("bundling_solution", "Cloud + Security Bundling with Partner X", "Inisiatif bundling cloud infrastructure + security solution dengan partner", 2, 1, "count", "Q3", 2026, "in_progress", "Sedang negosiasi dengan partner"),
                ("bundling_solution", "Data Platform + BI Bundling", "Bundling data platform dengan BI tool dari vendor lain", 1, 1, "count", "Q3", 2026, "achieved", "Bundling solution berhasil di-launch"),
                ("bundling_solution", "AI Solution + Infrastructure Package", "Package AI solution dengan infrastruktur untuk offering ke enterprise", 2, 0, "count", "Q3", 2026, "in_progress", "Dalam diskusi dengan product team"),
                # 2. Marketing Activities
                ("marketing_activities", "Tech Webinar Series Q3", "Webinar series tentang AI & Cloud transformation", 4, 3, "count", "Q3", 2026, "in_progress", "3 dari 4 webinar selesai"),
                ("marketing_activities", "Industry Event Sponsorship", "Sponsorship event industri teknologi", 2, 1, "count", "Q3", 2026, "in_progress", "1 event done, 1 upcoming"),
                ("marketing_activities", "Content Marketing Campaign", "Whitepaper & case study publication", 6, 4, "count", "Q3", 2026, "in_progress", "4 dari 6 konten published"),
                # 3. Certification
                ("certification", "ACA Certification", "Alibaba Cloud Associate certification", 1, 1, "count", "Q3", 2026, "achieved", "Certified pada bulan Agustus"),
                ("certification", "ACP Advanced Certification", "Alibaba Cloud Professional certification", 1, 0, "count", "Q3", 2026, "in_progress", "Sedang persiapan ujian"),
                ("certification", "ACE Expert Certification", "Alibaba Cloud Expert certification", 1, 0, "count", "Q3", 2026, "not_started", "Target Q4, belum mulai"),
                # 4. Relationship with Principal
                ("relationship_principal", "Quarterly Business Review", "QBR dengan principal untuk alignment strategi", 1, 1, "count", "Q3", 2026, "achieved", "QBR Q3 selesai"),
                ("relationship_principal", "Joint Solution Workshop", "Workshop bersama principal untuk solution design", 2, 1, "count", "Q3", 2026, "in_progress", "1 workshop done, 1 scheduled"),
                ("relationship_principal", "Principal Partner Scorecard", "Submit partner performance scorecard", 1, 0, "count", "Q3", 2026, "in_progress", "Sedang compile data"),
                # 5. Upselling & Cross-selling
                ("upselling_cross_selling", "Upsell Pipeline - Existing Cloud Customers", "Upsell managed services ke existing cloud customers", 2, 1, "pipeline_count", "Q3", 2026, "in_progress", "1 pipeline created, target 2"),
                ("upselling_cross_selling", "Cross-sell Pipeline - Security Solutions", "Cross-sell security solution ke existing customers", 2, 2, "pipeline_count", "Q3", 2026, "achieved", "Target tercapai: 2 pipelines"),
                ("upselling_cross_selling", "Cross-sell Pipeline - Data Analytics", "Cross-sell data analytics ke existing customers", 2, 1, "pipeline_count", "Q3", 2026, "in_progress", "1 pipeline created"),
                # 6. Response Time
                ("response_time", "WhatsApp Response Time", "Response via WhatsApp within 1×24 hours", 24, 22, "hours", "Q3", 2026, "in_progress", "Avg response 22 jam, within SLA"),
                ("response_time", "Call Response Time", "Response via call within 1×24 hours", 24, 18, "hours", "Q3", 2026, "in_progress", "Avg response 18 jam, within SLA"),
                ("response_time", "Email Response Time", "Response via email within 1×24 hours", 24, 26, "hours", "Q3", 2026, "overdue", "Avg response 26 jam, SLA breached! Negative flag"),
                ("response_time", "Negative Checking - No Response", "Track inquiries with no response > 24h (negative)", 0, 3, "count", "Q3", 2026, "in_progress", "3 inquiries no response > 24h — needs follow up"),
            ]

            # Distribute KPIs across presales users
            for i, (cat, name, desc, target, actual, unit, q, yr, status, notes) in enumerate(kpis_data):
                assignee = presales_users[i % len(presales_users)] if presales_users else None
                db.add(PresalesKpi(
                    user_id=assignee.id if assignee else None,
                    category=cat,
                    item_name=name,
                    description=desc,
                    target=target,
                    actual=actual,
                    unit=unit,
                    quarter=q,
                    year=yr,
                    status=status,
                    notes=notes,
                ))
            await db.flush()
            print(f"✅ Presales KPIs: {len(kpis_data)} created")
        else:
            print(f"✅ Presales KPIs: {len(existing_kpis)} already exist")

        await db.commit()
        print("\n🎉 Seed data complete!")


if __name__ == "__main__":
    asyncio.run(seed())
