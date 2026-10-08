import re

with open("backend/tests/test_oct7_upload_e2e.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the expected numbers
# "Replace them with these scopes: renewals today 1212, renewals yesterday 1208, Q4 slice today 348, Q4 slice yesterday 346, last-week Q4 334, last-week renewals 1197."
# Let's see what is inside test_validate_scope_numbers_to_the_cent. I'll just rewrite the test completely.

test_scope_old_start = content.find("def test_validate_scope_numbers_to_the_cent")
test_scope_old_end = content.find("def test_", test_scope_old_start + 10)
if test_scope_old_end == -1:
    test_scope_old_end = len(content)

test_scope_new = """def test_validate_scope_numbers_to_the_cent(db_session):
    from backend.models.opportunity import Opportunity
    from backend.models.snapshot import UploadSnapshot
    from backend.services.scopes import ScopeService
    from sqlalchemy import select, func
    
    snaps = {s.label: s.id for s in db_session.query(UploadSnapshot).all()}
    
    def _cnt(snap_lbl, scope_filter):
        if snap_lbl not in snaps: return 0
        snap_id = snaps[snap_lbl]
        stmt = select(func.count(Opportunity.id)).where(Opportunity.snapshot_id == snap_id, scope_filter)
        return db_session.execute(stmt).scalar()
        
    assert _cnt("Today", ScopeService.is_renewals()) == 1212
    assert _cnt("Yesterday", ScopeService.is_renewals()) == 1208
    
    # Q4 slice
    today_snap = db_session.query(UploadSnapshot).filter(UploadSnapshot.label == "Today").first()
    assert _cnt("Today", ScopeService.current_quarter_slice(today_snap.snapshot_date)) == 348
    assert _cnt("Yesterday", ScopeService.current_quarter_slice(today_snap.snapshot_date)) == 346
    
    # Last week
    assert _cnt("Last Week (Partial)", ScopeService.current_quarter_slice(today_snap.snapshot_date)) == 334
    assert _cnt("Last Week (Partial)", ScopeService.is_renewals()) == 1197

"""
content = content[:test_scope_old_start] + test_scope_new + content[test_scope_old_end:]

# "delete the FY2026 Commit->Closed test"
test_commit_closed_start = content.find("def test_fy2026_commit_to_closed_diff")
if test_commit_closed_start != -1:
    test_commit_closed_end = content.find("def test_", test_commit_closed_start + 10)
    if test_commit_closed_end == -1:
        test_commit_closed_end = len(content)
    content = content[:test_commit_closed_start] + content[test_commit_closed_end:]

# "test_yesterday_and_last_week_are_tagged_by_scope: rewrite it as 'yesterday and last-week snapshots have sales_type and fiscal_period filled on 100% of rows'."
test_tagged_start = content.find("def test_yesterday_and_last_week_are_tagged_by_scope")
if test_tagged_start != -1:
    test_tagged_end = content.find("def test_", test_tagged_start + 10)
    if test_tagged_end == -1:
        test_tagged_end = len(content)
        
    test_tagged_new = """def test_yesterday_and_last_week_are_tagged_by_scope(db_session):
    from backend.models.opportunity import Opportunity
    from backend.models.snapshot import UploadSnapshot
    
    yest_snap = db_session.query(UploadSnapshot).filter(UploadSnapshot.label == "Yesterday").first()
    lw_snap = db_session.query(UploadSnapshot).filter(UploadSnapshot.label == "Last Week (Partial)").first()
    
    for s in (yest_snap, lw_snap):
        if not s: continue
        total = db_session.query(Opportunity).filter(Opportunity.snapshot_id == s.id).count()
        with_st = db_session.query(Opportunity).filter(Opportunity.snapshot_id == s.id, Opportunity.sales_type.isnot(None)).count()
        with_fp = db_session.query(Opportunity).filter(Opportunity.snapshot_id == s.id, Opportunity.fiscal_period.isnot(None)).count()
        assert total > 0
        assert with_st == total
        assert with_fp == total

"""
    content = content[:test_tagged_start] + test_tagged_new + content[test_tagged_end:]

# Remove skip marks from test_oct7_upload_e2e.py if any
content = content.replace("@pytest.mark.skip", "#@pytest.mark.skip")

with open("backend/tests/test_oct7_upload_e2e.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Patch e2e done")
