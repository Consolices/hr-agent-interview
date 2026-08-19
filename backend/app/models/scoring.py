from pydantic import BaseModel, Field, model_validator
from typing import Dict, List


DEFAULT_SCORING_RESPONSE_QUESTIONS: List[Dict[str, str]] = [
    {
        "key": "introduction",
        "label": "Introduction & Motivation",
        "description": "Clarity, relevance to role, genuine motivation",
    },
    {
        "key": "passion_description",
        "label": "Passion / Expertise",
        "description": "Depth of interest, specific examples, enthusiasm",
    },
    {
        "key": "self_learning",
        "label": "Self-Learning Initiatives",
        "description": "Concrete examples, initiative, growth mindset",
    },
]


def _default_questions() -> List[Dict[str, str]]:
    return [dict(q) for q in DEFAULT_SCORING_RESPONSE_QUESTIONS]


class ScoringConfig(BaseModel):
    # Weights (must sum to 100)
    job_match_weight: int = 40
    screening_weight: int = 40
    response_weight: int = 20

    # Screening criteria
    career_gap_threshold_months: int = 6
    career_gap_deduction: int = 8
    min_tenure_months: int = 12
    tenure_deduction: int = 8
    spelling_deduction: int = 3

    # Recommendation thresholds
    strong_yes_threshold: int = 80
    yes_threshold: int = 65
    maybe_threshold: int = 50

    # Default response questions (fallback when job has none)
    default_response_questions: List[Dict[str, str]] = Field(
        default_factory=_default_questions
    )

    @model_validator(mode="after")
    def check_weights_sum(self) -> "ScoringConfig":
        total = self.job_match_weight + self.screening_weight + self.response_weight
        if total != 100:
            raise ValueError(f"Weights must sum to 100, got {total}")
        return self
