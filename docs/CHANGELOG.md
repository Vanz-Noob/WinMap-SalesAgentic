# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/), dates in YYYY-MM-DD.

---

## [1.0.0] - 2026-09-28

### Added — Phase 1: Backend Core

- FastAPI application with async SQLAlchemy 2.0
- PostgreSQL 16 + pgvector extension
- 8 database models: Account, Contact, Stage, User, Opportunity, Activity, Task, AgentLog
- Database init.sql with tables, indexes, materialized views
- Seed script with dummy data (4 users, 8 accounts, 8 contacts, 20 opportunities, 45 activities, 10 tasks)
- CRUD API for opportunities, activities, tasks, accounts, contacts, stages
- Dashboard API: summary, forecast, rep-performance
- Docker Compose for development (postgres, redis, backend, celery_worker, celery_beat, frontend)
- Dockerfile for backend (python:3.11-slim)

### Added — Phase 2: AI Agents

- BytePlus ModelArk LLM client (OpenAI-compatible API)
- Opportunity Agent: NER extraction (skylark-lite) + BANT scoring (skylark-pro) + auto-create
- Pipeline Agent: deal evaluation + win probability + next best action + risk flags
- Insight Agent: daily briefing + revenue forecast + anomaly detection
- Celery background tasks: hourly pipeline scan, daily briefing
- pgvector integration for opportunity embeddings (1024-dim)
- Agent log audit trail (all LLM executions logged)
- Agent trigger API endpoints

### Added — Phase 3: Frontend

- Next.js 14 (App Router) with TypeScript
- Dashboard page: 4 stat cards, bar chart funnel, pie chart, recent opportunities table
- Pipeline Kanban: drag & drop with optimistic update
- Opportunities list with win probability bars and source badges
- Opportunity detail page with inline editing and activity timeline
- AI Agents page: trigger all 3 agents with result display
- Analytics page: bar chart, line chart forecast, Tableau iframe embed
- Sidebar navigation with active link highlighting
- Error boundary (error.tsx)
- API client wrapper (apiFetch, apiPost, apiPatch, apiDelete)
- Multi-stage Dockerfile (builder + runner)
- Tailwind CSS with custom color scheme
- Recharts for data visualization

### Added — Phase 4: Deployment & Testing

- docker-compose.prod.yml: 7 production services
- Nginx reverse proxy with SSL, security headers, gzip
- start.sh: startup script with --dev, --prod, --seed, --build options
- stop.sh: shutdown script with --clean, --all options
- .dockerignore files (root, backend, frontend)
- .env.production template
- CI/CD pipeline (GitHub Actions): backend-test, frontend-build, docker-build
- E2E test script (9 test cases, all passing)
- Pytest unit tests
- Comprehensive README.md with 13 sections
- Documentation: API reference, architecture, database schema, AI agents, user manual, deployment guide

### Fixed — Bug Review (Phase 1-3)

- CRITICAL: agents router not registered in main.py
- HIGH: Celery event loop conflict (NullPool + fresh event loop per task)
- HIGH: seed.py logic error (existing_opps vs existing_acts)
- HIGH: Frontend Dockerfile running dev server in production
- HIGH: Weighted forecast logic error in dashboard
- HIGH: Missing error handling in frontend Promise.all calls
- MEDIUM: Float to Numeric(15,2) for monetary fields
- MEDIUM: Materialized views never refreshed
- MEDIUM: LLM error handling missing
- MEDIUM: win_probability not validated (0.0-1.0 clamping)
- MEDIUM: SQLAlchemy `== False` anti-pattern replaced with `.is_(False)`
- MEDIUM: Dynamic Tailwind classes not working with JIT
- MEDIUM: Firefox drag & drop compatibility
- MEDIUM: Sidebar active link matching
- LOW: Pydantic v2 Config replaced with model_config
- LOW: Docker compose deprecated version field removed
- LOW: Unused imports cleaned up
- LOW: Missing error boundary in frontend
