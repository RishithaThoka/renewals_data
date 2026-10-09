from __future__ import annotations
import logging
from datetime import date
from typing import Optional
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
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
FUNNEL_STAGES = ["Approved", "Pending Approval", "Blank"]

class V2ApprovalsService:
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

    def _get_opps_df(self, snap: UploadSnapshot, quarter: str, exclude_deleted_lost: bool) -> pd.DataFrame:
        if not snap:
            return pd.DataFrame()
        q = self.db.query(Opportunity).filter(
            Opportunity.snapshot_id == snap.id,
            Opportunity.sales_type == "Renewals",
            Opportunity.fiscal_period == quarter
        )
        if exclude_deleted_lost:
            q = q.filter(Opportunity.is_deleted_or_lost == False)
        
        opps = q.all()
        if not opps:
            return pd.DataFrame()
            
        data = []
        for o in opps:
            fc = o.forecast_category if o.forecast_category in ALL_FC else "Blank"
            if not o.forecast_category or str(o.forecast_category).strip() == "":
                fc = "Blank"
            elif o.forecast_category not in ["Closed", "Commit", "Best Case", "Pipeline"]:
                fc = "Blank"
                
            status = o.approval_status
            if not status or str(status).strip() == "":
                status = "Blank"
            elif status == "Pending-Approval":
                status = "Pending Approval"
                
            data.append({
                "id": o.id,
                "opportunity_id_18": o.opportunity_id_18,
                "forecast_category": fc,
                "forecast_acv_amount": float(o.forecast_acv_amount or 0),
                "approval_status": status,
                "reason_for_approval": o.extra_attributes.get("Reason for approval") if o.extra_attributes else None
            })
        
        df = pd.DataFrame(data)
        df = df.drop_duplicates(subset=["opportunity_id_18"], keep="last")
        return df

    def get_distribution(
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
        if not target_quarter:
            return {"error": "Invalid current quarter"}
            
        df = self._get_opps_df(snap, target_quarter, exclude_deleted_lost)
        
        comp_snap = None
        if compare:
            comp_snap = self._get_snapshot(ctx, compare)
        comp_df = self._get_opps_df(comp_snap, target_quarter, exclude_deleted_lost) if comp_snap else pd.DataFrame()
            
        snap_yest = self._get_snapshot(ctx, "yesterday")
        df_yest = self._get_opps_df(snap_yest, target_quarter, exclude_deleted_lost) if snap_yest else pd.DataFrame()
        
        snap_lw = self._get_snapshot(ctx, "last_week")
        df_lw = self._get_opps_df(snap_lw, target_quarter, exclude_deleted_lost) if snap_lw else pd.DataFrame()
        
        total_count = len(df)
        total_acv = _sum(df, "forecast_acv_amount") if not df.empty else 0.0
        
        # Build unique statuses
        all_statuses = set()
        if not df.empty:
            all_statuses.update(df["approval_status"].unique())
        # Ensure FUNNEL_STAGES are present if requested, even if 0
        all_statuses.update(FUNNEL_STAGES)
        
        statuses_list = []
        matrix = {}
        for st in all_statuses:
            st_df = df[df["approval_status"] == st] if not df.empty else pd.DataFrame()
            c = len(st_df)
            a = _sum(st_df, "forecast_acv_amount")
            # Hide rows with zero deals if they are not in FUNNEL_STAGES
            if c == 0 and st not in FUNNEL_STAGES:
                continue
                
            pct_c = round((c / total_count * 100) if total_count else 0, 1)
            pct_a = round((a / total_acv * 100) if total_acv else 0, 1)
            
            # Deltas
            def get_delta(prev_df):
                if prev_df.empty:
                    return {"count": c, "acv": round(a, 2)}
                prev_st_df = prev_df[prev_df["approval_status"] == st]
                prev_c = len(prev_st_df)
                prev_a = _sum(prev_st_df, "forecast_acv_amount")
                return {"count": c - prev_c, "acv": round(a - prev_a, 2)}
                
            delta_yest = get_delta(df_yest)
            delta_lw = get_delta(df_lw)
            delta_comp = get_delta(comp_df)
            
            statuses_list.append({
                "status": st,
                "count": c,
                "acv": round(a, 2),
                "pct_count": pct_c,
                "pct_acv": pct_a,
                "delta_yesterday": delta_yest,
                "delta_lastweek": delta_lw,
                "delta_custom": delta_comp
            })
            
            # Matrix row
            row_matrix = {}
            for fc in ALL_FC:
                fc_df = st_df[st_df["forecast_category"] == fc] if not st_df.empty else pd.DataFrame()
                row_matrix[fc] = {
                    "count": len(fc_df),
                    "acv": round(_sum(fc_df, "forecast_acv_amount"), 2)
                }
            matrix[st] = row_matrix
            
        # Funnel stages
        funnel = [{"stage": "Total slice", "count": total_count, "acv": round(total_acv, 2)}]
        for st in FUNNEL_STAGES:
            st_df = df[df["approval_status"] == st] if not df.empty else pd.DataFrame()
            funnel.append({
                "stage": st,
                "count": len(st_df),
                "acv": round(_sum(st_df, "forecast_acv_amount"), 2)
            })
            
        # Movements between comp_df (or yesterday if compare is empty) and df
        movements = []
        prev_df_for_moves = comp_df if compare else df_yest
        if not df.empty and not prev_df_for_moves.empty:
            merged = pd.merge(
                prev_df_for_moves[["opportunity_id_18", "approval_status"]],
                df[["opportunity_id_18", "approval_status", "forecast_acv_amount"]],
                on="opportunity_id_18",
                suffixes=("_prev", "_curr")
            )
            changed = merged[merged["approval_status_prev"] != merged["approval_status_curr"]]
            grouped = changed.groupby(["approval_status_prev", "approval_status_curr"]).agg(
                count=("opportunity_id_18", "count"),
                acv=("forecast_acv_amount", "sum")
            ).reset_index()
            for _, row in grouped.iterrows():
                movements.append({
                    "from_status": row["approval_status_prev"],
                    "to_status": row["approval_status_curr"],
                    "count": int(row["count"]),
                    "acv": round(float(row["acv"]), 2)
                })
                
        # Top reasons for pending
        pending_reasons = []
        pending_df = df[df["approval_status"] == "Pending Approval"] if not df.empty else pd.DataFrame()
        if not pending_df.empty and "reason_for_approval" in pending_df.columns:
            reasons = pending_df["reason_for_approval"].value_counts().reset_index()
            reasons.columns = ["reason", "count"]
            for _, r in reasons.iterrows():
                reason_val = r["reason"]
                if pd.isna(reason_val) or str(reason_val).strip() == "":
                    continue
                reason_acv = _sum(pending_df[pending_df["reason_for_approval"] == reason_val], "forecast_acv_amount")
                pending_reasons.append({
                    "reason": reason_val,
                    "count": int(r["count"]),
                    "acv": round(reason_acv, 2)
                })
                
        return {
            "snapshot_date": snap.snapshot_date.isoformat(),
            "compare_date": comp_snap.snapshot_date.isoformat() if comp_snap else (snap_yest.snapshot_date.isoformat() if snap_yest else None),
            "data_slice": "Renewals",
            "data_slice_key": target_quarter,
            "total": {
                "count": total_count,
                "acv": round(total_acv, 2)
            },
            "statuses": statuses_list,
            "matrix": matrix,
            "categories": ALL_FC,
            "funnel": funnel,
            "movements": movements,
            "pending_reasons": pending_reasons[:5]
        }

    def get_deals(
        self,
        ctx: UserContext,
        status: Optional[str] = None,
        category: Optional[str] = None,
        as_of: Optional[str] = None,
        exclude_deleted_lost: bool = False
    ) -> list[dict]:
        snap = self._get_snapshot(ctx, as_of)
        if not snap:
            return []
            
        target_quarter = ScopeService.current_quarter(snap.snapshot_date)
        q = self.db.query(Opportunity).filter(
            Opportunity.snapshot_id == snap.id,
            Opportunity.sales_type == "Renewals",
            Opportunity.fiscal_period == target_quarter
        )
        if exclude_deleted_lost:
            q = q.filter(Opportunity.is_deleted_or_lost == False)
            
        if status:
            if status == "Blank":
                q = q.filter(or_(Opportunity.approval_status == None, Opportunity.approval_status == ""))
            elif status == "Pending Approval":
                q = q.filter(or_(Opportunity.approval_status == "Pending Approval", Opportunity.approval_status == "Pending-Approval"))
            else:
                q = q.filter(Opportunity.approval_status == status)
                
        if category:
            if category == "Blank":
                q = q.filter(or_(Opportunity.forecast_category == None, Opportunity.forecast_category == "", ~Opportunity.forecast_category.in_(["Closed", "Commit", "Best Case", "Pipeline"])))
            else:
                q = q.filter(Opportunity.forecast_category == category)
                
        opps = q.all()
        seen = set()
        deduped = []
        for o in reversed(opps): 
            if o.opportunity_id_18 not in seen:
                seen.add(o.opportunity_id_18)
                deduped.append(o)
        
        def to_dict(o):
            return {
                "id": o.id,
                "opportunity_id_18": o.opportunity_id_18,
                "opportunity_name": o.opportunity_name,
                "account_name": o.account_name,
                "forecast_category": o.forecast_category,
                "forecast_acv_amount": float(o.forecast_acv_amount or 0),
                "approval_status": o.approval_status,
                "reason_for_approval": o.extra_attributes.get("Reason for approval") if o.extra_attributes else None,
                "sub_region": o.sub_region,
                "business_unit_primary": o.business_unit_primary,
                "close_date": o.close_date.isoformat() if o.close_date else None
            }
        return [to_dict(o) for o in reversed(deduped)]
