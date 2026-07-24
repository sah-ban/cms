from email import policy
from email.parser import BytesParser
from io import BytesIO
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException, UploadFile, status


MAX_DOCUMENT_BYTES = 10 * 1024 * 1024


async def extract_document_text(file: UploadFile) -> str:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded document is empty.")
    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Document exceeds 10MB limit.")

    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()

    if filename.endswith(".pdf") or content_type == "application/pdf":
        return _extract_pdf_text(content)
    if filename.endswith(".docx") or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _extract_docx_text(content)
    if filename.endswith(".eml") or content_type == "message/rfc822":
        return _extract_eml_text(content)
    if filename.endswith(".txt") or content_type.startswith("text/"):
        return _decode_text(content)

    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Unsupported document type. Upload a PDF, DOCX, TXT, or EML file.",
    )


def _extract_pdf_text(content: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF extraction dependency is not installed.",
        ) from exc

    reader = PdfReader(BytesIO(content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return _require_text(text)


def _extract_docx_text(content: bytes) -> str:
    try:
        with ZipFile(BytesIO(content)) as docx:
            xml = docx.read("word/document.xml")
    except (BadZipFile, KeyError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not read DOCX document text.") from exc

    import re
    import xml.etree.ElementTree as ET

    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not parse DOCX document text.") from exc

    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for paragraph in root.findall(".//w:p", namespace):
        paragraph_text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace))
        if paragraph_text.strip():
            paragraphs.append(paragraph_text)
    return _require_text("\n".join(paragraphs))


def _extract_eml_text(content: bytes) -> str:
    message = BytesParser(policy=policy.default).parsebytes(content)
    if message.is_multipart():
        parts = [
            part.get_content()
            for part in message.walk()
            if part.get_content_type() == "text/plain" and not part.get_filename()
        ]
        return _require_text("\n".join(str(part) for part in parts))
    return _require_text(str(message.get_content()))


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return _require_text(content.decode(encoding))
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not decode text document.")


def _require_text(text: str) -> str:
    normalized = " ".join(text.split()).strip()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No readable text found in document.")
    return normalized
