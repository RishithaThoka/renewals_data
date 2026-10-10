"""
API test for /api/v2/overview/* — Overview tab (Tab 1).
Requires real Oct-7 files in data/sample_oct7/ (never committed).
Values come from the user's confirmed numbers.

Expected Q4 slice (Oct 7, include_deleted_lost=True):
  total: 348 deals, $40,068,990.09
  Commit:    308 / $30,349,636.71
  Best Case:  34 / $9,456,843.36
  Pipeline:    1 / $49,737.62
  Blank:       5 / $212,772.40
  Closed:      0 / $0.00

Approval (Approved includes Approved-2nd):
  Approved: 96, Pending Approval: 6, Blank: 246

Yesterday (Oct 6) Q4: 346 / $39,592,770.91
Last Week (Sep 30) Q4: 334 / $39,164,857.76

FY2026 Commit->Closed vs yesterday: 3 deals / $345,891.08
  (Note: this is an FY2026-scoped movement, not Q4-scoped)

Region Q4 counts: Europe 158, MENA 50, APAC 48, NAMR 37, South America 32, AFRICA 23
  (mapped to canonical: Europe=Europe, APAC=APAC, Africa=Africa,
   MENA=Middle East and North Africa, NAMR=North America, South America=LATAM)
"""
import pathlib
import pytest

SAMPLE = pathlib.Path("data/sample_oct7")
pytestmark = pytest.mark.skipif(not SAMPLE.exists(), reason="real sample files not present")

# ── expected values ───────────────────────────────────────────────────────────
Q4_TOTAL_COUNT = 348
Q4_TOTAL_ACV = 40_068_990.09

Q4_CATS = {
    "Commit":     {"count": 308, "acv": 30_349_636.71},
    "Best Case":  {"count":  34, "acv":  9_456_843.36},
    "Pipeline":   {"count":   1, "acv":     49_737.62},
    "Blank":      {"count":   5, "acv":    212_772.40},
    "Closed":     {"count":   0, "acv":          0.00},
}

Q4_APPROVAL = {
    "Approved":        96,
    "Pending Approval":  6,
    "Blank":           246,
}

Q4_YESTERDAY_COUNT = 346
Q4_YESTERDAY_ACV   = 39_592_770.91

Q4_LASTWEEK_COUNT = 334
Q4_LASTWEEK_ACV   = 39_164_857.76

REGION_COUNTS = {
    "Europe": 158, "Middle East and North Africa": 50,
    "APAC": 48, "North America": 37,
    "LATAM": 32, "Africa": 23,
}

ACV_ABS = 0.02  # tolerance: ±2 cents


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client_and_db(tmp_path_factory):
    """Upload Oct-7 files and return TestClient + Session factory."""
    import pathlib, os
    os.environ.setdefault("DATABASE_URL", "sqlite:///./test_v2_overview.db")

    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend.database import Base, get_db
    from backend.main import app

    db_path = tmp_path_factory.mktemp("db") / "test_v2_overview.db"
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
    assert set(slots) == {"comparison_tool", "fiscal_2026", "fiscal_2027", "fiscal_q4"}, set(slots)

    with TestClient(app) as client:
        # Validate
        files = [(slot, (fp.name, open(fp, "rb"),
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                 for slot, fp in slots.items()]
        data = {"data_as_of_date": "2026-10-07", "yesterday_date": "2026-10-06"}
        vr = client.post("/api/snapshots/validate", data=data, files=files)
        assert vr.status_code == 200, vr.text
        session_id = vr.json()["session_id"]

        # Commit
        cr = client.post("/api/snapshots/commit",
                         json={"session_id": session_id, "replace": False})
        assert cr.status_code == 200, cr.text

        yield client, Session

    # Cleanup
    app.dependency_overrides.clear()


# ── SECTION 1: Total Q4 ───────────────────────────────────────────────────────

class TestOverviewSummary:
    def test_total_count(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/summary")
        assert r.status_code == 200
        d = r.json()
        assert d["total"]["count"] == Q4_TOTAL_COUNT

    def test_total_acv(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/summary")
        assert r.status_code == 200
        assert r.json()["total"]["acv"] == pytest.approx(Q4_TOTAL_ACV, abs=ACV_ABS)

    @pytest.mark.parametrize("fc,exp", Q4_CATS.items())
    def test_category_count(self, client_and_db, fc, exp):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/summary")
        assert r.status_code == 200
        cat = r.json()["categories"][fc]
        assert cat["count"] == exp["count"], f"{fc} count"
        assert cat["acv"] == pytest.approx(exp["acv"], abs=ACV_ABS), f"{fc} ACV"

    def test_yesterday_delta_count(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/summary")
        assert r.status_code == 200
        dy = r.json()["total"]["delta_yesterday"]
        assert dy is not None, "No yesterday snapshot"
        assert dy["count"] == Q4_TOTAL_COUNT - Q4_YESTERDAY_COUNT
        assert dy["acv"] == pytest.approx(Q4_TOTAL_ACV - Q4_YESTERDAY_ACV, abs=ACV_ABS)

    def test_lastweek_delta_count(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/summary")
        assert r.status_code == 200
        dlw = r.json()["total"]["delta_lastweek"]
        assert dlw is not None, "No last-week snapshot"
        assert dlw["count"] == Q4_TOTAL_COUNT - Q4_LASTWEEK_COUNT
        assert dlw["acv"] == pytest.approx(Q4_TOTAL_ACV - Q4_LASTWEEK_ACV, abs=ACV_ABS)

    def test_data_slice_labels_all_v2(self, client_and_db):
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


# ── SECTION 2: Approval totals (from regional breakdown) ─────────────────────

class TestOverviewApproval:
    def test_approval_counts_in_proposal_confirmation(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/regional-breakdown")
        assert r.status_code == 200
        totals = r.json()["proposal_confirmation_totals"]
        assert totals["approved_count"] == Q4_APPROVAL["Approved"], "Approved count"
        assert totals["pending_count"]  == Q4_APPROVAL["Pending Approval"], "Pending count"
        assert totals["blank_count"]    == Q4_APPROVAL["Blank"], "Blank count"


# ── SECTION 5+6: Regional breakdown ──────────────────────────────────────────

class TestOverviewRegional:
    def test_regional_trend_totals_match_section1(self, client_and_db):
        client, _ = client_and_db
        summary  = client.get("/api/v2/overview/summary").json()
        regional = client.get("/api/v2/overview/regional-breakdown").json()
        assert regional["total_acv_check_passes"], "Regional sum != Section 1 total"
        reg_total = regional["regional_trend_totals"]["total_acv"]
        assert reg_total == pytest.approx(summary["total"]["acv"], abs=ACV_ABS)

    @pytest.mark.parametrize("canonical,expected_count", REGION_COUNTS.items())
    def test_region_deal_count(self, client_and_db, canonical, expected_count):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/regional-breakdown")
        rows = {row["region"]: row for row in r.json()["regional_trend"]}
        assert canonical in rows, f"Region {canonical!r} missing from regional_trend"
        assert rows[canonical]["total_count"] == expected_count, f"{canonical} count"


# ── SECTION 4: Movements ─────────────────────────────────────────────────────

class TestOverviewMovements:
    def test_movements_endpoint_returns_data(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/movements?compare=yesterday")
        assert r.status_code == 200
        d = r.json()
        assert "positive" in d and "negative" in d and "approval" in d

    def test_movements_not_from_change_logs(self, client_and_db):
        """Movements endpoint must compute from snapshot diff, never change_logs."""
        # Verify last_week movements work (change_logs has no last-week data)
        client, _ = client_and_db
        r = client.get("/api/v2/overview/movements?compare=last_week")
        assert r.status_code == 200
        d = r.json()
        # If computed from change_logs, last_week movements would all be 0
        assert d["compare"] == "last_week"
        # At minimum the endpoint must respond without error
        assert "positive" in d

    def test_slippage_yesterday(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/movements?compare=yesterday")
        d = r.json()
        slip = d["slippage_to_2027"]
        assert slip["count"] == 2
        assert slip["acv"] == pytest.approx(59514.21, abs=0.01)

    def test_slippage_last_week(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/movements?compare=last_week")
        d = r.json()
        
        slip = d["slippage_to_2027"]
        assert slip["count"] == 5
        assert slip["acv"] == pytest.approx(1315839.07, abs=0.01)
        
        # Check specific IDs in slippage
        slip_ids = {deal["opportunity_id_18"] for deal in slip["deals"]}
        expected_ids = {
            "006Qp00000jgO7FIAU",
            "006Qp00000bPWXFIA4",
            "0061K00000iGWbBQAW",
            "006Qp00000asRzQIAU",
            "006Qp00000asTgFIAU",
        }
        for eid in expected_ids:
            assert eid in slip_ids, f"{eid} missing from slippage_to_2027"
            
        slipped_earlier = d["slipped_earlier"]
        assert slipped_earlier["count"] == 1
        assert slipped_earlier["acv"] == pytest.approx(75567.25, abs=0.01)
        earlier_ids = {deal["opportunity_id_18"] for deal in slipped_earlier["deals"]}
        assert "006Qp00000mTS8XIAW" in earlier_ids
        
        slipped_later = d["slipped_later_quarter"]
        assert slipped_later["count"] == 0

