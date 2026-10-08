import re

with open("backend/services/ingest_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# Fix yesterday snapshot scope columns
y_flags_old = """                def _y_flags(r):
                    return {}"""
y_flags_new = """                def _y_flags(r):
                    # We store sales_type and fiscal_period in extra_attributes if they are missing?
                    # No, _row_to_opportunity uses row.get("sales_type") and row.get("fiscal_period") directly from mapped row.
                    # We just ensure the row has them. But we can inject them via _row_to_opportunity raw dict or just mapped row.
                    # _fill_snapshot passes mapped row. We can mutate mapped row or wait, we just return a dict of flags, but we need sales_type and fiscal_period populated.
                    # Wait, _row_to_opportunity expects them in `row` (pd.Series).
                    return {}"""
content = content.replace(y_flags_old, y_flags_new)

# Wait, `ingest_service.py`'s `_row_to_opportunity` does this:
# `sales_type=_safe_str(row.get("sales_type"))`
# If we need to ensure `sales_type` is set, we can just modify the DataFrame before `_fill_snapshot`.
patch_y_df = """                y_mapped = _map_columns(yesterday_raw)
                
                # Ensure sales_type and fiscal_period exist
                if "sales_type" not in y_mapped.columns:
                    y_mapped["sales_type"] = "Renewals"
                if "fiscal_period" not in y_mapped.columns:
                    from backend.services.scopes import ScopeService
                    y_mapped["fiscal_period"] = y_mapped["close_date"].apply(
                        lambda d: ScopeService.quarter_of(parse_excel_date(d)) if pd.notnull(d) else None
                    )"""
content = content.replace("                y_mapped = _map_columns(yesterday_raw)", patch_y_df)


# Fix lastweek snapshot scope columns
patch_lw_df = """                lw_df_all = pd.DataFrame(lw_rows).reset_index(drop=True)

                if "sales_type" not in lw_df_all.columns:
                    lw_df_all["sales_type"] = "Renewals"
                else:
                    lw_df_all["sales_type"] = lw_df_all["sales_type"].fillna("Renewals")
                
                if "fiscal_period" not in lw_df_all.columns:
                    from backend.services.scopes import ScopeService
                    lw_df_all["fiscal_period"] = lw_df_all.get("close_date", pd.Series(dtype=object)).apply(
                        lambda d: ScopeService.quarter_of(parse_excel_date(d)) if pd.notnull(d) else None
                    )
                else:
                    from backend.services.scopes import ScopeService
                    def fill_fp(row):
                        if pd.isna(row.get("fiscal_period")):
                            d = row.get("close_date")
                            return ScopeService.quarter_of(parse_excel_date(d)) if pd.notnull(d) else None
                        return row["fiscal_period"]
                    lw_df_all["fiscal_period"] = lw_df_all.apply(fill_fp, axis=1)"""
content = content.replace("                lw_df_all = pd.DataFrame(lw_rows).reset_index(drop=True)", patch_lw_df)


# Also in _row_to_opportunity, we don't have sales_type and fiscal_period fields added yet in ingest_service!
# Let's ensure _row_to_opportunity extracts sales_type and fiscal_period from row.
row_to_opp_old = """            is_deleted_or_lost=is_del_lost,
            in_renewals=flags.get("in_renewals"),"""
row_to_opp_new = """            is_deleted_or_lost=is_del_lost,
            sales_type=_safe_str(row.get("sales_type")),
            fiscal_period=_safe_str(row.get("fiscal_period")),
            in_renewals=flags.get("in_renewals"),"""
content = content.replace(row_to_opp_old, row_to_opp_new)


with open("backend/services/ingest_service.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Patch ingest for older snapshots done")
