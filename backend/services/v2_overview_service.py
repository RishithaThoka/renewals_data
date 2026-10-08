"""
V2 Overview Service — powers Tab 1 (Overview / Dashboard).

Data slice: Q4 slice = opportunities where in_q4_2026 is True, deduped by
opportunity_id_18 (multiple snapshots may contain the same opp; we always use
the LATEST record for a given opp_id within the active snapshot).

Deleted/Lost: INCLUDED by default (matches Excel pivots).
Movements: computed by diffing two scoped snapshots by Opportunity ID —
  NOT from change_logs (unscoped, only exists for yesterday, inflates Q4).
Blank category: treated as its own column alongside Closed/Commit/Best Case/Pipeline.
Slippage to 2027: Q4 opps whose close_date.year == 2027.
Region mapping: EXACT match on revised_sub_region value.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from backend.models.opportunity import Opportunity
from backend.models.snapshot import UploadSnapshot
from backend.services.context import UserContext

log = logging.getLogger(__name__)

# ── Region normalisation (EXACT match as specified) ──────────────────────────
REGION_MAP: dict[str, str] = {
    "Europe":        "Europe",
    "APAC":          "APAC",
    "AFRICA":        "Africa",
    "MENA":          "Middle East and North Africa",
    "NAMR":          "North America",
    "South America": "LATAM",
}
CANONICAL_REGIONS = list(REGION_MAP.values())  # preserves insertion order
ALL_FC = ["Closed", "Commit", "Best Case", "Pipeline", "Blank"]
POSITIVE_MOVES = [
    ("Commit",     "Closed"),
    ("Best Case",  "Commit"),
    ("Pipeline",   "Best Case"),
]
NEGATIVE_MOVES = [
    ("Commit",     "Best Case"),
    ("Best Case",  "Pipeline"),
    ("Commit",     "Pipeline"),  # 2-step downgrade shown in the reference
]
APPROVAL_STATUSES = ["Approved", "Pending Approval", "Blank", "Rejected"]


def _norm_approval(s: str | None) -> str:
    if not s or str(s).strip() in ("", "nan", "None", "Blank"):
        return "Blank"
    s = s.strip()
    if s in ("Approved", "Approved - 2nd"):
        return "Approved"
    if s in ("Pending Approval", "Pending-Approval"):
        return "Pending Approval"
    return s  # Rejected or anything else


def _norm_fc(s: str | None) -> str:
    if not s or str(s).strip() in ("", "nan", "None"):
        return "Blank"
    return s.strip()


def _norm_region(revised_sub_region: str | None) -> str:
    """Exact-match region mapping; returns 'Other' if not in the map."""
    if not revised_sub_region:
        return "Other"
    return REGION_MAP.get(str(revised_sub_region).strip(), "Other")


def _opps_to_df(opps: list[Opportunity]) -> pd.DataFrame:
    if not opps:
        return pd.DataFrame()
    records = []
    for o in opps:
        records.append({
            "opportunity_id_18": o.opportunity_id_18 or "",
            "opportunity_name":  o.opportunity_name or "",
            "account_name":      o.account_name or "",
            "revised_sub_region": o.revised_sub_region or "",
            "canonical_region":   _norm_region(o.revised_sub_region),
            "business_unit_primary": o.business_unit_primary or "",
            "forecast_category":  _norm_fc(o.forecast_category),
            "forecast_acv_amount": float(o.forecast_acv_amount or 0),
            "approval_status":    _norm_approval(o.approval_status),
            "close_date":         o.close_date,
            "close_year":         o.close_date.year if o.close_date else None,
            "is_deleted_or_lost": bool(o.is_deleted_or_lost),
        })
    return pd.DataFrame(records)


class V2OverviewService:
    def __init__(self, db: Session):
        self.db = db

    # ── snapshot helpers ──────────────────────────────────────────────────────

    def _active_snap(self) -> UploadSnapshot | None:
        return (
            self.db.query(UploadSnapshot)
            .filter(UploadSnapshot.is_active_today == True)  # noqa: E712
            .order_by(UploadSnapshot.snapshot_date.desc())
            .first()
        )

    def _snap_by_date(self, d: date) -> UploadSnapshot | None:
        return (
            self.db.query(UploadSnapshot)
            .filter(UploadSnapshot.snapshot_date == d)
            .first()
        )

    def _q4_opps(self, snap: UploadSnapshot, exclude_deleted: bool = False) -> list[Opportunity]:
        q = (
            self.db.query(Opportunity)
            .filter(
                Opportunity.snapshot_id == snap.id,
                Opportunity.in_q4_2026 == True,  # noqa: E712
            )
        )
        if exclude_deleted:
            q = q.filter(Opportunity.is_deleted_or_lost == False)  # noqa: E712
        return q.all()

    def _yesterday_snap(self, snap: UploadSnapshot) -> UploadSnapshot | None:
        from datetime import timedelta
        # Try yesterday_date attribute first, then date-1
        if getattr(snap, "yesterday_date", None):
            s = self._snap_by_date(snap.yesterday_date)
            if s:
                return s
        return self._snap_by_date(snap.snapshot_date - timedelta(days=1))

    def _lastweek_snap(self, snap: UploadSnapshot) -> UploadSnapshot | None:
        from datetime import timedelta
        return self._snap_by_date(snap.snapshot_date - timedelta(days=7))

    # ── core aggregation helpers ──────────────────────────────────────────────

    def _category_summary(self, df: pd.DataFrame) -> dict:
        """Count + ACV per forecast category including Blank."""
        if df.empty:
            return {fc: {"count": 0, "acv": 0.0} for fc in ALL_FC}
        result = {}
        for fc in ALL_FC:
            sub = df[df["forecast_category"] == fc]
            result[fc] = {
                "count": len(sub),
                "acv": round(float(sub["forecast_acv_amount"].sum()), 2),
            }
        return result

    def _movements(
        self,
        today_df: pd.DataFrame,
        prev_df: pd.DataFrame,
        scope_label: str = "q4",
    ) -> dict:
        """
        Compute forecast category and approval movements by diffing two scoped DataFrames.
        Joins on opportunity_id_18. Only considers opps present in BOTH snapshots.
        Returns positive_moves, negative_moves, approval_moves lists.
        """
        if today_df.empty or prev_df.empty:
            return {
                "positive": [], "negative": [], "approval": [],
                "slippage_to_2027": {"count": 0, "acv": 0.0},
            }

        t = today_df.set_index("opportunity_id_18")
        p = prev_df.set_index("opportunity_id_18")
        common = t.index.intersection(p.index)

        positive: list[dict] = []
        negative: list[dict] = []
        approval_moves: list[dict] = []

        # Pre-build move buckets
        pos_buckets: dict[tuple, list] = {m: [] for m in POSITIVE_MOVES}
        neg_buckets: dict[tuple, list] = {m: [] for m in NEGATIVE_MOVES}
        app_buckets: dict[tuple, list] = {}

        for opp_id in common:
            tr = t.loc[opp_id]
            pr = p.loc[opp_id]
            fc_now  = tr["forecast_category"] if isinstance(tr, pd.Series) else tr.iloc[0]["forecast_category"]
            fc_prev = pr["forecast_category"] if isinstance(pr, pd.Series) else pr.iloc[0]["forecast_category"]
            acv     = float(tr["forecast_acv_amount"] if isinstance(tr, pd.Series) else tr.iloc[0]["forecast_acv_amount"])
            name    = str(tr["opportunity_name"] if isinstance(tr, pd.Series) else tr.iloc[0]["opportunity_name"])
            region  = str(tr["canonical_region"] if isinstance(tr, pd.Series) else tr.iloc[0]["canonical_region"])
            ap_now  = str(tr["approval_status"] if isinstance(tr, pd.Series) else tr.iloc[0]["approval_status"])
            ap_prev = str(pr["approval_status"] if isinstance(pr, pd.Series) else pr.iloc[0]["approval_status"])

            move_key = (fc_prev, fc_now)
            if fc_prev != fc_now:
                deal = {"opportunity_id_18": opp_id, "opportunity_name": name,
                        "region": region, "from_category": fc_prev, "to_category": fc_now, "acv": acv}
                if move_key in pos_buckets:
                    pos_buckets[move_key].append(deal)
                elif move_key in neg_buckets:
                    neg_buckets[move_key].append(deal)

            if ap_now != ap_prev:
                ak = (ap_prev, ap_now)
                if ak not in app_buckets:
                    app_buckets[ak] = []
                app_buckets[ak].append({
                    "opportunity_id_18": opp_id, "opportunity_name": name,
                    "from_status": ap_prev, "to_status": ap_now, "acv": acv, "region": region,
                })

        def _bucket_summary(bucket: list[dict]) -> dict:
            return {
                "count": len(bucket),
                "acv": round(sum(d["acv"] for d in bucket), 2),
                "deals": bucket,
            }

        for (f, t_), deals in pos_buckets.items():
            positive.append({
                "from_category": f, "to_category": t_,
                **_bucket_summary(deals),
            })
        for (f, t_), deals in neg_buckets.items():
            negative.append({
                "from_category": f, "to_category": t_,
                **_bucket_summary(deals),
            })
        for (fa, ta), deals in app_buckets.items():
            approval_moves.append({
                "from_status": fa, "to_status": ta,
                **_bucket_summary(deals),
            })

        # Slippage to 2027: Q4 opps whose close_date.year == 2027 in TODAY but not in PREV
        # (or: any Q4 opp where close_date.year == 2027)
        slip_df = today_df[today_df["close_year"] == 2027]
        slippage = {
            "count": len(slip_df),
            "acv": round(float(slip_df["forecast_acv_amount"].sum()), 2),
            "deals": slip_df[["opportunity_id_18", "opportunity_name", "canonical_region",
                               "forecast_category", "forecast_acv_amount"]].to_dict(orient="records"),
        }

        return {
            "positive": positive,
            "negative": negative,
            "approval": approval_moves,
            "slippage_to_2027": slippage,
        }

    # ── public API ────────────────────────────────────────────────────────────

    def get_summary(
        self,
        ctx: UserContext,
        exclude_deleted: bool = False,
    ) -> dict:
        """
        Main Overview summary:
        - Section 1: Total Q4 ACV + count + Δ yesterday + Δ last week
        - Section 2: 4 category cards (Closed/Commit/BC/Pipeline) + Blank card
        - Section 3: Slippage to 2027
        - Snapshot metadata (date, files, uploaded_at)
        """
        snap = self._active_snap()
        if snap is None:
            return {"error": "no_snapshot"}

        opps = self._q4_opps(snap, exclude_deleted=exclude_deleted)
        df = _opps_to_df(opps)

        total_count = len(df)
        total_acv   = round(float(df["forecast_acv_amount"].sum()), 2) if not df.empty else 0.0
        cats = self._category_summary(df)

        slip_df = df[df["close_year"] == 2027] if not df.empty else pd.DataFrame()
        slippage = {
            "count": len(slip_df),
            "acv": round(float(slip_df["forecast_acv_amount"].sum()), 2),
        }

        # ── Yesterday deltas ──────────────────────────────────────────────────
        yest_snap = self._yesterday_snap(snap)
        delta_yesterday = None
        cats_delta_yesterday = None
        slip_delta_yesterday = None
        if yest_snap:
            y_opps = self._q4_opps(yest_snap, exclude_deleted=exclude_deleted)
            y_df   = _opps_to_df(y_opps)
            y_total_count = len(y_df)
            y_total_acv   = round(float(y_df["forecast_acv_amount"].sum()), 2) if not y_df.empty else 0.0
            y_cats = self._category_summary(y_df)
            y_slip_df = y_df[y_df["close_year"] == 2027] if not y_df.empty else pd.DataFrame()
            delta_yesterday = {
                "count": total_count - y_total_count,
                "acv":   round(total_acv - y_total_acv, 2),
                "snapshot_date": yest_snap.snapshot_date.isoformat(),
            }
            cats_delta_yesterday = {
                fc: {
                    "count": cats[fc]["count"] - y_cats[fc]["count"],
                    "acv":   round(cats[fc]["acv"] - y_cats[fc]["acv"], 2),
                }
                for fc in ALL_FC
            }
            slip_delta_yesterday = {
                "count": slippage["count"] - len(y_slip_df),
                "acv":   round(slippage["acv"] - float(y_slip_df["forecast_acv_amount"].sum()), 2),
            }

        # ── Last-week deltas ──────────────────────────────────────────────────
        lw_snap = self._lastweek_snap(snap)
        delta_lastweek = None
        cats_delta_lastweek = None
        slip_delta_lastweek = None
        if lw_snap:
            lw_opps = self._q4_opps(lw_snap, exclude_deleted=exclude_deleted)
            lw_df   = _opps_to_df(lw_opps)
            lw_total_count = len(lw_df)
            lw_total_acv   = round(float(lw_df["forecast_acv_amount"].sum()), 2) if not lw_df.empty else 0.0
            lw_cats = self._category_summary(lw_df)
            lw_slip_df = lw_df[lw_df["close_year"] == 2027] if not lw_df.empty else pd.DataFrame()
            delta_lastweek = {
                "count": total_count - lw_total_count,
                "acv":   round(total_acv - lw_total_acv, 2),
                "snapshot_date": lw_snap.snapshot_date.isoformat(),
            }
            cats_delta_lastweek = {
                fc: {
                    "count": cats[fc]["count"] - lw_cats[fc]["count"],
                    "acv":   round(cats[fc]["acv"] - lw_cats[fc]["acv"], 2),
                }
                for fc in ALL_FC
            }
            slip_delta_lastweek = {
                "count": slippage["count"] - len(lw_slip_df),
                "acv":   round(slippage["acv"] - float(lw_slip_df["forecast_acv_amount"].sum()), 2),
            }

        # ── Other regions notice ──────────────────────────────────────────────
        other_count = 0
        if not df.empty:
            other_count = int((df["canonical_region"] == "Other").sum())

        return {
            "snapshot_date":    snap.snapshot_date.isoformat(),
            "snapshot_id":      snap.id,
            "data_slice":       "Q4-2026",
            "exclude_deleted":  exclude_deleted,
            "other_region_count": other_count,
            # Section 1
            "total": {
                "count": total_count,
                "acv":   total_acv,
                "delta_yesterday": delta_yesterday,
                "delta_lastweek":  delta_lastweek,
            },
            # Section 2 — category cards
            "categories": {
                fc: {
                    **cats[fc],
                    "delta_yesterday": cats_delta_yesterday[fc] if cats_delta_yesterday else None,
                    "delta_lastweek":  cats_delta_lastweek[fc] if cats_delta_lastweek else None,
                }
                for fc in ALL_FC
            },
            # Section 3 — slippage
            "slippage_to_2027": {
                **slippage,
                "delta_yesterday": slip_delta_yesterday,
                "delta_lastweek":  slip_delta_lastweek,
            },
        }

    def get_movements(
        self,
        ctx: UserContext,
        compare: str = "yesterday",
        exclude_deleted: bool = False,
    ) -> dict:
        """
        Section 4: Forecast Category Movement + Approval Movement.
        compare: 'yesterday' | 'last_week'
        """
        snap = self._active_snap()
        if snap is None:
            return {"error": "no_snapshot"}

        opps = self._q4_opps(snap, exclude_deleted=exclude_deleted)
        today_df = _opps_to_df(opps)

        prev_snap = self._yesterday_snap(snap) if compare == "yesterday" else self._lastweek_snap(snap)
        if prev_snap is None:
            return {
                "compare": compare,
                "compare_date": None,
                "positive": [], "negative": [], "approval": [],
                "slippage_to_2027": {"count": 0, "acv": 0.0},
            }

        prev_opps = self._q4_opps(prev_snap, exclude_deleted=exclude_deleted)
        prev_df   = _opps_to_df(prev_opps)

        moves = self._movements(today_df, prev_df)
        return {
            "compare": compare,
            "compare_date": prev_snap.snapshot_date.isoformat(),
            **moves,
        }

    def get_regional_breakdown(
        self,
        ctx: UserContext,
        exclude_deleted: bool = False,
    ) -> dict:
        """
        Sections 5 + 6:
        5. Proposal Confirmation: Region | Total ACV | Approved | Pending | Blank
        6. Regional Trend: Region | Total ACV | Closed | Commit | Best Case | Pipeline | Blank
        Both include a totals row; Section 6 includes a check that sum == Section 1 total.
        """
        snap = self._active_snap()
        if snap is None:
            return {"error": "no_snapshot"}

        opps = self._q4_opps(snap, exclude_deleted=exclude_deleted)
        df = _opps_to_df(opps)
        if df.empty:
            return {"proposal_confirmation": [], "regional_trend": [], "total_acv": 0.0, "other_count": 0}

        # ── Section 5: Proposal Confirmation ─────────────────────────────────
        prop_rows = []
        for region in CANONICAL_REGIONS + ["Other"]:
            r_df = df[df["canonical_region"] == region]
            if r_df.empty and region != "Other":
                # Include even if 0 so table is always 6-row
                prop_rows.append({
                    "region": region, "total_acv": 0.0,
                    "approved_count": 0, "pending_count": 0, "blank_count": 0,
                    "approved_acv": 0.0, "pending_acv": 0.0, "blank_acv": 0.0,
                })
                continue
            if r_df.empty:
                continue
            prop_rows.append({
                "region": region,
                "total_acv":    round(float(r_df["forecast_acv_amount"].sum()), 2),
                "approved_count": int((r_df["approval_status"] == "Approved").sum()),
                "pending_count":  int((r_df["approval_status"] == "Pending Approval").sum()),
                "blank_count":    int((r_df["approval_status"] == "Blank").sum()),
                "approved_acv":  round(float(r_df[r_df["approval_status"] == "Approved"]["forecast_acv_amount"].sum()), 2),
                "pending_acv":   round(float(r_df[r_df["approval_status"] == "Pending Approval"]["forecast_acv_amount"].sum()), 2),
                "blank_acv":     round(float(r_df[r_df["approval_status"] == "Blank"]["forecast_acv_amount"].sum()), 2),
            })

        # Totals row for Section 5
        prop_totals = {
            "region": "Total",
            "total_acv":     round(float(df["forecast_acv_amount"].sum()), 2),
            "approved_count": int((df["approval_status"] == "Approved").sum()),
            "pending_count":  int((df["approval_status"] == "Pending Approval").sum()),
            "blank_count":    int((df["approval_status"] == "Blank").sum()),
        }

        # ── Section 6: Regional Trend ─────────────────────────────────────────
        trend_rows = []
        for region in CANONICAL_REGIONS + ["Other"]:
            r_df = df[df["canonical_region"] == region]
            if r_df.empty and region != "Other":
                row = {"region": region, "total_count": 0, "total_acv": 0.0}
                for fc in ALL_FC:
                    row[f"{fc.lower().replace(' ', '_')}_count"] = 0
                    row[f"{fc.lower().replace(' ', '_')}_acv"] = 0.0
                trend_rows.append(row)
                continue
            if r_df.empty:
                continue
            row = {
                "region":       region,
                "total_count":  len(r_df),
                "total_acv":    round(float(r_df["forecast_acv_amount"].sum()), 2),
            }
            for fc in ALL_FC:
                fc_key = fc.lower().replace(" ", "_")
                fc_df = r_df[r_df["forecast_category"] == fc]
                row[f"{fc_key}_count"] = len(fc_df)
                row[f"{fc_key}_acv"]   = round(float(fc_df["forecast_acv_amount"].sum()), 2)
            trend_rows.append(row)

        # Totals row for Section 6
        total_row = {"region": "Total", "total_count": len(df),
                     "total_acv": round(float(df["forecast_acv_amount"].sum()), 2)}
        for fc in ALL_FC:
            fc_key = fc.lower().replace(" ", "_")
            fc_df = df[df["forecast_category"] == fc]
            total_row[f"{fc_key}_count"] = len(fc_df)
            total_row[f"{fc_key}_acv"]   = round(float(fc_df["forecast_acv_amount"].sum()), 2)

        regional_sum = sum(r["total_acv"] for r in trend_rows)
        check_passes = abs(regional_sum - total_row["total_acv"]) < 0.01

        return {
            "proposal_confirmation": prop_rows,
            "proposal_confirmation_totals": prop_totals,
            "regional_trend": trend_rows,
            "regional_trend_totals": total_row,
            "regional_sum": round(regional_sum, 2),
            "total_acv_check_passes": check_passes,
            "other_count": int((df["canonical_region"] == "Other").sum()),
        }
