"""
IngestService — handles daily 4-file upload, slot detection, pre-commit validation,
reconciliation against pivot sheets, and atomic commit of snapshot with scopes.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from backend.models.snapshot import UploadSnapshot, UploadedFile
from backend.models.opportunity import Opportunity
from backend.models.daily_summary import DailySummary
from backend.models.change_log import ChangeLog, ForecastMovementLog
from backend.services.context import UserContext
from backend.utils.excel_parser import (
    detect_file_slot,
    compute_file_sha256,
    _normalise_col,
    _map_columns,
    RENEWALS_COLUMN_MAP,
    parse_comparison_tool,
    parse_summary_workbook,
    parse_renewals_summary,
)
from backend.utils.normalise import (
    normalise_approval_status,
    normalise_forecast_category,
    primary_business_unit,
    to_decimal,
)

log = logging.getLogger(__name__)

# Temporary in-memory cache for validated upload sessions
# {session_id: session_dict}
_UPLOAD_SESSIONS: dict[str, dict[str, Any]] = {}


def compute_previous_working_day(d: date) -> date:
    """
    Monday -> Friday (3 days earlier)
    Tuesday-Friday -> 1 day earlier
    Sunday -> Friday (2 days earlier)
    Saturday -> Friday (1 day earlier)
    """
    weekday = d.weekday()  # Monday=0, Sunday=6
    if weekday == 0:
        return d - timedelta(days=3)
    elif weekday == 6:
        return d - timedelta(days=2)
    elif weekday == 5:
        return d - timedelta(days=1)
    else:
        return d - timedelta(days=1)


def _coerce_date(val) -> date | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, (date, datetime)):
        return val.date() if isinstance(val, datetime) else val
    try:
        return pd.to_datetime(str(val)).date()
    except Exception:
        return None


def _coerce_datetime(val) -> datetime | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, datetime):
        return val
    try:
        return pd.to_datetime(str(val)).to_pydatetime()
    except Exception:
        return None


def _coerce_float(val) -> float | None:
    if val is None:
        return None
    try:
        s = str(val).strip().replace(",", "")
        return float(s) if s and s.lower() != "nan" else None
    except (ValueError, TypeError):
        return None


def _coerce_int(val) -> int | None:
    f = _coerce_float(val)
    return int(f) if f is not None else None


def _safe_str(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s and s.lower() not in ("nan", "none", "nat") else None


class IngestService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # 4-File Upload Validation & Preview
    # ------------------------------------------------------------------

    def validate_upload(
        self,
        ctx: UserContext,
        files_dict: dict[str, Path],
        data_as_of: date,
        yesterday_date: date | None = None,
    ) -> dict[str, Any]:
        """
        Validate uploaded files and generate a PREVIEW without saving anything to the DB.
        files_dict maps requested slot ('comparison_tool', 'fiscal_2026', 'fiscal_2027', 'fiscal_q4')
        to local temporary file Path.
        """
        if yesterday_date is None:
            yesterday_date = compute_previous_working_day(data_as_of)

        errors: list[str] = []
        warnings: list[str] = []
        file_metadata: list[dict[str, Any]] = []

        # 1. Verify Comparison Tool is present
        comp_path = files_dict.get("comparison_tool")
        if not comp_path or not comp_path.exists():
            errors.append("Renewal Comparison Tool is mandatory but was not uploaded.")
            return {
                "errors": errors,
                "warnings": warnings,
                "can_commit": False,
                "session_id": None,
            }

        # 2. Check slots, signatures, and SHA-256 hashes
        all_hashes: dict[str, str] = {}
        for slot, path in files_dict.items():
            if not path or not path.exists():
                continue
            sha = compute_file_sha256(path)
            all_hashes[slot] = sha

            detected_slot, detected_desc = detect_file_slot(path)
            if detected_slot != "unknown" and detected_slot != slot:
                warnings.append(
                    f"File in slot '{slot}' ({path.name}) appears to be '{detected_slot}': {detected_desc}"
                )

            # Check if this exact hash was already uploaded to a snapshot
            existing_upload = (
                self.db.query(UploadedFile)
                .filter(UploadedFile.sha256_hash == sha)
                .first()
            )
            if existing_upload:
                warnings.append(
                    f"File '{path.name}' has identical content (SHA-256) to an earlier upload on snapshot date {existing_upload.snapshot.snapshot_date}."
                )

            file_metadata.append({
                "slot": slot,
                "detected_slot": detected_slot,
                "filename": path.name,
                "size_bytes": path.stat().st_size,
                "sha256": sha,
            })

        # Check if snapshot already exists for this date
        existing_snap = (
            self.db.query(UploadSnapshot)
            .filter(UploadSnapshot.snapshot_date == data_as_of)
            .first()
        )
        snapshot_exists = existing_snap is not None
        if snapshot_exists:
            warnings.append(
                f"A snapshot already exists for {data_as_of.isoformat()} ({existing_snap.row_count} rows). Confirming will ask to replace."
            )

        # Flag weekend date
        if data_as_of.weekday() in (5, 6):
            warnings.append(
                f"Data as of date {data_as_of.isoformat()} falls on a weekend ({data_as_of.strftime('%A')})."
            )

        # 3. Parse Comparison Tool sheets
        try:
            comp_sheets = parse_comparison_tool(comp_path)
        except Exception as exc:
            errors.append(f"Failed to read Comparison Tool: {exc}")
            return {"errors": errors, "warnings": warnings, "can_commit": False, "session_id": None}

        today_raw = comp_sheets.get("today")
        yesterday_raw = comp_sheets.get("yesterday")

        if today_raw is None or today_raw.empty:
            errors.append("Comparison Tool is missing the mandatory 'today' sheet or it is empty.")
        if yesterday_raw is None:
            warnings.append("Comparison Tool is missing the 'yesterday' sheet; comparisons against yesterday will be limited.")

        if errors:
            return {"errors": errors, "warnings": warnings, "can_commit": False, "session_id": None}

        # Validate required columns in today sheet
        today_mapped = _map_columns(today_raw)
        if "opportunity_id_18" not in today_mapped.columns:
            errors.append("Comparison Tool 'today' sheet is missing required column 'Opportunity ID 18 Digit'.")
        if "forecast_acv_amount" not in today_mapped.columns:
            errors.append("Comparison Tool 'today' sheet is missing required column 'Forecast ACV Amount'.")

        if errors:
            return {"errors": errors, "warnings": warnings, "can_commit": False, "session_id": None}

        # Check duplicate IDs within today sheet
        today_ids = today_mapped["opportunity_id_18"].dropna().astype(str).str.strip()
        dupes = today_ids[today_ids.duplicated()].unique()
        if len(dupes) > 0:
            errors.append(f"Comparison Tool 'today' sheet contains duplicate Opportunity IDs: {list(dupes)[:5]}")

        # Check ACV numeric
        acv_series = today_mapped["forecast_acv_amount"].dropna()
        non_numeric_acv = pd.to_numeric(acv_series.astype(str).str.replace(",", "").str.strip(), errors="coerce").isna().sum()
        if non_numeric_acv > 0:
            errors.append(f"Comparison Tool 'today' sheet contains {non_numeric_acv} non-numeric ACV entries.")

        if errors:
            return {"errors": errors, "warnings": warnings, "can_commit": False, "session_id": None}

        # 4. Parse Summary Workbooks for scope IDs
        scope_ids: dict[str, set[str]] = {
            "fy2026": set(),
            "fy2027": set(),
            "q4_2026": set(),
        }
        scope_available: dict[str, bool] = {
            "fy2026": False,
            "fy2027": False,
            "q4_2026": False,
        }

        summary_dfs: dict[str, dict[str, pd.DataFrame]] = {}
        for slot in ["fiscal_2026", "fiscal_2027", "fiscal_q4"]:
            slot_path = files_dict.get(slot)
            if slot_path and slot_path.exists():
                try:
                    s_sheets = parse_summary_workbook(slot_path)
                    summary_dfs[slot] = s_sheets
                    td = s_sheets.get("today_data")
                    if td is not None and not td.empty:
                        td_mapped = _map_columns(td)
                        if "opportunity_id_18" in td_mapped.columns:
                            ids = set(td_mapped["opportunity_id_18"].dropna().astype(str).str.strip())
                            scope_ids[slot] = ids
                            scope_available[slot] = True

                            # Check Sales Type == 'Renewals'
                            if "sales_type" in td_mapped.columns:
                                non_renewals = td_mapped[td_mapped["sales_type"].astype(str).str.strip().str.lower() != "renewals"]
                                if not non_renewals.empty:
                                    warnings.append(
                                        f"{slot_path.name} contains {len(non_renewals)} rows with Sales Type other than 'Renewals'."
                                    )

                            # Reconcile against ApprovalStatus_Summary if present
                            appr_sheet = s_sheets.get("approvalstatus_summary")
                            if appr_sheet is not None and not appr_sheet.empty:
                                try:
                                    gt_row = appr_sheet[appr_sheet.iloc[:, 0].astype(str).str.strip().str.lower() == "grand total"]
                                    if not gt_row.empty:
                                        # Compare total count / ACV
                                        sheet_cnt = float(gt_row.iloc[0, 1]) if len(gt_row.columns) > 1 else None
                                        sheet_acv = float(gt_row.iloc[0, 2]) if len(gt_row.columns) > 2 else None
                                        computed_cnt = len(td_mapped)
                                        computed_acv = float(td_mapped["forecast_acv_amount"].astype(float).sum()) if "forecast_acv_amount" in td_mapped.columns else 0.0

                                        if sheet_cnt and abs(sheet_cnt - computed_cnt) > 0:
                                            warnings.append(
                                                f"{slot_path.name}: computed row count ({computed_cnt}) differs from ApprovalStatus_Summary ({int(sheet_cnt)})."
                                            )
                                except Exception:
                                    pass
                except Exception as exc:
                    warnings.append(f"Warning reading {slot_path.name}: {exc}")

        # Renewals scope = union of the three scopes
        renewals_ids = scope_ids["fy2026"].union(scope_ids["fy2027"]).union(scope_ids["q4_2026"])
        renewals_available = any(scope_available.values())

        # Check summary file IDs not found in comparison tool
        all_comp_ids = set(today_ids)
        missing_ids = renewals_ids - all_comp_ids
        if missing_ids:
            warnings.append(
                f"{len(missing_ids)} Opportunity IDs present in summary files were not found in Comparison Tool today sheet."
            )

        # 5. Compute Scope Metrics (Raw vs Active)
        stage_col = next((c for c in today_mapped.columns if c in ("stage_number", "stage")), None)

        def _metrics_for(ids: set[str] | None):
            if ids is None:
                sub = today_mapped
            else:
                sub = today_mapped[today_mapped["opportunity_id_18"].astype(str).str.strip().isin(ids)]
            raw_cnt = len(sub)
            raw_acv = float(sub["forecast_acv_amount"].astype(float).sum()) if "forecast_acv_amount" in sub.columns else 0.0

            if stage_col:
                del_mask = sub[stage_col].astype(str).str.strip().isin(["Deleted", "Lost"])
                active_sub = sub[~del_mask]
            else:
                active_sub = sub

            active_cnt = len(active_sub)
            active_acv = float(active_sub["forecast_acv_amount"].astype(float).sum()) if "forecast_acv_amount" in active_sub.columns else 0.0
            deleted_lost_cnt = raw_cnt - active_cnt

            return {
                "raw_count": raw_cnt,
                "raw_acv": round(raw_acv, 2),
                "active_count": active_cnt,
                "active_acv": round(active_acv, 2),
                "deleted_lost_count": deleted_lost_cnt,
            }

        scopes_summary = {
            "all": {
                **_metrics_for(None),
                "available": True,
                "label": "All Opportunities",
            },
            "renewals": {
                **(_metrics_for(renewals_ids) if renewals_available else {"raw_count": None, "raw_acv": None, "active_count": None, "active_acv": None}),
                "available": renewals_available,
                "label": "Renewals (Union)",
            },
            "fy2026": {
                **(_metrics_for(scope_ids["fy2026"]) if scope_available["fy2026"] else {"raw_count": None, "raw_acv": None, "active_count": None, "active_acv": None}),
                "available": scope_available["fy2026"],
                "label": "Fiscal 2026",
            },
            "fy2027": {
                **(_metrics_for(scope_ids["fy2027"]) if scope_available["fy2027"] else {"raw_count": None, "raw_acv": None, "active_count": None, "active_acv": None}),
                "available": scope_available["fy2027"],
                "label": "Fiscal 2027",
            },
            "q4_2026": {
                **(_metrics_for(scope_ids["q4_2026"]) if scope_available["q4_2026"] else {"raw_count": None, "raw_acv": None, "active_count": None, "active_acv": None}),
                "available": scope_available["q4_2026"],
                "label": "Fiscal Q4",
            },
        }

        # Check row count movement vs previous snapshot in DB (>5%)
        prev_snap = (
            self.db.query(UploadSnapshot)
            .filter(UploadSnapshot.snapshot_date < data_as_of)
            .order_by(UploadSnapshot.snapshot_date.desc())
            .first()
        )
        if prev_snap and prev_snap.row_count > 0:
            diff_pct = abs(len(today_mapped) - prev_snap.row_count) / prev_snap.row_count * 100
            if diff_pct > 5.0:
                warnings.append(
                    f"Row count moved by {diff_pct:.1f}% vs previous snapshot ({prev_snap.snapshot_date}: {prev_snap.row_count} rows -> today: {len(today_mapped)} rows)."
                )

        # 6. Reconcile FinalChangeReport changes
        fcr = comp_sheets.get("finalchangereport")
        fcr_count = len(fcr) if fcr is not None and not fcr.empty else None

        can_commit = len(errors) == 0
        session_id = str(uuid.uuid4())
        _UPLOAD_SESSIONS[session_id] = {
            "data_as_of": data_as_of,
            "yesterday_date": yesterday_date,
            "files_dict": files_dict,
            "file_metadata": file_metadata,
            "today_mapped": today_mapped,
            "today_raw": today_raw,
            "yesterday_raw": yesterday_raw,
            "comp_sheets": comp_sheets,
            "summary_dfs": summary_dfs,
            "scope_ids": scope_ids,
            "scope_available": scope_available,
            "renewals_ids": renewals_ids,
            "renewals_available": renewals_available,
            "scopes_summary": scopes_summary,
            "snapshot_exists": snapshot_exists,
            "can_commit": can_commit,  # stored so commit can reject failed sessions
        }

        return {
            "session_id": session_id,
            "data_as_of_date": data_as_of.isoformat(),
            "yesterday_date": yesterday_date.isoformat(),
            "snapshot_exists": snapshot_exists,
            "files": file_metadata,
            "scopes": scopes_summary,
            "warnings": warnings,
            "errors": errors,
            "can_commit": can_commit,
            "fcr_changes_count": fcr_count,
        }

    # ------------------------------------------------------------------
    # Atomic Commit of Upload
    # ------------------------------------------------------------------

    def commit_upload(
        self,
        ctx: UserContext,
        session_id: str,
        replace: bool = False,
    ) -> UploadSnapshot:
        """
        Commit validated upload in a SINGLE atomic transaction.
        If replace=True and snapshot exists for date, existing data is replaced.
        """
        session_data = _UPLOAD_SESSIONS.get(session_id)
        if not session_data:
            raise ValueError("Upload session expired or invalid. Please re-upload and re-validate files.")
        # Reject if the session itself had blocking errors (should not happen via UI, but guard against direct API calls)
        if not session_data.get("can_commit", True):
            raise ValueError("Cannot commit: this upload session had validation errors. Please re-validate.")

        data_as_of: date = session_data["data_as_of"]
        yesterday_date: date = session_data["yesterday_date"]
        file_metadata: list[dict[str, Any]] = session_data["file_metadata"]
        today_mapped: pd.DataFrame = session_data["today_mapped"]
        today_raw: pd.DataFrame = session_data["today_raw"]
        yesterday_raw: pd.DataFrame | None = session_data.get("yesterday_raw")
        scope_ids: dict[str, set[str]] = session_data["scope_ids"]
        scope_available: dict[str, bool] = session_data["scope_available"]
        renewals_ids: set[str] = session_data["renewals_ids"]
        renewals_available: bool = session_data["renewals_available"]
        summary_dfs: dict[str, dict[str, pd.DataFrame]] = session_data["summary_dfs"]

        # Check existing snapshot
        existing = (
            self.db.query(UploadSnapshot)
            .filter(UploadSnapshot.snapshot_date == data_as_of)
            .first()
        )
        if existing:
            if not replace:
                raise ValueError(
                    f"Snapshot already exists for {data_as_of.isoformat()}. Set replace=True to overwrite."
                )
            # Remove previous opportunities and files
            self.db.query(Opportunity).filter(Opportunity.snapshot_id == existing.id).delete()
            self.db.query(UploadedFile).filter(UploadedFile.snapshot_id == existing.id).delete()
            self.db.query(DailySummary).filter(DailySummary.snapshot_id == existing.id).delete()
            self.db.query(ChangeLog).filter(
                (ChangeLog.snapshot_from_id == existing.id) | (ChangeLog.snapshot_to_id == existing.id)
            ).delete()
            snap = existing
            snap.yesterday_date = yesterday_date
        else:
            snap = UploadSnapshot(
                label="Today",
                snapshot_date=data_as_of,
                yesterday_date=yesterday_date,
                uploaded_by=getattr(ctx, "user_id", "system") or "system",
            )
            self.db.add(snap)
            self.db.flush()

        # Update active flags
        self.db.query(UploadSnapshot).filter(UploadSnapshot.is_active_today == True).update(  # noqa: E712
            {"is_active_today": False}
        )
        snap.is_active_today = True

        # Check if stored snapshot exactly 7 days earlier exists
        last_week_target = data_as_of - timedelta(days=7)
        real_lw_snap = (
            self.db.query(UploadSnapshot)
            .filter(UploadSnapshot.snapshot_date == last_week_target)
            .first()
        )
        if real_lw_snap:
            snap.last_week_source = "real_snapshot"
            snap.last_week_is_partial = False
        else:
            snap.last_week_source = "embedded_summary_union"
            snap.last_week_is_partial = True

        # Insert UploadedFile records
        for f_meta in file_metadata:
            uf = UploadedFile(
                snapshot_id=snap.id,
                file_slot=f_meta["slot"],
                filename=f_meta["filename"],
                file_size_bytes=f_meta["size_bytes"],
                sha256_hash=f_meta["sha256"],
                sheet_names=None,
                row_count=None,
            )
            self.db.add(uf)

        # Insert Opportunity rows from Comparison Tool 'today' sheet
        opp_objects: list[Opportunity] = []
        raw_rows_dict = today_raw.to_dict(orient="records") if today_raw is not None else []

        active_count = 0
        for i, (_, row) in enumerate(today_mapped.iterrows()):
            opp_id = _safe_str(row.get("opportunity_id_18"))
            flags = {
                "in_renewals": (opp_id in renewals_ids) if renewals_available else None,
                "in_fy2026": (opp_id in scope_ids["fy2026"]) if scope_available["fy2026"] else None,
                "in_fy2027": (opp_id in scope_ids["fy2027"]) if scope_available["fy2027"] else None,
                "in_q4_2026": (opp_id in scope_ids["q4_2026"]) if scope_available["q4_2026"] else None,
            }
            raw_dict = raw_rows_dict[i] if i < len(raw_rows_dict) else None

            opp = self._row_to_opportunity(snap.id, row, scope_flags=flags, raw_row_dict=raw_dict)
            if not opp.is_deleted_or_lost:
                active_count += 1
            opp_objects.append(opp)

        self.db.bulk_save_objects(opp_objects)
        snap.row_count = len(opp_objects)
        snap.active_row_count = active_count

        # Ensure yesterday snapshot exists using the uploaded comparison tool's yesterday sheet
        if yesterday_raw is not None and not yesterday_raw.empty:
            existing_yest = (
                self.db.query(UploadSnapshot)
                .filter(UploadSnapshot.snapshot_date == yesterday_date)
                .first()
            )
            if not existing_yest:
                yest_snap = UploadSnapshot(
                    label="Yesterday",
                    snapshot_date=yesterday_date,
                    uploaded_by="comparison_tool_yesterday",
                    is_active_today=False,
                )
                self.db.add(yest_snap)
                self.db.flush()
                y_mapped = _map_columns(yesterday_raw)
                y_raw_dict = yesterday_raw.to_dict(orient="records")
                y_opp_objs = []
                y_active = 0
                for idx_y, (_, y_row) in enumerate(y_mapped.iterrows()):
                    st = _safe_str(y_row.get("sales_type"))
                    y_flags = {
                        "in_renewals": (st == "Renewals") if st else False,
                        "in_fy2026": None,
                        "in_fy2027": None,
                        "in_q4_2026": None,
                    }
                    raw_d = y_raw_dict[idx_y] if idx_y < len(y_raw_dict) else None
                    y_opp = self._row_to_opportunity(yest_snap.id, y_row, scope_flags=y_flags, raw_row_dict=raw_d)
                    if not y_opp.is_deleted_or_lost:
                        y_active += 1
                    y_opp_objs.append(y_opp)
                self.db.bulk_save_objects(y_opp_objs)
                yest_snap.row_count = len(y_opp_objs)
                yest_snap.active_row_count = y_active
                self._build_daily_summaries_multi_scope(yest_snap)

        # If no stored snapshot dated exactly data_as_of - 7 days exists, create partial snapshot from summary files' Lastweek_Data sheets
        if not real_lw_snap and summary_dfs:
            lw_rows = []
            seen_ids = set()
            for slot_name, s_sheets in summary_dfs.items():
                lw_df = s_sheets.get("Lastweek_Data")
                if lw_df is not None and not lw_df.empty:
                    lw_m = _map_columns(lw_df)
                    id_col = "opportunity_id_18"
                    for _, r in lw_m.iterrows():
                        opp_id = _safe_str(r.get(id_col))
                        if opp_id and opp_id not in seen_ids:
                            seen_ids.add(opp_id)
                            lw_rows.append(r)
            if lw_rows:
                lw_snap = UploadSnapshot(
                    label="Last Week (Partial)",
                    snapshot_date=last_week_target,
                    uploaded_by="summary_lastweek_union",
                    is_active_today=False,
                    last_week_source="embedded_summary_union",
                    last_week_is_partial=True,
                )
                self.db.add(lw_snap)
                self.db.flush()
                lw_objs = []
                lw_act = 0
                for r in lw_rows:
                    flags = {"in_renewals": True, "in_fy2026": None, "in_fy2027": None, "in_q4_2026": None}
                    opp = self._row_to_opportunity(lw_snap.id, r, scope_flags=flags)
                    if not opp.is_deleted_or_lost:
                        lw_act += 1
                    lw_objs.append(opp)
                self.db.bulk_save_objects(lw_objs)
                lw_snap.row_count = len(lw_objs)
                lw_snap.active_row_count = lw_act
                self._build_daily_summaries_multi_scope(lw_snap)

        # Build DailySummary for all scopes
        self._build_daily_summaries_multi_scope(snap)

        # Compute yesterday ChangeLog (using comparison tool 'yesterday' sheet)
        if yesterday_raw is not None and not yesterday_raw.empty:
            self._compute_yesterday_changelog(snap, yesterday_raw)

        # Commit atomic transaction
        self.db.commit()

        # Clean up session cache
        _UPLOAD_SESSIONS.pop(session_id, None)

        log.info("Committed snapshot %s (%s) with %d rows (%d active)", snap.id, snap.snapshot_date, snap.row_count, snap.active_row_count)
        return snap

    def _row_to_opportunity(
        self,
        snapshot_id: str,
        row: pd.Series,
        scope_flags: dict[str, bool | None] | None = None,
        raw_row_dict: dict | None = None,
    ) -> Opportunity:
        bu_raw = _safe_str(row.get("business_unit_raw"))
        raw_approval = _safe_str(row.get("approval_status"))
        raw_forecast = _safe_str(row.get("forecast_category"))
        raw_stage = _safe_str(row.get("stage_number")) or _safe_str(row.get("stage"))

        flags = scope_flags or {}
        is_del_lost = (raw_stage or "").lower() in ("deleted", "lost")

        return Opportunity(
            snapshot_id=snapshot_id,
            opportunity_id_18=_safe_str(row.get("opportunity_id_18")),
            opportunity_name=_safe_str(row.get("opportunity_name")),
            account_name=_safe_str(row.get("account_name")),
            sub_region=_safe_str(row.get("sub_region")),
            revised_sub_region=_safe_str(row.get("revised_sub_region")),
            country_territory=_safe_str(row.get("country_territory")),
            business_unit_raw=bu_raw,
            business_unit_primary=primary_business_unit(bu_raw),
            forecast_category=normalise_forecast_category(raw_forecast),
            forecast_acv_amount=to_decimal(row.get("forecast_acv_amount")),
            close_date=_coerce_date(row.get("close_date")),
            last_modified_date=_coerce_datetime(row.get("last_modified_date")),
            probability_pct=_coerce_float(row.get("probability_pct")),
            approval_status=normalise_approval_status(raw_approval),
            service_expiry_period=_safe_str(row.get("service_expiry_period")),
            closing_year=_coerce_int(row.get("closing_year")),
            renewal_category=_safe_str(row.get("renewal_category")),
            months_delayed=_coerce_float(row.get("months_delayed")),
            opportunity_owner=_safe_str(row.get("opportunity_owner")),
            stage_number=raw_stage,
            is_deleted_or_lost=is_del_lost,
            in_renewals=flags.get("in_renewals"),
            in_fy2026=flags.get("in_fy2026"),
            in_fy2027=flags.get("in_fy2027"),
            in_q4_2026=flags.get("in_q4_2026"),
            extra_attributes=raw_row_dict,
        )

    def _build_daily_summaries_multi_scope(self, snapshot: UploadSnapshot) -> None:
        """Pre-aggregate key metrics and write to daily_summary table."""
        self.db.query(DailySummary).filter(DailySummary.snapshot_id == snapshot.id).delete()

        opps = self.db.query(Opportunity).filter(Opportunity.snapshot_id == snapshot.id).all()
        if not opps:
            return

        snap_date = snapshot.snapshot_date
        rows: list[DailySummary] = []

        def _make(metric, dimension, dim_val, value, count):
            return DailySummary(
                snapshot_id=snapshot.id,
                snapshot_date=snap_date,
                metric=metric,
                dimension=dimension,
                dimension_value=str(dim_val),
                value=Decimal(str(round(value, 2))),
                count=int(count),
            )

        # Overall totals
        total_acv = sum(float(o.forecast_acv_amount or 0) for o in opps)
        rows.append(_make("total_acv", "overall", "overall", total_acv, len(opps)))

        # By forecast category
        from collections import defaultdict
        cat_acv: dict[str, float] = defaultdict(float)
        cat_cnt: dict[str, int] = defaultdict(int)
        for o in opps:
            fc = o.forecast_category or "Blank"
            cat_acv[fc] += float(o.forecast_acv_amount or 0)
            cat_cnt[fc] += 1
        for fc, acv in cat_acv.items():
            rows.append(_make("forecast_acv", "forecast_category", fc, acv, cat_cnt[fc]))

        # By approval status
        appr_acv: dict[str, float] = defaultdict(float)
        appr_cnt: dict[str, int] = defaultdict(int)
        for o in opps:
            st = o.approval_status or "Blank"
            appr_acv[st] += float(o.forecast_acv_amount or 0)
            appr_cnt[st] += 1
        for st, acv in appr_acv.items():
            rows.append(_make("approval_acv", "approval_status", st, acv, appr_cnt[st]))

        self.db.bulk_save_objects(rows)

    def _compute_yesterday_changelog(self, snapshot: UploadSnapshot, yesterday_df: pd.DataFrame) -> None:
        """
        Compare snapshot opportunities vs Comparison Tool 'yesterday' sheet.
        Tracks new, removed, field changes, and 'Moved to Deleted/Lost'.
        """
        yesterday_mapped = _map_columns(yesterday_df)
        id_col = "opportunity_id_18"
        if id_col not in yesterday_mapped.columns:
            return

        y_dict: dict[str, dict] = {}
        for _, r in yesterday_mapped.iterrows():
            opp_id = _safe_str(r.get(id_col))
            if opp_id:
                stage = _safe_str(r.get("stage_number")) or _safe_str(r.get("stage"))
                y_dict[opp_id] = {
                    "name": _safe_str(r.get("opportunity_name")),
                    "stage": stage,
                    "is_deleted_or_lost": (stage or "").lower() in ("deleted", "lost"),
                    "acv": to_decimal(r.get("forecast_acv_amount")),
                    "forecast_category": normalise_forecast_category(_safe_str(r.get("forecast_category"))),
                    "approval_status": normalise_approval_status(_safe_str(r.get("approval_status"))),
                }

        today_opps = self.db.query(Opportunity).filter(Opportunity.snapshot_id == snapshot.id).all()
        t_dict = {o.opportunity_id_18: o for o in today_opps if o.opportunity_id_18}

        # Try to resolve the real "from" snapshot (yesterday DB snapshot if it exists)
        yesterday_snap = (
            self.db.query(UploadSnapshot)
            .filter(UploadSnapshot.snapshot_date == snapshot.yesterday_date)
            .first()
            if snapshot.yesterday_date
            else None
        )
        from_snap_id: str | None = yesterday_snap.id if yesterday_snap else None

        logs: list[ChangeLog] = []

        for opp_id, t_opp in t_dict.items():
            y_opp = y_dict.get(opp_id)
            if y_opp is None:
                # New deal today (ignore if already Deleted/Lost on arrival)
                if not t_opp.is_deleted_or_lost:
                    logs.append(
                        ChangeLog(
                            snapshot_from_id=from_snap_id,
                            snapshot_to_id=snapshot.id,
                            opportunity_id_18=opp_id,
                            opportunity_name=t_opp.opportunity_name,
                            changed_column="opportunity_id_18",
                            old_value=None,
                            new_value=opp_id,
                            opportunity_status="New",
                            change_type="New Opportunity",
                        )
                    )
                continue

            # Deal existed yesterday
            # Check if moved to Deleted/Lost
            if not y_opp["is_deleted_or_lost"] and t_opp.is_deleted_or_lost:
                logs.append(
                    ChangeLog(
                        snapshot_from_id=from_snap_id,
                        snapshot_to_id=snapshot.id,
                        opportunity_id_18=opp_id,
                        opportunity_name=t_opp.opportunity_name,
                        changed_column="stage_number",
                        old_value=y_opp["stage"] or "Active",
                        new_value=t_opp.stage_number or "Deleted/Lost",
                        opportunity_status="Existing",
                        change_type="Moved to Deleted/Lost",
                    )
                )

            # Check category move
            if y_opp["forecast_category"] != t_opp.forecast_category:
                logs.append(
                    ChangeLog(
                        snapshot_from_id=from_snap_id,
                        snapshot_to_id=snapshot.id,
                        opportunity_id_18=opp_id,
                        opportunity_name=t_opp.opportunity_name,
                        changed_column="forecast_category",
                        old_value=y_opp["forecast_category"],
                        new_value=t_opp.forecast_category,
                        opportunity_status="Existing",
                        change_type="Category Change",
                    )
                )

            # Check ACV change
            if y_opp["acv"] is not None and t_opp.forecast_acv_amount is not None:
                if abs(y_opp["acv"] - t_opp.forecast_acv_amount) >= Decimal("0.01"):
                    logs.append(
                        ChangeLog(
                            snapshot_from_id=from_snap_id,
                            snapshot_to_id=snapshot.id,
                            opportunity_id_18=opp_id,
                            opportunity_name=t_opp.opportunity_name,
                            changed_column="forecast_acv_amount",
                            old_value=str(y_opp["acv"]),
                            new_value=str(t_opp.forecast_acv_amount),
                            opportunity_status="Existing",
                            change_type="ACV Change",
                        )
                    )

        # Removed deals
        for opp_id, y_opp in y_dict.items():
            if opp_id not in t_dict and not y_opp["is_deleted_or_lost"]:
                logs.append(
                    ChangeLog(
                        snapshot_from_id=from_snap_id,
                        snapshot_to_id=snapshot.id,
                        opportunity_id_18=opp_id,
                        opportunity_name=y_opp["name"],
                        changed_column="opportunity_id_18",
                        old_value=opp_id,
                        new_value=None,
                        opportunity_status="Existing",
                        change_type="Opportunity Removed",
                    )
                )

        if logs:
            self.db.bulk_save_objects(logs)

    # ------------------------------------------------------------------
    # Legacy compatibility methods
    # ------------------------------------------------------------------

    def ingest_renewals_summary(
        self,
        ctx: UserContext,
        path: Path,
        snapshot_date: date,
        label: str = "Today",
    ) -> UploadSnapshot:
        """Legacy ingest method preserved for tests."""
        sheets = parse_renewals_summary(path)
        today_df = sheets.get("today", sheets.get("today_data", sheets.get("Today_Data", pd.DataFrame())))
        if today_df.empty:
            for k, df_k in sheets.items():
                if "today" in k.lower():
                    today_df = df_k
                    break

        if label == "Today":
            self.db.query(UploadSnapshot).update({"is_active_today": False})

        snap = (
            self.db.query(UploadSnapshot)
            .filter(UploadSnapshot.snapshot_date == snapshot_date)
            .first()
        )
        if not snap:
            snap = UploadSnapshot(
                label=label,
                snapshot_date=snapshot_date,
                yesterday_date=compute_previous_working_day(snapshot_date),
                is_active_today=(label == "Today"),
                source_file_summary=path.name,
                uploaded_by="system",
            )
            self.db.add(snap)
            self.db.flush()
        else:
            if label == "Today":
                snap.is_active_today = True

        if not today_df.empty:
            mapped_df = _map_columns(today_df)
            raw_rows_dict = today_df.to_dict(orient="records")
            self.db.query(Opportunity).filter(Opportunity.snapshot_id == snap.id).delete()
            rows: list[Opportunity] = []
            for idx_r, (_, r) in enumerate(mapped_df.iterrows()):
                st = _safe_str(r.get("sales_type"))
                flags = {
                    "in_renewals": (st == "Renewals") if st else True,
                    "in_fy2026": None,
                    "in_fy2027": None,
                    "in_q4_2026": None,
                }
                raw_d = raw_rows_dict[idx_r] if idx_r < len(raw_rows_dict) else None
                rows.append(self._row_to_opportunity(snap.id, r, scope_flags=flags, raw_row_dict=raw_d))
            self.db.bulk_save_objects(rows)
            snap.row_count = len(rows)
            snap.active_row_count = sum(1 for r in rows if not r.is_deleted_or_lost)
            self._build_daily_summaries_multi_scope(snap)

        # Ingest Yesterday if present in workbook
        yest_df = sheets.get("yesterday", sheets.get("yesterday_data", sheets.get("Yesterday_Data", pd.DataFrame())))
        if not yest_df.empty:
            yest_date = compute_previous_working_day(snapshot_date)
            yest_snap = (
                self.db.query(UploadSnapshot)
                .filter(UploadSnapshot.snapshot_date == yest_date)
                .first()
            )
            if not yest_snap:
                yest_snap = UploadSnapshot(
                    label="Yesterday",
                    snapshot_date=yest_date,
                    is_active_today=False,
                    source_file_summary=path.name,
                    uploaded_by="system",
                )
                self.db.add(yest_snap)
                self.db.flush()
            y_mapped = _map_columns(yest_df)
            y_raw_dict = yest_df.to_dict(orient="records")
            self.db.query(Opportunity).filter(Opportunity.snapshot_id == yest_snap.id).delete()
            y_rows = []
            for idx_y, (_, r) in enumerate(y_mapped.iterrows()):
                st = _safe_str(r.get("sales_type"))
                flags = {"in_renewals": (st == "Renewals") if st else True, "in_fy2026": None, "in_fy2027": None, "in_q4_2026": None}
                raw_d = y_raw_dict[idx_y] if idx_y < len(y_raw_dict) else None
                y_rows.append(self._row_to_opportunity(yest_snap.id, r, scope_flags=flags, raw_row_dict=raw_d))
            self.db.bulk_save_objects(y_rows)
            yest_snap.row_count = len(y_rows)
            yest_snap.active_row_count = sum(1 for r in y_rows if not r.is_deleted_or_lost)
            self._build_daily_summaries_multi_scope(yest_snap)

        # Ingest Last Week if present in workbook
        lw_df = sheets.get("lastweek", sheets.get("lastweek_data", sheets.get("Lastweek_Data", pd.DataFrame())))
        if not lw_df.empty:
            lw_date = snapshot_date - timedelta(days=7)
            lw_snap = (
                self.db.query(UploadSnapshot)
                .filter(UploadSnapshot.snapshot_date == lw_date)
                .first()
            )
            if not lw_snap:
                lw_snap = UploadSnapshot(
                    label="Last Week",
                    snapshot_date=lw_date,
                    is_active_today=False,
                    source_file_summary=path.name,
                    uploaded_by="system",
                )
                self.db.add(lw_snap)
                self.db.flush()
            lw_mapped = _map_columns(lw_df)
            lw_raw_dict = lw_df.to_dict(orient="records")
            self.db.query(Opportunity).filter(Opportunity.snapshot_id == lw_snap.id).delete()
            lw_rows = []
            for idx_lw, (_, r) in enumerate(lw_mapped.iterrows()):
                st = _safe_str(r.get("sales_type"))
                flags = {"in_renewals": (st == "Renewals") if st else True, "in_fy2026": None, "in_fy2027": None, "in_q4_2026": None}
                raw_d = lw_raw_dict[idx_lw] if idx_lw < len(lw_raw_dict) else None
                lw_rows.append(self._row_to_opportunity(lw_snap.id, r, scope_flags=flags, raw_row_dict=raw_d))
            self.db.bulk_save_objects(lw_rows)
            lw_snap.row_count = len(lw_rows)
            lw_snap.active_row_count = sum(1 for r in lw_rows if not r.is_deleted_or_lost)
            self._build_daily_summaries_multi_scope(lw_snap)

        self.db.commit()
        return snap

    def ingest_comparison_tool(
        self,
        ctx: UserContext,
        path: Path,
        snapshot: UploadSnapshot,
    ) -> None:
        """Legacy comparison tool ingest preserved for tests."""
        from backend.services.diff_service import DiffService
        sheets = parse_comparison_tool(path)
        diff_svc = DiffService(self.db)
        diff_svc.ingest_from_comparison_tool(ctx, snapshot, sheets)
        self.db.commit()
