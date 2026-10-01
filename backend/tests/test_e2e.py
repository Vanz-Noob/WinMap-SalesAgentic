"""
E2E Test Script untuk RenRND Sales Agentic AI.
Test flow: Health -> Stages -> Create Opportunity -> Get -> Update -> Dashboard -> Pipeline -> Cleanup

Usage:
    cd backend
    python3 tests/test_e2e.py

Prasyarat: backend running di http://localhost:8000
"""
import httpx
import sys
import json

BASE_URL = "http://localhost:8000/api/v1"

passed = 0
failed = 0


def test(name, func):
    """Run a single test and track results."""
    global passed, failed
    try:
        result = func()
        if result is not None:
            passed += 1
        else:
            failed += 1
            print(f"  FAIL: {name}: returned None")
    except Exception as e:
        failed += 1
        print(f"  ERROR: {name}: {e}")


# --- Health Check ---
def test_health():
    r = httpx.get(f"{BASE_URL.replace('/api/v1', '')}/health")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert data["status"] == "healthy", f"Expected 'healthy', got {data['status']}"
    print(f"  OK: Health = {data}")
    return True


# --- Stages ---
def test_stages():
    r = httpx.get(f"{BASE_URL}/stages")
    assert r.status_code == 200
    stages = r.json()
    assert len(stages) >= 6, f"Expected 6 stages, got {len(stages)}"
    names = [s["name"] for s in stages]
    expected = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]
    for name in expected:
        assert name in names, f"Stage '{name}' not found"
    print(f"  OK: {len(stages)} stages loaded")
    return True


# --- Create Opportunity ---
def test_create_opportunity():
    payload = {
        "name": "E2E Test - CRM System",
        "value": 100000000,
        "currency": "IDR",
        "source": "e2e_test",
    }
    r = httpx.post(f"{BASE_URL}/opportunities", json=payload)
    assert r.status_code == 201, f"Create failed: {r.status_code} - {r.text}"
    opp = r.json()
    assert "id" in opp, "No ID returned"
    assert opp["name"] == "E2E Test - CRM System"
    print(f"  OK: Created {opp['name']} (id={opp['id'][:8]}...)")
    # Save ID for next tests
    test_create_opportunity.opp_id = opp["id"]
    return opp["id"]


# --- Get Opportunity ---
def test_get_opportunity():
    opp_id = test_create_opportunity.opp_id
    r = httpx.get(f"{BASE_URL}/opportunities/{opp_id}")
    assert r.status_code == 200
    opp = r.json()
    assert opp["name"] == "E2E Test - CRM System"
    print(f"  OK: retrieved {opp['name']}")
    return True


# --- Update Opportunity ---
def test_update_opportunity():
    opp_id = test_create_opportunity.opp_id
    payload = {"name": "E2E Test - Updated Name", "win_probability": 0.45}
    r = httpx.patch(f"{BASE_URL}/opportunities/{opp_id}", json=payload)
    assert r.status_code == 200
    opp = r.json()
    assert opp["win_probability"] == 0.45, f"Expected 0.45, got {opp['win_probability']}"
    print(f"  OK: updated win_probability to {opp['win_probability']}")
    return True


# --- Dashboard Summary ---
def test_dashboard_summary():
    r = httpx.get(f"{BASE_URL}/dashboard/summary")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list), "Expected a list"
    assert len(data) >= 1, "No stages in summary"
    has_deals = any(d["deal_count"] > 0 for d in data)
    print(f"  OK: {len(data)} stages, deals found: {has_deals}")
    return True


# --- Dashboard Forecast ---
def test_dashboard_forecast():
    r = httpx.get(f"{BASE_URL}/dashboard/forecast")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list), "Expected a list"
    print(f"  OK: forecast returned {len(data)} entries")
    return True


# --- Pipeline Stages (Kanban) ---
def test_pipeline_stages():
    r = httpx.get(f"{BASE_URL}/stages")
    assert r.status_code == 200
    stages = r.json()
    open_stages = [s for s in stages if not s["is_closed"]]
    assert len(open_stages) == 4, f"Expected 4 open stages, got {len(open_stages)}"
    print(f"  OK: {len(open_stages)} open stages for Kanban")
    return True


# --- Cleanup ---
def test_cleanup():
    opp_id = test_create_opportunity.opp_id
    r = httpx.delete(f"{BASE_URL}/opportunities/{opp_id}")
    assert r.status_code == 204, f"Delete failed: {r.status_code}"
    # Verify deletion
    r2 = httpx.get(f"{BASE_URL}/opportunities/{opp_id}")
    assert r2.status_code == 404, f"Expected 404 after delete, got {r2.status_code}"
    print(f"  OK: deleted opportunity {opp_id[:8]}...")
    return True


# --- Main ---
def main():
    global passed, failed

    print("=" * 60)
    print("RenRND Sales Agentic AI - E2E Test")
    print("=" * 60)
    print()

    test("Health Check", test_health)
    test("Stages", test_stages)
    test("Create Opportunity", test_create_opportunity)
    test("Get Opportunity", test_get_opportunity)
    test("Update Opportunity", test_update_opportunity)
    test("Dashboard Summary", test_dashboard_summary)
    test("Dashboard Forecast", test_dashboard_forecast)
    test("Pipeline Stages", test_pipeline_stages)
    test("Cleanup", test_cleanup)

    print()
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    if failed > 0:
        print("\n❌ Some tests failed!")
        sys.exit(1)
    else:
        print("\n✅ All tests passed! Backend is working correctly.")
        sys.exit(0)


if __name__ == "__main__":
    main()
