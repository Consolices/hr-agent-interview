from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from typing import Dict, List, Optional
import uuid

from ..services.storage_service import get_storage_service
from ..services.file_parser import parse_cv, UnsupportedFileTypeError
from ..services.agent_service import extract_cv_data_standalone
from ..models.candidate import Candidate, FileType

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


class CandidateResponse(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    filename: str
    file_type: str
    analyzed: bool
    created_at: str
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None
    emails_sent: int = 0
    pipeline_stage: Optional[str] = None


class CandidateDetailResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    raw_text: str
    extracted_data: Optional[dict] = None
    application_responses: Optional[dict] = None
    analyzed: bool
    created_at: str
    analysis: Optional[dict] = None
    drive_file_id: Optional[str] = None


class ApplicationResponsesUpdate(BaseModel):
    # Dynamic dict of question key → answer
    responses: Optional[Dict[str, Optional[str]]] = None
    # Legacy fields for backward compat
    introduction: Optional[str] = None
    passion_description: Optional[str] = None
    self_learning: Optional[str] = None


class ApplicationInfo(BaseModel):
    application_id: str
    job_id: str
    job_title: str
    pipeline_stage: str
    analyzed: bool
    overall_score: Optional[float] = None


@router.get("", response_model=List[CandidateResponse])
async def list_candidates(job_id: Optional[str] = Query(None)):
    """List all candidates ranked by score. Optionally filter by job_id."""
    storage = get_storage_service()
    ranked = storage.get_ranked_candidates(job_id or "")

    return [
        CandidateResponse(
            id=c["id"],
            name=c.get("name"),
            email=c.get("email"),
            filename=c["filename"],
            file_type="pdf",
            analyzed=c["analyzed"],
            created_at=c["created_at"] or "",
            overall_score=c.get("overall_score"),
            recommendation=c.get("recommendation"),
            emails_sent=c.get("emails_sent", 0),
            pipeline_stage=c.get("pipeline_stage"),
        )
        for c in ranked
    ]


@router.get("/stats")
async def get_stats(job_id: Optional[str] = Query(None)):
    """Get overview statistics."""
    storage = get_storage_service()
    return storage.get_stats(job_id or "")


@router.get("/{candidate_id}", response_model=CandidateDetailResponse)
async def get_candidate(candidate_id: str, job_id: Optional[str] = Query(None)):
    """Get detailed candidate information."""
    storage = get_storage_service()
    candidate = storage.get_candidate(candidate_id)

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    analysis = storage.get_analysis_by_candidate(candidate_id, job_id or "")

    # Determine application-level fields when job scoped
    analyzed = candidate.analyzed
    application_responses = candidate.application_responses
    if job_id:
        app = storage.get_application_by_candidate_and_job(candidate_id, job_id)
        if app:
            analyzed = app.analyzed
            if app.application_responses is not None:
                application_responses = app.application_responses

    return CandidateDetailResponse(
        id=candidate.id,
        filename=candidate.filename,
        file_type=candidate.file_type.value,
        raw_text=candidate.raw_text,
        extracted_data=candidate.extracted_data.model_dump() if candidate.extracted_data else None,
        application_responses=application_responses,
        analyzed=analyzed,
        created_at=candidate.created_at.isoformat() if candidate.created_at else "",
        analysis=analysis.model_dump() if analysis else None,
        drive_file_id=candidate.drive_file_id,
    )


@router.get("/{candidate_id}/applications", response_model=List[ApplicationInfo])
async def get_candidate_applications(candidate_id: str):
    """Get all job applications for a candidate."""
    storage = get_storage_service()
    candidate = storage.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    applications = storage.get_applications_by_candidate(candidate_id)
    result = []
    for app in applications:
        job = storage.get_job(app.job_id)
        job_title = job.title if job else "Unknown Job"
        analysis = storage.get_analysis_by_candidate(candidate_id, app.job_id)
        result.append(ApplicationInfo(
            application_id=app.id,
            job_id=app.job_id,
            job_title=job_title,
            pipeline_stage=app.pipeline_stage.value,
            analyzed=app.analyzed,
            overall_score=analysis.score.overall_score if analysis else None,
        ))
    return result


@router.post("/upload", response_model=CandidateResponse)
async def upload_cv(file: UploadFile = File(...)):
    """Upload a CV file directly."""
    storage = get_storage_service()

    try:
        file_bytes = await file.read()
        filename = file.filename or "unknown.pdf"
        text, file_type = parse_cv(file_bytes, filename)

        candidate = Candidate(
            id=str(uuid.uuid4()),
            filename=filename,
            file_type=FileType(file_type),
            raw_text=text,
        )

        storage.save_candidate(candidate)

        return CandidateResponse(
            id=candidate.id,
            name=None,
            email=None,
            filename=candidate.filename,
            file_type=candidate.file_type.value,
            analyzed=False,
            created_at=candidate.created_at.isoformat(),
            overall_score=None,
            recommendation=None,
        )

    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{candidate_id}/responses")
async def update_application_responses(
    candidate_id: str,
    responses: ApplicationResponsesUpdate,
    job_id: Optional[str] = Query(None),
):
    """Update candidate's application responses."""
    storage = get_storage_service()
    candidate = storage.get_candidate(candidate_id)

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if responses.responses is not None:
        resp_data = responses.responses
    else:
        # Legacy format fallback
        resp_data = {
            "introduction": responses.introduction,
            "passion_description": responses.passion_description,
            "self_learning": responses.self_learning,
        }

    # Save on Application when job-scoped, otherwise on Candidate
    if job_id:
        app = storage.get_application_by_candidate_and_job(candidate_id, job_id)
        if app:
            app.application_responses = resp_data
            storage.save_application(app)
        else:
            candidate.application_responses = resp_data
            storage.save_candidate(candidate)
    else:
        candidate.application_responses = resp_data
        storage.save_candidate(candidate)

    return {"message": "Responses updated successfully"}


@router.post("/{candidate_id}/extract")
async def extract_cv_data(candidate_id: str):
    """Extract structured data from candidate's CV using LLM."""
    storage = get_storage_service()

    candidate = storage.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    try:
        extracted = await extract_cv_data_standalone(candidate.raw_text)
        candidate.extracted_data = extracted
        storage.save_candidate(candidate)

        return {
            "message": "CV data extracted successfully",
            "data": extracted.model_dump(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: str):
    """Delete a candidate."""
    storage = get_storage_service()

    if not storage.delete_candidate(candidate_id):
        raise HTTPException(status_code=404, detail="Candidate not found")

    return {"message": "Candidate deleted successfully"}
