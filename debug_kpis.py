import pytest
from backend.main import app
from fastapi.testclient import TestClient
from backend.database import get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models.opportunity import Opportunity
from backend.services.analytics_service import AnalyticsService

db_path = "test_e2e.db"
engine = create_engine(f"sqlite:///{db_path}")
Session = sessionmaker(bind=engine)

def main():
    db = Session()
    count_all = db.query(Opportunity).count()
    print("Total rows:", count_all)
    count_renewals = db.query(Opportunity).filter(Opportunity.sales_type == "Renewals").count()
    print("Total sales_type == 'Renewals':", count_renewals)
    count_renewals_act = db.query(Opportunity).filter(Opportunity.sales_type == "Renewals", Opportunity.is_deleted_or_lost == False).count()
    print("Active sales_type == 'Renewals':", count_renewals_act)

    analytics = AnalyticsService(db)
    from backend.services.context import UserContext
    kpis_raw = analytics.get_kpis(UserContext(), scope="renewals", include_deleted_lost=True)
    print("KPIs raw:", kpis_raw.get("total_count"))

    kpis_act = analytics.get_kpis(UserContext(), scope="renewals", include_deleted_lost=False)
    print("KPIs act:", kpis_act.get("total_count"))

if __name__ == "__main__":
    main()
