#!/usr/bin/env bash
# ============================================
# WinMap — Sales Intelligence Platform
# Stop Script
# ============================================
# Usage:
#   ./stop.sh              # Stop production (default)
#   ./stop.sh --dev        # Stop development
#   ./stop.sh --prod       # Stop production
#   ./stop.sh --clean      # Stop + hapus volumes (DANGER!)
#   ./stop.sh --all        # Stop dev + prod sekaligus
#   ./stop.sh --env FILE   # Pakai file env tertentu
#   ./stop.sh --help       # Show help
# ============================================

set -uo pipefail

# ── Colors ──────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Config ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_COMPOSE="docker-compose.yml"
PROD_COMPOSE="docker-compose.prod.yml"

MODE="prod"
DO_CLEAN=false
STOP_ALL=false
ENV_OVERRIDE="${WM_ENV_FILE:-}"
USE_SUDO=""
COMPOSE_BIN="docker compose"

die() { echo -e "${RED}Error: $*${NC}" >&2; exit 1; }

# Kill proses milik root. Non-interaktif: set WM_SUDO_PASS.
sudo_kill() {
    local pid="$1"
    if [[ -n "${WM_SUDO_PASS:-}" ]]; then
        printf '%s\n' "$WM_SUDO_PASS" | sudo -S kill -9 "$pid" 2>/dev/null
    else
        sudo kill -9 "$pid" 2>/dev/null
    fi
}

docker_run() {
    if [[ -n "$USE_SUDO" ]]; then sudo docker "$@"; else docker "$@"; fi
}

compose_run() {
    if [[ -n "$USE_SUDO" ]]; then sudo $COMPOSE_BIN "$@"; else $COMPOSE_BIN "$@"; fi
}

# ── Detect Docker + Compose ─────────────────
detect_docker() {
    command -v docker &>/dev/null || die "Docker tidak ditemukan."

    if docker info &>/dev/null 2>&1; then
        USE_SUDO=""
    elif sudo docker info &>/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        echo -e "${YELLOW}Warning: Docker daemon tidak berjalan — services sudah berhenti.${NC}"
        return 1
    fi

    if docker_run compose version &>/dev/null 2>&1; then
        COMPOSE_BIN="docker compose"
    elif command -v docker-compose &>/dev/null; then
        COMPOSE_BIN="docker-compose"
    else
        die "Docker Compose tidak ditemukan."
    fi
    return 0
}

# ── Container milik stack ini saja ──────────
stack_containers() {
    local mode="$1" cid name
    docker_run ps -aq --filter "name=rsa" 2>/dev/null | while IFS= read -r cid; do
        [[ -z "$cid" ]] && continue
        name=$(docker_run inspect -f '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##')
        [[ -z "$name" ]] && continue
        if [[ "$mode" == "prod" ]]; then
            [[ "$name" == rsa_prod_* ]] && echo "$cid"
        else
            [[ "$name" != rsa_prod_* ]] && echo "$cid"
        fi
    done
}

stack_running_names() {
    local mode="$1" cid
    for cid in $(stack_containers "$mode"); do
        docker_run inspect -f '{{.Name}} => {{.State.Status}}' "$cid" 2>/dev/null | sed 's#^/##'
    done
}

# ── Force-kill stack (workaround AppArmor) ──
force_kill_stack() {
    local mode="$1" cids cid pid
    cids=$(stack_containers "$mode")
    if [[ -z "$cids" ]]; then
        return 0
    fi

    for cid in $cids; do
        docker_run update --restart=no "$cid" &>/dev/null || true
    done

    for cid in $cids; do
        pid=$(docker_run inspect -f '{{.State.Pid}}' "$cid" 2>/dev/null || true)
        pid="${pid:-0}"
        [[ "$pid" == "0" ]] && continue
        echo -e "   ${YELLOW}Force-kill ${cid:0:12} (PID=$pid)...${NC}"
        if kill -9 "$pid" 2>/dev/null; then
            continue
        fi
        sudo_kill "$pid" \
            || echo -e "   ${RED}Tidak bisa kill PID $pid (butuh sudo).${NC}"
    done

    sleep 2
    for cid in $cids; do
        docker_run rm -f "$cid" &>/dev/null || true
    done
}

# ── Resolve file env ─────────────────────────
resolve_env_file() {
    local mode="$1"
    if [[ -n "$ENV_OVERRIDE" ]]; then
        ENV_FILE="$ENV_OVERRIDE"
        if [[ "$ENV_FILE" == /* ]]; then
            ENV_PATH="$ENV_FILE"
            return 0
        fi
    elif [[ "$mode" == "prod" ]]; then
        if [[ -f "$SCRIPT_DIR/.env.production" ]]; then
            ENV_FILE=".env.production"
        else
            ENV_FILE=".env"
        fi
    else
        ENV_FILE=".env"
    fi
    ENV_PATH="$SCRIPT_DIR/$ENV_FILE"
}

# ── Parse Arguments ─────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dev) MODE="dev"; shift ;;
        --prod) MODE="prod"; shift ;;
        --clean) DO_CLEAN=true; shift ;;
        --all) STOP_ALL=true; shift ;;
        --env)
            [[ $# -gt 1 ]] || die "Opsi --env butuh nama file, contoh: --env .env.production"
            ENV_OVERRIDE="$2"; shift 2 ;;
        --help|-h)
            echo ""
            echo -e "${BOLD}WinMap — Sales Intelligence Platform${NC}"
            echo ""
            echo -e "${BOLD}Usage:${NC}  ./stop.sh [OPTIONS]"
            echo ""
            echo -e "${BOLD}Options:${NC}"
            echo -e "  ${CYAN}--dev${NC}         Stop development"
            echo -e "  ${CYAN}--prod${NC}        Stop production (default)"
            echo -e "  ${CYAN}--clean${NC}       Stop + hapus volumes & data ${RED}(DANGER!)${NC}"
            echo -e "  ${CYAN}--all${NC}         Stop dev + prod sekaligus"
            echo -e "  ${CYAN}--env FILE${NC}    Pakai file env tertentu"
            echo -e "  ${CYAN}--help${NC}        Show help ini"
            echo ""
            echo -e "${BOLD}Examples:${NC}"
            echo -e "  ${GREEN}./stop.sh${NC}             # Stop production"
            echo -e "  ${GREEN}./stop.sh --dev${NC}       # Stop development"
            echo -e "  ${GREEN}./stop.sh --all${NC}       # Stop semua"
            echo -e "  ${RED}./stop.sh --clean${NC}     # Stop + HAPUS SEMUA DATA!"
            echo ""
            exit 0
            ;;
        *) die "Unknown option: $1 (lihat ./stop.sh --help)" ;;
    esac
done

# ── Stop satu stack ─────────────────────────
stop_stack() {
    local mode="$1" compose_file="$2" mode_label="$3" do_clean="$4"

    resolve_env_file "$mode"
    local file_path="$SCRIPT_DIR/$compose_file"

    echo -e "${BLUE}Stopping WinMap — ${mode_label}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${CYAN}[1/3]${NC} Checking Docker..."
    if ! detect_docker; then
        echo -e "${GREEN}OK Nothing to stop${NC}"
        echo ""
        return 0
    fi
    echo -e "${GREEN}OK Docker is running${NC}"

    # ── Cek service yang jalan ────────────────
    echo -e "${CYAN}[2/3]${NC} Checking running services..."
    local names
    names=$(stack_running_names "$mode")

    if [[ -z "$names" ]]; then
        echo -e "${YELLOW}Warning: Tidak ada container WinMap (${mode_label}) yang ada.${NC}"
        echo -e "${GREEN}OK Already stopped${NC}"
        echo ""
        return 0
    fi
    echo -e "   Found:"
    echo "$names" | sed 's/^/     - /'
    echo ""
    echo -e "${GREEN}OK Services found${NC}"

    # ── Konfirmasi --clean ────────────────────
    if [[ "$do_clean" == true ]]; then
        echo ""
        echo -e "${RED}${BOLD}WARNING: --clean akan MENGHAPUS SEMUA DATA!${NC}"
        echo -e "${RED}   - Database (volume postgres)${NC}"
        echo -e "${RED}   - Redis cache${NC}"
        echo -e "${RED}   - Data tidak bisa dikembalikan!${NC}"
        echo ""
        if [[ -t 0 ]]; then
            read -p "   Ketik 'DELETE' untuk konfirmasi: " confirm || confirm=""
            echo ""
            if [[ "$confirm" != "DELETE" ]]; then
                echo -e "${YELLOW}Warning: Dibatalkan. Data aman.${NC}"
                do_clean=false
            fi
        else
            echo -e "${YELLOW}Non-interaktif: --clean diabaikan demi keamanan data.${NC}"
            do_clean=false
        fi
    fi

    # ── Stop services ─────────────────────────
    echo -e "${CYAN}[3/3]${NC} Stopping services..."

    local down_args=(--remove-orphans)
    [[ "$do_clean" == true ]] && down_args=(--remove-orphans -v)

    local env_args=()
    [[ -f "$ENV_PATH" ]] && env_args=(--env-file "$ENV_PATH")

    # Coba cara normal dulu
    if compose_run "${env_args[@]}" -f "$file_path" down "${down_args[@]}" &>/dev/null; then
        echo -e "${GREEN}OK Services stopped${NC}"
    else
        echo -e "${YELLOW}docker compose down gagal (kemungkinan AppArmor) — force-kill...${NC}"
        force_kill_stack "$mode"
        compose_run "${env_args[@]}" -f "$file_path" down "${down_args[@]}" &>/dev/null || true
    fi

    # ── Verifikasi ────────────────────────────
    local remaining
    remaining=$(stack_containers "$mode")
    if [[ -n "$remaining" ]]; then
        echo -e "${YELLOW}Masih ada container — retry force-kill...${NC}"
        force_kill_stack "$mode"
        remaining=$(stack_containers "$mode")
    fi

    if [[ -z "$remaining" ]]; then
        if [[ "$do_clean" == true ]]; then
            echo -e "${GREEN}OK Services stopped + volumes removed${NC}"
        else
            echo -e "${GREEN}OK All services stopped${NC}"
        fi
    else
        echo -e "${RED}Error: masih ada container tersisa:${NC}"
        echo "$remaining" | sed 's/^/   /'
        echo -e "   Manual: ${CYAN}sudo kill -9 \$(sudo docker inspect -f '{{.State.Pid}}' <container>)${NC}"
        return 1
    fi

    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}OK ${mode_label} stopped successfully${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    if [[ "$do_clean" == true ]]; then
        echo -e "${YELLOW}Tip: Start ulang + seed: ${CYAN}./start.sh --seed${NC}"
    else
        echo -e "${YELLOW}Tip: Untuk start lagi: ${CYAN}./start.sh${NC}"
    fi
    echo ""
}

# ── Execute ─────────────────────────────────
RC=0
if [[ "$STOP_ALL" == true ]]; then
    stop_stack "prod" "$PROD_COMPOSE" "PRODUCTION" "$DO_CLEAN" || RC=1
    echo ""
    stop_stack "dev" "$DEV_COMPOSE" "DEVELOPMENT" "$DO_CLEAN" || RC=1
else
    if [[ "$MODE" == "dev" ]]; then
        stop_stack "dev" "$DEV_COMPOSE" "DEVELOPMENT" "$DO_CLEAN" || RC=1
    else
        stop_stack "prod" "$PROD_COMPOSE" "PRODUCTION" "$DO_CLEAN" || RC=1
    fi
fi

exit "$RC"
