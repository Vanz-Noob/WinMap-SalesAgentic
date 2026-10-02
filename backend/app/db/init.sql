-- init.sql (dijalankan otomatis saat container pertama kali start)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Accounts (perusahaan customer)
CREATE TABLE IF NOT EXISTS accounts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    industry    VARCHAR(100),
    website     VARCHAR(255),
    size        VARCHAR(50),
    region      VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Contacts (orang di customer)
CREATE TABLE IF NOT EXISTS contacts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  UUID REFERENCES accounts(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(50),
    role        VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Stages (tahapan pipeline)
CREATE TABLE IF NOT EXISTS stages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    "order"     INT NOT NULL,
    probability FLOAT DEFAULT 0.0,
    is_closed   BOOLEAN DEFAULT FALSE,
    is_won      BOOLEAN DEFAULT FALSE
);

-- Seed default stages
INSERT INTO stages (name, "order", probability, is_closed, is_won) VALUES
    ('Prospecting', 1, 0.10, FALSE, FALSE),
    ('Qualification', 2, 0.25, FALSE, FALSE),
    ('Proposal', 3, 0.50, FALSE, FALSE),
    ('Negotiation', 4, 0.70, FALSE, FALSE),
    ('Closed Won', 5, 1.00, TRUE, TRUE),
    ('Closed Lost', 6, 0.00, TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- Users (sales reps)
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role          VARCHAR(50) DEFAULT 'sales_rep',
    quota         DECIMAL(15,2) DEFAULT 0,
    is_active     BOOLEAN DEFAULT TRUE,
    is_superuser  BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Opportunities
CREATE TABLE IF NOT EXISTS opportunities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID REFERENCES accounts(id),
    contact_id      UUID REFERENCES contacts(id),
    name            VARCHAR(255) NOT NULL,
    stage_id        UUID REFERENCES stages(id),
    value           DECIMAL(15,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'IDR',
    close_date      DATE,
    win_probability FLOAT DEFAULT 0.0,
    owner_id        UUID REFERENCES users(id),
    presales_id     UUID REFERENCES users(id),
    source          VARCHAR(50),
    ai_metadata     JSONB,
    embedding       vector(1024),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Activities (log aktivitas sales)
CREATE TABLE IF NOT EXISTS activities (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opp_id      UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    description TEXT,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Tasks (follow-up tasks)
CREATE TABLE IF NOT EXISTS tasks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opp_id      UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    due_date    DATE,
    status      VARCHAR(20) DEFAULT 'open',
    assigned_to UUID REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Agent Logs (audit trail AI agent)
CREATE TABLE IF NOT EXISTS agent_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type  VARCHAR(50) NOT NULL,
    action      VARCHAR(100) NOT NULL,
    input       JSONB,
    output      JSONB,
    token_usage INT DEFAULT 0,
    status      VARCHAR(20) DEFAULT 'success',
    timestamp   TIMESTAMP DEFAULT NOW()
);

-- Presales KPIs (Presales KPI Tracking)
CREATE TABLE IF NOT EXISTS presales_kpis (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    category    VARCHAR(50) NOT NULL,
    item_name   VARCHAR(255) NOT NULL,
    description TEXT,
    target      DECIMAL(15,2) DEFAULT 0,
    actual      DECIMAL(15,2) DEFAULT 0,
    unit        VARCHAR(50) DEFAULT 'count',
    quarter     VARCHAR(10) DEFAULT 'Q3',
    year        INT DEFAULT 2026,
    status      VARCHAR(20) DEFAULT 'in_progress',
    notes       TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_presales_kpis_user ON presales_kpis(user_id);
CREATE INDEX IF NOT EXISTS idx_presales_kpis_category ON presales_kpis(category, quarter, year);
CREATE INDEX IF NOT EXISTS idx_opp_stage ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opp_owner ON opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opp_presales ON opportunities(presales_id);

-- Add presales_id column if not exists (for existing databases)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'presales_id') THEN
        ALTER TABLE opportunities ADD COLUMN presales_id UUID REFERENCES users(id);
    END IF;
END $$;

-- Add password_hash column if not exists (for existing databases)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
    END IF;
END $$;

-- Add is_active column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Add is_superuser column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_superuser') THEN
        ALTER TABLE users ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_opp_close_date ON opportunities(close_date);
CREATE INDEX IF NOT EXISTS idx_opp_embedding ON opportunities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_activities_opp ON activities(opp_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_type ON agent_logs(agent_type, timestamp);

-- ============================================
-- MATERIALIZED VIEWS (untuk Tableau)
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_funnel_summary AS
SELECT
    s.name AS stage_name,
    s."order" AS stage_order,
    COUNT(o.id) AS deal_count,
    COALESCE(SUM(o.value), 0) AS total_value,
    COALESCE(AVG(o.win_probability), 0) AS avg_win_prob,
    DATE_TRUNC('month', o.created_at) AS month
FROM stages s
LEFT JOIN opportunities o ON o.stage_id = s.id
GROUP BY s.name, s."order", DATE_TRUNC('month', o.created_at);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_forecast_data AS
SELECT
    DATE_TRUNC('month', o.close_date) AS close_month,
    COALESCE(SUM(o.value * o.win_probability), 0) AS weighted_pipeline,
    COALESCE(SUM(o.value), 0) AS unweighted_pipeline,
    COUNT(o.id) AS deal_count,
    COALESCE(AVG(o.win_probability), 0) AS avg_probability
FROM opportunities o
JOIN stages s ON o.stage_id = s.id
WHERE s.is_closed = FALSE
GROUP BY DATE_TRUNC('month', o.close_date)
ORDER BY close_month;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rep_performance AS
SELECT
    u.id AS rep_id,
    u.name AS rep_name,
    COUNT(o.id) AS total_deals,
    COUNT(CASE WHEN s.is_won THEN 1 END) AS won_deals,
    COALESCE(SUM(CASE WHEN s.is_won THEN o.value ELSE 0 END), 0) AS won_revenue,
    COALESCE(AVG(o.value), 0) AS avg_deal_size,
    u.quota AS quota
FROM users u
LEFT JOIN opportunities o ON o.owner_id = u.id
LEFT JOIN stages s ON o.stage_id = s.id
WHERE u.role = 'sales_rep'
GROUP BY u.id, u.name, u.quota;
