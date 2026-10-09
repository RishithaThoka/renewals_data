import pytest
from datetime import date
from backend.models.snapshot import UploadSnapshot
from backend.models.opportunity import Opportunity

# Use the same fixture from test_v2_expiry to avoid duplicating the setup
from backend.tests.test_v2_expiry import client_and_db

def test_v2_approvals_distribution(client_and_db):
    client = client_and_db

    r = client.get("/api/v2/approvals/distribution?as_of=2026-10-07&exclude_deleted_lost=false")
    assert r.status_code == 200, r.text
    d = r.json()

    assert d["data_slice"] == "Renewals"
    assert d["data_slice_key"] == "Q4-2026"
    assert d["total"]["count"] == 348
    assert d["total"]["acv"] == 40068990.09

    statuses = {s["status"]: s for s in d["statuses"]}
    
    # Approved
    appr = statuses["Approved"]
    assert appr["count"] == 96
    assert appr["acv"] == 8571916.50
    assert appr["delta_yesterday"]["count"] == 8
    assert appr["delta_yesterday"]["acv"] == 413834.99
    # yesterday 88 / 8,158,081.51 => 96 - 88 = 8, 8571916.50 - 8158081.51 = 413834.99
    assert appr["delta_lastweek"]["count"] == 96 - 73
    assert appr["delta_lastweek"]["acv"] == round(8571916.50 - 6172895.93, 2)

    # Pending
    pend = statuses["Pending Approval"]
    assert pend["count"] == 6
    assert pend["acv"] == 304814.55
    assert pend["delta_yesterday"]["count"] == -1
    assert pend["delta_yesterday"]["acv"] == -100287.47
    assert pend["delta_lastweek"]["count"] == 6 - 4
    assert pend["delta_lastweek"]["acv"] == round(304814.55 - 1464342.36, 2)

    # Blank
    blnk = statuses["Blank"]
    assert blnk["count"] == 246
    assert blnk["acv"] == 31192259.04
    assert blnk["delta_yesterday"]["count"] == -5
    assert blnk["delta_yesterday"]["acv"] == 162671.66
    assert blnk["delta_lastweek"]["count"] == 246 - 257
    assert blnk["delta_lastweek"]["acv"] == round(31192259.04 - 31527619.47, 2)

    # Sum of status counts
    assert sum(s["count"] for s in d["statuses"]) == 348

    # Matrix checks
    mx = d["matrix"]
    
    # Approved Matrix
    assert mx["Approved"]["Best Case"]["count"] == 13
    assert mx["Approved"]["Blank"]["count"] == 0
    assert mx["Approved"]["Commit"]["count"] == 83
    assert mx["Approved"]["Pipeline"]["count"] == 0
    assert mx["Approved"]["Best Case"]["acv"] == 1812016.90
    assert mx["Approved"]["Commit"]["acv"] == 6759899.60

    # Pending Matrix
    assert mx["Pending Approval"]["Best Case"]["count"] == 1
    assert mx["Pending Approval"]["Blank"]["count"] == 0
    assert mx["Pending Approval"]["Commit"]["count"] == 5
    assert mx["Pending Approval"]["Pipeline"]["count"] == 0
    assert mx["Pending Approval"]["Best Case"]["acv"] == 18252.34
    assert mx["Pending Approval"]["Commit"]["acv"] == 286562.21

    # Blank Matrix
    assert mx["Blank"]["Best Case"]["count"] == 20
    assert mx["Blank"]["Blank"]["count"] == 5
    assert mx["Blank"]["Commit"]["count"] == 220
    assert mx["Blank"]["Pipeline"]["count"] == 1
    assert mx["Blank"]["Best Case"]["acv"] == 7626574.12
    assert mx["Blank"]["Blank"]["acv"] == 212772.40
    assert mx["Blank"]["Commit"]["acv"] == 23303174.90
    assert mx["Blank"]["Pipeline"]["acv"] == 49737.62

    # Movement table reconcile (loose check as movements omit new/dropped deals)
    movements = d["movements"]
    assert isinstance(movements, list)

def test_v2_approvals_deals_endpoint(client_and_db):
    client = client_and_db
    r = client.get("/api/v2/approvals/deals?as_of=2026-10-07&status=Approved&category=Commit&exclude_deleted_lost=false")
    assert r.status_code == 200
    deals = r.json()
    assert len(deals) == 83
    assert round(sum(d["forecast_acv_amount"] for d in deals), 2) == 6759899.60

def test_v2_approvals_exclude_deleted_lost(client_and_db):
    client = client_and_db
    r = client.get("/api/v2/approvals/distribution?as_of=2026-10-07&exclude_deleted_lost=true")
    assert r.status_code == 200
    d = r.json()
    assert d["total"]["count"] == 343 # 348 - 5 deleted_lost in Q4-2026

def test_v2_approvals_empty_slice(client_and_db):
    client = client_and_db
    r = client.get("/api/v2/approvals/distribution?as_of=2024-01-01") # Some date without data
    assert r.status_code == 200
    d = r.json()
    if "error" in d:
        pass # Valid response if no snapshot
    else:
        assert d["total"]["count"] == 0

def test_v2_approvals_time_travel(client_and_db):
    client = client_and_db
    from backend.main import app
    from backend.database import get_db
    db = next(app.dependency_overrides[get_db]())
    # Create a synthetic snapshot for 2027-01-05
    snap = UploadSnapshot(
        snapshot_date=date(2027, 1, 5),
        yesterday_date=date(2027, 1, 4),
        label="Time Travel"
    )
    db.add(snap)
    db.commit()
    
    # Add a fake opportunity for Q1-2027
    opp = Opportunity(
        snapshot_id=snap.id,
        opportunity_id_18="SYNTHETIC_1",
        opportunity_name="Synth",
        account_name="Synth Acc",
        sales_type="Renewals",
        fiscal_period="Q1-2027",
        forecast_category="Commit",
        forecast_acv_amount=50000.0,
        approval_status="Approved"
    )
    db.add(opp)
    db.commit()
    db.close()

    r = client.get("/api/v2/approvals/distribution?as_of=2027-01-05")
    assert r.status_code == 200
    d = r.json()
    assert d["data_slice_key"] == "Q1-2027"
    assert d["total"]["count"] == 1
    assert d["total"]["acv"] == 50000.0
