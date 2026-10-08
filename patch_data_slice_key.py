import re

# Update v2_overview_service.py
with open("backend/services/v2_overview_service.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    '            "data_slice":       ScopeService.quarter_label(ScopeService.current_quarter(snap.snapshot_date)),',
    '            "data_slice":       ScopeService.quarter_label(ScopeService.current_quarter(snap.snapshot_date)),\n            "data_slice_key":   ScopeService.current_quarter(snap.snapshot_date),'
)

with open("backend/services/v2_overview_service.py", "w", encoding="utf-8") as f:
    f.write(content)


# Update test_v2_overview.py
with open("backend/tests/test_v2_overview.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    '        assert r.json()["data_slice"] == "Q4 FY26"',
    '        d = r.json()\n        assert d["data_slice"] == "Q4 FY26"\n        assert d["data_slice_key"] == "Q4-2026"'
)

with open("backend/tests/test_v2_overview.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Added data_slice_key")
