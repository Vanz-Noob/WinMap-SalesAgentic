#!/usr/bin/env bash
# ============================================
# WinMap — Sales Intelligence Platform
# Stop Script (Ubuntu / Linux compatible)
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

# ── Detect Docker Compose (V2 plugin or V1 standalone) ──
detect_compose() {
    if docker compose version &>/dev/null; then
        COMPOSE_CMD=(docker compose)
    elif command -v docker-compose &>/dev/null; then
        COMPOSE_CMD=(docker-compose)
    else
        echo -e "${RED}Error: Docker Compose tidak ditemukan.${NC}"
        echo -e "Install dengan: ${CYAN}sudo apt install docker-compose-plugin${NC} (V2)"
        echo -e "Atau:           ${CYAN}sudo apt install docker-compose${NC} (V1)"
        exit 1
    fi
}

# ── Detect if Docker needs sudo ──
detect_docker_sudo() {
    if docker info &>/dev/null 2>&1; then
        DOCKER_PREFIX=()
    elif sudo docker info &>/dev/null 2>&1; then
        DOCKER_PREFIX=(sudo)
        COMPOSE_CMD=("${DOCKER_PREFIX[@]}" "${COMPOSE_CMD[@]}")
    else
        echo -e "${RED}Error: Tidak bisa akses Docker daemon.${NC}"
        echo -e "Start Docker: ${CYAN}sudo systemctl start docker${NC}"
        exit 1
    fi
}

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
            echo -e "${BOLD}WinMap — Sales Intelligence Platform${NC}"
            echo ""
            echo -e "${BOLD}Usage:${NC}"
            echo -e "  ./stop.sh [OPTIONS]"
            echo ""
            echo -e "${BOLD}Options:${NC}"
            echo -e "  ${CYAN}--dev${NC}       Stop mode development"
            echo -e "  ${CYAN}--prod${NC}      Stop mode production (default)"
            echo -e "  ${CYAN}--clean${NC}     Stop + hapus semua volumes & data ${RED}(DANGER!)${NC}"
            echo -e "  ${CYAN}--all${NC}       Stop dev + prod sekaligus"
            echo -e "  ${CYAN}--help${NC}      Show help ini"
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
            echo -e "${RED}Error: Unknown option: $1${NC}"
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

    echo -e "${BLUE}Stopping WinMap — ${mode_label}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # ── Check Docker ───────────────────────────
    echo -e "${CYAN}[1/4]${NC} Checking Docker..."
    if ! command -v docker &>/dev/null; then
        echo -e "${RED}Error: Docker tidak ditemukan.${NC}"
        return 1
    fi

    detect_compose
    detect_docker_sudo

    if ! docker info &>/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Docker daemon tidak berjalan. Services mungkin sudah berhenti.${NC}"
        echo -e "${GREEN}OK Nothing to stop${NC}"
        return 0
    fi
    echo -e "${GREEN}OK Docker is running${NC}"

    # ── Check if services are running ─────────
    echo -e "${CYAN}[2/4]${NC} Checking running services..."

    # Count running containers from this compose file
    # Use || true to prevent set -e from exiting on grep returning 1 (no matches)
    local running_containers
    running_containers=$("${COMPOSE_CMD[@]}" -f "$file_path" ps --format json 2>/dev/null | grep '"State":"running"' || true)

    if [[ -z "$running_containers" ]]; then
        echo -e "${YELLOW}Warning: Tidak ada services yang running untuk $compose_file${NC}"
        echo -e "${GREEN}OK Already stopped${NC}"
        echo ""
        return 0
    fi

    local running_count
    running_count=$(echo "$running_containers" | grep -c '"State":"running"' || echo "0")

    echo -e "   Found ${BOLD}${running_count}${NC} running service(s):"
    "${COMPOSE_CMD[@]}" -f "$file_path" ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /' || \
        docker ps --filter "name=rsa" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /'
    echo ""
    echo -e "${GREEN}OK Services found${NC}"

    # ── Confirm clean ──────────────────────────
    if [[ "$do_clean" == true ]]; then
        echo ""
        echo -e "${RED}${BOLD}WARNING: --clean akan MENGHAPUS SEMUA DATA!${NC}"
        echo -e "${RED}   - Database (postgres volume)${NC}"
        echo -e "${RED}   - Redis cache${NC}"
        echo -e "${RED}   - Data tidak bisa dikembalikan!${NC}"
        echo ""
        read -p "   Ketik 'DELETE' untuk konfirmasi: " confirm
        echo ""

        if [[ "$confirm" != "DELETE" ]]; then
            echo -e "${YELLOW}Warning: Dibatalkan. Data aman.${NC}"
            echo -e "${GREEN}OK Stop tanpa clean${NC}"
            do_clean=false
        else
            echo -e "${RED}Proceeding with clean...${NC}"
        fi
    fi

    # ── Stop services ─────────────────────────
    echo -e "${CYAN}[3/4]${NC} Stopping services..."

    if [[ "$do_clean" == true ]]; then
        "${COMPOSE_CMD[@]}" -f "$file_path" down -v --remove-orphans 2>&1 | while read -r line; do
            echo "   $line"
        done
        echo -e "${GREEN}OK Services stopped + volumes removed${NC}"
    else
        "${COMPOSE_CMD[@]}" -f "$file_path" down --remove-orphans 2>&1 | while read -r line; do
            echo "   $line"
        done
        echo -e "${GREEN}OK Services stopped${NC}"
    fi

    # ── Verify ─────────────────────────────────
    echo -e "${CYAN}[4/4]${NC} Verifying..."

    local remaining
    remaining=$("${COMPOSE_CMD[@]}" -f "$file_path" ps --format json 2>/dev/null | grep '"State":"running"' || true)

    if [[ -z "$remaining" ]]; then
        echo -e "${GREEN}OK All services stopped${NC}"
    else
        local remaining_count
        remaining_count=$(echo "$remaining" | grep -c '"State":"running"' || echo "0")
        echo -e "${YELLOW}Warning: ${remaining_count} service(s) masih running. Coba: docker kill${NC}"
    fi

    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}OK ${mode_label} stopped successfully${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [[ "$do_clean" == true ]]; then
        echo -e "${YELLOW}Tip: Untuk restart: ${CYAN}./start.sh${NC}"
        echo -e "${YELLOW}Tip: Jangan lupa seed ulang: ${CYAN}./start.sh --seed${NC}"
        echo ""
    else
        echo -e "${YELLOW}Tip: Untuk restart: ${CYAN}./start.sh${NC}"
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
