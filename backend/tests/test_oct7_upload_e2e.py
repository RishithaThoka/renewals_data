"""
End-to-end upload test with the four real Oct 7 files, through the HTTP API.
Put the four .xlsx files in data/sample_oct7/ (any file names; slots are detected by content)
or set RENEWALS_SAMPLE_DIR. The test is skipped if the files are not there.
"""
import os
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app
from backend.models.opportunity import Opportunity
from backend.utils.excel_parser import detect_file_slot, parse_excel_date

SAMPLE_DIR = Path(os.environ.get("RENEWALS_SAMPLE_DIR", Path(__file__).resolve().parents[2] / "data" / "sample_oct7"))
FILES = sorted(SAMPLE_DIR.glob("*.xlsx")) if SAMPLE_DIR.exists() else []
pytestmark = pytest.mark.skipif(len(FILES) < 4, reason="Oct 7 sample files not found in data/sample_oct7/")

EXPECTED = {
    "all": (3093, 2814, 451999230.24, 409669930.68),
    "renewals": (1212, 1132, 115634387.11, 112986592.75),
    "fy2026": (1098, 1018, 102508199.67, 99860405.31),
    "fy2027": (116, 116, 13194630.44, 13194630.44),
    "q4_2026": (348, 343, 40068990.09, 39856217.69),
}


@pytest.fixture(scope="module")
def client_and_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    def _override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c, Session
    app.dependency_overrides.clear()


def _slot_files():
    out = {}
    for f in FILES:
        slot, _ = detect_file_slot(f)
        out[slot] = f
    return out


@pytest.fixture(scope="module")
def validated(client_and_db):
    client, _ = client_and_db
    slots = _slot_files()
    assert set(slots) == {"comparison_tool", "fiscal_2026", "fiscal_2027", "fiscal_q4"}, f"detected: {set(slots)}"
    handles = {s: (p.name, p.open("rb"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") for s, p in slots.items()}
    try:
        r = client.post("/api/snapshots/validate", data={"data_as_of_date": "2026-10-07"}, files=handles)
    finally:
        for _, fh, _ in handles.values():
            fh.close()
    assert r.status_code == 200, r.text
    return r.json()


def test_slots_detected_by_content():
    slots = _slot_files()
    assert set(slots) == {"comparison_tool", "fiscal_2026", "fiscal_2027", "fiscal_q4"}


def test_validate_scope_numbers_to_the_cent(validated):
    assert validated["errors"] == []
    assert validated["can_commit"] is True
    for key, (raw, active, raw_acv, active_acv) in EXPECTED.items():
        sc = validated["scopes"][key]
        assert sc["available"] is True, key
        assert sc["raw_count"] == raw, key
        assert sc["active_count"] == active, key
        assert sc["deleted_lost_count"] == raw - active, key
        assert sc["raw_acv"] == pytest.approx(raw_acv, abs=0.005), key
        assert sc["active_acv"] == pytest.approx(active_acv, abs=0.005), key


def test_yesterday_is_previous_working_day(validated):
    assert validated["yesterday_date"] == "2026-10-06"
    assert validated["fcr_changes_count"] == 59


def test_commit_and_dashboard_numbers(client_and_db, validated):
    client, Session = client_and_db
    r = client.post("/api/snapshots/commit", json={"session_id": validated["session_id"], "replace": False})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["row_count"] == 3093 and body["active_row_count"] == 2814

    db = Session()
    total = db.query(Opportunity).filter(Opportunity.snapshot_id == body["snapshot_id"]).count()
    with_close = db.query(Opportunity).filter(Opportunity.snapshot_id == body["snapshot_id"], Opportunity.close_date.isnot(None)).count()
    db.close()
    assert total == with_close == 3093

    def kpis(scope, idl):
        res = client.get("/api/analytics/kpis", params={"scope": scope, "include_deleted_lost": str(idl).lower()})
        assert res.status_code == 200, res.text
        return res.json()

    def count_acv(k):
        return k.get("total_count"), k.get("total_acv")

    renewals = kpis("renewals", False)
    all_active = kpis("all", False)
    all_raw = kpis("all", True)
    assert renewals != all_active != all_raw
    assert count_acv(renewals)[0] == 1132
    assert count_acv(renewals)[1] == pytest.approx(112986592.75, abs=0.005)
    assert count_acv(all_active)[0] == 2814
    assert count_acv(all_active)[1] == pytest.approx(409669930.68, abs=0.005)
    assert count_acv(all_raw)[0] == 3093
    assert count_acv(all_raw)[1] == pytest.approx(451999230.24, abs=0.005)


def test_same_files_again_ask_to_replace(client_and_db, validated):
    client, _ = client_and_db
    slots = _slot_files()
    handles = {s: (p.name, p.open("rb"), "application/octet-stream") for s, p in slots.items()}
    try:
        r = client.post("/api/snapshots/validate", data={"data_as_of_date": "2026-10-07"}, files=handles)
    finally:
        for _, fh, _ in handles.values():
            fh.close()
    j = r.json()
    assert j["snapshot_exists"] is True
    c = client.post("/api/snapshots/commit", json={"session_id": j["session_id"], "replace": False})
    assert c.status_code == 409


def test_excel_date_parsing():
    assert parse_excel_date("46378") == date(2026, 12, 22)
    assert parse_excel_date(46243) == date(2026, 8, 9)
    assert parse_excel_date("6/2/2026") == date(2026, 6, 2)
    assert parse_excel_date("2026-06-02 00:00:00") == date(2026, 6, 2)
    assert parse_excel_date("0") is None and parse_excel_date(None) is None and parse_excel_date("nan") is None
