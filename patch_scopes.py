import re

with open("backend/services/scopes.py", "r", encoding="utf-8") as f:
    content = f.read()

# Change current_quarter_slice
cqs_old = """    @staticmethod
    def current_quarter_slice(snapshot_date: date) -> ColumnElement[bool]:
        \"\"\"Scope: renewals AND fiscal_period == current quarter\"\"\"
        cq = ScopeService.current_quarter(snapshot_date)
        return and_(
            ScopeService.is_renewals(),
            Opportunity.fiscal_period == cq
        )"""

cqs_new = """    @staticmethod
    def current_quarter_slice(quarter: str) -> ColumnElement[bool]:
        \"\"\"Scope: renewals AND fiscal_period == current quarter\"\"\"
        return and_(
            ScopeService.is_renewals(),
            Opportunity.fiscal_period == quarter
        )"""

content = content.replace(cqs_old, cqs_new)

# Change slippage
slip_old = """    @staticmethod
    def slippage(snapshot_date: date) -> ColumnElement[bool]:
        \"\"\"Scope: current_quarter_slice AND close_date after the quarter end\"\"\"
        cq = ScopeService.current_quarter(snapshot_date)
        _, end_date = ScopeService.quarter_bounds(cq)
        return and_(
            ScopeService.current_quarter_slice(snapshot_date),
            Opportunity.close_date > end_date
        )"""

slip_new = """    @staticmethod
    def slippage(quarter: str) -> ColumnElement[bool]:
        \"\"\"Scope: current_quarter_slice AND close_date after the quarter end\"\"\"
        _, end_date = ScopeService.quarter_bounds(quarter)
        return and_(
            ScopeService.current_quarter_slice(quarter),
            Opportunity.close_date > end_date
        )"""

content = content.replace(slip_old, slip_new)

# Change delayed
del_old = """    @staticmethod
    def delayed(snapshot_date: date) -> ColumnElement[bool]:
        \"\"\"Scope: renewals AND fiscal_period an earlier quarter of the SAME fiscal year AND forecast_category != 'Closed'\"\"\"
        cq = ScopeService.current_quarter(snapshot_date)
        if not cq or "-" not in cq:
            return False"""

del_new = """    @staticmethod
    def delayed(quarter: str) -> ColumnElement[bool]:
        \"\"\"Scope: renewals AND fiscal_period an earlier quarter of the SAME fiscal year AND forecast_category != 'Closed'\"\"\"
        cq = quarter
        if not cq or "-" not in cq:
            return False"""

content = content.replace(del_old, del_new)

with open("backend/services/scopes.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated scopes.py")
