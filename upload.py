import requests
from pathlib import Path

slots = ['comparison_tool', 'fiscal_2026', 'fiscal_2027', 'fiscal_q4']
files = {}
for slot in slots:
    for f in Path('data/sample_oct7').glob('*.xlsx'):
        if (slot == 'comparison_tool' and 'Comparison' in f.name) or \
           (slot == 'fiscal_2026' and '2026' in f.name) or \
           (slot == 'fiscal_2027' and '2027' in f.name) or \
           (slot == 'fiscal_q4' and 'Q4' in f.name):
            files[slot] = (f.name, open(f, 'rb'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

r = requests.post('http://localhost:8000/api/snapshots/validate', data={'data_as_of_date': '2026-10-07'}, files=files)
print(r.json())
session_id = r.json()['session_id']
c = requests.post('http://localhost:8000/api/snapshots/commit', json={'session_id': session_id, 'replace': False})
print(c.json())
