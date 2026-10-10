from __future__ import annotations
import logging
import pandas as pd
from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from backend.models.opportunity import Opportunity
from backend.models.snapshot import UploadSnapshot
from backend.services.context import UserContext
from backend.services.scopes import ScopeService

log = logging.getLogger(__name__)

ALL_FC = ["Closed", "Commit", "Best Case", "Pipeline", "Blank"]
FUNNEL_STAGES = ["Approved", "Pending Approval", "Blank"]

def _parse_fp(fp: str) -> tuple[int, int]:
    """Q4-2026 -> (2026, 4)"""
    try:
        q, y = fp.split("-")
        return int(y), int(q[1])
    except:
        return (0, 0)

def _norm_fc(s: str | None) -> str:
    if not s or str(s).strip() in ("", "nan", "None"): return "Blank"
    s = str(s).strip()
    if s not in ["Closed", "Commit", "Best Case", "Pipeline"]: return "Blank"
    return s

def _norm_approval(s: str | None) -> str:
    if not s or str(s).strip() in ("", "nan", "None", "Blank"): return "Blank"
    s = str(s).strip()
    if s in ("Approved", "Approved - 2nd"): return "Approved"
    if s in ("Pending Approval", "Pending-Approval"): return "Pending Approval"
    return s

def _map_region(s: str | None) -> str:
    if not s or str(s).strip() in ("", "nan", "None"): return "Other"
    s = str(s).strip()
    if s == "Europe": return "Europe"
    if s == "APAC": return "APAC"
    if s == "AFRICA": return "Africa"
    if s == "MENA": return "Middle East and North Africa"
    if s == "NAMR": return "North America"
    if s == "South America": return "LATAM"
    return "Other"

def _opps_to_df(opps: list[Opportunity]) -> pd.DataFrame:
    if not opps:
        return pd.DataFrame()
    records = []
    for o in opps:
        records.append({
            "opportunity_id_18": o.opportunity_id_18,
            "opportunity_name": o.opportunity_name,
            "account_name": o.account_name,
            "forecast_acv_amount": float(o.forecast_acv_amount or 0.0),
            "forecast_category": _norm_fc(o.forecast_category),
            "business_unit": (o.business_unit_primary or "").strip() or "Unassigned",
            "is_deleted_or_lost": bool(o.is_deleted_or_lost),
            "fiscal_period": o.fiscal_period or "",
            "close_date": pd.to_datetime(o.close_date) if o.close_date else pd.NaT,
            "approval_status": _norm_approval(o.approval_status),
            "region": _map_region(o.revised_sub_region),
            "sales_type": o.sales_type or ""
        })
    df = pd.DataFrame(records)
    df = df.drop_duplicates(subset=["opportunity_id_18"], keep="last")
    return df

class V2DelayedService:
    def __init__(self, db: Session):
        self.db = db

    def _active_snap(self, as_of: str | None = None) -> UploadSnapshot | None:
        q = self.db.query(UploadSnapshot)
        if as_of:
            try:
                d = date.fromisoformat(as_of)
                return q.filter(UploadSnapshot.snapshot_date <= d).order_by(UploadSnapshot.snapshot_date.desc()).first()
            except ValueError:
                pass
        return q.filter(UploadSnapshot.is_active_today == True).order_by(UploadSnapshot.snapshot_date.desc()).first()

    def _snap_by_date(self, d: date) -> UploadSnapshot | None:
        return self.db.query(UploadSnapshot).filter(UploadSnapshot.snapshot_date == d).first()

    def _get_opps(self, snap: UploadSnapshot) -> list[Opportunity]:
        return self.db.query(Opportunity).filter(Opportunity.snapshot_id == snap.id).all()
    
    def _slice_renewals(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty: return df
        return df[(df["sales_type"] == "Renewals") & (~df["is_deleted_or_lost"])]

    def _calculate_delayed_overdue(self, t_df: pd.DataFrame, p_df: pd.DataFrame, t_snap: UploadSnapshot, p_snap: UploadSnapshot) -> pd.DataFrame:
        if p_df.empty or t_df.empty:
            return pd.DataFrame()
            
        p_q4 = p_df[p_df["fiscal_period"] == ScopeService.current_quarter(t_snap.snapshot_date)]
        if p_q4.empty:
            return pd.DataFrame()
            
        t_snap_date = pd.Timestamp(t_snap.snapshot_date)
        
        target_parsed = _parse_fp(ScopeService.current_quarter(t_snap.snapshot_date))
        
        delayed_ids = []
        push_out_days = []
        is_overdue_flags = []
        is_slipped_flags = []
        
        p_q4_indexed = p_q4.set_index("opportunity_id_18")
        t_indexed = t_df.set_index("opportunity_id_18")
        
        for opp_id, p_row in p_q4_indexed.iterrows():
            if opp_id not in t_indexed.index: continue
            
            t_row = t_indexed.loc[opp_id]
            t_fp = t_row["fiscal_period"]
            if not t_fp or '-' not in t_fp: continue
            t_parsed = _parse_fp(t_fp)
            
            is_slipped = (t_parsed[0] > target_parsed[0]) or (t_parsed[0] == target_parsed[0] and t_parsed[1] > target_parsed[1])
            is_later_close_date = pd.notna(t_row["close_date"]) and pd.notna(p_row["close_date"]) and t_row["close_date"] > p_row["close_date"]
            
            is_delayed = is_slipped or is_later_close_date
            
            # overdue: Close Date before the snapshot date and still open
            is_overdue = pd.notna(t_row["close_date"]) and t_row["close_date"] < t_snap_date and t_row["forecast_category"] != "Closed"
            
            if is_delayed or is_overdue:
                delayed_ids.append(opp_id)
                days = 0
                if pd.notna(t_row["close_date"]) and pd.notna(p_row["close_date"]) and t_row["close_date"] > p_row["close_date"]:
                    days = (t_row["close_date"] - p_row["close_date"]).days
                push_out_days.append(days)
                is_overdue_flags.append(is_overdue)
                is_slipped_flags.append(is_slipped)
                
        if not delayed_ids:
            return pd.DataFrame()
            
        res_df = t_indexed.loc[delayed_ids].copy()
        res_df["push_out_days"] = push_out_days
        res_df["is_overdue"] = is_overdue_flags
        res_df["is_slipped"] = is_slipped_flags
        res_df = res_df.reset_index()
        return res_df

    def get_summary(self, as_of: str | None, compare: str | None) -> dict:
        t_snap = self._active_snap(as_of)
        if not t_snap:
            return {"error": "No snapshot"}
            
        p_snap = None
        if compare == "last_week":
            p_snap = self._snap_by_date(t_snap.snapshot_date - timedelta(days=7))
        else: # yesterday default
            p_snap = self._snap_by_date(t_snap.snapshot_date - timedelta(days=1))
            
        if not p_snap:
            p_snap = self.db.query(UploadSnapshot).filter(UploadSnapshot.snapshot_date < t_snap.snapshot_date).order_by(UploadSnapshot.snapshot_date.desc()).first()
            if not p_snap:
                return {"error": "No compare"}

        target_q_str = ScopeService.current_quarter(t_snap.snapshot_date)
        target_q_label = ScopeService.quarter_label(target_q_str)
        
        t_df = _opps_to_df(self._get_opps(t_snap))
        p_df = _opps_to_df(self._get_opps(p_snap))
        
        t_ren = self._slice_renewals(t_df)
        p_ren = self._slice_renewals(p_df)
        
        y_snap = self._snap_by_date(t_snap.snapshot_date - timedelta(days=1)) or p_snap
        w_snap = self._snap_by_date(t_snap.snapshot_date - timedelta(days=7)) or p_snap
        
        y_ren = self._slice_renewals(_opps_to_df(self._get_opps(y_snap))) if y_snap != p_snap else p_ren
        w_ren = self._slice_renewals(_opps_to_df(self._get_opps(w_snap))) if w_snap != p_snap else p_ren
        
        delayed_y = self._calculate_delayed_overdue(t_df, y_ren, t_snap, y_snap)
        delayed_w = self._calculate_delayed_overdue(t_df, w_ren, t_snap, w_snap)
        
        # Calculate summary based on current requested compare
        delayed_df = delayed_y if compare != "last_week" else delayed_w
        
        total_count = len(delayed_df)
        total_acv = delayed_df["forecast_acv_amount"].sum() if not delayed_df.empty else 0.0
        
        overdue_df = delayed_df[delayed_df["is_overdue"]] if not delayed_df.empty else pd.DataFrame()
        slipped_df = delayed_df[delayed_df["is_slipped"]] if not delayed_df.empty else pd.DataFrame()
        
        overdue_y_df = delayed_y[delayed_y["is_overdue"]] if not delayed_y.empty else pd.DataFrame()
        overdue_w_df = delayed_w[delayed_w["is_overdue"]] if not delayed_w.empty else pd.DataFrame()
        
        slipped_y_df = delayed_y[delayed_y["is_slipped"]] if not delayed_y.empty else pd.DataFrame()
        slipped_w_df = delayed_w[delayed_w["is_slipped"]] if not delayed_w.empty else pd.DataFrame()

        def _get_deltas(df_y, df_w):
            c_y = len(df_y)
            c_w = len(df_w)
            a_y = df_y["forecast_acv_amount"].sum() if not df_y.empty else 0.0
            a_w = df_w["forecast_acv_amount"].sum() if not df_w.empty else 0.0
            return {
                "delta_yesterday": {"count": c_y, "acv": a_y},
                "delta_lastweek": {"count": c_w, "acv": a_w}
            }

        def _aggregate_by(col: str):
            res = []
            if delayed_df.empty: return res
            for val in delayed_df[col].unique():
                d = delayed_df[delayed_df[col] == val]
                d_y = delayed_y[delayed_y[col] == val] if not delayed_y.empty else pd.DataFrame()
                d_w = delayed_w[delayed_w[col] == val] if not delayed_w.empty else pd.DataFrame()
                res.append({
                    "label": val,
                    "count": len(d),
                    "acv": d["forecast_acv_amount"].sum(),
                    "avg_push_out": round(d["push_out_days"].mean(), 1) if len(d) > 0 else 0,
                    "max_push_out": int(d["push_out_days"].max()) if len(d) > 0 else 0,
                    **_get_deltas(d_y, d_w)
                })
            return sorted(res, key=lambda x: x["acv"], reverse=True)

        return {
            "data_slice": target_q_label,
            "data_slice_key": target_q_str,
            "snapshot_date": t_snap.snapshot_date.isoformat(),
            "compare_date": p_snap.snapshot_date.isoformat(),
            "yesterday_date": y_snap.snapshot_date.isoformat(),
            "lastweek_date": w_snap.snapshot_date.isoformat(),
            "total": {
                "count": total_count,
                "acv": round(total_acv, 2),
                **_get_deltas(delayed_y, delayed_w)
            },
            "overdue": {
                "count": len(overdue_df),
                "acv": round(overdue_df["forecast_acv_amount"].sum() if not overdue_df.empty else 0.0, 2),
                **_get_deltas(overdue_y_df, overdue_w_df)
            },
            "slipped": {
                "count": len(slipped_df),
                "acv": round(slipped_df["forecast_acv_amount"].sum() if not slipped_df.empty else 0.0, 2),
                **_get_deltas(slipped_y_df, slipped_w_df)
            },
            "by_region": _aggregate_by("region"),
            "by_bu": _aggregate_by("business_unit"),
            "by_category": _aggregate_by("forecast_category"),
            "by_approval": _aggregate_by("approval_status")
        }

    def get_deals(self, as_of: str | None, compare: str | None) -> dict:
        t_snap = self._active_snap(as_of)
        if not t_snap:
            return {"count": 0, "acv": 0.0, "deals": []}
            
        p_snap = None
        if compare == "last_week":
            p_snap = self._snap_by_date(t_snap.snapshot_date - timedelta(days=7))
        else: # yesterday default
            p_snap = self._snap_by_date(t_snap.snapshot_date - timedelta(days=1))
            
        if not p_snap:
            p_snap = self.db.query(UploadSnapshot).filter(UploadSnapshot.snapshot_date < t_snap.snapshot_date).order_by(UploadSnapshot.snapshot_date.desc()).first()
            if not p_snap:
                return {"count": 0, "acv": 0.0, "deals": []}

        t_df = _opps_to_df(self._get_opps(t_snap))
        p_df = _opps_to_df(self._get_opps(p_snap))
        
        t_ren = self._slice_renewals(t_df)
        p_ren = self._slice_renewals(p_df)
        
        delayed_df = self._calculate_delayed_overdue(t_df, p_ren, t_snap, p_snap)
        if delayed_df.empty:
            return {"count": 0, "acv": 0.0, "deals": []}
            
        # Format close_date back to string for json
        delayed_df["close_date"] = delayed_df["close_date"].apply(lambda x: x.strftime('%Y-%m-%d') if pd.notna(x) else None)
        deals = delayed_df.to_dict("records")
        return {
            "count": len(deals),
            "acv": round(delayed_df["forecast_acv_amount"].sum(), 2),
            "deals": deals
        }
