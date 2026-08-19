from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..models.candidate import PipelineStage, StageChange
from ..services.pipeline_service import get_pipeline_service
from ..services.storage_service import get_storage_service

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


class MoveRequest(BaseModel):
    to_stage: PipelineStage
    job_id: str = ""
    notes: Optional[str] = None
    force: bool = False


class BulkMoveRequest(BaseModel):
    candidate_ids: List[str]
    to_stage: PipelineStage
    job_id: str = ""
    notes: Optional[str] = None
    force: bool = False


class StageChangeResponse(BaseModel):
    from_stage: Optional[str]
    to_stage: str
    changed_at: str
    changed_by: Optional[str]
    notes: Optional[str]


class CandidateCard(BaseModel):
    id: str
    name: Optional[str]
    email: Optional[str]
    filename: str
    analyzed: bool
    pipeline_stage: str
    overall_score: Optional[float]
    recommendation: Optional[str]
    emails_sent: int


class StageData(BaseModel):
    stage: str
    label: str
    candidates: List[CandidateCard]


STAGE_LABELS = {
    "applied": "Applied",
    "screened": "Screened",
    "interview_invited": "Interview Invited",
    "interview_scheduled": "Interview Scheduled",
    "interview_done": "Interview Done",
    "offer": "Offer",
    "hired": "Hired",
    "rejected": "Rejected",
}


@router.get("/stages")
async def get_pipeline_stages(job_id: Optional[str] = Query(None)) -> List[StageData]:
    """Get all candidates grouped by pipeline stage."""
    pipeline_service = get_pipeline_service()
    candidates_by_stage = pipeline_service.get_candidates_by_stage(job_id or "")

    result = []
    for stage in PipelineStage:
        candidates = candidates_by_stage.get(stage.value, [])
        result.append(
            StageData(
                stage=stage.value,
                label=STAGE_LABELS.get(stage.value, stage.value.replace("_", " ").title()),
                candidates=[CandidateCard(**c) for c in candidates],
            )
        )

    return result


@router.get("/stats")
async def get_pipeline_stats(job_id: Optional[str] = Query(None)) -> Dict[str, int]:
    """Get count of candidates per pipeline stage."""
    pipeline_service = get_pipeline_service()
    return pipeline_service.get_stage_stats(job_id or "")


@router.post("/candidates/{candidate_id}/move")
async def move_candidate(candidate_id: str, request: MoveRequest) -> Dict:
    """Move a candidate to a new pipeline stage."""
    pipeline_service = get_pipeline_service()

    try:
        result = pipeline_service.move_candidate(
            candidate_id=candidate_id,
            to_stage=request.to_stage,
            job_id=request.job_id,
            notes=request.notes,
            force=request.force,
        )

        if result is None and request.job_id:
            raise HTTPException(status_code=404, detail="Application not found")

        return {
            "success": True,
            "candidate_id": candidate_id,
            "pipeline_stage": request.to_stage.value,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bulk-move")
async def bulk_move_candidates(request: BulkMoveRequest) -> Dict:
    """Move multiple candidates to a new stage."""
    pipeline_service = get_pipeline_service()

    results = pipeline_service.bulk_move_candidates(
        candidate_ids=request.candidate_ids,
        to_stage=request.to_stage,
        job_id=request.job_id,
        notes=request.notes,
        force=request.force,
    )

    success_count = sum(1 for r in results.values() if r == "success")
    failed_count = len(results) - success_count

    return {
        "total": len(results),
        "success": success_count,
        "failed": failed_count,
        "results": results,
    }


@router.get("/candidates/{candidate_id}/history")
async def get_candidate_history(
    candidate_id: str,
    job_id: Optional[str] = Query(None),
) -> List[StageChangeResponse]:
    """Get stage change history for a candidate."""
    pipeline_service = get_pipeline_service()
    history = pipeline_service.get_stage_history(candidate_id, job_id or "")

    if not history:
        storage = get_storage_service()
        candidate = storage.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

    return [
        StageChangeResponse(
            from_stage=change.from_stage.value if change.from_stage else None,
            to_stage=change.to_stage.value,
            changed_at=change.changed_at.isoformat(),
            changed_by=change.changed_by,
            notes=change.notes,
        )
        for change in history
    ]


@router.get("/candidates/{candidate_id}/transitions")
async def get_valid_transitions(
    candidate_id: str,
    job_id: Optional[str] = Query(None),
) -> Dict:
    """Get valid stage transitions for a candidate."""
    storage = get_storage_service()

    if job_id:
        app = storage.get_application_by_candidate_and_job(candidate_id, job_id)
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")
        current_stage = app.pipeline_stage
    else:
        candidate = storage.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        current_stage = candidate.pipeline_stage

    pipeline_service = get_pipeline_service()
    valid = pipeline_service.get_valid_transitions(current_stage)

    return {
        "current_stage": current_stage.value,
        "valid_transitions": [s.value for s in valid],
    }
