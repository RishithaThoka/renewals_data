import re

with open("backend/services/v2_overview_service.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# The error says "IndentationError: expected an indented block after 'if' statement on line 290"
# Let's see lines around 290
for i, l in enumerate(lines):
    if "prop_totals =" in l:
        print(f"Line {i+1}: {l.strip()}")
        if "if" in lines[i-1]:
            print(f"Line {i}: {lines[i-1].strip()}")

with open("backend/services/v2_overview_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# Wait, my earlier patch was:
#        # Proposal confirmation totals for summary
#        prop_totals = {
# That was injected before "return {".
# Let's inspect get_summary in v2_overview_service.py around 290
with open("v2_overview_service_temp.py", "w", encoding="utf-8") as f:
    f.write(content)

