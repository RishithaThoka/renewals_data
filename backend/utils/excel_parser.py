"""
Excel parser — reads raw sheets from workbooks into pandas DataFrames.
Column mapping and slot detection defined here.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

import pandas as pd


# ---------------------------------------------------------------------------
# Column name → canonical attribute name mapping
# ---------------------------------------------------------------------------
RENEWALS_COLUMN_MAP: dict[str, str] = {
    # Natural key
    "opportunity id 18 digit": "opportunity_id_18",

    # Core deal fields
    "opportunity name":         "opportunity_name",
    "account name":             "account_name",

    # Regions
    "sub-region":               "sub_region",
    "revised sub-region":       "revised_sub_region",
    "country: territory name":  "country_territory",
    "country / territory":      "country_territory",

    # BU
    "business unit":            "business_unit_raw",

    # Forecast
    "forecast category":        "forecast_category",
    "forecast acv amount":      "forecast_acv_amount",

    # Dates
    "close date":               "close_date",
    "last modified date":       "last_modified_date",

    # Probability & approval
    "probability (%)":          "probability_pct",
    "opportunity approval status": "approval_status",
    "approval status":          "approval_status",

    # Expiry & timing
    "service expiry period":    "service_expiry_period",
    "closing year":             "closing_year",
    "fiscal period":            "fiscal_period",
    "renewal category":         "renewal_category",

    # Months delayed (newline collapsed to space)
    "months delayed (working)": "months_delayed",
    "months\ndelayed (working)": "months_delayed",

    # Owner & sales/stage
    "opportunity owner":        "opportunity_owner",
    "sales type":               "sales_type",
    "stage number":             "stage_number",
    "stage":                    "stage_number",
}

RAW_DATA_SHEETS = ["Today_Data", "Yesterday_Data", "Lastweek_Data"]

COMPARISON_SHEETS = [
    "FinalChangeReport",
    "ACVChanges",
    "TodayForecastSummary",
    "YesterdayForecastSummary",
    "ForecastMovementSummary",
    "OpportunityStatus",
    "ApprovalStatusChanges",
    "ServiceExpiryChanges",
    "RenewalCategoryChanges",
    "RegionChanges",
    "ForecastChanges",
    "comparison",
    "today",
    "yesterday",
]


def compute_file_sha256(path: Path) -> str:
    """Calculate SHA-256 hash of a file."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def _normalise_col(col: str) -> str:
    """Lowercase + strip + collapse whitespace for fuzzy matching."""
    return re.sub(r"\s+", " ", str(col).strip().lower())


def _map_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename columns from raw Excel headers to canonical names."""
    rename = {}
    for col in df.columns:
        normed = _normalise_col(col)
        if normed in RENEWALS_COLUMN_MAP:
            rename[col] = RENEWALS_COLUMN_MAP[normed]
    return df.rename(columns=rename)


def _read_sheet(path: Path, sheet_name: str, **kwargs) -> pd.DataFrame:
    """Read one sheet, always returning a DataFrame (empty if sheet missing)."""
    try:
        df = pd.read_excel(path, sheet_name=sheet_name, dtype=str, **kwargs)
        return df
    except Exception as exc:
        raise ValueError(f"Cannot read sheet '{sheet_name}' from {path.name}: {exc}") from exc


def available_sheets(path: Path) -> list[str]:
    """Return list of sheet names without loading full data."""
    xf = pd.ExcelFile(path)
    return xf.sheet_names


def detect_file_slot(path: Path) -> tuple[str, str]:
    """
    Detect slot by CONTENT and sheet signature:
    - Comparison Tool: sheets 'today' and 'yesterday'
    - Summary files: sheet 'Today_Data'
      - all Fiscal Period == 'Q4-2026' -> 'fiscal_q4'
      - else all Closing Year == '2027' -> 'fiscal_2027'
      - else -> 'fiscal_2026'
    """
    try:
        xf = pd.ExcelFile(path)
        sheet_names = xf.sheet_names
        sheet_names_lower = {s.lower(): s for s in sheet_names}
    except Exception as exc:
        return "unknown", f"Cannot open Excel file: {exc}"

    if "today" in sheet_names_lower and "yesterday" in sheet_names_lower:
        return "comparison_tool", "Renewal Comparison Tool (today & yesterday sheets present)"

    today_data_sheet = sheet_names_lower.get("today_data")
    if today_data_sheet:
        try:
            df_head = pd.read_excel(path, sheet_name=today_data_sheet, nrows=50)
            fp_col = next((c for c in df_head.columns if "fiscal period" in str(c).lower()), None)
            cy_col = next((c for c in df_head.columns if "closing year" in str(c).lower()), None)

            cols_to_read = [c for c in [fp_col, cy_col] if c]
            if cols_to_read:
                df_full = pd.read_excel(path, sheet_name=today_data_sheet, usecols=cols_to_read)
                if fp_col:
                    vals_fp = df_full[fp_col].dropna().astype(str).str.strip().unique()
                    if len(vals_fp) == 1 and vals_fp[0] == "Q4-2026":
                        return "fiscal_q4", "Renewals Summary - Fiscal Q4 (all Fiscal Period = Q4-2026)"
                if cy_col:
                    vals_cy = df_full[cy_col].dropna().astype(str).str.replace(".0", "").str.strip().unique()
                    if len(vals_cy) == 1 and vals_cy[0] == "2027":
                        return "fiscal_2027", "Renewals Summary - Fiscal 2027 (all Closing Year = 2027)"

            return "fiscal_2026", "Renewals Summary - Fiscal 2026 (Renewals scope)"
        except Exception:
            return "fiscal_2026", "Renewals Summary (defaulted to Fiscal 2026)"

    return "unknown", f"Unrecognized sheet structure: {sheet_names[:5]}"


def parse_comparison_tool(path: Path) -> dict[str, pd.DataFrame]:
    """
    Read sheets from the Comparison Tool workbook.
    Returns dict keyed by sheet name (original and lowercase).
    'today' and 'yesterday' columns are also mapped to canonical names.
    """
    result: dict[str, pd.DataFrame] = {}
    sheets_in_wb = available_sheets(path)
    for sheet in sheets_in_wb:
        if sheet in COMPARISON_SHEETS or sheet.lower() in ("today", "yesterday"):
            try:
                df = _read_sheet(path, sheet)
                df = df.dropna(how="all")
            except ValueError:
                df = pd.DataFrame()
            result[sheet] = df
            result[sheet.lower()] = df

    return result


def parse_summary_workbook(path: Path) -> dict[str, pd.DataFrame]:
    """
    Read raw data sheets ('Today_Data', 'Yesterday_Data', 'Lastweek_Data')
    and any pivot sheets for reconciliation.
    """
    result: dict[str, pd.DataFrame] = {}
    sheets_in_wb = available_sheets(path)
    for sheet in sheets_in_wb:
        try:
            df = _read_sheet(path, sheet)
            df = df.dropna(how="all")
        except ValueError:
            df = pd.DataFrame()
        result[sheet] = df
        result[sheet.lower()] = df

    return result


parse_renewals_summary = parse_summary_workbook
