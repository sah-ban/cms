from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.complaint_graph import complaint_graph
from app.db.models import Complaint
from app.db.session import get_db
from app.schemas import ComplaintCreate, ComplaintRead, IntakeExtraction, IntakeRequest

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/complaints", response_model=list[ComplaintRead])
def list_complaints(db: Session = Depends(get_db)) -> list[Complaint]:
    return list(db.scalars(select(Complaint).order_by(Complaint.created_at.desc())).all())


@router.post("/complaints", response_model=ComplaintRead, status_code=201)
def create_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)) -> Complaint:
    complaint = Complaint(**payload.model_dump())
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.post("/ai/intake", response_model=IntakeExtraction)
def extract_complaint(payload: IntakeRequest) -> dict:
    state = complaint_graph.invoke({"text": payload.text, "extraction": {}})
    return state["extraction"]

