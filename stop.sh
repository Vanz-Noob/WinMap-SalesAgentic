#!/usr/bin/env bash
# ============================================
# RenRND Sales Agentic AI — Stop Script
# ============================================
# Usage:
#   ./stop.sh              # Stop production (default)
#   ./stop.sh --dev        # Stop development
#   ./stop.sh --prod       # Stop production
#   ./stop.sh --clean      # Stop + hapus volumes (DANGER!)
#   ./stop.sh --all        # Stop dev + prod sekaligus
#   ./stop.sh --help       # Show help
# ============================================

set -euo pipefail

# ── Colors ──────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Config ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_COMPOSE="docker-compose.yml"
PROD_COMPOSE="docker-compose.prod.yml"

# ── Defaults ────────────────────────────────
MODE="prod"
DO_CLEAN=false
STOP_ALL=false

# ── Parse Arguments ─────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dev)
            MODE="dev"
            shift
            ;;
        --prod)
            MODE="prod"
            shift
            ;;
        --clean)
            DO_CLEAN=true
            shift
            ;;
        --all)
            STOP_ALL=true
            shift
            ;;
        --help|-h)
            echo ""
            echo -e "${BOLD}RenRND Sales Agentic AI — Stop Script${NC}"
            echo ""
            echo -e "${BOLD}Usage:${NC}"
            echo -e "  ./stop.sh [OPTIONS]"
            echo ""
            echo -e "${BOLD}Options:${NC}"
            echo -e "  ${CYAN}--dev${NC}       Stop mode development"
            echo -e "  ${CYAN}--prod${NC}      Stop mode production (default)"
            echo -e "  ${CYAN}--clean${NC}     Stop + hapus semua volumes & data ${RED}(DANGER!)${NC}"
            echo -e "  ${CYAN}--all${NC}       Stop dev + prod sekaligus"
            echo -e "  ${CYAN}--help${NC}     Show help ini"
            echo ""
            echo -e "${BOLD}Examples:${NC}"
            echo -e "  ${GREEN}./stop.sh${NC}                  # Stop production"
            echo -e "  ${GREEN}./stop.sh --dev${NC}            # Stop development"
            echo -e "  ${GREEN}./stop.sh --all${NC}            # Stop semua"
            echo -e "  ${RED}./stop.sh --clean${NC}     # Stop + HAPUS SEMUA DATA!"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo -e "Run ${CYAN}./stop.sh --help${NC} untuk melihat opsi yang tersedia."
            exit 1
            ;;
    esac
done

# ── Define stop function ────────────────────
stop_stack() {
    local compose_file="$1"
    local mode_label="$2"
    local do_clean="$3"

    local file_path="$SCRIPT_DIR/$compose_file"

    echo -e "${BLUE}🛑 Stopping RenRND Sales Agentic AI — ${mode_label}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # ── Check Docker ───────────────────────────
    echo -e "${CYAN}[1/4]${NC} Checking Docker..."
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker tidak ditemukan.${NC}"
        return 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${YELLOW}⚠️  Docker daemon tidak berjalan. Services mungkin sudah berhenti.${NC}"
        echo -e "${GREEN}✅ Nothing to stop${NC}"
        return 0
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"

    # ── Check if services are running ─────────
    echo -e "${CYAN}[2/4]${NC} Checking running services..."

    # Count running containers from this compose file
    RUNNING=$(docker compose -f "$file_path" ps --format json 2>/dev/null | grep -c '"State":"running"' || echo "0")

    if [[ "$RUNNING" == "0" ]] || [[ -z "$RUNNING" ]]; then
        echo -e "${YELLOW}⚠️  Tidak ada services yang running untuk $compose_file${NC}"
        echo -e "${GREEN}✅ Already stopped${NC}"
        echo ""
        return 0
    fi

    echo -e "   Found ${BOLD}${RUNNING}${NC} running service(s):"
    docker compose -f "$file_path" ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /'
    echo ""
    echo -e "${GREEN}✅ Services found${NC}"

    # ── Confirm clean ──────────────────────────
    if [[ "$do_clean" == true ]]; then
        echo ""
        echo -e "${RED}${BOLD}⚠️  WARNING: --clean akan MENGHAPUS SEMUA DATA!${NC}"
        echo -e "${RED}   • Database (postgres volume)${NC}"
        echo -e "${RED}   • Redis cache${NC}"
        echo -e "${RED}   • Data tidak bisa dikembalikan!${NC}"
        echo ""
        read -p "   Ketik 'DELETE' untuk konfirmasi: " confirm
        echo ""

        if [[ "$confirm" != "DELETE" ]]; then
            echo -e "${YELLOW}⚠️  Dibatalkan. Data aman.${NC}"
            echo -e "${GREEN}✅ Stop tanpa clean${NC}"
            DO_CLEAN=false
        else
            echo -e "${RED}Proceeding with clean...${NC}"
        fi
    fi

    # ── Stop services ─────────────────────────
    echo -e "${CYAN}[3/4]${NC} Stopping services..."

    if [[ "$do_clean" == true ]]; then
        docker compose -f "$file_path" down -v --remove-orphans 2>&1 | while read -r line; do
            echo "   $line"
        done
        echo -e "${GREEN}✅ Services stopped + volumes removed${NC}"
    else
        docker compose -f "$file_path" down --remove-orphans 2>&1 | while read -r line; do
            echo "   $line"
        done
        echo -e "${GREEN}✅ Services stopped${NC}"
    fi

    # ── Verify ─────────────────────────────────
    echo -e "${CYAN}[4/4]${NC} Verifying..."

    REMAINING=$(docker compose -f "$file_path" ps --format json 2>/dev/null | grep -c '"State":"running"' || echo "0")

    if [[ "$REMAINING" == "0" ]] || [[ -z "$REMAINING" ]]; then
        echo -e "${GREEN}✅ All services stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  $REMAINING service(s) masih running. Coba: docker kill${NC}"
    fi

    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}✅ $mode_label stopped successfully${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [[ "$do_clean" == true ]]; then
        echo -e "${YELLOW}💡 Untuk restart: ${CYAN}./start.sh${NC}"
        echo -e "${YELLOW}💡 Jangan lupa seed ulang: ${CYAN}./start.sh --seed${NC}"
        echo ""
    else
        echo -e "${YELLOW}💡 Untuk restart: ${CYAN}./start.sh${NC}"
        echo ""
    fi
}

# ── Execute ─────────────────────────────────
if [[ "$STOP_ALL" == true ]]; then
    # Stop both dev and prod
    stop_stack "$PROD_COMPOSE" "PRODUCTION" "$DO_CLEAN"
    echo ""
    stop_stack "$DEV_COMPOSE" "DEVELOPMENT" "$DO_CLEAN"
else
    if [[ "$MODE" == "dev" ]]; then
        stop_stack "$DEV_COMPOSE" "DEVELOPMENT" "$DO_CLEAN"
    else
        stop_stack "$PROD_COMPOSE" "PRODUCTION" "$DO_CLEAN"
    fi
fi
