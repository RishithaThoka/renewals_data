from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.services.context import get_user_context, UserContext
from backend.services.v2_business_units_service import V2BusinessUnitsService

router = APIRouter(prefix="/api/v2/business-units", tags=["business-units-v2"])


@router.get("/summary")
def get_bu_summary(
    as_of: Optional[str] = None,
    compare: Optional[str] = "yesterday",
    exclude_deleted_lost: bool = False,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    svc = V2BusinessUnitsService(db)
    return svc.get_summary(ctx, as_of=as_of, compare=compare, exclude_deleted_lost=exclude_deleted_lost)


@router.get("/deals")
def get_bu_deals(
    bu: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    as_of: Optional[str] = None,
    exclude_deleted_lost: bool = False,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    svc = V2BusinessUnitsService(db)
    return svc.get_deals(
        ctx,
        bu=bu,
        category=category,
        status=status,
        as_of=as_of,
        exclude_deleted_lost=exclude_deleted_lost
    )


@router.get("/top-opportunities")
def get_bu_top_opportunities(
    bu: Optional[str] = None,
    limit: int = 10,
    as_of: Optional[str] = None,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context)
):
    svc = V2BusinessUnitsService(db)
    return svc.get_top_opportunities(ctx, bu=bu, limit=limit, as_of=as_of)
