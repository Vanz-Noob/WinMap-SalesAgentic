"""
Unit tests untuk RenRND Sales Agentic AI Backend.
Run: cd backend && python -m pytest tests/ -v
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health():
    """Health endpoint should return 200."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/health")
    assert r.status_code == 200
        assert r.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_root():
    """Root endpoint should return app info."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/")
    assert r.status_code == 200
    data = r.json()
    assert "app" in data
    assert "status" in data


@pytest.mark.asyncio
async def test_stages():
    """Stages endpoint should return 6 stages."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/stages")
    assert r.status_code == 200
    stages = r.json()
    assert len(stages) == 6    "Should have 6 stages"


@pytest.mark.asyncio
async def test_opportunities_list():
    """Opportunities list should return a list."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/opportunities?limit=3")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_dashboard_summary():
    """Dashboard summary should return stage metrics."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/dashboard/summary")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
