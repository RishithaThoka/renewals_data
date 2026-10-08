import re

files = [
    "backend/services/v2_overview_service.py",
    "backend/services/analytics_service.py",
    "backend/services/opportunity_service.py",
    "backend/tests/test_scopes.py",
]

for fp in files:
    with open(fp, "r", encoding="utf-8") as f:
        content = f.read()

    # We need to replace:
    # ScopeService.current_quarter_slice(snap.snapshot_date) -> ScopeService.current_quarter_slice(ScopeService.current_quarter(snap.snapshot_date))
    # etc., but it's better to replace the specific usages we find.
    
    # In analytics_service.py:
    # ScopeService.current_quarter_slice(snapshot.snapshot_date)
    content = content.replace(
        "ScopeService.current_quarter_slice(snapshot.snapshot_date)",
        "ScopeService.current_quarter_slice(ScopeService.current_quarter(snapshot.snapshot_date))"
    )

    # In opportunity_service.py:
    # ScopeService.current_quarter_slice(snap.snapshot_date)
    content = content.replace(
        "ScopeService.current_quarter_slice(snap.snapshot_date)",
        "ScopeService.current_quarter_slice(ScopeService.current_quarter(snap.snapshot_date))"
    )

    # In v2_overview_service.py:
    # ScopeService.current_quarter_slice(eff_date) -> Wait, eff_date was target_date. If target_date is used, we need the quarter of it.
    # Actually, in v2_overview_service.py, get_summary uses `snap.snapshot_date`.
    content = content.replace(
        "ScopeService.current_quarter_slice(eff_date)",
        "ScopeService.current_quarter_slice(ScopeService.current_quarter(eff_date))"
    )
    
    # Also, slippage and delayed. Let's see if there are usages.
    content = content.replace(
        "ScopeService.slippage(snapshot.snapshot_date)",
        "ScopeService.slippage(ScopeService.current_quarter(snapshot.snapshot_date))"
    )
    content = content.replace(
        "ScopeService.delayed(snapshot.snapshot_date)",
        "ScopeService.delayed(ScopeService.current_quarter(snapshot.snapshot_date))"
    )
    
    # In test_scopes.py
    content = content.replace(
        "ScopeService.current_quarter_slice(d)",
        "ScopeService.current_quarter_slice(ScopeService.current_quarter(d))"
    )
    content = content.replace(
        "ScopeService.slippage(d)",
        "ScopeService.slippage(ScopeService.current_quarter(d))"
    )
    content = content.replace(
        "ScopeService.delayed(d)",
        "ScopeService.delayed(ScopeService.current_quarter(d))"
    )

    with open(fp, "w", encoding="utf-8") as f:
        f.write(content)

print("Updated callers")
