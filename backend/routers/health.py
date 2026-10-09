from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.database import get_db

router = APIRouter(prefix="/api/health", tags=["health"])

@router.get("/db")
def get_db_health(db: Session = Depends(get_db)):
    try:
        res = db.execute(text("PRAGMA table_info(opportunities)")).fetchall()
        cols = [r[1] for r in res]
        is_legacy = "fiscal_period" not in cols or "sales_type" not in cols
        
        return {
            "status": "ok",
            "is_legacy": is_legacy,
            "version": "v2" if not is_legacy else "v1"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
