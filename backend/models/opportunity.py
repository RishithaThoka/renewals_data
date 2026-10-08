"""
Opportunity — one row per raw data row per snapshot.
Primary natural key: opportunity_id_18 within a snapshot.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    String, Numeric, Date, DateTime, Integer, Float,
    ForeignKey, Text, Index, Boolean, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("upload_snapshots.id"), index=True)

    # --- Natural / business key ---
    opportunity_id_18: Mapped[str | None] = mapped_column(String(18), index=True)

    # --- Core fields ---
    opportunity_name: Mapped[str | None] = mapped_column(String(512))
    account_name: Mapped[str | None] = mapped_column(String(512))
    sub_region: Mapped[str | None] = mapped_column(String(256))
    revised_sub_region: Mapped[str | None] = mapped_column(String(256))
    country_territory: Mapped[str | None] = mapped_column(String(256))

    # Business unit — raw string (may contain "; " separated values)
    business_unit_raw: Mapped[str | None] = mapped_column(Text)
    # Normalised first BU (most reports group by single BU)
    business_unit_primary: Mapped[str | None] = mapped_column(String(256), index=True)

    # Forecast
    forecast_category: Mapped[str | None] = mapped_column(String(64), index=True)
    forecast_acv_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # Dates
    close_date: Mapped[date | None] = mapped_column(Date)
    last_modified_date: Mapped[datetime | None] = mapped_column(DateTime)

    # Probability & approval
    probability_pct: Mapped[float | None] = mapped_column(Float)
    # Normalised: "Approved" | "Approved - 2nd" | "Pending Approval" | "Rejected" | "Blank"
    approval_status: Mapped[str | None] = mapped_column(String(64), index=True)

    # Expiry & timing
    service_expiry_period: Mapped[str | None] = mapped_column(String(32), index=True)
    closing_year: Mapped[int | None] = mapped_column(Integer)
    renewal_category: Mapped[str | None] = mapped_column(String(128))
    months_delayed: Mapped[float | None] = mapped_column(Float)

    # Owner
    opportunity_owner: Mapped[str | None] = mapped_column(String(256))

    # Stage & Active / Deleted / Lost
    stage_number: Mapped[str | None] = mapped_column(String(64))
    is_deleted_or_lost: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Scope membership flags (set by membership in summary files' Today_Data)
    in_renewals: Mapped[bool | None] = mapped_column(Boolean, nullable=True, index=True)
    in_fy2026: Mapped[bool | None] = mapped_column(Boolean, nullable=True, index=True)
    in_fy2027: Mapped[bool | None] = mapped_column(Boolean, nullable=True, index=True)
    in_q4_2026: Mapped[bool | None] = mapped_column(Boolean, nullable=True, index=True)

    # Raw full attributes (all 172 columns preserved)
    extra_attributes: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    snapshot: Mapped["UploadSnapshot"] = relationship(  # noqa: F821
        "UploadSnapshot", back_populates="opportunities"
    )

    __table_args__ = (
        Index("ix_opp_snapshot_opp_id", "snapshot_id", "opportunity_id_18"),
    )

    def __repr__(self) -> str:
        return f"<Opportunity {self.opportunity_id_18} [{self.forecast_category}] ${self.forecast_acv_amount}>"
