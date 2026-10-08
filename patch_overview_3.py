import re

with open("backend/services/v2_overview_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace get_regional_breakdown
new_get_reg = """    def get_regional_breakdown(
        self,
        ctx: UserContext,
        exclude_deleted: bool = False,
    ) -> dict:
        snap = self._active_snap()
        if snap is None:
            return {"error": "no_snapshot"}

        opps = self._q4_opps(snap, exclude_deleted=exclude_deleted)
        df = _opps_to_df(opps)
        
        yest_snap = self._yesterday_snap(snap)
        y_opps = self._q4_opps(yest_snap, exclude_deleted=exclude_deleted) if yest_snap else []
        y_df = _opps_to_df(y_opps)
        
        lw_snap = self._lastweek_snap(snap)
        lw_opps = self._q4_opps(lw_snap, exclude_deleted=exclude_deleted) if lw_snap else []
        lw_df = _opps_to_df(lw_opps)

        regions = list(CANONICAL_REGIONS)
        if not df.empty and "Other" in df["canonical_region"].values:
            regions.append("Other")

        prop_rows = []
        for region in regions:
            r_df = df[df["canonical_region"] == region] if not df.empty else pd.DataFrame()
            prop_rows.append({
                "region": region,
                "total_acv":    round(_sum(r_df, "forecast_acv_amount"), 2),
                "approved_count": int((r_df["approval_status"] == "Approved").sum()) if not r_df.empty and "approval_status" in r_df.columns else 0,
                "pending_count":  int((r_df["approval_status"] == "Pending Approval").sum()) if not r_df.empty and "approval_status" in r_df.columns else 0,
                "blank_count":    int((r_df["approval_status"] == "Blank").sum()) if not r_df.empty and "approval_status" in r_df.columns else 0,
                "approved_acv":  round(_sum(r_df[r_df["approval_status"] == "Approved"] if not r_df.empty and "approval_status" in r_df.columns else pd.DataFrame(), "forecast_acv_amount"), 2),
                "pending_acv":   round(_sum(r_df[r_df["approval_status"] == "Pending Approval"] if not r_df.empty and "approval_status" in r_df.columns else pd.DataFrame(), "forecast_acv_amount"), 2),
                "blank_acv":     round(_sum(r_df[r_df["approval_status"] == "Blank"] if not r_df.empty and "approval_status" in r_df.columns else pd.DataFrame(), "forecast_acv_amount"), 2),
            })

        prop_totals = {
            "region": "Total",
            "total_acv":     round(_sum(df, "forecast_acv_amount"), 2),
            "approved_count": int((df["approval_status"] == "Approved").sum()) if not df.empty and "approval_status" in df.columns else 0,
            "pending_count":  int((df["approval_status"] == "Pending Approval").sum()) if not df.empty and "approval_status" in df.columns else 0,
            "blank_count":    int((df["approval_status"] == "Blank").sum()) if not df.empty and "approval_status" in df.columns else 0,
        }

        trend_rows = []
        for region in regions:
            r_df = df[df["canonical_region"] == region] if not df.empty else pd.DataFrame()
            y_r_df = y_df[y_df["canonical_region"] == region] if not y_df.empty else pd.DataFrame()
            lw_r_df = lw_df[lw_df["canonical_region"] == region] if not lw_df.empty else pd.DataFrame()
            
            row = {
                "region":       region,
                "total_count":  len(r_df),
                "total_acv":    round(_sum(r_df, "forecast_acv_amount"), 2),
                "y_total_count": len(y_r_df),
                "y_total_acv":  round(_sum(y_r_df, "forecast_acv_amount"), 2),
                "lw_total_count": len(lw_r_df),
                "lw_total_acv": round(_sum(lw_r_df, "forecast_acv_amount"), 2),
            }
            for fc in ALL_FC:
                fc_key = fc.lower().replace(" ", "_")
                
                fc_df = r_df[r_df["forecast_category"] == fc] if not r_df.empty and "forecast_category" in r_df.columns else pd.DataFrame()
                row[f"{fc_key}_count"] = len(fc_df)
                row[f"{fc_key}_acv"]   = round(_sum(fc_df, "forecast_acv_amount"), 2)
                
                y_fc_df = y_r_df[y_r_df["forecast_category"] == fc] if not y_r_df.empty and "forecast_category" in y_r_df.columns else pd.DataFrame()
                row[f"y_{fc_key}_count"] = len(y_fc_df)
                row[f"y_{fc_key}_acv"]   = round(_sum(y_fc_df, "forecast_acv_amount"), 2)
                
                lw_fc_df = lw_r_df[lw_r_df["forecast_category"] == fc] if not lw_r_df.empty and "forecast_category" in lw_r_df.columns else pd.DataFrame()
                row[f"lw_{fc_key}_count"] = len(lw_fc_df)
                row[f"lw_{fc_key}_acv"]   = round(_sum(lw_fc_df, "forecast_acv_amount"), 2)
                
            trend_rows.append(row)

        total_row = {"region": "Total", "total_count": len(df), "total_acv": round(_sum(df, "forecast_acv_amount"), 2),
                     "y_total_count": len(y_df), "y_total_acv": round(_sum(y_df, "forecast_acv_amount"), 2),
                     "lw_total_count": len(lw_df), "lw_total_acv": round(_sum(lw_df, "forecast_acv_amount"), 2)}
                     
        for fc in ALL_FC:
            fc_key = fc.lower().replace(" ", "_")
            fc_df = df[df["forecast_category"] == fc] if not df.empty and "forecast_category" in df.columns else pd.DataFrame()
            total_row[f"{fc_key}_count"] = len(fc_df)
            total_row[f"{fc_key}_acv"]   = round(_sum(fc_df, "forecast_acv_amount"), 2)
            
            y_fc_df = y_df[y_df["forecast_category"] == fc] if not y_df.empty and "forecast_category" in y_df.columns else pd.DataFrame()
            total_row[f"y_{fc_key}_count"] = len(y_fc_df)
            total_row[f"y_{fc_key}_acv"]   = round(_sum(y_fc_df, "forecast_acv_amount"), 2)
            
            lw_fc_df = lw_df[lw_df["forecast_category"] == fc] if not lw_df.empty and "forecast_category" in lw_df.columns else pd.DataFrame()
            total_row[f"lw_{fc_key}_count"] = len(lw_fc_df)
            total_row[f"lw_{fc_key}_acv"]   = round(_sum(lw_fc_df, "forecast_acv_amount"), 2)

        regional_sum = sum(r["total_acv"] for r in trend_rows)
        check_passes = abs(regional_sum - total_row["total_acv"]) < 0.01

        return {
            "proposal_confirmation": prop_rows,
            "proposal_confirmation_totals": prop_totals,
            "regional_trend": trend_rows,
            "regional_trend_totals": total_row,
            "regional_sum": round(regional_sum, 2),
            "total_acv_check_passes": check_passes,
            "other_count": int((df["canonical_region"] == "Other").sum()) if not df.empty and "canonical_region" in df.columns else 0,
        }
"""
start_idx = content.find("    def get_regional_breakdown(")
content = content[:start_idx] + new_get_reg

with open("backend/services/v2_overview_service.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Patch 3 done")
