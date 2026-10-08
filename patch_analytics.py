import re

# Patch analytics_service.py
with open("backend/services/analytics_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace scoping
new_scope = """        if scope == "renewals":
            q = q.filter(ScopeService.is_renewals())
        elif scope == "fy2026":
            # For backward compat or tests
            q = q.filter(ScopeService.is_renewals(), Opportunity.fiscal_period.in_(["Q1-2026", "Q2-2026", "Q3-2026", "Q4-2026"]))
        elif scope == "fy2027":
            q = q.filter(ScopeService.is_renewals(), Opportunity.fiscal_period.in_(["Q1-2027", "Q2-2027", "Q3-2027", "Q4-2027"]))
        elif scope == "q4_2026":
            q = q.filter(ScopeService.current_quarter_slice(snapshot.snapshot_date))"""

# find def _opps_for
start = content.find('if scope == "renewals":')
end = content.find('return q', start)
if start != -1 and end != -1:
    content = content[:start] + new_scope + "\n        " + content[end:]

import_end = content.find("from backend.services.context import UserContext")
content = content[:import_end] + "from backend.services.scopes import ScopeService\n" + content[import_end:]

with open("backend/services/analytics_service.py", "w", encoding="utf-8") as f:
    f.write(content)

# Patch opportunity_service.py
with open("backend/services/opportunity_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# same replacement
start = content.find('if scope == "renewals":')
end = content.find('return q.all()', start)
if start != -1 and end != -1:
    content = content[:start] + new_scope + "\n        " + content[end:]
    
import_end = content.find("from backend.services.context import UserContext")
content = content[:import_end] + "from backend.services.scopes import ScopeService\n" + content[import_end:]

with open("backend/services/opportunity_service.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Analytics and Opportunity services patched")
