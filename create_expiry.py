import os

service_code = """
from __future__ import annotations
import logging
from datetime import date
from typing import Optional
import pandas as pd
from sqlalchemy.orm import Session
from backend.models.opportunity import Opportunity
from backend.models.snapshot import UploadSnapshot
from backend.services.context import UserContext
from backend.services.scopes import ScopeService

def _sum(df: pd.DataFrame, col: str) -> float:
    if df.empty or col not in df.columns:
        return 0.0
    return float(df[col].sum())

log = logging.getLogger(__name__)

ALL_FC = ["Closed", "Commit", "Best Case", "Pipeline", "Blank"]

class V2ExpiryService:
    def __init__(self, db: Session):
        self.db = db

    def _get_snapshot(self, ctx: UserContext, target_date: Optional[str] = None) -> Optional[UploadSnapshot]:
        q = self.db.query(UploadSnapshot)
        if target_date:
            if target_date == "yesterday":
                latest = q.order_by(UploadSnapshot.snapshot_date.desc()).first()
                if not latest: return None
                return q.filter(UploadSnapshot.snapshot_date < latest.snapshot_date).order_by(UploadSnapshot.snapshot_date.desc()).first()
            elif target_date == "last_week":
                latest = q.order_by(UploadSnapshot.snapshot_date.desc()).first()
                if not latest: return None
                target = latest.snapshot_date - pd.Timedelta(days=7)
                return q.filter(UploadSnapshot.snapshot_date <= target).order_by(UploadSnapshot.snapshot_date.desc()).first()
            else:
                try:
                    d = date.fromisoformat(target_date)
                    return q.filter(UploadSnapshot.snapshot_date <= d).order_by(UploadSnapshot.snapshot_date.desc()).first()
                except ValueError:
                    return None
        return q.order_by(UploadSnapshot.snapshot_date.desc()).first()

    def _window_opps(self, snap: UploadSnapshot, quarter: str, exclude_deleted_lost: bool) -> pd.DataFrame:
        q = self.db.query(Opportunity).filter(
            Opportunity.snapshot_id == snap.id,
            ScopeService.expiry_window(quarter)
        )
        if exclude_deleted_lost:
            q = q.filter(Opportunity.is_deleted_or_lost == False)
        
        opps = q.all()
        if not opps:
            return pd.DataFrame()
            
        data = []
        for o in opps:
            fc = o.forecast_category if o.forecast_category in ALL_FC else "Blank"
            if not o.forecast_category:
                fc = "Blank"
            # Some entries might have valid but non-canonical forecast categories. We map them.
            # Wait, the rule is "Blank Forecast Category is shown as a 'Blank' column". So if not in ALL_FC, we map it?
            # For Overview, we used ALL_FC. Let's just use what's in the DB. We'll map to 'Blank' if empty.
            if not o.forecast_category or o.forecast_category.strip() == "":
                fc = "Blank"
            elif o.forecast_category not in ["Closed", "Commit", "Best Case", "Pipeline"]:
                fc = "Blank" # Or maybe it's just "Blank" if empty, else keep? But Overview does this.
                
            data.append({
                "id": o.id,
                "opportunity_id_18": o.opportunity_id_18,
                "forecast_category": fc,
                "forecast_acv_amount": float(o.forecast_acv_amount or 0),
                "service_expiry_period": o.service_expiry_period or "Blank",
                "close_date": o.close_date
            })
        
        df = pd.DataFrame(data)
        # deduplicate by opportunity_id_18 keeping last
        df = df.drop_duplicates(subset=["opportunity_id_18"], keep="last")
        return df

    def get_summary(
        self,
        ctx: UserContext,
        as_of: Optional[str] = None,
        compare: Optional[str] = None,
        exclude_deleted_lost: bool = False
    ) -> dict:
        snap = self._get_snapshot(ctx, as_of)
        if not snap:
            return {"error": "No snapshot found"}
            
        target_quarter = ScopeService.current_quarter(snap.snapshot_date)
        if not target_quarter or "-" not in target_quarter:
            return {"error": "Invalid current quarter"}
            
        _, current_y_str = target_quarter.split("-")
        current_y = int(current_y_str)
        next_y = current_y + 1
        
        df = self._window_opps(snap, target_quarter, exclude_deleted_lost)
        
        comp_snap = None
        if compare:
            comp_snap = self._get_snapshot(ctx, compare)
        comp_df = pd.DataFrame()
        if comp_snap:
            comp_df = self._window_opps(comp_snap, target_quarter, exclude_deleted_lost)
            
        fy1_label = str(current_y)
        fy2_label = str(next_y)
        
        quarters = []
        for y in (current_y, next_y):
            for q in range(1, 5):
                key = f"Q{q}-{y}"
                label = f"Q{q} FY{str(y)[-2:]}"
                quarters.append({"key": key, "label": label, "fy": str(y)})
                
        def build_grid(target_df: pd.DataFrame, y_label: str):
            rows = []
            fy_qs = [q for q in quarters if q["fy"] == y_label]
            grid_count = 0
            grid_acv = 0.0
            cat_totals = {fc: {"count": 0, "acv": 0.0} for fc in ALL_FC}
            
            for q in fy_qs:
                cells = {}
                row_count = 0
                row_acv = 0.0
                q_df = target_df[target_df["service_expiry_period"] == q["key"]] if not target_df.empty else pd.DataFrame()
                
                for fc in ALL_FC:
                    fc_df = q_df[q_df["forecast_category"] == fc] if not q_df.empty else pd.DataFrame()
                    c = len(fc_df)
                    a = round(_sum(fc_df, "forecast_acv_amount"), 2)
                    cells[fc] = {"count": c, "acv": a}
                    row_count += c
                    row_acv += a
                    
                    cat_totals[fc]["count"] += c
                    cat_totals[fc]["acv"] += a
                    
                rows.append({
                    "quarter": q["key"],
                    "label": q["label"],
                    "cells": cells,
                    "total": {"count": row_count, "acv": round(row_acv, 2)}
                })
                grid_count += row_count
                grid_acv += row_acv
                
            return {
                "rows": rows,
                "totals": {
                    "category": cat_totals,
                    "grand": {"count": grid_count, "acv": round(grid_acv, 2)}
                }
            }
            
        grid_current = build_grid(df, fy1_label)
        grid_next = build_grid(df, fy2_label)
        
        comp_grid_current = build_grid(comp_df, fy1_label) if not comp_df.empty else build_grid(pd.DataFrame(), fy1_label)
        comp_grid_next = build_grid(comp_df, fy2_label) if not comp_df.empty else build_grid(pd.DataFrame(), fy2_label)
        
        def compute_deltas(grid, cgrid):
            # calculate deltas vs compare snapshot
            deltas = {"grand": {"count": grid["totals"]["grand"]["count"] - cgrid["totals"]["grand"]["count"], "acv": round(grid["totals"]["grand"]["acv"] - cgrid["totals"]["grand"]["acv"], 2)}}
            return deltas
            
        # Slippage: window deals whose Close Date is after the end of the current fiscal year.
        # End of current fiscal year = quarter_bounds("Q4-" + current_y)[1]
        _, fy_end_date = ScopeService.quarter_bounds(f"Q4-{current_y}")
        slip_df = df[df["close_date"] > pd.Timestamp(fy_end_date)] if not df.empty else pd.DataFrame()
        slip_count = len(slip_df)
        slip_acv = _sum(slip_df, "forecast_acv_amount")
        
        # Breakdown by quarter
        slip_by_quarter = []
        if not slip_df.empty:
            for q in quarters:
                q_slip = slip_df[slip_df["service_expiry_period"] == q["key"]]
                if not q_slip.empty:
                    slip_by_quarter.append({
                        "quarter": q["key"],
                        "count": len(q_slip),
                        "acv": round(_sum(q_slip, "forecast_acv_amount"), 2)
                    })
        
        return {
            "fiscal_years": [
                {"label": fy1_label, "quarters": [{"key": q["key"], "label": q["label"]} for q in quarters if q["fy"] == fy1_label]},
                {"label": fy2_label, "quarters": [{"key": q["key"], "label": q["label"]} for q in quarters if q["fy"] == fy2_label]}
            ],
            "categories": ALL_FC,
            "grids": {
                fy1_label: grid_current,
                fy2_label: grid_next
            },
            "acv_by_year": {
                fy1_label: grid_current["totals"]["grand"],
                fy2_label: grid_next["totals"]["grand"]
            },
            "grand_total": {
                "count": grid_current["totals"]["grand"]["count"] + grid_next["totals"]["grand"]["count"],
                "acv": round(grid_current["totals"]["grand"]["acv"] + grid_next["totals"]["grand"]["acv"], 2)
            },
            "slippage": {
                "count": slip_count,
                "acv": round(slip_acv, 2),
                "by_quarter": slip_by_quarter
            },
            "deltas": {
                "yesterday": compute_deltas(grid_current, comp_grid_current) if compare == "yesterday" else None, # We can make this better
            }
        }
        
    def get_deals(
        self,
        ctx: UserContext,
        quarter: Optional[str] = None,
        category: Optional[str] = None,
        as_of: Optional[str] = None,
        exclude_deleted_lost: bool = False
    ) -> list[dict]:
        snap = self._get_snapshot(ctx, as_of)
        if not snap:
            return []
            
        target_quarter = ScopeService.current_quarter(snap.snapshot_date)
        df = self._window_opps(snap, target_quarter, exclude_deleted_lost)
        if df.empty:
            return []
            
        if quarter:
            df = df[df["service_expiry_period"] == quarter]
        if category:
            df = df[df["forecast_category"] == category]
            
        return df.to_dict("records")
"""

router_code = """
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.services.context import UserContext
from backend.services.v2_expiry_service import V2ExpiryService

router = APIRouter(prefix="/api/v2/expiry", tags=["v2_expiry"])

@router.get("/summary")
def get_summary(
    as_of: str = Query(None),
    compare: str = Query("yesterday"),
    exclude_deleted_lost: bool = Query(False),
    db: Session = Depends(get_db)
):
    ctx = UserContext()
    svc = V2ExpiryService(db)
    return svc.get_summary(ctx, as_of, compare, exclude_deleted_lost)

@router.get("/deals")
def get_deals(
    quarter: str = Query(None),
    category: str = Query(None),
    as_of: str = Query(None),
    exclude_deleted_lost: bool = Query(False),
    db: Session = Depends(get_db)
):
    ctx = UserContext()
    svc = V2ExpiryService(db)
    # the frontend expects full opportunity models for the drawer, so returning dicts with IDs might need a join or returning the objects.
    # We will just return the IDs and then the frontend can use the existing /api/opportunities endpoint?
    # No, the instructions say: "reuse the existing deals modal API if one exists". We can just return the same shape as opportunity_service.
    # Wait, the instruction says: "GET /api/v2/expiry/deals?quarter=&category=&as_of=  -> the deal list for any clicked cell (reuse the existing deals modal API if one exists)"
    # I'll implement a query that returns the actual models.
    pass
"""

# write tests later
