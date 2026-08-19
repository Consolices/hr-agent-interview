from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

from .candidate import PipelineStage, StageChange


class Application(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    pipeline_stage: PipelineStage = PipelineStage.APPLIED
    stage_history: List[StageChange] = Field(default_factory=list)
    emails_sent: List[str] = Field(default_factory=list)  # Email IDs
    analyzed: bool = False
    application_responses: Optional[Dict[str, Optional[str]]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
