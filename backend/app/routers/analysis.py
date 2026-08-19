import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import asyncio

from ..services.storage_service import get_storage_service
from ..services.agent_service import analyze_candidate as agent_analyze
from ..services.agent_service import analyze_candidates_batch
from ..models.analysis import BatchAnalysisProgress

logger = logging.getLogger("analysis")

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

# Global progress tracking
_batch_progress: Optional[BatchAnalysisProgress] = None


class AnalyzeRequest(BaseModel):
    job_id: str = ""
    job_description: Optional[str] = None


class AnalysisResponse(BaseModel):
    id: str
    candidate_id: str
    overall_score: float
    job_match_score: float
    screening_score: float
    response_score: float
    recommendation: str
    summary: str
    red_flags: List[str]
    green_flags: List[str]
    analyzed_at: str


class BatchAnalyzeRequest(BaseModel):
    candidate_ids: Optional[List[str]] = None
    job_id: str = ""
    job_description: Optional[str] = None


@router.post("/{candidate_id}/analyze", response_model=AnalysisResponse)
async def analyze_candidate(candidate_id: str, request: AnalyzeRequest = None):
    """Analyze a single candidate."""
    storage = get_storage_service()

    candidate = storage.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Load Job if job_id provided
    job = None
    app = None
    application_id = ""
    job_id = request.job_id if request else ""
    if job_id:
        job = storage.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        app = storage.get_application_by_candidate_and_job(candidate_id, job_id)
        if app:
            application_id = app.id

    try:
        result = await agent_analyze(
            candidate,
            job=job,
            job_id=job_id,
            application_id=application_id,
        )

        # Update candidate with extracted data
        if candidate.extracted_data:
            storage.save_candidate(candidate)

        # Save analysis result
        storage.save_analysis(result)

        # Mark application as analyzed
        if app:
            app.analyzed = True
            storage.save_application(app)

        return AnalysisResponse(
            id=result.id,
            candidate_id=result.candidate_id,
            overall_score=result.score.overall_score,
            job_match_score=result.score.job_match_score.score,
            screening_score=result.score.screening_score.score,
            response_score=result.score.response_score.score,
            recommendation=result.score.recommendation or "Unknown",
            summary=result.score.summary or "",
            red_flags=result.score.red_flags,
            green_flags=result.score.green_flags,
            analyzed_at=result.analyzed_at.isoformat(),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Get analysis details by ID."""
    storage = get_storage_service()
    analysis = storage.get_analysis(analysis_id)

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return analysis.model_dump()


@router.get("/candidate/{candidate_id}")
async def get_candidate_analysis(candidate_id: str, job_id: Optional[str] = None):
    """Get the latest analysis for a candidate."""
    storage = get_storage_service()
    analysis = storage.get_analysis_by_candidate(candidate_id, job_id or "")

    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this candidate")

    return analysis.model_dump()


async def run_batch_analysis(candidate_ids: List[str], job_id: str = ""):
    """Background task for batch analysis — runs candidates concurrently."""
    global _batch_progress
    storage = get_storage_service()

    logger.info(f"[BATCH] Starting batch analysis for {len(candidate_ids)} candidates")

    _batch_progress = BatchAnalysisProgress(
        total=len(candidate_ids),
        completed=0,
        in_progress=True,
        errors=[],
    )

    # Load job if provided
    job = storage.get_job(job_id) if job_id else None

    def update_progress(candidate_id: str, error: Optional[str]) -> None:
        _batch_progress.completed += 1
        _batch_progress.current_candidate = candidate_id
        if error:
            logger.error(f"[BATCH] Error for {candidate_id}: {error}")
            _batch_progress.errors.append(error)
        else:
            logger.info(f"[BATCH] Progress: {_batch_progress.completed}/{_batch_progress.total} done")

    await analyze_candidates_batch(
        candidate_ids=candidate_ids,
        get_candidate=storage.get_candidate,
        save_candidate=storage.save_candidate,
        save_analysis=storage.save_analysis,
        progress_callback=update_progress,
        job=job,
        job_id=job_id,
        get_application=storage.get_application_by_candidate_and_job if job_id else None,
        save_application=storage.save_application if job_id else None,
    )

    _batch_progress.in_progress = False
    _batch_progress.current_candidate = None

    logger.info(f"[BATCH] Analysis complete: {_batch_progress.completed}/{_batch_progress.total}, "
                f"errors={len(_batch_progress.errors)}")

    # Export results to CSV after batch completes
    try:
        csv_path = storage.export_candidates_csv(job_id)
        logger.info(f"[CSV] Export successful: {csv_path}")
    except Exception as e:
        logger.error(f"[CSV] Export failed: {e}")


@router.post("/batch")
async def batch_analyze(request: BatchAnalyzeRequest, background_tasks: BackgroundTasks):
    """Start batch analysis of multiple candidates."""
    global _batch_progress

    # Check if batch is already running
    if _batch_progress and _batch_progress.in_progress:
        raise HTTPException(status_code=400, detail="Batch analysis already in progress")

    storage = get_storage_service()
    job_id = request.job_id

    # Get candidate IDs to analyze
    if request.candidate_ids:
        candidate_ids = request.candidate_ids
    else:
        if job_id:
            # Analyze unanalyzed candidates for this job
            applications = storage.get_applications_by_job(job_id)
            candidate_ids = [a.candidate_id for a in applications if not a.analyzed]
        else:
            # Analyze all unanalyzed candidates
            candidates = storage.list_candidates()
            candidate_ids = [c.id for c in candidates if not c.analyzed]

    if not candidate_ids:
        return {"message": "No candidates to analyze", "total": 0}

    # Start background task
    background_tasks.add_task(run_batch_analysis, candidate_ids, job_id)

    return {
        "message": "Batch analysis started",
        "total": len(candidate_ids),
    }


@router.get("/batch/progress", response_model=BatchAnalysisProgress)
async def get_batch_progress():
    """Get progress of batch analysis."""
    global _batch_progress

    if not _batch_progress:
        return BatchAnalysisProgress(
            total=0,
            completed=0,
            in_progress=False,
            errors=[],
        )

    return _batch_progress


@router.post("/batch/cancel")
async def cancel_batch():
    """Cancel ongoing batch analysis."""
    global _batch_progress

    if _batch_progress and _batch_progress.in_progress:
        _batch_progress.in_progress = False
        return {"message": "Batch analysis cancelled"}

    return {"message": "No batch analysis in progress"}
