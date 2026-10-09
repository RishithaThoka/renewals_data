import requests
print(requests.get('http://localhost:8000/api/v2/expiry/summary?as_of=2026-10-07&exclude_deleted_lost=false').text)
