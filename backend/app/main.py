import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import candidates, analysis, drive, sheets, settings, pipeline, email, jobs
from .config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

app = FastAPI(
    title="HR CV Screening Agent",
    description="AI-powered CV screening and candidate ranking system",
    version="2.0.0",
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(analysis.router)
app.include_router(drive.router)
app.include_router(sheets.router)
app.include_router(settings.router)
app.include_router(pipeline.router)
app.include_router(email.router)


@app.on_event("startup")
async def run_migrations():
    """Run data migrations on startup."""
    from .migrations.migrate_to_multi_job import run_migration

    settings = get_settings()
    run_migration(settings.data_path)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "HR CV Screening Agent API",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    settings = get_settings()
    return {
        "status": "healthy",
        "openai_configured": bool(settings.openai_api_key),
        "google_configured": bool(settings.google_client_id and settings.google_client_secret),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
