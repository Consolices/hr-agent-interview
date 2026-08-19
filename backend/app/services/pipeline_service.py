from typing import Optional, List, Dict
from datetime import datetime

from ..models.candidate import Candidate, PipelineStage, StageChange
from ..models.application import Application
from .storage_service import get_storage_service


# Define valid stage transitions
VALID_TRANSITIONS = {
    PipelineStage.APPLIED: [
        PipelineStage.SCREENED,
        PipelineStage.REJECTED,
    ],
    PipelineStage.SCREENED: [
        PipelineStage.INTERVIEW_INVITED,
        PipelineStage.REJECTED,
    ],
    PipelineStage.INTERVIEW_INVITED: [
        PipelineStage.INTERVIEW_SCHEDULED,
        PipelineStage.SCREENED,  # Allow going back
        PipelineStage.REJECTED,
    ],
    PipelineStage.INTERVIEW_SCHEDULED: [
        PipelineStage.INTERVIEW_DONE,
        PipelineStage.INTERVIEW_INVITED,  # Reschedule
        PipelineStage.REJECTED,
    ],
    PipelineStage.INTERVIEW_DONE: [
        PipelineStage.OFFER,
        PipelineStage.REJECTED,
        PipelineStage.INTERVIEW_SCHEDULED,  # Additional interview
    ],
    PipelineStage.OFFER: [
        PipelineStage.HIRED,
        PipelineStage.REJECTED,  # Declined
    ],
    PipelineStage.HIRED: [],  # Terminal state
    PipelineStage.REJECTED: [],  # Terminal state (but can be reopened)
}


class PipelineService:
    """Service for managing candidate pipeline stages."""

    def move_candidate(
        self,
        candidate_id: str,
        to_stage: PipelineStage,
        job_id: str = "",
        notes: Optional[str] = None,
        changed_by: Optional[str] = None,
        force: bool = False,
    ) -> Optional[Application]:
        """
        Move a candidate to a new pipeline stage.

        When job_id is provided, operates on the Application record.
        Falls back to legacy Candidate-level operation when no job_id.

        Returns updated Application (or None if not found).
        """
        storage = get_storage_service()

        if job_id:
            app = storage.get_application_by_candidate_and_job(candidate_id, job_id)
            if not app:
                return None

            from_stage = app.pipeline_stage

            if not force and to_stage != from_stage:
                valid_targets = VALID_TRANSITIONS.get(from_stage, [])
                if to_stage not in valid_targets:
                    if from_stage == PipelineStage.REJECTED:
                        pass  # Allow any transition from rejected
                    else:
                        raise ValueError(
                            f"Invalid transition from {from_stage.value} to {to_stage.value}. "
                            f"Valid targets: {[s.value for s in valid_targets]}"
                        )

            if from_stage == to_stage:
                return app

            stage_change = StageChange(
                from_stage=from_stage,
                to_stage=to_stage,
                changed_at=datetime.utcnow(),
                changed_by=changed_by,
                notes=notes,
            )

            app.pipeline_stage = to_stage
            app.stage_history.append(stage_change)
            storage.save_application(app)
            return app
        else:
            # Legacy: operate on Candidate
            candidate = storage.get_candidate(candidate_id)
            if not candidate:
                return None

            from_stage = candidate.pipeline_stage

            if not force and to_stage != from_stage:
                valid_targets = VALID_TRANSITIONS.get(from_stage, [])
                if to_stage not in valid_targets:
                    if from_stage == PipelineStage.REJECTED:
                        pass
                    else:
                        raise ValueError(
                            f"Invalid transition from {from_stage.value} to {to_stage.value}. "
                            f"Valid targets: {[s.value for s in valid_targets]}"
                        )

            if from_stage == to_stage:
                return None

            stage_change = StageChange(
                from_stage=from_stage,
                to_stage=to_stage,
                changed_at=datetime.utcnow(),
                changed_by=changed_by,
                notes=notes,
            )

            candidate.pipeline_stage = to_stage
            candidate.stage_history.append(stage_change)
            storage.save_candidate(candidate)
            return None  # Legacy path doesn't return Application

    def bulk_move_candidates(
        self,
        candidate_ids: List[str],
        to_stage: PipelineStage,
        job_id: str = "",
        notes: Optional[str] = None,
        changed_by: Optional[str] = None,
        force: bool = False,
    ) -> Dict[str, str]:
        """Move multiple candidates to a new stage."""
        results = {}
        for candidate_id in candidate_ids:
            try:
                result = self.move_candidate(
                    candidate_id=candidate_id,
                    to_stage=to_stage,
                    job_id=job_id,
                    notes=notes,
                    changed_by=changed_by,
                    force=force,
                )
                if result is not None or not job_id:
                    results[candidate_id] = "success"
                else:
                    results[candidate_id] = "not_found"
            except ValueError as e:
                results[candidate_id] = str(e)
        return results

    def get_stage_history(self, candidate_id: str, job_id: str = "") -> List[StageChange]:
        """Get the stage change history for a candidate."""
        storage = get_storage_service()
        if job_id:
            app = storage.get_application_by_candidate_and_job(candidate_id, job_id)
            if app:
                return app.stage_history
            return []
        else:
            candidate = storage.get_candidate(candidate_id)
            if not candidate:
                return []
            return candidate.stage_history

    def get_candidates_by_stage(self, job_id: str = "") -> Dict[str, List[Dict]]:
        """Get all candidates grouped by pipeline stage."""
        storage = get_storage_service()
        return storage.get_candidates_by_stage(job_id)

    def get_stage_stats(self, job_id: str = "") -> Dict[str, int]:
        """Get count of candidates per stage."""
        storage = get_storage_service()
        return storage.get_pipeline_stats(job_id)

    def get_valid_transitions(self, current_stage: PipelineStage) -> List[PipelineStage]:
        """Get valid transition targets for a stage."""
        if current_stage == PipelineStage.REJECTED:
            return [
                PipelineStage.APPLIED,
                PipelineStage.SCREENED,
                PipelineStage.INTERVIEW_INVITED,
            ]
        return VALID_TRANSITIONS.get(current_stage, [])


# Singleton instance
_pipeline_service: Optional[PipelineService] = None


def get_pipeline_service() -> PipelineService:
    global _pipeline_service
    if _pipeline_service is None:
        _pipeline_service = PipelineService()
    return _pipeline_service
