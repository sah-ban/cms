from datetime import date, datetime

from pydantic import BaseModel, Field


class ComplaintBase(BaseModel):
    complaint_source: str = ""
    customer_name: str = ""
    product_name: str = ""
    product_strength_grade: str = ""
    batch_lot_number: str = ""
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    quantity_affected: str = ""
    complaint_type: str = ""
    complaint_date: date | None = None
    description: str = ""
    initial_severity: str = "Unclassified"
    priority: str = "Pending"
    status: str = "Pending Triage"
    ai_summary: str = ""
    ai_risk_flags: str = ""


class ComplaintCreate(ComplaintBase):
    pass


class ComplaintRead(ComplaintBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IntakeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class IntakeExtraction(BaseModel):
    complaint_source: str = ""
    customer_name: str = ""
    product_name: str = ""
    product_strength_grade: str = ""
    batch_lot_number: str = ""
    manufacturing_date: str = ""
    expiry_date: str = ""
    quantity_affected: str = ""
    complaint_type: str = ""
    complaint_date: str = ""
    description: str = ""
    initial_severity: str = "Medium"
    priority: str = "QA Review"
    ai_summary: str = ""
    ai_risk_flags: list[str] = []


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    complaint: dict[str, str] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    answer: str
    updates: dict[str, str] = Field(default_factory=dict)
