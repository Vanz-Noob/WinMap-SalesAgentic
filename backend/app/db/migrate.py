"""Database migration script — safe to run multiple times (idempotent).

Runs automatically before backend starts in production.
Adds is_active and is_superuser columns to users table if missing,
and ensures a superadmin user exists.
"""
import asyncio
import os
import sys

from sqlalchemy import text

from app.db.database import engine


async def run_migrations():
    """Run all migrations sequentially."""
    print("🔄 Starting database migration...")

    async with engine.begin() as conn:
        # ── Migration 1: Add is_active column ──
        result = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'is_active'
        """))
        if not result.fetchone():
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE"
            ))
            print("  ✅ Added column: users.is_active")
        else:
            print("  ✓ Column already exists: users.is_active")

        # ── Migration 2: Add is_superuser column ──
        result = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'is_superuser'
        """))
        if not result.fetchone():
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE"
            ))
            print("  ✅ Added column: users.is_superuser")
        else:
            print("  ✓ Column already exists: users.is_superuser")

        # ── Migration 3: Set existing NULL is_active to TRUE ──
        await conn.execute(text(
            "UPDATE users SET is_active = TRUE WHERE is_active IS NULL"
        ))
        print("  ✓ Ensured all users have is_active set")

        # ── Migration 4: Ensure superadmin user exists ──
        result = await conn.execute(text("""
            SELECT id FROM users WHERE is_superuser = TRUE OR role = 'superadmin' LIMIT 1
        """))
        if result.fetchone():
            print("  ✓ Superadmin user already exists")
        else:
            # Check if admin@winmap.id exists (upgrade to superadmin)
            result = await conn.execute(text("""
                SELECT id, password_hash FROM users WHERE email = :email
            """), {"email": "admin@winmap.id"})

            existing = result.fetchone()
            if existing:
                # Upgrade existing user to superadmin
                await conn.execute(text("""
                    UPDATE users
                    SET is_superuser = TRUE, role = 'superadmin', is_active = TRUE
                    WHERE email = :email
                """), {"email": "admin@winmap.id"})
                print("  ✅ Upgraded admin@winmap.id to superadmin")
            else:
                # Create new superadmin user — generate strong random password if env var not set
                import bcrypt
                import secrets as _secrets
                import string as _string

                password = os.environ.get("SUPERADMIN_PASSWORD")
                if not password:
                    # Generate a secure random password (24 chars, mixed case + digits)
                    alphabet = _string.ascii_letters + _string.digits
                    password = "".join(_secrets.choice(alphabet) for _ in range(24))
                    print(f"\n{'='*60}")
                    print("  ⚠️  SUPERADMIN PASSWORD (save this — shown only once):")
                    print(f"     {password}")
                    print(f"{'='*60}\n")

                hashed = bcrypt.hashpw(
                    password.encode("utf-8"), bcrypt.gensalt()
                ).decode("utf-8")

                await conn.execute(text("""
                    INSERT INTO users (id, name, email, password_hash, role, quota, is_active, is_superuser)
                    VALUES (gen_random_uuid(), 'Super Admin', :email, :hash, 'superadmin', 0, TRUE, TRUE)
                """), {"email": "admin@winmap.id", "hash": hashed})
                print("  ✅ Created superadmin user: admin@winmap.id")

        # ── Migration 5: Presales Work Tracking table ──
        result = await conn.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_name = 'presales_work'
        """))
        if not result.fetchone():
            await conn.execute(text("""
                CREATE TABLE presales_work (
                    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
                    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
                    title          VARCHAR(255) NOT NULL,
                    description    TEXT,
                    work_type      VARCHAR(50) NOT NULL,
                    priority       VARCHAR(20) DEFAULT 'medium',
                    status         VARCHAR(20) DEFAULT 'todo',
                    outcome        VARCHAR(20) DEFAULT 'pending',
                    outcome_notes  TEXT,
                    due_date       DATE,
                    completed_at   TIMESTAMP,
                    created_at     TIMESTAMP DEFAULT NOW(),
                    updated_at     TIMESTAMP DEFAULT NOW()
                )
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_presales_work_user ON presales_work(user_id)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_presales_work_type ON presales_work(work_type, status, outcome)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_presales_work_opp ON presales_work(opportunity_id)"))
            print("  ✅ Created table: presales_work")
        else:
            print("  ✓ Table already exists: presales_work")

    await engine.dispose()
    print("✅ Migration complete.\n")


if __name__ == "__main__":
    try:
        asyncio.run(run_migrations())
    except Exception as e:
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        sys.exit(1)
