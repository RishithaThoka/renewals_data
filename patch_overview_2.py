import re

with open("backend/services/v2_overview_service.py", "r", encoding="utf-8") as f:
    content = f.read()

helper = """
def _sum(df: pd.DataFrame, col: str) -> float:
    if df.empty or col not in df.columns:
        return 0.0
    return float(df[col].sum())
"""

# add the helper after imports
import_end = content.find("log = logging.getLogger(__name__)")
content = content[:import_end] + helper + "\n" + content[import_end:]

# Replace all occurrences of float(df["forecast_acv_amount"].sum()) with _sum(df, "forecast_acv_amount")
# And also for other dfs like y_df, lw_df, slip_df, etc.
content = re.sub(r'float\(([^\[]+)\["forecast_acv_amount"\]\.sum\(\)\)', r'_sum(\1, "forecast_acv_amount")', content)

# Also fix len() to 0 if empty
# Wait, len(pd.DataFrame()) is safely 0, but just in case:
# No, len() is safe.

# We need to add proposal_confirmation_totals to get_summary
# Let's see what is needed: "Add the missing key 'proposal_confirmation_totals' to the summary response (Approved / Pending / Blank counts and ACV), always present, zeros when empty."
# We can calculate this in get_summary.
prop_conf_code = """
        # Proposal confirmation totals for summary
        prop_totals = {
            "approved_count": int((df["approval_status"] == "Approved").sum()) if not df.empty and "approval_status" in df.columns else 0,
            "pending_count":  int((df["approval_status"] == "Pending Approval").sum()) if not df.empty and "approval_status" in df.columns else 0,
            "blank_count":    int((df["approval_status"] == "Blank").sum()) if not df.empty and "approval_status" in df.columns else 0,
            "approved_acv":   _sum(df[df["approval_status"] == "Approved"] if not df.empty and "approval_status" in df.columns else pd.DataFrame(), "forecast_acv_amount"),
            "pending_acv":    _sum(df[df["approval_status"] == "Pending Approval"] if not df.empty and "approval_status" in df.columns else pd.DataFrame(), "forecast_acv_amount"),
            "blank_acv":      _sum(df[df["approval_status"] == "Blank"] if not df.empty and "approval_status" in df.columns else pd.DataFrame(), "forecast_acv_amount"),
        }
"""
# Insert prop_conf_code before returning in get_summary
ret_start = content.find("        return {", content.find("def get_summary"))
content = content[:ret_start] + prop_conf_code + content[ret_start:]

# Inject into the return dict
content = re.sub(r'("slippage_to_2027": \{[^\}]+\},)', r'\1\n            "proposal_confirmation_totals": prop_totals,', content)

# Also in get_regional_breakdown, make sure it has all regions even if empty
# Actually, the user says "regional_trend must contain all six regions... Add 'Other' only if some row maps to it."
# Let's fix get_regional_breakdown.
# Currently it iterates over CANONICAL_REGIONS + ["Other"]
get_reg_start = content.find("def get_regional_breakdown")
# We'll just replace the whole get_regional_breakdown using regex or a targeted replace
with open("backend/services/v2_overview_service.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Patch 2 part 1 done")
