import os
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.email import RecruitmentSettings
from ..models.scoring import ScoringConfig
from ..services.storage_service import get_storage_service
from ..services.drive_service import get_drive_service

router = APIRouter(prefix="/api/settings", tags=["settings"])

# job-description.txt lives in the project root (two levels above this file)
_JD_PATH = os.path.join(
    os.path.dirname(__file__),  # routers/
    "..",                       # app/
    "..",                       # backend/
    "..",                       # project root
    "job-description.txt",
)
_JD_PATH = os.path.normpath(_JD_PATH)


class JobDescriptionBody(BaseModel):
    content: str


@router.get("/job-description")
async def get_job_description():
    """Read the current job description from job-description.txt."""
    if os.path.exists(_JD_PATH):
        with open(_JD_PATH, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = ""
    return {"content": content}


@router.put("/job-description")
async def update_job_description(body: JobDescriptionBody):
    """Write a new job description to job-description.txt."""
    try:
        with open(_JD_PATH, "w", encoding="utf-8") as f:
            f.write(body.content)
        return {"message": "Job description saved", "length": len(body.content)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save: {str(e)}")


# Recruitment Settings
class RecruitmentSettingsBody(BaseModel):
    trafft_booking_link: Optional[str] = None
    company_name: str = "Your Company"
    position_title: str = "Software Engineer"
    sender_name: str = "HR Team"
    sender_email: Optional[str] = None


@router.get("/recruitment")
async def get_recruitment_settings():
    """Get recruitment settings."""
    storage = get_storage_service()
    settings = storage.get_recruitment_settings()
    return settings.model_dump()


@router.put("/recruitment")
async def update_recruitment_settings(body: RecruitmentSettingsBody):
    """Update recruitment settings."""
    storage = get_storage_service()
    settings = RecruitmentSettings(
        trafft_booking_link=body.trafft_booking_link,
        company_name=body.company_name,
        position_title=body.position_title,
        sender_name=body.sender_name,
        sender_email=body.sender_email,
    )
    storage.save_recruitment_settings(settings)
    return {"message": "Recruitment settings saved"}


# Scoring Config
@router.get("/scoring")
async def get_scoring_config():
    """Get scoring configuration."""
    storage = get_storage_service()
    config = storage.get_scoring_config()
    return config.model_dump()


@router.put("/scoring")
async def update_scoring_config(body: ScoringConfig):
    """Update scoring configuration. Weights must sum to 100."""
    storage = get_storage_service()
    storage.save_scoring_config(body)
    return {"message": "Scoring config saved"}


# OAuth Status
class OAuthStatusResponse(BaseModel):
    connected: bool
    has_drive_scope: bool
    has_sheets_scope: bool
    has_gmail_send_scope: bool
    has_gmail_read_scope: bool
    needs_reauth: bool


@router.get("/oauth/status")
async def get_oauth_status() -> OAuthStatusResponse:
    """Check OAuth status and scope availability."""
    drive_service = get_drive_service()

    # Try to load credentials
    if not drive_service._credentials:
        drive_service._load_credentials()

    if not drive_service._credentials:
        return OAuthStatusResponse(
            connected=False,
            has_drive_scope=False,
            has_sheets_scope=False,
            has_gmail_send_scope=False,
            has_gmail_read_scope=False,
            needs_reauth=True,
        )

    scopes = drive_service._credentials.scopes or []

    has_drive = "https://www.googleapis.com/auth/drive.readonly" in scopes
    has_sheets = "https://www.googleapis.com/auth/spreadsheets.readonly" in scopes
    has_gmail_send = "https://www.googleapis.com/auth/gmail.send" in scopes
    has_gmail_read = "https://www.googleapis.com/auth/gmail.readonly" in scopes

    # Need re-auth if missing Gmail scopes
    needs_reauth = not (has_gmail_send and has_gmail_read)

    return OAuthStatusResponse(
        connected=True,
        has_drive_scope=has_drive,
        has_sheets_scope=has_sheets,
        has_gmail_send_scope=has_gmail_send,
        has_gmail_read_scope=has_gmail_read,
        needs_reauth=needs_reauth,
    )
