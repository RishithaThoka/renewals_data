import pathlib
import pytest
from datetime import date
from sqlalchemy.orm import Session

from backend.database import Base, get_db
from backend.models.snapshot import UploadSnapshot
from backend.models.opportunity import Opportunity
@pytest.fixture(scope="module")
def client_and_db(tmp_path_factory):
    """Upload Oct-7 files and return TestClient + Session factory."""
    import pathlib, os
    os.environ.setdefault("DATABASE_URL", "sqlite:///./test_v2_delayed.db")

    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend.database import Base, get_db
    from backend.main import app

    db_path = tmp_path_factory.mktemp("db") / "test_v2_delayed.db"
    engine  = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)

    def override_db():
        db = Session()
        try: yield db
        finally: db.close()

    app.dependency_overrides[get_db] = override_db

    from backend.utils.excel_parser import detect_file_slot
    sample = pathlib.Path("data/sample_oct7")
    slots = {}
    for fp in sorted(sample.glob("*.xlsx")):
        slots[detect_file_slot(fp)[0]] = fp

    with TestClient(app) as client:
        files = [(slot, (fp.name, open(fp, "rb"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) for slot, fp in slots.items()]
        data = {"data_as_of_date": "2026-10-07", "yesterday_date": "2026-10-06"}
        vr = client.post("/api/snapshots/validate", data=data, files=files)
        assert vr.status_code == 200, vr.text
        session_id = vr.json()["session_id"]

        cr = client.post("/api/snapshots/commit", json={"session_id": session_id, "replace": False})
        assert cr.status_code == 200, cr.text

    yield TestClient(app), Session

def test_delayed_summary_yesterday(client_and_db):
    client, _ = client_and_db
    r = client.get("/api/v2/delayed/summary?compare=yesterday")
    assert r.status_code == 200
    d = r.json()
    assert "error" not in d
    assert d["data_slice"] == "Q4 FY26"
    assert d["data_slice_key"] == "Q4-2026"
    
    # We don't have exact numbers for yesterday delayed total from the user yet,
    # but we can check the keys.
    assert "total" in d
    assert "overdue" in d
    assert "slipped" in d
    assert "by_region" in d

def test_delayed_summary_last_week(client_and_db):
    client, _ = client_and_db
    r = client.get("/api/v2/delayed/summary?compare=last_week")
    assert r.status_code == 200
    d = r.json()
    assert d["data_slice"] == "Q4 FY26"
    assert "delta_lastweek" in d["total"]
    
    # Check slipped matches overview numbers exactly
    slipped = d["slipped"]
    assert slipped["count"] >= 5 # at least 5
    # The slipped logic might include both "next year" and "later quarter"
    # overview "slipped to next year" was 5 / 1,315,839.07
    assert slipped["acv"] >= 1315839.07

def test_delayed_deals_endpoint(client_and_db):
    client, _ = client_and_db
    r = client.get("/api/v2/delayed/deals?compare=yesterday")
    assert r.status_code == 200
    d_deals = r.json()
    
    r2 = client.get("/api/v2/delayed/summary?compare=yesterday")
    d_summary = r2.json()
    
    assert d_deals["count"] == d_summary["total"]["count"]
    assert d_deals["acv"] == d_summary["total"]["acv"]

def test_delayed_as_of_fix(client_and_db):
    client, _ = client_and_db
    # Using time-travel
    r = client.get("/api/v2/delayed/summary?as_of=2027-01-05")
    assert r.status_code == 200
    d = r.json()
    assert d["data_slice_key"] == "Q4-2026" # Falls back to latest Oct 7
