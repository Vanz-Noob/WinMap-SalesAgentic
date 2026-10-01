#!/usr/bin/env bash
# ============================================
# WinMap — Sales Intelligence Platform
# Start Script (Ubuntu / Linux compatible)
# ============================================
# Usage:
#   ./start.sh              # Start production (default)
#   ./start.sh --dev        # Start development
#   ./start.sh --prod       # Start production
#   ./start.sh --seed       # Start + seed database
#   ./start.sh --build      # Force rebuild images
#   ./start.sh --help       # Show help
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
DO_SEED=false
DO_BUILD=false

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
        echo -e "${YELLOW}Note: Docker membutuhkan sudo. Menjalankan dengan sudo.${NC}"
        echo -e "${YELLOW}Tip: Tambahkan user ke group docker: ${CYAN}sudo usermod -aG docker \$USER${NC}"
        echo -e "${YELLOW}     Lalu logout dan login kembali.${NC}"
        echo ""
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
        --seed)
            DO_SEED=true
            shift
            ;;
        --build)
            DO_BUILD=true
            shift
            ;;
        --help|-h)
            echo ""
            echo -e "${BOLD}WinMap — Sales Intelligence Platform${NC}"
            echo ""
            echo -e "${BOLD}Usage:${NC}"
            echo -e "  ./start.sh [OPTIONS]"
            echo ""
            echo -e "${BOLD}Options:${NC}"
            echo -e "  ${CYAN}--dev${NC}       Start dalam mode development (docker-compose.yml)"
            echo -e "  ${CYAN}--prod${NC}      Start dalam mode production (docker-compose.prod.yml)"
            echo -e "  ${CYAN}--seed${NC}      Seed database setelah start (first run only)"
            echo -e "  ${CYAN}--build${NC}     Force rebuild Docker images"
            echo -e "  ${CYAN}--help${NC}      Show help ini"
            echo ""
            echo -e "${BOLD}Examples:${NC}"
            echo -e "  ${GREEN}./start.sh${NC}                    # Start production"
            echo -e "  ${GREEN}./start.sh --dev${NC}              # Start development"
            echo -e "  ${GREEN}./start.sh --prod --seed${NC}     # Start production + seed DB"
            echo -e "  ${GREEN}./start.sh --dev --build${NC}     # Start dev + rebuild images"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}"
            echo -e "Run ${CYAN}./start.sh --help${NC} untuk melihat opsi yang tersedia."
            exit 1
            ;;
    esac
done

# ── Select compose file ─────────────────────
if [[ "$MODE" == "dev" ]]; then
    COMPOSE_FILE="$DEV_COMPOSE"
    ENV_FILE=".env"
    BACKEND_CONTAINER="rsa_backend"
    echo -e "${BLUE}Starting WinMap — ${YELLOW}DEVELOPMENT${NC}"
else
    COMPOSE_FILE="$PROD_COMPOSE"
    ENV_FILE=".env.production"
    BACKEND_CONTAINER="rsa_prod_backend"
    echo -e "${BLUE}Starting WinMap — ${GREEN}PRODUCTION${NC}"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Step 1: Check Docker ────────────────────
echo -e "${CYAN}[1/6]${NC} Checking Docker..."
if ! command -v docker &>/dev/null; then
    echo -e "${RED}Error: Docker tidak ditemukan. Install Docker terlebih dahulu.${NC}"
    echo -e "  ${CYAN}curl -fsSL https://get.docker.com | sudo sh${NC}"
    exit 1
fi

detect_compose
detect_docker_sudo

echo -e "${GREEN}OK Docker is running${NC}"

# ── Step 2: Check env file ─────────────────
echo -e "${CYAN}[2/6]${NC} Checking environment..."
ENV_PATH="$SCRIPT_DIR/$ENV_FILE"

if [[ ! -f "$ENV_PATH" ]]; then
    echo -e "${YELLOW}Warning: $ENV_FILE tidak ditemukan.${NC}"
    echo -e "   Copy dari template: ${CYAN}cp .env.example $ENV_FILE${NC}"
    echo -e "   Lalu edit dan isi: ${CYAN}ARK_API_KEY${NC}, ${CYAN}POSTGRES_PASSWORD${NC}, ${CYAN}JWT_SECRET${NC}"
    echo ""
    read -p "   Lanjutkan dengan default values? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Dibatalkan.${NC}"
        exit 1
    fi
else
    # Load env file
    set -a
    # shellcheck source=/dev/null
    source "$ENV_PATH"
    set +a

    # Validate required vars
    MISSING=()
    if [[ -z "${ARK_API_KEY:-}" ]] || [[ "$ARK_API_KEY" == "your_production_api_key" ]] || [[ "$ARK_API_KEY" == "your_api_key_here" ]]; then
        MISSING+=("ARK_API_KEY")
    fi
    if [[ "$MODE" == "prod" ]]; then
        if [[ -z "${POSTGRES_PASSWORD:-}" ]] || [[ "$POSTGRES_PASSWORD" == "change_this_to_secure_password" ]]; then
            MISSING+=("POSTGRES_PASSWORD")
        fi
        if [[ -z "${JWT_SECRET:-}" ]] || [[ "$JWT_SECRET" == "change_this_to_secure_jwt_secret_min_32_chars" ]]; then
            MISSING+=("JWT_SECRET")
        fi
    fi

    if [[ ${#MISSING[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Warning: Environment variables belum diisi:${NC}"
        for var in "${MISSING[@]}"; do
            echo -e "   ${RED}- $var${NC}"
        done
        echo ""
        echo -e "   Edit ${CYAN}$ENV_FILE${NC} dan isi nilai yang benar."
        echo ""
        read -p "   Lanjutkan dengan default values? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Dibatalkan.${NC}"
            exit 1
        fi
    fi
fi
echo -e "${GREEN}OK Environment OK${NC}"

# ── Step 3: Validate compose file ──────────
echo -e "${CYAN}[3/6]${NC} Validating $COMPOSE_FILE..."
if ! "${COMPOSE_CMD[@]}" -f "$SCRIPT_DIR/$COMPOSE_FILE" config --quiet 2>/dev/null; then
    echo -e "${RED}Error: $COMPOSE_FILE tidak valid! Cek syntax.${NC}"
    "${COMPOSE_CMD[@]}" -f "$SCRIPT_DIR/$COMPOSE_FILE" config --quiet
    exit 1
fi
echo -e "${GREEN}OK $COMPOSE_FILE valid${NC}"

# ── Step 4: Build & Start ───────────────────
echo -e "${CYAN}[4/6]${NC} Building & starting services..."

BUILD_FLAG=""
if [[ "$DO_BUILD" == true ]]; then
    BUILD_FLAG="--build"
    echo -e "   ${YELLOW}Force rebuild enabled${NC}"
fi

"${COMPOSE_CMD[@]}" -f "$SCRIPT_DIR/$COMPOSE_FILE" up -d $BUILD_FLAG 2>&1 | while read -r line; do
    echo "   $line"
done

echo -e "${GREEN}OK Services started${NC}"

# ── Step 5: Wait for healthy ────────────────
echo -e "${CYAN}[5/6]${NC} Waiting for services to be healthy..."

MAX_WAIT=90
WAITED=0

check_healthy() {
    local output
    output=$("${COMPOSE_CMD[@]}" -f "$SCRIPT_DIR/$COMPOSE_FILE" ps --format json 2>/dev/null || true)
    
    # If no output, services might not support json format (older docker-compose V1)
    if [[ -z "$output" ]]; then
        # Fallback: check if containers are running via docker ps
        local running
        running=$(docker ps --filter "name=rsa" --format '{{.Names}} {{.Status}}' 2>/dev/null || true)
        if [[ -z "$running" ]]; then
            return 1
        fi
        # Check if any container has "starting" or is unhealthy
        if echo "$running" | grep -qi "starting\|unhealthy\|restarting"; then
            return 1
        fi
        return 0
    fi
    
    # Parse JSON output (pure bash, no python3 dependency)
    local all_healthy=true
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        # Extract State and Health from JSON using grep/sed
        local state health service
        state=$(echo "$line" | grep -o '"State":"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || echo "")
        health=$(echo "$line" | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || echo "")
        service=$(echo "$line" | grep -o '"Service":"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || echo "?")
        
        if [[ "$state" != "running" ]]; then
            echo -e "   ${YELLOW}Waiting: ${service} state=${state}${NC}"
            all_healthy=false
        elif [[ "$health" == "starting" ]]; then
            echo -e "   ${YELLOW}Waiting: ${service} health starting...${NC}"
            all_healthy=false
        fi
    done <<< "$output"
    
    if [[ "$all_healthy" == true ]]; then
        return 0
    else
        return 1
    fi
}

while [[ $WAITED -lt $MAX_WAIT ]]; do
    if check_healthy; then
        break
    fi
    sleep 3
    WAITED=$((WAITED + 3))
    echo -ne "   ${YELLOW}Waiting... (${WAITED}s)${NC}\r"
done

echo ""

# Final status check
echo ""
echo -e "   ${BOLD}Service Status:${NC}"
"${COMPOSE_CMD[@]}" -f "$SCRIPT_DIR/$COMPOSE_FILE" ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
    docker ps --filter "name=rsa" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
echo ""

# ── Step 6: Seed database (optional) ───────
if [[ "$DO_SEED" == true ]]; then
    echo -e "${CYAN}[6/6]${NC} Seeding database..."
    sleep 3  # Give backend a moment to fully initialize

    if docker exec "$BACKEND_CONTAINER" python3 -m app.db.seed 2>/dev/null; then
        echo -e "${GREEN}OK Database seeded successfully${NC}"
    else
        echo -e "${YELLOW}Warning: Seed gagal — backend mungkin belum siap.${NC}"
        echo -e "   Coba manual: ${CYAN}docker exec -it $BACKEND_CONTAINER python3 -m app.db.seed${NC}"
    fi
else
    echo -e "${CYAN}[6/6]${NC} Skipping seed (use --seed to seed database)"
fi

# ── Summary ─────────────────────────────────
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}WinMap is running!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Access Points:${NC}"
echo -e "  ${CYAN}Frontend:${NC}  http://localhost:3000"
echo -e "  ${CYAN}Backend:${NC}   http://localhost:8000"
echo -e "  ${CYAN}Swagger:${NC}   http://localhost:8000/docs"
if [[ "$MODE" == "prod" ]]; then
    echo -e "  ${CYAN}Nginx:${NC}     http://localhost"
fi
echo ""

if [[ "$MODE" == "prod" ]]; then
    echo -e "${BOLD}Management:${NC}"
    echo -e "  ${CYAN}Stop:${NC}    ./stop.sh"
    echo -e "  ${CYAN}Logs:${NC}    ${COMPOSE_CMD[*]} -f $COMPOSE_FILE logs -f"
    echo -e "  ${CYAN}Status:${NC}  ${COMPOSE_CMD[*]} -f $COMPOSE_FILE ps"
    echo ""
    if [[ "$DO_SEED" != true ]]; then
        echo -e "${YELLOW}Tip:${NC} Jalankan ${CYAN}./start.sh --prod --seed${NC} untuk first run."
        echo ""
    fi
else
    echo -e "${BOLD}Management:${NC}"
    echo -e "  ${CYAN}Stop:${NC}    ./stop.sh --dev"
    echo -e "  ${CYAN}Logs:${NC}    ${COMPOSE_CMD[*]} -f $COMPOSE_FILE logs -f backend"
    echo ""
fi
