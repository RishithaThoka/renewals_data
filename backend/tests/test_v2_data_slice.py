import pytest
from backend.services.scopes import ScopeService

def test_data_slice_labels_all_v2(client_and_db):
    client, _ = client_and_db
    
    # 2026-10-07 snapshot
    for ep in ["overview/summary", "expiry/summary", "approvals/summary", "business-units/summary"]:
        r = client.get(f"/api/v2/{ep}")
        assert r.status_code == 200, f"Failed {ep}"
        assert r.json()["data_slice"] == "Q4 FY26"
        
    # Time-travel to 2027-01-05
    for ep in ["overview/summary", "expiry/summary", "approvals/summary", "business-units/summary"]:
        r = client.get(f"/api/v2/{ep}?as_of=2027-01-05")
        assert r.status_code == 200, f"Failed {ep} time-travel"
        assert r.json()["data_slice"] == "Q1 FY27"
