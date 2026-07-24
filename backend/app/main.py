from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.db import models
from app.db.session import engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Customer Complaint Management System",
    description="Pharmaceutical QMS complaint intake and triage API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

