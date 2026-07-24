from datetime import date, datetime
from enum import Enum

from sqlalchemy import Date, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ComplaintStatus(str, Enum):
    pending_triage = "Pending Triage"
    qa_review = "QA Review"
    investigation = "Investigation"
    capa_required = "CAPA Required"
    closed = "Closed"


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    complaint_source: Mapped[str] = mapped_column(default="")
    customer_name: Mapped[str] = mapped_column(default="")
    product_name: Mapped[str] = mapped_column(default="")
    product_strength_grade: Mapped[str] = mapped_column(default="")
    batch_lot_number: Mapped[str] = mapped_column(default="", index=True)
    manufacturing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    quantity_affected: Mapped[str] = mapped_column(default="")
    complaint_type: Mapped[str] = mapped_column(default="")
    complaint_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    initial_severity: Mapped[str] = mapped_column(default="Unclassified")
    priority: Mapped[str] = mapped_column(default="Pending")
    status: Mapped[ComplaintStatus] = mapped_column(default=ComplaintStatus.pending_triage)
    ai_summary: Mapped[str] = mapped_column(Text, default="")
    ai_risk_flags: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

