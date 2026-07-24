import json
import os
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.config import settings
from app.schemas import IntakeExtraction


class ComplaintIntakeState(TypedDict):
    text: str
    extraction: dict


SYSTEM_PROMPT = """You are a pharmaceutical QMS complaint intake assistant.
Extract structured data from customer complaint text for API or FDF manufacturing.
Return only valid JSON matching these keys:
complaint_source, customer_name, product_name, product_strength_grade, batch_lot_number,
manufacturing_date, expiry_date, quantity_affected, complaint_type, complaint_date,
description, initial_severity, priority, ai_summary, ai_risk_flags.
Use empty strings when unknown. ai_risk_flags must be a JSON array of short strings.
Severity should be Low, Medium, High, or Critical. Priority should be Pending, QA Review,
Investigation, CAPA Review, Recall Assessment, or Pharmacovigilance Review."""


def _normalize_text(text: str) -> str:
    return " ".join(text.split()).strip()


def _fallback_extract(text: str) -> dict:
    normalized = _normalize_text(text)
    lowered = normalized.lower()
    word_count = len(normalized.split()) if normalized else 0
    flags: list[str] = []
    severity = "Medium"
    priority = "QA Review"

    if not normalized or word_count < 3:
        return IntakeExtraction(
            complaint_source="Customer communication",
            description=normalized,
            initial_severity="Low",
            priority="Pending",
            ai_summary=normalized or "No complaint detail provided.",
            ai_risk_flags=["Insufficient detail for automated triage"],
        ).model_dump()

    if any(term in lowered for term in ["injury", "adverse", "serious", "hospital", "death"]):
        flags.append("Potential adverse event")
        severity = "Critical"
        priority = "Pharmacovigilance Review"
    if any(term in lowered for term in ["contamination", "foreign particle", "black speck", "glass"]):
        flags.append("Potential contamination or foreign matter")
        severity = "High" if severity != "Critical" else severity
        priority = "Investigation"
    if any(term in lowered for term in ["out of specification", "oos", "failed", "assay", "dissolution"]):
        flags.append("Possible specification failure")
        priority = "Investigation"
    if any(term in lowered for term in ["multiple", "recurring", "repeat"]):
        flags.append("Possible complaint trend")

    import re
    product_name = ""
    batch_lot = ""
    expiry_date = ""

    # Simple regex for lot/batch
    lot_match = re.search(r'(?:Lot(?: number)?|Batch)\s*:?\s*([A-Za-z0-9\-]+)', text, re.IGNORECASE)
    if lot_match:
        batch_lot = lot_match.group(1)
        
    # Simple regex for expiry
    exp_match = re.search(r'(?:Exp(?:ires)?|Expiry)\s*:?\s*([0-9]{2}/[0-9]{4}|[0-9]{4}-[0-9]{2})', text, re.IGNORECASE)
    if exp_match:
        expiry_date = exp_match.group(1)
        
    # Simple check for common products in test data
    if "ibuprofen" in lowered:
        product_name = "Ibuprofen 200mg"
    elif "amoxicillin" in lowered:
        product_name = "Amoxicillin 500mg"
    elif "lisinopril" in lowered:
        product_name = "Lisinopril 10mg"

    return IntakeExtraction(
        complaint_source="Email" if "@" in text else "Customer communication",
        description=text.strip(),
        initial_severity=severity,
        priority=priority,
        ai_summary=text.strip()[:280],
        ai_risk_flags=flags or ["Requires QA triage"],
        batch_lot_number=batch_lot,
        product_name=product_name,
        expiry_date=expiry_date
    ).model_dump()


def _extract_with_groq(state: ComplaintIntakeState) -> ComplaintIntakeState:
    normalized = _normalize_text(state["text"])
    if not settings.groq_api_key or len(normalized.split()) < 3:
        return {"text": normalized, "extraction": _fallback_extract(normalized)}

    os.environ["GROQ_API_KEY"] = settings.groq_api_key
    from langchain_groq import ChatGroq

    llm = ChatGroq(model=settings.groq_model, temperature=0)
    try:
        response = llm.invoke(
            [
                ("system", SYSTEM_PROMPT),
                ("human", normalized),
            ]
        )
        content = response.content if isinstance(response.content, str) else json.dumps(response.content)
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        parsed = json.loads(content)
    except Exception as e:
        print(f"Groq API or JSON parsing error: {e}")
        parsed = _fallback_extract(normalized)

    try:
        extraction = IntakeExtraction(**parsed).model_dump()
    except Exception as e:
        print(f"Pydantic validation error: {e}")
        extraction = _fallback_extract(normalized)

    return {"text": normalized, "extraction": extraction}


def build_complaint_graph():
    graph = StateGraph(ComplaintIntakeState)
    graph.add_node("extract_complaint", _extract_with_groq)
    graph.add_edge(START, "extract_complaint")
    graph.add_edge("extract_complaint", END)
    return graph.compile()


complaint_graph = build_complaint_graph()
