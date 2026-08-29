"""Backend API tests for AMR Fleet Coordination (demo-requests, sim-runs, root)."""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Module: root health ---
class TestRoot:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=30)
        assert r.status_code == 200, r.text
        assert "message" in r.json()


# --- Module: demo requests ---
class TestDemoRequests:
    def test_create_and_persist(self, api_client):
        payload = {
            "name": "TEST_QA User",
            "email": "TEST_qa@example.test",
            "org": "TEST_Org",
            "message": "TEST_message body",
        }
        r = api_client.post(f"{BASE_URL}/api/demo-requests", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["id"], str) and len(data["id"]) > 0
        for k, v in payload.items():
            assert data[k] == v
        assert "created_at" in data
        assert "_id" not in data

        lst = api_client.get(f"{BASE_URL}/api/demo-requests", timeout=30)
        assert lst.status_code == 200
        rows = lst.json()
        assert isinstance(rows, list)
        match = [x for x in rows if x["id"] == data["id"]]
        assert len(match) == 1, "created demo request not persisted"
        assert match[0]["email"] == payload["email"]
        assert "_id" not in match[0]

    def test_create_minimal_optional_fields(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/demo-requests",
            json={"name": "TEST_Min", "email": "TEST_min@example.test"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["org"] == "" and d["message"] == ""

    def test_create_validation_error(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/demo-requests", json={"name": "no email"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_sorted_desc_by_created_at(self, api_client):
        rows = api_client.get(f"{BASE_URL}/api/demo-requests", timeout=30).json()
        stamps = [x["created_at"] for x in rows]
        assert stamps == sorted(stamps, reverse=True)


# --- Module: sim runs ---
class TestSimRuns:
    def test_create_and_persist(self, api_client):
        payload = {
            "seed": 424242,
            "trials": 3,
            "task_count": 12,
            "baseline_avg": 140.5,
            "system_avg": 96.25,
            "improvement": 31.5,
            "baseline_collisions": 7,
            "system_collisions": 0,
        }
        r = api_client.post(f"{BASE_URL}/api/sim-runs", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["id"], str)
        for k, v in payload.items():
            assert data[k] == v, f"{k} mismatch"
        assert "_id" not in data

        rows = api_client.get(f"{BASE_URL}/api/sim-runs", timeout=30).json()
        match = [x for x in rows if x["id"] == data["id"]]
        assert len(match) == 1, "sim run not persisted"
        assert match[0]["improvement"] == payload["improvement"]

    def test_create_validation_error(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/sim-runs", json={"seed": "abc"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_list_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/sim-runs", timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            for key in ("id", "seed", "trials", "improvement", "created_at"):
                assert key in rows[0]


# --- Module: misc ---
class TestMisc:
    def test_unknown_route_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/does-not-exist", timeout=30)
        assert r.status_code == 404

    def test_cors_header_present(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/", headers={"Origin": BASE_URL}, timeout=30
        )
        assert r.status_code == 200
        assert "access-control-allow-origin" in {k.lower() for k in r.headers}
