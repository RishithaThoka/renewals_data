import re

with open("backend/services/v2_overview_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# Change _q4_opps signature and logic
q4_old = """    def _q4_opps(self, snap: UploadSnapshot, exclude_deleted: bool = False) -> list[Opportunity]:
        q = (
            self.db.query(Opportunity)
            .filter(
                Opportunity.snapshot_id == snap.id,
                ScopeService.current_quarter_slice(snap.snapshot_date)
            )
        )"""
q4_new = """    def _q4_opps(self, snap: UploadSnapshot, exclude_deleted: bool = False, target_date = None) -> list[Opportunity]:
        eff_date = target_date if target_date else snap.snapshot_date
        q = (
            self.db.query(Opportunity)
            .filter(
                Opportunity.snapshot_id == snap.id,
                ScopeService.current_quarter_slice(eff_date)
            )
        )"""
content = content.replace(q4_old, q4_new)


# Change y_opps and lw_opps calls in get_summary
ysnap_old = """            y_opps = self._q4_opps(yest_snap, exclude_deleted=exclude_deleted)"""
ysnap_new = """            y_opps = self._q4_opps(yest_snap, exclude_deleted=exclude_deleted, target_date=snap.snapshot_date)"""
content = content.replace(ysnap_old, ysnap_new)

lwsnap_old = """            lw_opps = self._q4_opps(lw_snap, exclude_deleted=exclude_deleted)"""
lwsnap_new = """            lw_opps = self._q4_opps(lw_snap, exclude_deleted=exclude_deleted, target_date=snap.snapshot_date)"""
content = content.replace(lwsnap_old, lwsnap_new)

# Change get_regional_breakdown
yreg_old = """        y_opps = self._q4_opps(yest_snap, exclude_deleted=exclude_deleted) if yest_snap else []"""
yreg_new = """        y_opps = self._q4_opps(yest_snap, exclude_deleted=exclude_deleted, target_date=snap.snapshot_date) if yest_snap else []"""
content = content.replace(yreg_old, yreg_new)

lwreg_old = """        lw_opps = self._q4_opps(lw_snap, exclude_deleted=exclude_deleted) if lw_snap else []"""
lwreg_new = """        lw_opps = self._q4_opps(lw_snap, exclude_deleted=exclude_deleted, target_date=snap.snapshot_date) if lw_snap else []"""
content = content.replace(lwreg_old, lwreg_new)

with open("backend/services/v2_overview_service.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Patch 5 done")
