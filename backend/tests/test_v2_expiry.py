import pytest
import pathlib
from datetime import date
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.utils.excel_parser import detect_file_slot

client = TestClient(app)

@pytest.fixture(scope="module")
def client_and_db(tmp_path_factory):
    import sqlalchemy
    from backend.database import Base
    
    db_path = tmp_path_factory.mktemp("data") / "test_expiry.db"
    engine = sqlalchemy.create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    Session = sqlalchemy.orm.sessionmaker(bind=engine)
    
    def override_db():
        db = Session()
        try: yield db
        finally: db.close()

    app.dependency_overrides[get_db] = override_db

    sample = pathlib.Path("data/sample_oct7")
    slots = {}
    for fp in sorted(sample.glob("*.xlsx")):
        slots[detect_file_slot(fp)[0]] = fp
    assert set(slots) == {"comparison_tool", "fiscal_2026", "fiscal_2027", "fiscal_q4"}, set(slots)

    with TestClient(app) as test_client:
        files = [(slot, (fp.name, open(fp, "rb"),
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                 for slot, fp in slots.items()]
        data = {"data_as_of_date": "2026-10-07", "yesterday_date": "2026-10-06"}
        vr = test_client.post("/api/snapshots/validate", data=data, files=files)
        assert vr.status_code == 200, vr.text
        session_id = vr.json()["session_id"]

        cr = test_client.post("/api/snapshots/commit",
                         json={"session_id": session_id, "replace": False})
        assert cr.status_code == 200, cr.text

        yield test_client

class TestExpirySummary:
    def test_full_grid(self, client_and_db):
        res = client_and_db.get("/api/v2/expiry/summary?exclude_deleted_lost=false")
        assert res.status_code == 200
        d = res.json()
        
        g26 = d["grids"]["2026"]
        g27 = d["grids"]["2027"]
        
        q1_26 = next(r for r in g26["rows"] if r["quarter"] == "Q1-2026")
        assert q1_26["cells"]["Best Case"]["count"] == 7
        assert q1_26["cells"]["Closed"]["count"] == 193
        assert q1_26["cells"]["Commit"]["count"] == 5
        assert q1_26["cells"]["Pipeline"]["count"] == 1
        assert q1_26["total"]["count"] == 206
        assert q1_26["total"]["acv"] == 15562415.66
        
        q4_26 = next(r for r in g26["rows"] if r["quarter"] == "Q4-2026")
        assert q4_26["cells"]["Best Case"]["count"] == 81
        assert q4_26["cells"]["Closed"]["count"] == 43
        assert q4_26["cells"]["Commit"]["count"] == 279
        assert q4_26["cells"]["Pipeline"]["count"] == 7
        assert q4_26["total"]["count"] == 410
        assert q4_26["total"]["acv"] == 52134488.49
        
        assert g26["totals"]["grand"]["count"] == 941
        assert g26["totals"]["grand"]["acv"] == 100657985.75
        
        assert g27["totals"]["grand"]["count"] == 16
        assert g27["totals"]["grand"]["acv"] == 1869207.49
        
        assert d["grand_total"]["count"] == 957
        assert d["grand_total"]["acv"] == 102527193.24
        
        assert d["slippage"]["count"] == 105
        assert d["slippage"]["acv"] == 12415568.47
        
        # Test Yesterday deltas
        yesterday_count = d["grand_total"]["count"] - (d["deltas"]["2026"]["grand"]["count"] + d["deltas"]["2027"]["grand"]["count"])
        yesterday_acv = d["grand_total"]["acv"] - (d["deltas"]["2026"]["grand"]["acv"] + d["deltas"]["2027"]["grand"]["acv"])
        assert yesterday_count == 953
        assert round(yesterday_acv, 2) == 102193810.02
        # Window grand total yesterday is 953. Current is 957.
        # We can just check the grand total delta across the two years.
        
    def test_deals(self, client_and_db):
        res = client_and_db.get("/api/v2/expiry/deals?quarter=Q4-2026&category=Commit&exclude_deleted_lost=false")
        assert res.status_code == 200
        deals = res.json()
        assert len(deals) == 279
        acv = round(sum(d.get("forecast_acv_amount", 0) for d in deals), 2)
        assert acv == 29825989.53