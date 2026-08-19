import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.job import Job, JobCreate, JobUpdate, JobStatus, DEFAULT_RESPONSE_QUESTIONS


def _default_questions():
    return [dict(q) for q in DEFAULT_RESPONSE_QUESTIONS]
from ..models.application import Application
from ..services.storage_service import get_storage_service
from ..services.drive_service import get_drive_service
from ..services.sync_helpers import (
    preview_drive_folder,
    sync_drive_folder,
    sync_from_sheet as sync_from_sheet_helper,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class JobResponse(BaseModel):
    id: str
    title: str
    description: str
    status: str
    company_name: str
    position_title: str
    trafft_booking_link: Optional[str]
    sender_name: str
    sender_email: Optional[str]
    drive_folder_id: Optional[str] = None
    drive_folder_name: Optional[str] = None
    sheet_spreadsheet_id: Optional[str] = None
    sheet_spreadsheet_name: Optional[str] = None
    sheet_column_mapping: Optional[Dict[str, Any]] = None
    response_questions: List[Dict[str, str]] = []
    created_at: str
    updated_at: str
    candidate_count: int = 0
    analyzed_count: int = 0


class ApplyRequest(BaseModel):
    candidate_id: str


class BulkApplyRequest(BaseModel):
    candidate_ids: List[str]


def _job_to_response(job: Job, storage) -> JobResponse:
    applications = storage.get_applications_by_job(job.id)
    analyzed = sum(1 for a in applications if a.analyzed)
    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        status=job.status.value,
        company_name=job.company_name,
        position_title=job.position_title or job.title,
        trafft_booking_link=job.trafft_booking_link,
        sender_name=job.sender_name,
        sender_email=job.sender_email,
        drive_folder_id=job.drive_folder_id,
        drive_folder_name=job.drive_folder_name,
        sheet_spreadsheet_id=job.sheet_spreadsheet_id,
        sheet_spreadsheet_name=job.sheet_spreadsheet_name,
        sheet_column_mapping=job.sheet_column_mapping,
        response_questions=job.response_questions or _default_questions(),
        created_at=job.created_at.isoformat() if job.created_at else "",
        updated_at=job.updated_at.isoformat() if job.updated_at else "",
        candidate_count=len(applications),
        analyzed_count=analyzed,
    )


@router.get("", response_model=List[JobResponse])
async def list_jobs():
    """List all jobs with candidate counts."""
    storage = get_storage_service()
    jobs = storage.list_jobs()
    return [_job_to_response(j, storage) for j in jobs]


@router.post("", response_model=JobResponse)
async def create_job(request: JobCreate):
    """Create a new job."""
    storage = get_storage_service()
    job = Job(
        id=str(uuid.uuid4()),
        title=request.title,
        description=request.description,
        status=request.status,
        company_name=request.company_name,
        position_title=request.position_title or request.title,
        trafft_booking_link=request.trafft_booking_link,
        sender_name=request.sender_name,
        sender_email=request.sender_email,
        drive_folder_id=request.drive_folder_id,
        drive_folder_name=request.drive_folder_name,
        sheet_spreadsheet_id=request.sheet_spreadsheet_id,
        sheet_spreadsheet_name=request.sheet_spreadsheet_name,
        sheet_column_mapping=request.sheet_column_mapping,
        response_questions=request.response_questions,
    )
    storage.save_job(job)
    return _job_to_response(job, storage)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Get job detail."""
    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job, storage)


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(job_id: str, request: JobUpdate):
    """Update a job."""
    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if request.title is not None:
        job.title = request.title
    if request.description is not None:
        job.description = request.description
    if request.status is not None:
        job.status = request.status
    if request.company_name is not None:
        job.company_name = request.company_name
    if request.position_title is not None:
        job.position_title = request.position_title
    if request.trafft_booking_link is not None:
        job.trafft_booking_link = request.trafft_booking_link
    if request.sender_name is not None:
        job.sender_name = request.sender_name
    if request.sender_email is not None:
        job.sender_email = request.sender_email
    if request.drive_folder_id is not None:
        job.drive_folder_id = request.drive_folder_id
    if request.drive_folder_name is not None:
        job.drive_folder_name = request.drive_folder_name
    if request.sheet_spreadsheet_id is not None:
        job.sheet_spreadsheet_id = request.sheet_spreadsheet_id
    if request.sheet_spreadsheet_name is not None:
        job.sheet_spreadsheet_name = request.sheet_spreadsheet_name
    if request.sheet_column_mapping is not None:
        job.sheet_column_mapping = request.sheet_column_mapping
    if request.response_questions is not None:
        job.response_questions = request.response_questions

    storage.save_job(job)
    return _job_to_response(job, storage)


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its applications."""
    storage = get_storage_service()
    if not storage.delete_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully"}


@router.post("/{job_id}/apply")
async def apply_to_job(job_id: str, request: ApplyRequest):
    """Link a candidate to a job (create Application)."""
    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate = storage.get_candidate(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Check if already applied
    existing = storage.get_application_by_candidate_and_job(request.candidate_id, job_id)
    if existing:
        return {"message": "Already applied", "application_id": existing.id}

    application = Application(
        id=str(uuid.uuid4()),
        candidate_id=request.candidate_id,
        job_id=job_id,
    )
    storage.save_application(application)
    return {"message": "Application created", "application_id": application.id}


@router.post("/{job_id}/apply-bulk")
async def bulk_apply_to_job(job_id: str, request: BulkApplyRequest):
    """Link multiple candidates to a job."""
    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    created = 0
    skipped = 0
    for candidate_id in request.candidate_ids:
        candidate = storage.get_candidate(candidate_id)
        if not candidate:
            continue
        existing = storage.get_application_by_candidate_and_job(candidate_id, job_id)
        if existing:
            skipped += 1
            continue
        application = Application(
            id=str(uuid.uuid4()),
            candidate_id=candidate_id,
            job_id=job_id,
        )
        storage.save_application(application)
        created += 1

    return {"created": created, "skipped": skipped}


@router.get("/{job_id}/candidates")
async def get_job_candidates(job_id: str):
    """List ranked candidates for a job."""
    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return storage.get_ranked_candidates(job_id)


@router.get("/{job_id}/stats")
async def get_job_stats(job_id: str):
    """Get job-specific statistics."""
    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return storage.get_stats(job_id)


def _link_candidates_to_job(storage, job_id: str, candidate_ids: List[str]):
    """Create Application records for candidates that don't already have one for this job.

    Returns (linked, already_linked) counts.
    """
    linked = 0
    already_linked = 0
    for cid in candidate_ids:
        existing = storage.get_application_by_candidate_and_job(cid, job_id)
        if existing:
            already_linked += 1
            continue
        application = Application(
            id=str(uuid.uuid4()),
            candidate_id=cid,
            job_id=job_id,
        )
        storage.save_application(application)
        linked += 1
    return linked, already_linked


@router.post("/{job_id}/sync-drive/preview")
async def job_sync_drive_preview(job_id: str):
    """Preview Drive folder sync for a specific job."""
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.drive_folder_id:
        raise HTTPException(status_code=400, detail="No Drive folder configured for this job")

    try:
        result = preview_drive_folder(job.drive_folder_id)
        return {
            "total_files": result.total_files,
            "new_files": result.new_files,
            "already_synced": result.already_synced,
            "file_names": result.file_names,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{job_id}/sync-drive")
async def job_sync_drive(job_id: str):
    """Sync Drive folder for a specific job. Creates candidates and Application records."""
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.drive_folder_id:
        raise HTTPException(status_code=400, detail="No Drive folder configured for this job")

    try:
        result = sync_drive_folder(job.drive_folder_id)
        all_candidate_ids = result.new_candidate_ids + result.existing_candidate_ids
        linked, already_linked = _link_candidates_to_job(storage, job_id, all_candidate_ids)

        return {
            "total_files": result.total_files,
            "processed": result.processed,
            "skipped": result.skipped,
            "errors": result.errors,
            "linked": linked,
            "already_linked": already_linked,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{job_id}/sync-sheet")
async def job_sync_sheet(job_id: str):
    """Sync Google Sheet for a specific job. Creates candidates with responses and Application records."""
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    storage = get_storage_service()
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.sheet_spreadsheet_id:
        raise HTTPException(status_code=400, detail="No spreadsheet configured for this job")
    if not job.sheet_column_mapping:
        raise HTTPException(status_code=400, detail="No column mapping configured for this job")

    try:
        result = await sync_from_sheet_helper(job.sheet_spreadsheet_id, job.sheet_column_mapping)

        all_candidate_ids = result.new_candidate_ids + result.existing_candidate_ids
        linked, already_linked = _link_candidates_to_job(storage, job_id, all_candidate_ids)

        # Copy application_responses from candidate to the Application record for new links
        for cid in result.new_candidate_ids:
            candidate = storage.get_candidate(cid)
            if candidate and candidate.application_responses:
                app = storage.get_application_by_candidate_and_job(cid, job_id)
                if app and not app.application_responses:
                    app.application_responses = candidate.application_responses
                    storage.save_application(app)

        return {
            "total_rows": result.total_rows,
            "processed": result.processed,
            "skipped": result.skipped,
            "errors": result.errors,
            "linked": linked,
            "already_linked": already_linked,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
