import re

with open("backend/services/v2_overview_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# Update _movements signature and slippage logic
movements_old = """    def _movements(
        self,
        today_df: pd.DataFrame,
        prev_df: pd.DataFrame,
        scope_label: str = "q4",
    ) -> dict:"""
movements_new = """    def _movements(
        self,
        today_df: pd.DataFrame,
        prev_df: pd.DataFrame,
        q_end_date,
    ) -> dict:"""
content = content.replace(movements_old, movements_new)

slip_old_1 = """        # Slippage to 2027: opps whose close_year is 2027 TODAY but was NOT 2027 in PREV
        # (i.e. their close date moved into 2027 since the comparison date)
        today_2027  = set(today_df[today_df["close_year"] == 2027]["opportunity_id_18"])
        prev_2027   = set(prev_df[prev_df["close_year"] == 2027]["opportunity_id_18"]) if not prev_df.empty else set()
        slipped_ids = today_2027 - prev_2027  # newly slipped since comparison date
        slip_df = today_df[today_df["opportunity_id_18"].isin(slipped_ids)]
        slippage_deals = slip_df[["opportunity_id_18", "opportunity_name", "canonical_region",
                                   "forecast_category", "forecast_acv_amount"]].to_dict(orient="records")
        slippage = {
            "label": "Slippage to 2027",
            "count": len(slip_df),
            "acv": round(float(slip_df["forecast_acv_amount"].sum()), 2),
            "deals": slippage_deals,
        }"""
slip_new_1 = """        # Slippage: opps whose close_date is after q_end_date TODAY but was NOT after q_end_date in PREV
        today_slipped = set(today_df[today_df["close_date"].dt.date > q_end_date]["opportunity_id_18"]) if not today_df.empty else set()
        prev_slipped = set(prev_df[prev_df["close_date"].dt.date > q_end_date]["opportunity_id_18"]) if not prev_df.empty else set()
        slipped_ids = today_slipped - prev_slipped
        slip_df = today_df[today_df["opportunity_id_18"].isin(slipped_ids)] if not today_df.empty else pd.DataFrame()
        slippage_deals = slip_df[["opportunity_id_18", "opportunity_name", "canonical_region",
                                   "forecast_category", "forecast_acv_amount"]].to_dict(orient="records") if not slip_df.empty else []
        slippage = {
            "label": "Slippage",
            "count": len(slip_df),
            "acv": round(float(slip_df["forecast_acv_amount"].sum()), 2) if not slip_df.empty else 0.0,
            "deals": slippage_deals,
        }"""
# Wait, close_date in DataFrame might be object (datetime.date) or datetime64. We can use pd.to_datetime().dt.date
slip_new_1 = slip_new_1.replace('today_df["close_date"].dt.date', 'pd.to_datetime(today_df["close_date"]).dt.date')
slip_new_1 = slip_new_1.replace('prev_df["close_date"].dt.date', 'pd.to_datetime(prev_df["close_date"]).dt.date')
content = content.replace(slip_old_1, slip_new_1)

# In get_summary
slip_sum_old = """        slip_df = df[df["close_year"] == 2027] if not df.empty else pd.DataFrame()
        slippage = {
            "count": len(slip_df),
            "acv": round(float(slip_df["forecast_acv_amount"].sum()), 2),
        }"""
slip_sum_new = """        import pandas as pd
        _, q_end_date = ScopeService.quarter_bounds(ScopeService.current_quarter(snap.snapshot_date))
        slip_df = df[pd.to_datetime(df["close_date"]).dt.date > q_end_date] if not df.empty else pd.DataFrame()
        slippage = {
            "count": len(slip_df),
            "acv": round(float(slip_df["forecast_acv_amount"].sum()), 2) if not slip_df.empty else 0.0,
        }"""
content = content.replace(slip_sum_old, slip_sum_new)

y_slip_sum_old = """            y_slip_df = y_df[y_df["close_year"] == 2027] if not y_df.empty else pd.DataFrame()"""
y_slip_sum_new = """            y_slip_df = y_df[pd.to_datetime(y_df["close_date"]).dt.date > q_end_date] if not y_df.empty else pd.DataFrame()"""
content = content.replace(y_slip_sum_old, y_slip_sum_new)

lw_slip_sum_old = """            lw_slip_df = lw_df[lw_df["close_year"] == 2027] if not lw_df.empty else pd.DataFrame()"""
lw_slip_sum_new = """            lw_slip_df = lw_df[pd.to_datetime(lw_df["close_date"]).dt.date > q_end_date] if not lw_df.empty else pd.DataFrame()"""
content = content.replace(lw_slip_sum_old, lw_slip_sum_new)


moves_call_old = """        moves = self._movements(today_df, prev_df)"""
moves_call_new = """        _, q_end_date = ScopeService.quarter_bounds(ScopeService.current_quarter(snap.snapshot_date))
        moves = self._movements(today_df, prev_df, q_end_date=q_end_date)"""
content = content.replace(moves_call_old, moves_call_new)

# In section 3 output
content = content.replace('"slippage_to_2027": slippage', '"slippage_to_2027": slippage') # Keep key

with open("backend/services/v2_overview_service.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Patch overview done")
