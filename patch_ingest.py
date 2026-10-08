import re

with open("backend/services/ingest_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# Remove SLOT_TO_SCOPE and SCOPE_TO_LABEL
content = re.sub(r'# Upload slot name -> scope key used for scope flags/metrics\nSLOT_TO_SCOPE = .*?\n# Snapshots built', '# Snapshots built', content, flags=re.DOTALL)
content = re.sub(r'SCOPE_TO_LABEL = .*?\n', '', content)

# Inside validate_upload, step 4: Parse Summary Workbooks
step4_start = content.find('# 4. Parse Summary Workbooks for scope IDs')
step5_start = content.find('# 5. Compute Scope Metrics')
if step4_start != -1 and step5_start != -1:
    new_step4 = """# 4. Parse Summary Workbooks for last-week bootstrap only
        summary_dfs: dict[str, dict[str, pd.DataFrame]] = {}
        for slot in ["fiscal_2026", "fiscal_2027", "fiscal_q4"]:
            slot_path = files_dict.get(slot)
            if slot_path and slot_path.exists():
                try:
                    s_sheets = parse_summary_workbook(slot_path, xf_cache.get(slot))
                    summary_dfs[slot] = s_sheets
                except Exception as exc:
                    warnings.append(f"Warning reading {slot_path.name}: {exc}")

"""
    content = content[:step4_start] + new_step4 + content[step5_start:]

# Fix Step 5: Compute Scope Metrics
step5_start = content.find('# 5. Compute Scope Metrics')
step6_start = content.find('# 6. Reconcile FinalChangeReport')

if step5_start != -1 and step6_start != -1:
    new_step5 = """# 5. Compute Scope Metrics
        from backend.services.scopes import ScopeService
        
        stage_col = next((c for c in today_mapped.columns if c in ("stage_number", "stage")), None)

        def _metrics_for(df_sub):
            raw_cnt = len(df_sub)
            raw_acv = float(df_sub["forecast_acv_amount"].astype(float).sum()) if "forecast_acv_amount" in df_sub.columns else 0.0
            if stage_col:
                del_mask = df_sub[stage_col].astype(str).str.strip().isin(["Deleted", "Lost"])
                active_sub = df_sub[~del_mask]
            else:
                active_sub = df_sub
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

        ren_mask = today_mapped.get("sales_type", pd.Series(dtype=str)).astype(str).str.strip() == "Renewals"
        renewals_df = today_mapped[ren_mask]
        
        cq = ScopeService.current_quarter(data_as_of)
        cq_mask = today_mapped.get("fiscal_period", pd.Series(dtype=str)).astype(str).str.strip() == cq
        current_quarter_df = renewals_df[renewals_df.index.isin(today_mapped[cq_mask].index)]

        scopes_summary = {
            "all": {**_metrics_for(today_mapped), "available": True, "label": "All Opportunities"},
            "renewals": {
                **_metrics_for(renewals_df),
                "available": True,
                "label": "Renewals",
            },
            "current_quarter": {
                **_metrics_for(current_quarter_df),
                "available": True,
                "label": ScopeService.quarter_label(cq),
            },
        }

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

"""
    content = content[:step5_start] + new_step5 + content[step6_start:]

# Fix step 6 checks
content = re.sub(
    r'for key, label in \(\("renewals", "Renewals"\), \("fy2026", "Fiscal 2026"\), \("fy2027", "Fiscal 2027"\), \("q4_2026", "Fiscal Q4"\)\):.*?if scopes_summary\["all"\]\["raw_count"\] == 0:',
    r'if scopes_summary["all"]["raw_count"] == 0:',
    content,
    flags=re.DOTALL
)

content = re.sub(r'if renewals_available and len\(missing_ids\) > 0.*?warnings\.append\(\s*"No summary files were read.*?this snapshot\."\s*\)\n', '', content, flags=re.DOTALL)

# In session_id definition, remove scope_ids, scope_available, etc.
session_dict_old = """        _UPLOAD_SESSIONS[session_id] = {
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
            "can_commit": can_commit,
        }"""
session_dict_new = """        _UPLOAD_SESSIONS[session_id] = {
            "data_as_of": data_as_of,
            "yesterday_date": yesterday_date,
            "files_dict": files_dict,
            "file_metadata": file_metadata,
            "today_mapped": today_mapped,
            "today_raw": today_raw,
            "yesterday_raw": yesterday_raw,
            "comp_sheets": comp_sheets,
            "summary_dfs": summary_dfs,
            "scopes_summary": scopes_summary,
            "snapshot_exists": snapshot_exists,
            "can_commit": can_commit,
        }"""
content = content.replace(session_dict_old, session_dict_new)

# In commit_upload:
commit_vars_old = """        data_as_of: date = session_data["data_as_of"]
        yesterday_date: date = session_data["yesterday_date"]
        file_metadata: list[dict[str, Any]] = session_data["file_metadata"]
        today_mapped: pd.DataFrame = session_data["today_mapped"]
        today_raw: pd.DataFrame = session_data["today_raw"]
        yesterday_raw: pd.DataFrame | None = session_data.get("yesterday_raw")
        scope_ids: dict[str, set[str]] = session_data["scope_ids"]
        scope_available: dict[str, bool] = session_data["scope_available"]
        renewals_ids: set[str] = session_data["renewals_ids"]
        renewals_available: bool = session_data["renewals_available"]
        summary_dfs: dict[str, dict[str, pd.DataFrame]] = session_data["summary_dfs"]"""
commit_vars_new = """        data_as_of: date = session_data["data_as_of"]
        yesterday_date: date = session_data["yesterday_date"]
        file_metadata: list[dict[str, Any]] = session_data["file_metadata"]
        today_mapped: pd.DataFrame = session_data["today_mapped"]
        today_raw: pd.DataFrame = session_data["today_raw"]
        yesterday_raw: pd.DataFrame | None = session_data.get("yesterday_raw")
        summary_dfs: dict[str, dict[str, pd.DataFrame]] = session_data["summary_dfs"]"""
content = content.replace(commit_vars_old, commit_vars_new)

content = content.replace("""            flags = {
                "in_renewals": (opp_id in renewals_ids) if renewals_available else None,
                "in_fy2026": (opp_id in scope_ids["fy2026"]) if scope_available["fy2026"] else None,
                "in_fy2027": (opp_id in scope_ids["fy2027"]) if scope_available["fy2027"] else None,
                "in_q4_2026": (opp_id in scope_ids["q4_2026"]) if scope_available["q4_2026"] else None,
            }""", """            flags = {}""")

# _scope_ids_from_sheet is no longer useful, we just read lastweek_data. Let's fix that block.
yest_lw_block_start = content.find('# Scope membership for yesterday / last week comes from each summary file')
yest_lw_block_end = content.find('self._build_daily_summaries_multi_scope(snap)', yest_lw_block_start)

if yest_lw_block_start != -1 and yest_lw_block_end != -1:
    new_yest_lw = """        if yesterday_raw is not None and not yesterday_raw.empty:
            existing_yest = (
                self.db.query(UploadSnapshot)
                .filter(UploadSnapshot.snapshot_date == yesterday_date)
                .first()
            )
            if existing_yest is None or existing_yest.uploaded_by in AUTO_SNAPSHOT_SOURCES:
                if existing_yest is None:
                    yest_snap = UploadSnapshot(
                        label="Yesterday",
                        snapshot_date=yesterday_date,
                        uploaded_by="comparison_tool_yesterday",
                        is_active_today=False,
                    )
                    self.db.add(yest_snap)
                    self.db.flush()
                else:
                    yest_snap = existing_yest
                    self._clear_snapshot_rows(yest_snap.id)
                y_mapped = _map_columns(yesterday_raw)
                
                def _y_flags(r):
                    return {}

                self._fill_snapshot(yest_snap, y_mapped, yesterday_raw, _y_flags)
                self._build_daily_summaries_multi_scope(yest_snap)
            elif existing_yest.row_count and abs(existing_yest.row_count - len(yesterday_raw)) > 0:
                warnings_note = (
                    f"Kept the stored snapshot for {yesterday_date} ({existing_yest.row_count} rows); "
                    f"the uploaded 'yesterday' sheet has {len(yesterday_raw)} rows."
                )
                log.warning(warnings_note)

        if not real_lw_snap:
            lw_rows = []
            seen_ids = set()
            for slot_name, s_sheets in summary_dfs.items():
                lw_df = s_sheets.get("lastweek_data")
                if lw_df is not None and not lw_df.empty:
                    lw_m = _map_columns(lw_df)
                    for _, r in lw_m.iterrows():
                        opp_id = _safe_str(r.get("opportunity_id_18"))
                        if opp_id and opp_id not in seen_ids:
                            seen_ids.add(opp_id)
                            lw_rows.append(r)
            if lw_rows:
                if existing_lw is None:
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
                else:
                    lw_snap = existing_lw
                    self._clear_snapshot_rows(lw_snap.id)
                lw_df_all = pd.DataFrame(lw_rows).reset_index(drop=True)

                def _lw_flags(r):
                    return {}

                self._fill_snapshot(lw_snap, lw_df_all, None, _lw_flags)
                self._build_daily_summaries_multi_scope(lw_snap)

        """
    content = content[:yest_lw_block_start] + new_yest_lw + content[yest_lw_block_end:]

content = re.sub(r'def _scope_ids_from_sheet.*?return ids, avail\n', '', content, flags=re.DOTALL)

with open("backend/services/ingest_service.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Ingest patched")
