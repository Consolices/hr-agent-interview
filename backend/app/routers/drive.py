from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import List, Optional

from ..services.drive_service import get_drive_service
from ..services.storage_service import get_storage_service
from ..services.sync_helpers import preview_drive_folder, sync_drive_folder

router = APIRouter(prefix="/api/drive", tags=["drive"])


class DriveFile(BaseModel):
    id: str
    name: str
    mime_type: str
    created_time: Optional[str] = None
    modified_time: Optional[str] = None
    size: Optional[int] = None


class DriveFolder(BaseModel):
    id: str
    name: str


class ConnectionStatus(BaseModel):
    connected: bool
    auth_url: Optional[str] = None


class SyncPreview(BaseModel):
    total_files: int
    new_files: int
    already_synced: int
    file_names: List[str]


class SyncResult(BaseModel):
    total_files: int
    processed: int
    skipped: int
    errors: List[str]


@router.get("/status", response_model=ConnectionStatus)
async def get_connection_status():
    """Check if Google Drive is connected."""
    drive = get_drive_service()
    connected = drive.is_connected()

    if not connected:
        auth_url = drive.get_auth_url()
        return ConnectionStatus(connected=False, auth_url=auth_url)

    return ConnectionStatus(connected=True)


@router.get("/connect")
async def connect_drive():
    """Initiate Google Drive OAuth flow."""
    drive = get_drive_service()
    auth_url = drive.get_auth_url()
    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(code: str = Query(...)):
    """Handle OAuth callback from Google."""
    drive = get_drive_service()
    try:
        drive.handle_callback(code)
        # Redirect to frontend success page
        return RedirectResponse(url="http://localhost:3000/settings?connected=true")
    except Exception as e:
        return RedirectResponse(url=f"http://localhost:3000/settings?error={str(e)}")


@router.post("/disconnect")
async def disconnect_drive():
    """Disconnect Google Drive."""
    drive = get_drive_service()
    drive.disconnect()
    return {"message": "Disconnected from Google Drive"}


@router.get("/folders", response_model=List[DriveFolder])
async def list_folders():
    """List folders from Google Drive."""
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    try:
        folders = drive.list_folders()
        return [DriveFolder(id=f["id"], name=f["name"]) for f in folders]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files", response_model=List[DriveFile])
async def list_files(folder_id: Optional[str] = None):
    """List CV files from Google Drive folder."""
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    try:
        files = drive.list_files(folder_id)
        return [
            DriveFile(
                id=f["id"],
                name=f["name"],
                mime_type=f["mimeType"],
                created_time=f.get("createdTime"),
                modified_time=f.get("modifiedTime"),
                size=int(f.get("size", 0)) if f.get("size") else None,
            )
            for f in files
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/preview", response_model=SyncPreview)
async def sync_preview(folder_id: Optional[str] = None):
    """Count files in a Drive folder before syncing. Returns total, new, and already-synced counts."""
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    try:
        result = preview_drive_folder(folder_id)
        return SyncPreview(
            total_files=result.total_files,
            new_files=result.new_files,
            already_synced=result.already_synced,
            file_names=result.file_names,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync", response_model=SyncResult)
async def sync_files(folder_id: Optional[str] = None):
    """Fetch and process all CV files from Google Drive."""
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    try:
        helper_result = sync_drive_folder(folder_id)
        return SyncResult(
            total_files=helper_result.total_files,
            processed=helper_result.processed,
            skipped=helper_result.skipped,
            errors=helper_result.errors,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
