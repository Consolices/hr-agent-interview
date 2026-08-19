import os
from typing import Dict, List, Optional


CV_EXTRACTION_PROMPT = """You are an expert CV/resume parser. Extract structured information from the following CV text.

CV TEXT:
{cv_text}

Extract the following information and return as JSON:
{{
    "name": "Full name of the candidate",
    "email": "Email address if found",
    "phone": "Phone number if found",
    "location": "City/Country if mentioned",
    "summary": "Brief professional summary or objective if present",
    "skills": ["List", "of", "technical", "and", "soft", "skills"],
    "experience": [
        {{
            "company": "Company name",
            "title": "Job title",
            "start_date": "Start date (YYYY-MM format if available)",
            "end_date": "End date or 'Present'",
            "duration_months": approximate months worked,
            "description": "Key responsibilities and achievements"
        }}
    ],
    "education": [
        {{
            "institution": "University/School name",
            "degree": "Degree type (BS, MS, PhD, etc.)",
            "field": "Field of study",
            "graduation_year": year as integer
        }}
    ],
    "projects": [
        {{
            "name": "Project name",
            "description": "Brief description",
            "technologies": ["tech", "stack", "used"]
        }}
    ],
    "certifications": ["List of certifications"],
    "languages": ["Languages spoken"]
}}

Important:
- Extract only information explicitly stated in the CV
- Use null for missing fields
- Estimate duration_months from dates when possible
- List skills comprehensively, including technologies mentioned in experience
- Return valid JSON only, no additional text"""


# Path to the job description file in the project root
_JD_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "job-description.txt")
)


def _read_job_description() -> str:
    """Read job description from the text file. Returns empty string if missing."""
    if os.path.exists(_JD_PATH):
        with open(_JD_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""


def _build_response_rubric(response_questions: Optional[List[Dict[str, str]]] = None) -> str:
    """Build the Response Score rubric section dynamically from question list."""
    from ..models.job import DEFAULT_RESPONSE_QUESTIONS
    questions = response_questions or DEFAULT_RESPONSE_QUESTIONS

    dimension_keys = ", ".join(q["key"] for q in questions)
    dimension_descriptions = "\n".join(
        f'- **{q["label"]}**: {q["description"]}' for q in questions
    )

    return f"""### Response Score (0-100)
- Rate each dimension 1-10: {dimension_keys}
- Overall score = weighted average scaled to 0-100
- If responses not provided, default all to 5 (neutral, score=50)
{dimension_descriptions}"""


def build_system_prompt(
    job_description: Optional[str] = None,
    response_questions: Optional[List[Dict[str, str]]] = None,
    scoring_config: Optional["ScoringConfig"] = None,
) -> str:
    """Build the HR system prompt with the given (or on-disk) job description.

    If *job_description* is None the file is read from disk automatically.
    If *response_questions* is None the default 3 questions are used.
    If *scoring_config* is None, default values are used.
    """
    from ..models.scoring import ScoringConfig as _SC
    cfg = scoring_config or _SC()

    jd = job_description if job_description is not None else _read_job_description()

    if jd:
        job_section = f"""## Job Description
{jd}

Read the job description above carefully. Extract the key requirements (technical skills, experience level,
soft skills, responsibilities) and use them as the basis for all scoring below. Evaluate the candidate
strictly against what this job asks for."""
    else:
        job_section = """## Job Description
No job description provided. Use general full-stack developer requirements as a baseline."""

    # Use config default_response_questions as fallback if no job-level questions
    effective_questions = response_questions or cfg.default_response_questions
    response_rubric = _build_response_rubric(effective_questions)

    jm_w = cfg.job_match_weight / 100
    sc_w = cfg.screening_weight / 100
    rs_w = cfg.response_weight / 100

    return f"""You are a Senior HR Screening Specialist with 15+ years of experience in technical recruitment. You perform thorough, objective, and consistent candidate evaluations.

{job_section}

## Scoring Rubric

### Job Match Score (0-100)
- Full marks if all core requirements from the job description are met with relevant experience
- Deduct proportionally for each missing core requirement
- Bonus up to 10 points for nice-to-have / bonus skills mentioned in the job description
- Adjust based on years of experience relative to what the job asks for

### Screening Score (0-100)
- Start at 75 (baseline for a reasonable candidate)
- **Career gaps**: Deduct {cfg.career_gap_deduction} points per gap > {cfg.career_gap_threshold_months} months (flag as significant)
- **Average tenure**: Deduct {cfg.tenure_deduction} points if avg tenure < {cfg.min_tenure_months} months
- **Spelling/grammar**: Deduct {cfg.spelling_deduction} points per error found in CV
- **Project complexity** (1-10): Add/deduct based on complexity vs baseline of 5
- **University tier**: "Top" (+5), "Mid" (0), "Unknown" (-2)
- Career trajectory and growth pattern matter

{response_rubric}

## Overall Score Weighting
overall_score = {jm_w} * job_match_score + {sc_w} * screening_score + {rs_w} * response_score

## Red Flags (list any that apply)
- Career gaps > {cfg.career_gap_threshold_months} months without explanation
- Average job tenure < {cfg.min_tenure_months} months (job hopping)
- No relevant technical skills for the role
- Significant spelling/grammar errors in CV
- Inconsistent dates or claims
- No projects or portfolio to demonstrate skills

## Green Flags (list any that apply)
- Strong match on all core technical requirements
- Progressive career growth / increasing responsibility
- Personal projects or open-source contributions
- Relevant certifications or continued education
- Clean, well-structured CV
- Experience with bonus/nice-to-have skills from the job description

## Recommendation Thresholds
- **Strong Yes**: overall_score >= {cfg.strong_yes_threshold}
- **Yes**: overall_score {cfg.yes_threshold}-{cfg.strong_yes_threshold - 1}
- **Maybe**: overall_score {cfg.maybe_threshold}-{cfg.yes_threshold - 1}
- **No**: overall_score < {cfg.maybe_threshold}

## Output Rules
- Return ONLY valid JSON, no markdown fences, no extra text
- All scores must be numbers, not strings
- Boolean fields must be true/false, not strings
- Arrays must be actual arrays, not strings
- Be objective and consistent across all candidates"""


def build_screening_prompt(
    cv_text: str,
    responses: Optional[dict] = None,
    response_questions: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Build the user message for the single screening LLM call.

    Args:
        cv_text: Cleaned CV text (will be truncated to 8000 chars).
        responses: Dict with question keys as keys and answer strings as values.
        response_questions: Question definitions. Falls back to defaults.
    """
    from ..models.job import DEFAULT_RESPONSE_QUESTIONS
    questions = response_questions or DEFAULT_RESPONSE_QUESTIONS

    cv_text = (cv_text or "")[:8000]

    if responses:
        lines = []
        for q in questions:
            value = responses.get(q["key"]) or "Not provided"
            lines.append(f'- **{q["label"]}**: {value}')
        responses_section = "\n## Application Responses\n" + "\n".join(lines)
    else:
        responses_section = """
## Application Responses
Not provided. Use neutral defaults (5/10) for all response dimensions."""

    # Build dynamic response_score schema
    dimension_example = ", ".join(f'"{q["key"]}": 5' for q in questions)
    response_score_schema = f"""    "response_score": {{
        "score": 60,
        "dimension_scores": {{{dimension_example}}},
        "notes": "Brief evaluation notes"
    }}"""

    return f"""Analyze the following candidate CV and application responses. Return a single JSON object with the complete evaluation.

## CV Text
{cv_text}
{responses_section}

## Required JSON Output Schema
Return this exact structure:
{{
    "extracted_data": {{
        "name": "Full name or null",
        "email": "Email or null",
        "phone": "Phone or null",
        "location": "Location or null",
        "summary": "Professional summary or null",
        "skills": ["skill1", "skill2"],
        "experience": [
            {{
                "company": "Company name",
                "title": "Job title",
                "start_date": "YYYY-MM or null",
                "end_date": "YYYY-MM or Present or null",
                "duration_months": 12,
                "description": "Key responsibilities"
            }}
        ],
        "education": [
            {{
                "institution": "University name",
                "degree": "Degree type or null",
                "field": "Field of study or null",
                "graduation_year": 2023
            }}
        ],
        "projects": [
            {{
                "name": "Project name",
                "description": "Description or null",
                "technologies": ["tech1", "tech2"]
            }}
        ],
        "certifications": ["cert1"],
        "languages": ["lang1"]
    }},
    "job_match_score": {{
        "score": 75,
        "years_experience": 1.5,
        "skills_matched": ["React", "Node.js"],
        "skills_missing": ["Database design"],
        "notes": "Brief explanation"
    }},
    "screening_score": {{
        "score": 70,
        "career_gaps": [
            {{
                "start_date": "2022-01",
                "end_date": "2022-08",
                "duration_months": 7,
                "description": "Gap between jobs"
            }}
        ],
        "has_significant_gaps": false,
        "avg_tenure_months": 18,
        "spelling_errors": 0,
        "grammar_issues": 1,
        "project_complexity": 6,
        "university_tier": "Mid",
        "notes": "Brief screening notes"
    }},
{response_score_schema},
    "red_flags": ["flag1"],
    "green_flags": ["flag1"],
    "summary": "2-3 sentence professional assessment for hiring manager",
    "recommendation": "Yes"
}}

Extract only information explicitly stated in the CV. Use null for missing fields. Return valid JSON only."""
