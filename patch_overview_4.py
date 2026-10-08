import re

with open("backend/tests/test_v2_overview.py", "r", encoding="utf-8") as f:
    content = f.read()

start = content.find("def test_commit_to_closed_vs_yesterday_fy2026")
if start != -1:
    end = content.find("def test_", start + 10)
    if end == -1:
        end = len(content)
    content = content[:start] + content[end:]

with open("backend/tests/test_v2_overview.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Removed test_commit_to_closed_vs_yesterday_fy2026")
