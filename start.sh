#!/usr/bin/env bash
# ============================================
# WinMap — Sales Intelligence Platform
# Start Script
# ============================================
# Usage:
#   ./start.sh                 # Start production (default)
#   ./start.sh --dev           # Start development
#   ./start.sh --prod          # Start production
#   ./start.sh --seed          # Start + seed database
#   ./start.sh --build         # Force rebuild images
#   ./start.sh --env .env      # Pakai file env tertentu
#   ./start.sh --help          # Show help
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
DO_SEED=false
DO_BUILD=false
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

# Nama project compose = nama folder (dipakai untuk network <project>_default)
PROJECT_NAME=$(basename "$SCRIPT_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')

# ── Docker / Compose helpers ────────────────
docker_run() {
    if [[ -n "$USE_SUDO" ]]; then sudo docker "$@"; else docker "$@"; fi
}

compose_run() {
    if [[ -n "$USE_SUDO" ]]; then sudo $COMPOSE_BIN "$@"; else $COMPOSE_BIN "$@"; fi
}

# ── Generate random string (SIGPIPE-safe) ───
gen_random() {
    local length="${1:-32}" hex
    if [[ -r /dev/urandom ]]; then
        hex=$(od -An -tx1 -N64 /dev/urandom | tr -d ' \n')
        printf '%s\n' "${hex:0:length}"
    elif command -v openssl &>/dev/null; then
        hex=$(openssl rand -hex 32)
        printf '%s\n' "${hex:0:length}"
    else
        date +%s%N | sha256sum | cut -c1-"$length"
    fi
}

# ── Detect Docker + Compose ─────────────────
detect_docker() {
    command -v docker &>/dev/null || die "Docker tidak ditemukan. Install: curl -fsSL https://get.docker.com | sudo sh"

    if docker info &>/dev/null 2>&1; then
        USE_SUDO=""
    elif sudo docker info &>/dev/null 2>&1; then
        USE_SUDO="sudo"
        echo -e "${YELLOW}Note: Docker membutuhkan sudo. Menjalankan dengan sudo.${NC}"
        echo -e "${YELLOW}Tip: sudo usermod -aG docker \$USER  lalu logout-login.${NC}"
        echo ""
    else
        die "Tidak bisa akses Docker daemon. Jalankan: sudo systemctl start docker"
    fi

    # Deteksi compose setelah tahu apakah butuh sudo
    if docker_run compose version &>/dev/null 2>&1; then
        COMPOSE_BIN="docker compose"
    elif command -v docker-compose &>/dev/null; then
        COMPOSE_BIN="docker-compose"
    else
        die "Docker Compose tidak ditemukan. Install: sudo apt install docker-compose-plugin"
    fi
}

# ── Daftar container milik stack ini saja ───
# Prod  : rsa_prod_*
# Dev   : rsa_* (selain rsa_prod_*)
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

# ── Force-kill stack (workaround AppArmor) ──
# Dipakai HANYA saat docker stop/compose down gagal.
force_kill_stack() {
    local mode="$1" cids cid pid
    cids=$(stack_containers "$mode")
    if [[ -z "$cids" ]]; then
        return 0
    fi

    # 1. Matikan restart policy agar tidak auto-restart setelah kill
    for cid in $cids; do
        docker_run update --restart=no "$cid" &>/dev/null || true
    done

    # 2. Kill PID container (proses milik root → fallback sudo)
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

    # 3. Hapus container
    sleep 2
    for cid in $cids; do
        docker_run rm -f "$cid" &>/dev/null || true
    done
}

# ── Resolve file env ─────────────────────────
# Prioritas: --env / WM_ENV_FILE → .env.production (prod) → .env → buat baru
resolve_env_file() {
    if [[ -n "$ENV_OVERRIDE" ]]; then
        ENV_FILE="$ENV_OVERRIDE"
        if [[ "$ENV_FILE" == /* ]]; then
            [[ -f "$ENV_FILE" ]] || die "File env '$ENV_FILE' tidak ditemukan"
            ENV_PATH="$ENV_FILE"
            return 0
        fi
        [[ -f "$SCRIPT_DIR/$ENV_FILE" ]] || die "File env '$ENV_FILE' tidak ditemukan di $SCRIPT_DIR"
    elif [[ "$MODE" == "prod" ]]; then
        if [[ -f "$SCRIPT_DIR/.env.production" ]]; then
            ENV_FILE=".env.production"
        elif [[ -f "$SCRIPT_DIR/.env" ]]; then
            ENV_FILE=".env"
            echo -e "${YELLOW}Note: .env.production tidak ada, memakai .env${NC}"
        else
            ENV_FILE=".env.production"
        fi
    else
        ENV_FILE=".env"
    fi
    ENV_PATH="$SCRIPT_DIR/$ENV_FILE"
}

env_value() {
    local var_name="$1" file_path="$2"
    grep -E "^${var_name}=" "$file_path" 2>/dev/null | head -n 1 | cut -d'=' -f2- || true
}

is_placeholder() {
    local value="$1"
    [[ -z "$value" || "$value" == *"your_"* || "$value" == *"change"* || "$value" == *"placeholder"* ]]
}

# Tulis/ubah KEY=VALUE di file env (portable macOS + Linux)
set_env_var() {
    local key="$1" val="$2" file="$3" tmp
    tmp=$(mktemp)
    if grep -q "^${key}=" "$file"; then
        sed "s|^${key}=.*|${key}=${val}|" "$file" > "$tmp"
    else
        cat "$file" > "$tmp"
        printf '%s=%s\n' "$key" "$val" >> "$tmp"
    fi
    mv "$tmp" "$file"
}

# ── Parse Arguments ─────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dev) MODE="dev"; shift ;;
        --prod) MODE="prod"; shift ;;
        --seed) DO_SEED=true; shift ;;
        --build) DO_BUILD=true; shift ;;
        --env)
            [[ $# -gt 1 ]] || die "Opsi --env butuh nama file, contoh: --env .env.production"
            ENV_OVERRIDE="$2"; shift 2 ;;
        --help|-h)
            echo ""
            echo -e "${BOLD}WinMap — Sales Intelligence Platform${NC}"
            echo ""
            echo -e "${BOLD}Usage:${NC}  ./start.sh [OPTIONS]"
            echo ""
            echo -e "${BOLD}Options:${NC}"
            echo -e "  ${CYAN}--dev${NC}          Start development (docker-compose.yml)"
            echo -e "  ${CYAN}--prod${NC}         Start production (docker-compose.prod.yml) — default"
            echo -e "  ${CYAN}--seed${NC}         Seed database setelah start (first run only)"
            echo -e "  ${CYAN}--build${NC}        Force rebuild Docker images"
            echo -e "  ${CYAN}--env FILE${NC}     Pakai file env tertentu (default: .env.production / .env)"
            echo -e "  ${CYAN}--help${NC}         Show help ini"
            echo ""
            echo -e "${BOLD}Examples:${NC}"
            echo -e "  ${GREEN}./start.sh${NC}                # Start production"
            echo -e "  ${GREEN}./start.sh --dev${NC}          # Start development"
            echo -e "  ${GREEN}./start.sh --prod --seed${NC}  # Start production + seed DB"
            echo -e "  ${GREEN}./start.sh --env .env${NC}     # Production pakai .env"
            echo ""
            exit 0
            ;;
        *) die "Unknown option: $1 (lihat ./start.sh --help)" ;;
    esac
done

# ── Select compose file ─────────────────────
if [[ "$MODE" == "dev" ]]; then
    COMPOSE_FILE="$DEV_COMPOSE"
    BACKEND_CONTAINER="rsa_backend"
    STACK_FILTER="name=rsa"
    echo -e "${BLUE}Starting WinMap — ${YELLOW}DEVELOPMENT${NC}"
else
    COMPOSE_FILE="$PROD_COMPOSE"
    BACKEND_CONTAINER="rsa_prod_backend"
    STACK_FILTER="name=rsa_prod"
    echo -e "${BLUE}Starting WinMap — ${GREEN}PRODUCTION${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Step 1: Check Docker ────────────────────
echo -e "${CYAN}[1/6]${NC} Checking Docker..."
detect_docker
echo -e "${GREEN}OK Docker is running${NC}"

# ── Step 2: Prepare env file ───────────────
echo -e "${CYAN}[2/6]${NC} Checking environment..."
resolve_env_file
ENV_GENERATED=false

if [[ ! -f "$ENV_PATH" ]]; then
    echo -e "${YELLOW}Warning: $ENV_FILE tidak ditemukan, membuat baru...${NC}"
    if [[ -f "$SCRIPT_DIR/.env.example" ]]; then
        cp "$SCRIPT_DIR/.env.example" "$ENV_PATH"
    else
        cat > "$ENV_PATH" << 'EOF'
# WinMap — Auto-generated environment file
ARK_API_KEY=
POSTGRES_USER=rsa_admin
POSTGRES_PASSWORD=
POSTGRES_DB=rsa_sales
REDIS_URL=redis://redis:6379/0
JWT_SECRET=
DEBUG=false
EOF
    fi

    # Hanya generate otomatis saat file BARU dibuat
    pg_pass=$(gen_random 32)
    jwt_secret=$(gen_random 48)
    set_env_var "POSTGRES_PASSWORD" "$pg_pass" "$ENV_PATH"
    set_env_var "JWT_SECRET" "$jwt_secret" "$ENV_PATH"
    chmod 600 "$ENV_PATH"
    ENV_GENERATED=true
    echo -e "   ${GREEN}Created:${NC} $ENV_FILE (password & JWT di-generate)"
    echo -e "   ${YELLOW}Isi ARK_API_KEY di file tersebut agar AI agent berfungsi.${NC}"
    echo ""
else
    # File sudah ada: JANGAN generate ulang (bisa memutus koneksi DB yang sudah ada)
    ENV_ERRORS=()
    for var in POSTGRES_PASSWORD JWT_SECRET; do
        val=$(env_value "$var" "$ENV_PATH")
        is_placeholder "$val" && ENV_ERRORS+=("$var")
    done
    if [[ ${#ENV_ERRORS[@]} -gt 0 ]]; then
        echo -e "${RED}Error: variabel berikut kosong/placeholder di $ENV_FILE:${NC}"
        for var in "${ENV_ERRORS[@]}"; do echo -e "   ${RED}- $var${NC}"; done
        echo -e "   Isi manual di ${CYAN}$ENV_PATH${NC}."
        echo -e "   ${YELLOW}Jangan generate ulang bila database sudah pernah dibuat —${NC}"
        echo -e "   ${YELLOW}password Postgres hanya dipakai saat volume pertama kali diinisialisasi.${NC}"
        exit 1
    fi

    ark_val=$(env_value "ARK_API_KEY" "$ENV_PATH")
    if is_placeholder "$ark_val"; then
        echo -e "${YELLOW}Warning: ARK_API_KEY belum diisi — AI agent tidak akan berfungsi.${NC}"
        echo -e "   Dapatkan key: ${CYAN}https://console.byteplus.com/${NC}"
        echo -e "   Edit: ${CYAN}$ENV_FILE${NC}"
        if [[ -t 0 ]]; then
            read -p "   Lanjutkan tanpa ARK_API_KEY? (y/N) " -n 1 -r || true
            echo ""
            [[ $REPLY =~ ^[Yy]$ ]] || die "Dibatalkan."
        fi
        echo ""
    fi
fi

echo -e "${GREEN}OK Environment OK ($ENV_FILE)${NC}"

# ── Step 3: Validate compose file ──────────
echo -e "${CYAN}[3/6]${NC} Validating $COMPOSE_FILE..."
if ! compose_run --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" config --quiet; then
    die "$COMPOSE_FILE tidak valid — cek syntax atau variabel yang belum diisi."
fi
echo -e "${GREEN}OK $COMPOSE_FILE valid${NC}"

# ── Step 4: Build & Start ───────────────────
echo -e "${CYAN}[4/6]${NC} Building & starting services..."
BUILD_FLAG=""
if [[ "$DO_BUILD" == true ]]; then
    BUILD_FLAG="--build"
    echo -e "   ${YELLOW}Force rebuild enabled${NC}"
fi

compose_up() {
    # shellcheck disable=SC2086
    compose_run --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" up -d $BUILD_FLAG
}

if compose_up; then
    echo -e "${GREEN}OK Services started${NC}"
else
    echo -e "${YELLOW}Start gagal — kemungkinan sisa masalah AppArmor / network Docker stale.${NC}"
    echo -e "   ${YELLOW}Cleanup stack lalu retry...${NC}"
    compose_run --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" down --remove-orphans &>/dev/null || true
    force_kill_stack "$MODE"
    docker_run network rm "${PROJECT_NAME}_default" &>/dev/null || true
    if compose_up; then
        echo -e "${GREEN}OK Services started (setelah cleanup)${NC}"
    else
        die "Masih gagal start. Cek log: $COMPOSE_BIN -f $COMPOSE_FILE logs"
    fi
fi

# ── Step 5: Wait for healthy ────────────────
echo -e "${CYAN}[5/6]${NC} Waiting for services to be healthy..."
MAX_WAIT=90
WAITED=0

check_healthy() {
    local output bad=0 line state health
    output=$(compose_run --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" ps --format json 2>/dev/null || true)
    if [[ -z "$output" ]]; then
        # Fallback untuk compose V1: inspeksi container stack ini saja
        local cids cid st
        cids=$(stack_containers "$MODE")
        [[ -z "$cids" ]] && return 1
        for cid in $cids; do
            st=$(docker_run inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$cid" 2>/dev/null || true)
            [[ "$st" == running* ]] || return 1
            [[ "$st" == *starting* || "$st" == *unhealthy* ]] && return 1
        done
        return 0
    fi
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        state=$(printf '%s' "$line" | grep -o '"State":"[^"]*"' | head -1 | cut -d'"' -f4)
        health=$(printf '%s' "$line" | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4)
        [[ "$state" == "running" ]] || bad=1
        [[ "$health" == "starting" ]] && bad=1
    done <<< "$output"
    [[ "$bad" -eq 0 ]] && return 0
    return 1
}

while [[ "$WAITED" -lt "$MAX_WAIT" ]]; do
    if check_healthy; then
        break
    fi
    sleep 3
    WAITED=$((WAITED + 3))
    echo -ne "   ${YELLOW}Waiting... (${WAITED}s)${NC}\r"
done
echo ""

echo -e "   ${BOLD}Service Status:${NC}"
compose_run --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
    || docker_run ps --filter "$STACK_FILTER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# ── Step 6: Seed database (optional) ───────
if [[ "$DO_SEED" == true ]]; then
    echo -e "${CYAN}[6/6]${NC} Seeding database..."
    sleep 3
    if docker_run exec "$BACKEND_CONTAINER" python3 -m app.db.seed; then
        echo -e "${GREEN}OK Database seeded successfully${NC}"
    else
        echo -e "${YELLOW}Warning: Seed gagal — backend mungkin belum siap.${NC}"
        echo -e "   Coba manual: ${CYAN}${USE_SUDO:+$USE_SUDO }docker exec -it $BACKEND_CONTAINER python3 -m app.db.seed${NC}"
    fi
else
    echo -e "${CYAN}[6/6]${NC} Skipping seed (pakai --seed untuk seed database)"
fi

# ── Summary ─────────────────────────────────
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}WinMap is running!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Access Points:${NC}"
if [[ "$MODE" == "prod" ]]; then
    PORT=$(docker_run port rsa_prod_nginx 80 2>/dev/null | awk -F: 'NR==1{print $NF}')
    [[ -z "$PORT" ]] && PORT=8088
    HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    echo -e "  ${CYAN}App:${NC}       http://localhost:${PORT}"
    [[ -n "$HOST_IP" ]] && echo -e "  ${CYAN}LAN:${NC}       http://${HOST_IP}:${PORT}"
    echo -e "  ${CYAN}Health:${NC}    http://localhost:${PORT}/health"
    echo -e "  ${CYAN}Swagger:${NC}   disabled di production (nginx blokir /docs)"
else
    echo -e "  ${CYAN}Frontend:${NC}  http://localhost:3000"
    echo -e "  ${CYAN}Backend:${NC}   http://localhost:8000"
    echo -e "  ${CYAN}Swagger:${NC}   http://localhost:8000/docs"
fi
echo ""

if [[ "$ENV_GENERATED" == true ]]; then
    echo -e "${YELLOW}Note: password/secret di-generate dan disimpan di $ENV_FILE${NC}"
    echo -e "${YELLOW}      Isi ARK_API_KEY sebelum dipakai produksi.${NC}"
    echo ""
fi

echo -e "${BOLD}Management:${NC}"
if [[ "$MODE" == "prod" ]]; then
    echo -e "  ${CYAN}Stop:${NC}    ./stop.sh"
else
    echo -e "  ${CYAN}Stop:${NC}    ./stop.sh --dev"
fi
echo -e "  ${CYAN}Logs:${NC}    $COMPOSE_BIN --env-file $ENV_FILE -f $COMPOSE_FILE logs -f"
echo -e "  ${CYAN}Status:${NC}  $COMPOSE_BIN --env-file $ENV_FILE -f $COMPOSE_FILE ps"
echo ""
