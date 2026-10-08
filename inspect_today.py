import pandas as pd
from pathlib import Path
from backend.utils.excel_parser import parse_comparison_tool, _map_columns

p = Path("data/sample_oct7/Renewal Comparison Tool.xlsx")
if p.exists():
    sheets = parse_comparison_tool(p, None)
    today_df = sheets["today"]
    cols = list(today_df.columns)
    print("Columns in today sheet:", cols)
    
    mapped = _map_columns(today_df)
    print("Mapped columns:", list(mapped.columns))
    
    if "sales_type" in mapped.columns:
        print("Sales Type values:", mapped["sales_type"].unique())
    else:
        print("sales_type NOT FOUND in mapped columns")
