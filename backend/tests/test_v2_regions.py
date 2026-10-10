import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
import os

from backend.main import app
from backend.database import Base, get_db
from backend.models.snapshot import UploadSnapshot
from backend.models.opportunity import Opportunity
from backend.services.data_ingestion import IngestionService

@pytest.fixture(scope="module")
def client_and_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    
    db = TestingSessionLocal()
    svc = IngestionService(db)
    
    # Ingest standard fixtures (using the same sample data from test_v2_expiry)
    sample_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample_oct7")
    
    if os.path.exists(os.path.join(sample_dir, "Mobileum_raw_data_2026-09-30.xlsx")):
        svc.ingest_snapshot(os.path.join(sample_dir, "Mobileum_raw_data_2026-09-30.xlsx"), date(2026, 9, 30))
    if os.path.exists(os.path.join(sample_dir, "Mobileum_raw_data_2026-10-06.xlsx")):
        svc.ingest_snapshot(os.path.join(sample_dir, "Mobileum_raw_data_2026-10-06.xlsx"), date(2026, 10, 6))
    if os.path.exists(os.path.join(sample_dir, "Mobileum_raw_data_2026-10-07.xlsx")):
        svc.ingest_snapshot(os.path.join(sample_dir, "Mobileum_raw_data_2026-10-07.xlsx"), date(2026, 10, 7))

    # Add an unmapped region opportunity to the Oct 7 snapshot to test "Other"
    snap = db.query(UploadSnapshot).filter(UploadSnapshot.snapshot_date == date(2026, 10, 7)).first()
    if snap:
        opp = Opportunity(
            snapshot_id=snap.id,
            opportunity_id_18="006TESTUNMAPPEDREGION",
            opportunity_name="Test Unmapped Region",
            account_name="Test Unmapped Account",
            forecast_acv_amount=50000.0,
            forecast_category="Commit",
            approval_status="Pending Approval",
            business_unit_primary="Roaming",
            is_deleted_or_lost=False,
            fiscal_period="Q4-2026",
            close_date=date(2026, 11, 15),
            sub_region="Antarctica", # Unmapped
        )
        db.add(opp)
        db.commit()

    yield client, db

    Base.metadata.drop_all(bind=engine)

def test_regions_summary_total(client_and_db):
    client, _ = client_and_db
    r = client.get("/api/v2/regions/summary")
    assert r.status_code == 200
    d = r.json()
    assert "error" not in d
    assert d["data_slice"] == "Q4 FY26"
    assert d["data_slice_key"] == "Q4-2026"
    assert d["total"]["count"] == 349 # 348 + 1 unmapped
    assert round(d["total"]["acv"], 2) == 40118990.09 # 40068990.09 + 50000

def test_regions_summary_regions(client_and_db):
    client, _ = client_and_db
    r = client.get("/api/v2/regions/summary")
    d = r.json()
    regions = d["regions"]
    
    eur = next((r for r in regions if r["region"] == "Europe"), None)
    assert eur is not None
    assert eur["count"] == 158
    assert round(eur["acv"], 2) == 11103425.68
    
    afr = next((r for r in regions if r["region"] == "Africa"), None)
    assert afr is not None
    assert afr["count"] == 23
    assert round(afr["acv"], 2) == 1592103.02

    # Check the unmapped
    other = next((r for r in regions if r["region"] == "Other"), None)
    assert other is not None
    assert other["count"] == 1
    assert other["acv"] == 50000.0
    
    unmapped = d["unmapped"]
    assert unmapped["count"] == 1
    assert unmapped["acv"] == 50000.0
    assert "Antarctica" in unmapped["values"]

def test_region_deals(client_and_db):
    client, _ = client_and_db
    r = client.get("/api/v2/regions/deals?region=Europe&category=Commit")
    assert r.status_code == 200
    d = r.json()
    assert d["count"] == 148
    assert round(d["acv"], 2) == 10581230.77
    
    r = client.get("/api/v2/regions/deals")
    d = r.json()
    assert d["count"] == 349

def test_region_movements(client_and_db):
    client, _ = client_and_db
    r = client.get("/api/v2/regions/Europe/movements?compare=yesterday")
    assert r.status_code == 200
    d = r.json()
    assert "category_moves" in d
    assert "approval_moves" in d
    assert "new_to_slice" in d
    assert "slipped_out" in d

def test_top_opportunities(client_and_db):
    client, _ = client_and_db
    r = client.get("/api/v2/regions/Europe/top-opportunities")
    assert r.status_code == 200
    d = r.json()
    assert len(d) > 0
    assert "Telia" in d[0]["opportunity_name"]

def test_as_of_fix(client_and_db):
    client, db = client_and_db
    
    r = client.get("/api/v2/regions/summary?as_of=2027-01-05")
    assert r.status_code == 200
    d = r.json()
    assert d["data_slice"] == "Q1 FY27"
    assert d["data_slice_key"] == "Q1-2027"
    assert d["requested_as_of"] == "2027-01-05"
    assert d["snapshot_date"] == "2026-10-07"
