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


def _fallback_extract(text: str) -> dict:
    lowered = text.lower()
    flags: list[str] = []
    severity = "Medium"
    priority = "QA Review"

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

    return IntakeExtraction(
        complaint_source="Email" if "@" in text else "Customer communication",
        description=text.strip(),
        initial_severity=severity,
        priority=priority,
        ai_summary=text.strip()[:280],
        ai_risk_flags=flags or ["Requires QA triage"],
    ).model_dump()


def _extract_with_groq(state: ComplaintIntakeState) -> ComplaintIntakeState:
    if not settings.groq_api_key:
        return {"text": state["text"], "extraction": _fallback_extract(state["text"])}

    os.environ["GROQ_API_KEY"] = settings.groq_api_key
    from langchain_groq import ChatGroq

    llm = ChatGroq(model=settings.groq_model, temperature=0)
    response = llm.invoke(
        [
            ("system", SYSTEM_PROMPT),
            ("human", state["text"]),
        ]
    )
    content = response.content if isinstance(response.content, str) else json.dumps(response.content)
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = _fallback_extract(state["text"])

    return {"text": state["text"], "extraction": IntakeExtraction(**parsed).model_dump()}


def build_complaint_graph():
    graph = StateGraph(ComplaintIntakeState)
    graph.add_node("extract_complaint", _extract_with_groq)
    graph.add_edge(START, "extract_complaint")
    graph.add_edge("extract_complaint", END)
    return graph.compile()


complaint_graph = build_complaint_graph()

