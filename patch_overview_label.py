import re

with open("backend/tests/test_v2_overview.py", "r", encoding="utf-8") as f:
    content = f.read()

# Fix test_data_slice_label
old_label = """    def test_data_slice_label(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/summary")
        assert r.json()["data_slice"] == "Q4-2026\""""

new_label = """    def test_data_slice_label(self, client_and_db):
        client, _ = client_and_db
        r = client.get("/api/v2/overview/summary")
        assert r.json()["data_slice"] == "Q4 FY26\""""

content = content.replace(old_label, new_label)

with open("backend/tests/test_v2_overview.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Patch overview label done")
