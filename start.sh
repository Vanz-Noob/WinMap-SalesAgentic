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
COMPOSE_CMD=()
DOCKER_PREFIX=()

# ── Generate random string ──────────────────
gen_random() {
    local length="${1:-32}"
    # Try /dev/urandom first (available on all Linux), fallback to openssl
    if [[ -r /dev/urandom ]]; then
        head -c 256 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c "$length"
    elif command -v openssl &>/dev/null; then
        openssl rand -base64 "$((length * 2))" 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c "$length"
    else
        # Fallback: use date + random
        date +%s%N | sha256sum | base64 | head -c "$length"
    fi
}

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
    else
        echo -e "${RED}Error: Tidak bisa akses Docker daemon.${NC}"
        echo -e "Start Docker: ${CYAN}sudo systemctl start docker${NC}"
        exit 1
    fi
}

# ── Build full compose command with sudo + env-file ──
build_compose_cmd() {
    local env_file="$1"
    if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
        COMPOSE_CMD=("${DOCKER_PREFIX[@]}" docker compose)
        # For V1 fallback
        if ! sudo docker compose version &>/dev/null 2>&1; then
            COMPOSE_CMD=("${DOCKER_PREFIX[@]}" docker-compose)
        fi
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

# ── Step 2: Check & prepare env file ────────
echo -e "${CYAN}[2/6]${NC} Checking environment..."
ENV_PATH="$SCRIPT_DIR/$ENV_FILE"
ENV_GENERATED=false

# Function: generate missing env vars and write to env file
ensure_env_var() {
    local var_name="$1"
    local var_length="${2:-32}"
    local file_path="$3"

    # Check if var exists and is not a placeholder
    local current_value
    current_value=$(grep -E "^${var_name}=" "$file_path" 2>/dev/null | cut -d'=' -f2- || echo "")

    if [[ -z "$current_value" ]] || [[ "$current_value" == *"your_"* ]] || [[ "$current_value" == *"change"* ]] || [[ "$current_value" == *"placeholder"* ]]; then
        local new_value
        new_value=$(gen_random "$var_length")
        if grep -q "^${var_name}=" "$file_path" 2>/dev/null; then
            # Update existing line
            sed -i "s|^${var_name}=.*|${var_name}=${new_value}|" "$file_path"
        else
            # Append new line
            echo "${var_name}=${new_value}" >> "$file_path"
        fi
        echo -e "   ${GREEN}Generated:${NC} ${var_name} (random, ${var_length} chars)"
        ENV_GENERATED=true
    fi
}

if [[ ! -f "$ENV_PATH" ]]; then
    echo -e "${YELLOW}Warning: $ENV_FILE tidak ditemukan.${NC}"
    echo -e "   Membuat file baru dengan generated secure values...${NC}"
    echo ""

    # Create env file from template if .env.example exists
    if [[ -f "$SCRIPT_DIR/.env.example" ]]; then
        cp "$SCRIPT_DIR/.env.example" "$ENV_PATH"
    else
        # Create minimal env file
        cat > "$ENV_PATH" << 'EOF'
# WinMap — Auto-generated environment file
# Edit this file to customize your deployment

# BytePlus ModelArk
ARK_API_KEY=

# Database
POSTGRES_USER=rsa_admin
POSTGRES_PASSWORD=
POSTGRES_DB=rsa_sales

# Redis
REDIS_URL=redis://redis:6379/0

# App
JWT_SECRET=
DEBUG=false
EOF
    fi

    # Generate secure random values for required vars
    ensure_env_var "POSTGRES_PASSWORD" 32 "$ENV_PATH"
    ensure_env_var "JWT_SECRET" 48 "$ENV_PATH"

    echo ""
    echo -e "   ${GREEN}Created:${NC} $ENV_FILE"
    echo -e "   ${YELLOW}Edit file ini untuk mengisi ARK_API_KEY dan custom password.${NC}"
    echo -e "   File ini sudah di-gitignore dan tidak akan ter-commit."
    echo ""
else
    # Env file exists — check for missing/placeholder values
    MISSING=()

    # Check ARK_API_KEY
    ARK_VAL=$(grep -E "^ARK_API_KEY=" "$ENV_PATH" 2>/dev/null | cut -d'=' -f2- || echo "")
    if [[ -z "$ARK_VAL" ]] || [[ "$ARK_VAL" == *"your_"* ]] || [[ "$ARK_VAL" == *"change"* ]]; then
        MISSING+=("ARK_API_KEY")
    fi

    # Check POSTGRES_PASSWORD
    PG_PASS=$(grep -E "^POSTGRES_PASSWORD=" "$ENV_PATH" 2>/dev/null | cut -d'=' -f2- || echo "")
    if [[ -z "$PG_PASS" ]] || [[ "$PG_PASS" == *"your_"* ]] || [[ "$PG_PASS" == *"change"* ]]; then
        MISSING+=("POSTGRES_PASSWORD")
    fi

    # Check JWT_SECRET
    JWT_VAL=$(grep -E "^JWT_SECRET=" "$ENV_PATH" 2>/dev/null | cut -d'=' -f2- || echo "")
    if [[ -z "$JWT_VAL" ]] || [[ "$JWT_VAL" == *"your_"* ]] || [[ "$JWT_VAL" == *"change"* ]]; then
        MISSING+=("JWT_SECRET")
    fi

    if [[ ${#MISSING[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Warning: Variable berikut belum diisi:${NC}"
        for var in "${MISSING[@]}"; do
            echo -e "   ${RED}- $var${NC}"
        done
        echo ""

        # Auto-generate for security vars (POSTGRES_PASSWORD, JWT_SECRET)
        for var in "${MISSING[@]}"; do
            if [[ "$var" == "POSTGRES_PASSWORD" ]]; then
                ensure_env_var "POSTGRES_PASSWORD" 32 "$ENV_PATH"
            elif [[ "$var" == "JWT_SECRET" ]]; then
                ensure_env_var "JWT_SECRET" 48 "$ENV_PATH"
            fi
        done

        # ARK_API_KEY can't be auto-generated — warn user
        for var in "${MISSING[@]}"; do
            if [[ "$var" == "ARK_API_KEY" ]]; then
                echo -e "   ${YELLOW}ARK_API_KEY tidak bisa di-generate. AI agents tidak akan berfungsi.${NC}"
                echo -e "   Dapatkan API key dari: ${CYAN}https://console.byteplus.com/${NC}"
                echo -e "   Lalu edit: ${CYAN}$ENV_FILE${NC}"
                echo ""
                read -p "   Lanjutkan tanpa ARK_API_KEY? (y/N) " -n 1 -r
                echo ""
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    echo -e "${RED}Dibatalkan.${NC}"
                    exit 1
                fi
            fi
        done
    fi
fi

echo -e "${GREEN}OK Environment OK${NC}"

# ── Step 3: Validate compose file ──────────
echo -e "${CYAN}[3/6]${NC} Validating $COMPOSE_FILE..."

# Build the compose command with sudo prefix and env-file
COMPOSE_BASE=()
if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
    COMPOSE_BASE=("${DOCKER_PREFIX[@]}" "${COMPOSE_CMD[@]}")
else
    COMPOSE_BASE=("${COMPOSE_CMD[@]}")
fi

# Use --env-file so docker-compose reads our env file directly
# This works even under sudo (no shell variable passing needed)
if ! "${COMPOSE_BASE[@]}" --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" config --quiet 2>/dev/null; then
    echo -e "${RED}Error: $COMPOSE_FILE tidak valid! Cek syntax.${NC}"
    "${COMPOSE_BASE[@]}" --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" config --quiet
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

"${COMPOSE_BASE[@]}" --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" up -d $BUILD_FLAG 2>&1 | while read -r line; do
    echo "   $line"
done

echo -e "${GREEN}OK Services started${NC}"

# ── Step 5: Wait for healthy ────────────────
echo -e "${CYAN}[5/6]${NC} Waiting for services to be healthy..."

MAX_WAIT=90
WAITED=0

check_healthy() {
    local output
    output=$("${COMPOSE_BASE[@]}" --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" ps --format json 2>/dev/null || true)

    # If no output, services might not support json format (older docker-compose V1)
    if [[ -z "$output" ]]; then
        # Fallback: check if containers are running via docker ps
        local running
        if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
            running=$(sudo docker ps --filter "name=rsa" --format '{{.Names}} {{.Status}}' 2>/dev/null || true)
        else
            running=$(docker ps --filter "name=rsa" --format '{{.Names}} {{.Status}}' 2>/dev/null || true)
        fi
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
"${COMPOSE_BASE[@]}" --env-file "$ENV_PATH" -f "$SCRIPT_DIR/$COMPOSE_FILE" ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
    { [[ ${#DOCKER_PREFIX[@]} -gt 0 ]] && sudo docker ps --filter "name=rsa" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null; } || \
    docker ps --filter "name=rsa" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
echo ""

# ── Step 6: Seed database (optional) ───────
if [[ "$DO_SEED" == true ]]; then
    echo -e "${CYAN}[6/6]${NC} Seeding database..."
    sleep 3  # Give backend a moment to fully initialize

    if [[ ${#DOCKER_PREFIX[@]} -gt 0 ]]; then
        if sudo docker exec "$BACKEND_CONTAINER" python3 -m app.db.seed 2>/dev/null; then
            echo -e "${GREEN}OK Database seeded successfully${NC}"
        else
            echo -e "${YELLOW}Warning: Seed gagal — backend mungkin belum siap.${NC}"
            echo -e "   Coba manual: ${CYAN}sudo docker exec -it $BACKEND_CONTAINER python3 -m app.db.seed${NC}"
        fi
    else
        if docker exec "$BACKEND_CONTAINER" python3 -m app.db.seed 2>/dev/null; then
            echo -e "${GREEN}OK Database seeded successfully${NC}"
        else
            echo -e "${YELLOW}Warning: Seed gagal — backend mungkin belum siap.${NC}"
            echo -e "   Coba manual: ${CYAN}docker exec -it $BACKEND_CONTAINER python3 -m app.db.seed${NC}"
        fi
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
if [[ "$MODE" == "prod" ]]; then
    echo -e "  ${CYAN}Frontend:${NC}  http://localhost"
    echo -e "  ${CYAN}Backend:${NC}   http://localhost:8000"
    echo -e "  ${CYAN}Swagger:${NC}   http://localhost:8000/docs"
else
    echo -e "  ${CYAN}Frontend:${NC}  http://localhost:3000"
    echo -e "  ${CYAN}Backend:${NC}   http://localhost:8000"
    echo -e "  ${CYAN}Swagger:${NC}   http://localhost:8000/docs"
fi
echo ""

if [[ "$ENV_GENERATED" == true ]]; then
    echo -e "${YELLOW}Note: Password/secret di-generate otomatis dan disimpan di:${NC}"
    echo -e "  ${CYAN}$ENV_FILE${NC}"
    echo -e "${YELLOW}Edit file tersebut untuk custom password atau ARK_API_KEY.${NC}"
    echo ""
fi

if [[ "$MODE" == "prod" ]]; then
    echo -e "${BOLD}Management:${NC}"
    echo -e "  ${CYAN}Stop:${NC}    ./stop.sh"
    echo -e "  ${CYAN}Logs:${NC}    ${COMPOSE_BASE[*]} --env-file $ENV_FILE -f $COMPOSE_FILE logs -f"
    echo -e "  ${CYAN}Status:${NC}  ${COMPOSE_BASE[*]} --env-file $ENV_FILE -f $COMPOSE_FILE ps"
    echo ""
    if [[ "$DO_SEED" != true ]]; then
        echo -e "${YELLOW}Tip:${NC} Jalankan ${CYAN}./start.sh --prod --seed${NC} untuk first run."
        echo ""
    fi
else
    echo -e "${BOLD}Management:${NC}"
    echo -e "  ${CYAN}Stop:${NC}    ./stop.sh --dev"
    echo -e "  ${CYAN}Logs:${NC}    ${COMPOSE_BASE[*]} --env-file $ENV_FILE -f $COMPOSE_FILE logs -f backend"
    echo ""
fi
