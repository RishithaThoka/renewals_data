from datetime import date
from dateutil.relativedelta import relativedelta
from typing import Tuple
from sqlalchemy import or_, and_, ColumnElement

from backend.config import settings
from backend.models.opportunity import Opportunity

class ScopeService:
    @staticmethod
    def quarter_of(d: date) -> str:
        """Returns the fiscal quarter of a date, e.g., 'Q4-2026'."""
        if not d:
            return ""
        start_month = settings.FISCAL_YEAR_START_MONTH
        m = d.month - start_month
        if m < 0:
            m += 12
            fy = d.year
        else:
            fy = d.year + (1 if start_month > 1 else 0)
        
        q = (m // 3) + 1
        return f"Q{q}-{fy}"

    @staticmethod
    def quarter_label(q_str: str) -> str:
        """Converts 'Q4-2026' to 'Q4 FY26'."""
        if not q_str or "-" not in q_str:
            return q_str
        q, y = q_str.split("-")
        return f"{q} FY{y[-2:]}"

    @staticmethod
    def current_quarter(snapshot_date: date) -> str:
        return ScopeService.quarter_of(snapshot_date)

    @staticmethod
    def quarter_bounds(q_str: str) -> Tuple[date, date]:
        """Returns (start_date, end_date) for a given quarter 'Qx-YYYY'."""
        if not q_str or "-" not in q_str:
            return date.today(), date.today()
        q_part, y_part = q_str.split("-")
        q = int(q_part[1])
        y = int(y_part)
        
        start_month = settings.FISCAL_YEAR_START_MONTH
        
        if start_month > 1:
            calendar_year = y - 1
        else:
            calendar_year = y
            
        q_start_month = start_month + (q - 1) * 3
        if q_start_month > 12:
            q_start_month -= 12
            calendar_year += 1
            
        start_date = date(calendar_year, q_start_month, 1)
        end_date = start_date + relativedelta(months=3, days=-1)
        return start_date, end_date

    @staticmethod
    def is_renewals() -> ColumnElement[bool]:
        """Scope: renewals = sales_type == 'Renewals'"""
        return Opportunity.sales_type == "Renewals"

    @staticmethod
    def current_quarter_slice(quarter: str) -> ColumnElement[bool]:
        """Scope: renewals AND fiscal_period == current quarter"""
        return and_(
            ScopeService.is_renewals(),
            Opportunity.fiscal_period == quarter
        )

    @staticmethod
    def slippage(quarter: str) -> ColumnElement[bool]:
        """Scope: current_quarter_slice AND close_date after the quarter end"""
        _, end_date = ScopeService.quarter_bounds(quarter)
        return and_(
            ScopeService.current_quarter_slice(quarter),
            Opportunity.close_date > end_date
        )

    @staticmethod
    def delayed(quarter: str) -> ColumnElement[bool]:
        """Scope: renewals AND fiscal_period an earlier quarter of the SAME fiscal year AND forecast_category != 'Closed'"""
        cq = quarter
        if not cq or "-" not in cq:
            return False
        
        q_part, y_part = cq.split("-")
        current_q = int(q_part[1])
        current_y = int(y_part)
        
        # Build list of earlier quarters in the same fiscal year
        earlier_quarters = [f"Q{q}-{current_y}" for q in range(1, current_q)]
        
        return and_(
            ScopeService.is_renewals(),
            Opportunity.fiscal_period.in_(earlier_quarters),
            Opportunity.forecast_category != "Closed"
        )

    @staticmethod
    def expiry_window(snapshot_date: date) -> ColumnElement[bool]:
        """Scope: renewals AND service_expiry_period in current fiscal year + next fiscal year"""
        cq = ScopeService.current_quarter(snapshot_date)
        if not cq or "-" not in cq:
            return False
        _, y_part = cq.split("-")
        current_y = int(y_part)
        next_y = current_y + 1
        
        # Generate possible expiry periods for FY and FY+1
        # E.g. "Q1-2026", "Q2-2026", ..., "Q4-2027"
        valid_periods = []
        for y in (current_y, next_y):
            for q in range(1, 5):
                valid_periods.append(f"Q{q}-{y}")
                
        return and_(
            ScopeService.is_renewals(),
            Opportunity.service_expiry_period.in_(valid_periods)
        )
