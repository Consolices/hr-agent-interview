from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class FileType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"


class PipelineStage(str, Enum):
    APPLIED = "applied"
    SCREENED = "screened"
    INTERVIEW_INVITED = "interview_invited"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_DONE = "interview_done"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"


class StageChange(BaseModel):
    from_stage: Optional[PipelineStage] = None
    to_stage: PipelineStage
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    changed_by: Optional[str] = None
    notes: Optional[str] = None


class Experience(BaseModel):
    company: str
    title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_months: Optional[int] = None
    description: Optional[str] = None


class Education(BaseModel):
    institution: str
    degree: Optional[str] = None
    field: Optional[str] = None
    graduation_year: Optional[int] = None


class Project(BaseModel):
    name: str
    description: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)
    complexity_score: Optional[int] = None  # 1-10


class ExtractedCVData(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    experience: List[Experience] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)


class ApplicationResponses(BaseModel):
    """Legacy typed model — kept for backward-compat deserialization."""
    introduction: Optional[str] = None
    passion_description: Optional[str] = None
    self_learning: Optional[str] = None

    def to_dict(self) -> Dict[str, Optional[str]]:
        return {
            "introduction": self.introduction,
            "passion_description": self.passion_description,
            "self_learning": self.self_learning,
        }


class Candidate(BaseModel):
    id: str
    drive_file_id: Optional[str] = None
    filename: str
    file_type: FileType
    raw_text: str
    extracted_data: Optional[ExtractedCVData] = None
    application_responses: Optional[Dict[str, Optional[str]]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    analyzed: bool = False
    # Legacy pipeline fields kept for backward compat during migration
    pipeline_stage: PipelineStage = PipelineStage.APPLIED
    stage_history: List[StageChange] = Field(default_factory=list)
    emails_sent: List[str] = Field(default_factory=list)  # Email IDs


class CandidateCreate(BaseModel):
    filename: str
    file_type: FileType
    raw_text: str
    drive_file_id: Optional[str] = None


class CandidateListItem(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    filename: str
    overall_score: Optional[float] = None
    analyzed: bool = False
    created_at: datetime
