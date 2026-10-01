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
COMPOSE_CMD=()
DOCKER_PREFIX=()

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
    else
        echo -e "${RED}Error: Tidak bisa akses Docker daemon.${NC}"
        echo -e "Start Docker: ${CYAN}sudo systemctl start docker${NC}"
        exit 1
    fi
}

# ── Build full compose command with sudo prefix ──
get_compose_base() {
    if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
        echo "${DOCKER_PREFIX[@]}" "${COMPOSE_CMD[@]}"
    else
        echo "${COMPOSE_CMD[@]}"
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
    local env_file="$4"

    local file_path="$SCRIPT_DIR/$compose_file"
    local env_path="$SCRIPT_DIR/$env_file"

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

    # Check if Docker daemon is running
    local docker_ok=false
    if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
        if sudo docker info &>/dev/null 2>&1; then
            docker_ok=true
        fi
    else
        if docker info &>/dev/null 2>&1; then
            docker_ok=true
        fi
    fi

    if [[ "$docker_ok" != true ]]; then
        echo -e "${YELLOW}Warning: Docker daemon tidak berjalan. Services mungkin sudah berhenti.${NC}"
        echo -e "${GREEN}OK Nothing to stop${NC}"
        echo ""
        return 0
    fi
    echo -e "${GREEN}OK Docker is running${NC}"

    # Build compose base command
    local compose_base
    if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
        compose_base=("${DOCKER_PREFIX[@]}" "${COMPOSE_CMD[@]}")
    else
        compose_base=("${COMPOSE_CMD[@]}")
    fi

    # ── Check if services are running ─────────
    echo -e "${CYAN}[2/4]${NC} Checking running services..."

    # Try with --env-file first (for variable interpolation)
    local running_containers=""
    if [[ -f "$env_path" ]]; then
        running_containers=$("${compose_base[@]}" --env-file "$env_path" -f "$file_path" ps --format json 2>/dev/null | grep '"State":"running"' || true)
    else
        # No env file — try without it (some compose files don't need it)
        running_containers=$("${compose_base[@]}" -f "$file_path" ps --format json 2>/dev/null | grep '"State":"running"' || true)
    fi

    # Fallback: check via docker ps directly
    if [[ -z "$running_containers" ]]; then
        local direct_running
        if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
            direct_running=$(sudo docker ps --filter "name=rsa" --format '{{.Names}}' 2>/dev/null || true)
        else
            direct_running=$(docker ps --filter "name=rsa" --format '{{.Names}}' 2>/dev/null || true)
        fi

        if [[ -z "$direct_running" ]]; then
            echo -e "${YELLOW}Warning: Tidak ada services WinMap yang running.${NC}"
            echo -e "${GREEN}OK Already stopped${NC}"
            echo ""
            return 0
        fi
    fi

    echo -e "   Found running services:"
    if [[ -f "$env_path" ]]; then
        "${compose_base[@]}" --env-file "$env_path" -f "$file_path" ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /' || \
            { [[ ${#DOCKER_PREFIX[@]} -gt 0 ]] && sudo docker ps --filter "name=rsa" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /'; } || \
            docker ps --filter "name=rsa" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /'
    else
        "${compose_base[@]}" -f "$file_path" ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /' || \
            { [[ ${#DOCKER_PREFIX[@]} -gt 0 ]] && sudo docker ps --filter "name=rsa" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /'; } || \
            docker ps --filter "name=rsa" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | sed 's/^/   /'
    fi
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
        if [[ -f "$env_path" ]]; then
            "${compose_base[@]}" --env-file "$env_path" -f "$file_path" down -v --remove-orphans 2>&1 | while read -r line; do
                echo "   $line"
            done
        else
            "${compose_base[@]}" -f "$file_path" down -v --remove-orphans 2>&1 | while read -r line; do
                echo "   $line"
            done
        fi
        echo -e "${GREEN}OK Services stopped + volumes removed${NC}"
    else
        if [[ -f "$env_path" ]]; then
            "${compose_base[@]}" --env-file "$env_path" -f "$file_path" down --remove-orphans 2>&1 | while read -r line; do
                echo "   $line"
            done
        else
            "${compose_base[@]}" -f "$file_path" down --remove-orphans 2>&1 | while read -r line; do
                echo "   $line"
            done
        fi
        echo -e "${GREEN}OK Services stopped${NC}"
    fi

    # ── Verify ─────────────────────────────────
    echo -e "${CYAN}[4/4]${NC} Verifying..."

    local remaining=""
    if [[ -f "$env_path" ]]; then
        remaining=$("${compose_base[@]}" --env-file "$env_path" -f "$file_path" ps --format json 2>/dev/null | grep '"State":"running"' || true)
    else
        remaining=$("${compose_base[@]}" -f "$file_path" ps --format json 2>/dev/null | grep '"State":"running"' || true)
    fi

    if [[ -z "$remaining" ]]; then
        echo -e "${GREEN}OK All services stopped${NC}"
    else
        echo -e "${YELLOW}Warning: beberapa service masih running.${NC}"
        echo -e "   Coba manual: ${CYAN}docker kill \$(docker ps -q --filter name=rsa)${NC}"
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
    stop_stack "$PROD_COMPOSE" "PRODUCTION" "$DO_CLEAN" ".env.production"
    echo ""
    stop_stack "$DEV_COMPOSE" "DEVELOPMENT" "$DO_CLEAN" ".env"
else
    if [[ "$MODE" == "dev" ]]; then
        stop_stack "$DEV_COMPOSE" "DEVELOPMENT" "$DO_CLEAN" ".env"
    else
        stop_stack "$PROD_COMPOSE" "PRODUCTION" "$DO_CLEAN" ".env.production"
    fi
fi
