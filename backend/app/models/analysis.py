from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime


class CareerGap(BaseModel):
    start_date: str
    end_date: str
    duration_months: int
    description: Optional[str] = None


class JobMatchScore(BaseModel):
    score: float  # 0-100
    years_experience: float = 0.0
    skills_matched: List[str] = Field(default_factory=list)
    skills_missing: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class ScreeningScore(BaseModel):
    score: float  # 0-100
    career_gaps: List[CareerGap] = Field(default_factory=list)
    has_significant_gaps: bool = False  # > 6 months
    avg_tenure_months: float = 0.0
    spelling_errors: int = 0
    grammar_issues: int = 0
    project_complexity: int = 5  # 1-10
    university_tier: Optional[str] = None  # "Top", "Mid", "Unknown"
    notes: Optional[str] = None


class ResponseScore(BaseModel):
    score: float  # 0-100
    # Dynamic dimension scores: question key → 1-10 score
    dimension_scores: Dict[str, int] = Field(default_factory=dict)
    # Legacy fields kept for reading old data
    introduction_quality: Optional[int] = None
    passion_depth: Optional[int] = None
    self_learning_quality: Optional[int] = None
    notes: Optional[str] = None

    def get_all_dimensions(self) -> Dict[str, int]:
        """Return dimension_scores, falling back to legacy fields for old data."""
        if self.dimension_scores:
            return self.dimension_scores
        # Fallback to legacy fields
        result: Dict[str, int] = {}
        if self.introduction_quality is not None:
            result["introduction"] = self.introduction_quality
        if self.passion_depth is not None:
            result["passion_description"] = self.passion_depth
        if self.self_learning_quality is not None:
            result["self_learning"] = self.self_learning_quality
        return result


class CandidateScore(BaseModel):
    overall_score: float  # 0-100
    job_match_score: JobMatchScore
    screening_score: ScreeningScore
    response_score: ResponseScore

    # Flags for quick filtering
    red_flags: List[str] = Field(default_factory=list)
    green_flags: List[str] = Field(default_factory=list)

    # Summary
    summary: Optional[str] = None
    recommendation: Optional[str] = None  # "Strong Yes", "Yes", "Maybe", "No"


class AnalysisResult(BaseModel):
    id: str
    candidate_id: str
    job_id: str = ""
    application_id: str = ""
    score: CandidateScore
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    llm_model: str = "gpt-4"


class AnalysisRequest(BaseModel):
    candidate_id: str
    job_id: str = ""
    job_description: Optional[str] = None


class BatchAnalysisRequest(BaseModel):
    candidate_ids: Optional[List[str]] = None  # None means all
    job_id: str = ""
    job_description: Optional[str] = None


class BatchAnalysisProgress(BaseModel):
    total: int
    completed: int
    in_progress: bool
    current_candidate: Optional[str] = None
    errors: List[str] = Field(default_factory=list)
