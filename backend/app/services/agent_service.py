import asyncio
import json
import logging
import re
import time
import uuid
from datetime import datetime
from typing import Callable, List, Optional

from openai import AsyncOpenAI

logger = logging.getLogger("analysis")

from ..config import get_settings
from ..models.candidate import Candidate, ExtractedCVData
from ..models.analysis import (
    AnalysisResult,
    CandidateScore,
    JobMatchScore,
    ScreeningScore,
    ResponseScore,
    CareerGap,
)
from ..models.job import Job
from ..models.scoring import ScoringConfig
from ..prompts.screening import (
    CV_EXTRACTION_PROMPT,
    build_system_prompt,
    build_screening_prompt,
)
from .storage_service import get_storage_service

MODEL = "gpt-4o-mini"
CONCURRENCY = 10

# Singleton async client
_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    return _client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _call_llm_async(system: str, user: str, temperature: float = 0.1) -> str:
    t0 = time.perf_counter()
    logger.info(f"[LLM] Calling {MODEL} (system: {len(system)} chars, user: {len(user)} chars)")
    try:
        response = await _get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=temperature,
            max_tokens=4000,
        )
        content = response.choices[0].message.content
        elapsed = time.perf_counter() - t0
        logger.info(f"[LLM] Response received ({len(content)} chars) in {elapsed:.1f}s")
        return content
    except Exception as e:
        elapsed = time.perf_counter() - t0
        logger.error(f"[LLM] ERROR after {elapsed:.1f}s: {type(e).__name__}: {e}")
        raise


def _parse_json_response(response: str) -> dict:
    """Parse JSON from LLM response, handling markdown code blocks."""
    response = response.strip()
    if response.startswith("```json"):
        response = response[7:]
    elif response.startswith("```"):
        response = response[3:]
    if response.endswith("```"):
        response = response[:-3]
    response = response.strip()

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", response)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError as e:
                logger.error(f"[JSON] Failed to parse extracted JSON: {e}")
                logger.error(f"[JSON] Raw response (first 500 chars): {response[:500]}")
                raise ValueError(f"Could not parse JSON from response: {response[:200]}")
        logger.error(f"[JSON] No JSON object found in response")
        logger.error(f"[JSON] Raw response (first 500 chars): {response[:500]}")
        raise ValueError(f"Could not parse JSON from response: {response[:200]}")


def _clean_cv_text(raw_text: str) -> str:
    """Collapse whitespace and truncate to 8000 chars."""
    cleaned = re.sub(r"\n{3,}", "\n\n", raw_text or "")
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    return cleaned.strip()[:8000]


# ---------------------------------------------------------------------------
# Model assembly helpers
# ---------------------------------------------------------------------------

def _build_extracted_data(data: dict) -> ExtractedCVData:
    """Build ExtractedCVData from the extracted_data section of the response."""
    return ExtractedCVData(
        name=data.get("name"),
        email=data.get("email"),
        phone=data.get("phone"),
        location=data.get("location"),
        summary=data.get("summary"),
        skills=data.get("skills", []),
        experience=[
            {
                "company": exp.get("company", "Unknown"),
                "title": exp.get("title", "Unknown"),
                "start_date": exp.get("start_date"),
                "end_date": exp.get("end_date"),
                "duration_months": exp.get("duration_months"),
                "description": exp.get("description"),
            }
            for exp in data.get("experience", [])
        ],
        education=[
            {
                "institution": edu.get("institution", "Unknown"),
                "degree": edu.get("degree"),
                "field": edu.get("field"),
                "graduation_year": edu.get("graduation_year"),
            }
            for edu in data.get("education", [])
        ],
        projects=[
            {
                "name": proj.get("name", "Unknown"),
                "description": proj.get("description"),
                "technologies": proj.get("technologies", []),
            }
            for proj in data.get("projects", [])
        ],
        certifications=data.get("certifications", []),
        languages=data.get("languages", []),
    )


def _validate_career_gap_duration(gap: CareerGap) -> CareerGap:
    """Recalculate duration_months from start_date/end_date if parseable (YYYY-MM format)."""
    try:
        from datetime import datetime
        start = datetime.strptime(gap.start_date, "%Y-%m")
        end = datetime.strptime(gap.end_date, "%Y-%m")
        calculated = (end.year - start.year) * 12 + (end.month - start.month)
        if calculated > 0:
            if abs(calculated - gap.duration_months) > 1:
                logger.warning(
                    f"[GAP] LLM duration_months={gap.duration_months} differs from "
                    f"calculated={calculated} for gap {gap.start_date}–{gap.end_date}"
                )
            gap.duration_months = calculated
    except (ValueError, TypeError):
        pass  # Dates not parseable, keep LLM value
    return gap


def _build_candidate_score(data: dict, config: Optional[ScoringConfig] = None) -> CandidateScore:
    """Build CandidateScore from the full parsed LLM response."""
    cfg = config or ScoringConfig()

    jm = data.get("job_match_score", {})
    job_match = JobMatchScore(
        score=jm.get("score", 50),
        years_experience=jm.get("years_experience", 0),
        skills_matched=jm.get("skills_matched", []),
        skills_missing=jm.get("skills_missing", []),
        notes=jm.get("notes"),
    )

    ss = data.get("screening_score", {})
    career_gaps = [
        _validate_career_gap_duration(
            CareerGap(
                start_date=gap.get("start_date", ""),
                end_date=gap.get("end_date", ""),
                duration_months=gap.get("duration_months", 0),
                description=gap.get("description"),
            )
        )
        for gap in ss.get("career_gaps", [])
    ]

    # Override has_significant_gaps based on config threshold instead of trusting LLM
    has_significant = any(
        g.duration_months > cfg.career_gap_threshold_months for g in career_gaps
    )

    screening = ScreeningScore(
        score=ss.get("score", 50),
        career_gaps=career_gaps,
        has_significant_gaps=has_significant,
        avg_tenure_months=ss.get("avg_tenure_months", 0),
        spelling_errors=ss.get("spelling_errors", 0),
        grammar_issues=ss.get("grammar_issues", 0),
        project_complexity=ss.get("project_complexity", 5),
        university_tier=ss.get("university_tier"),
        notes=ss.get("notes"),
    )

    rs = data.get("response_score", {})
    # Build dimension_scores from dynamic LLM output
    dimension_scores = rs.get("dimension_scores", {})
    # Ensure values are ints
    dimension_scores = {k: int(v) for k, v in dimension_scores.items() if v is not None}
    response = ResponseScore(
        score=rs.get("score", 50),
        dimension_scores=dimension_scores,
        # Also populate legacy fields if present (for backward compat reading)
        introduction_quality=rs.get("introduction_quality"),
        passion_depth=rs.get("passion_depth"),
        self_learning_quality=rs.get("self_learning_quality"),
        notes=rs.get("notes"),
    )

    jm_w = cfg.job_match_weight / 100
    sc_w = cfg.screening_weight / 100
    rs_w = cfg.response_weight / 100

    overall = round(
        job_match.score * jm_w
        + screening.score * sc_w
        + response.score * rs_w,
        1,
    )

    # Derive recommendation from config thresholds
    if overall >= cfg.strong_yes_threshold:
        recommendation = "Strong Yes"
    elif overall >= cfg.yes_threshold:
        recommendation = "Yes"
    elif overall >= cfg.maybe_threshold:
        recommendation = "Maybe"
    else:
        recommendation = "No"

    return CandidateScore(
        overall_score=overall,
        job_match_score=job_match,
        screening_score=screening,
        response_score=response,
        red_flags=data.get("red_flags", []),
        green_flags=data.get("green_flags", []),
        summary=data.get("summary", ""),
        recommendation=recommendation,
    )


# ---------------------------------------------------------------------------
# Main entry: single-call analysis
# ---------------------------------------------------------------------------

async def analyze_candidate(
    candidate: Candidate,
    job: Optional[Job] = None,
    job_id: str = "",
    application_id: str = "",
) -> AnalysisResult:
    """Analyze a candidate with a single LLM call.

    Args:
        candidate: The candidate to analyze.
        job: Optional Job object — uses job.description for the system prompt.
        job_id: Job ID to attach to the AnalysisResult.
        application_id: Application ID to attach to the AnalysisResult.

    Returns AnalysisResult with full CandidateScore.
    Also sets candidate.extracted_data as a side effect.
    """
    logger.info("=" * 60)
    logger.info(f"[ANALYSIS] Starting: {candidate.filename} (id={candidate.id})")
    logger.info("=" * 60)

    try:
        # Load scoring config from storage
        scoring_config = get_storage_service().get_scoring_config()

        cleaned_text = _clean_cv_text(candidate.raw_text)
        logger.info(f"[ANALYSIS] CV text: {len(cleaned_text)} chars (raw={len(candidate.raw_text or '')} chars)")
        logger.info(f"[ANALYSIS] CV preview (first 200 chars): {cleaned_text[:200]}")

        # Get response questions from job (or defaults)
        response_questions = job.response_questions if job else None

        responses_dict = None
        if candidate.application_responses:
            responses_dict = candidate.application_responses
            logger.info(f"[ANALYSIS] Application responses present: {list(responses_dict.keys())}")
        else:
            logger.warning(f"[ANALYSIS] No application_responses for this candidate — response_score will default to 50")

        user_prompt = build_screening_prompt(cleaned_text, responses_dict, response_questions)
        logger.info(f"[ANALYSIS] User prompt: {len(user_prompt)} chars")

        # Build system prompt: use job description from Job entity if provided
        job_description = job.description if job else None
        system_prompt = build_system_prompt(
            job_description=job_description,
            response_questions=response_questions,
            scoring_config=scoring_config,
        )
        logger.info(f"[ANALYSIS] System prompt: {len(system_prompt)} chars")
        logger.info(f"[ANALYSIS] Scoring weights: JM={scoring_config.job_match_weight}% SC={scoring_config.screening_weight}% RS={scoring_config.response_weight}%")
        if "No job description provided" in system_prompt:
            logger.warning(f"[ANALYSIS] Job description NOT loaded — using generic defaults")
        else:
            jd_start = system_prompt.find("## Job Description")
            jd_end = system_prompt.find("## Scoring Rubric")
            if jd_start >= 0 and jd_end >= 0:
                jd_section = system_prompt[jd_start:jd_end].strip()
                logger.info(f"[ANALYSIS] Job description loaded ({len(jd_section)} chars)")
                logger.info(f"[ANALYSIS] JD preview (first 200 chars): {jd_section[:200]}")

        raw_response = await _call_llm_async(system_prompt, user_prompt)
        data = _parse_json_response(raw_response)

        # Build extracted data and attach to candidate
        extracted_section = data.get("extracted_data", {})
        candidate.extracted_data = _build_extracted_data(extracted_section)

        # Build full score with config-driven weights/thresholds
        candidate_score = _build_candidate_score(data, config=scoring_config)

        logger.info(f"[ANALYSIS] Results for {candidate.filename}:")
        logger.info(f"  - Overall score: {candidate_score.overall_score}")
        logger.info(f"  - Job match:     {candidate_score.job_match_score.score}")
        logger.info(f"  - Screening:     {candidate_score.screening_score.score}")
        logger.info(f"  - Response:      {candidate_score.response_score.score}")
        logger.info(f"  - Recommendation: {candidate_score.recommendation}")
        logger.info(f"  - Red flags:  {candidate_score.red_flags}")
        logger.info(f"  - Green flags: {candidate_score.green_flags}")

    except Exception as e:
        logger.error(f"[ANALYSIS] ERROR for {candidate.filename}: {type(e).__name__}: {e}")
        candidate_score = CandidateScore(
            overall_score=50.0,
            job_match_score=JobMatchScore(score=50),
            screening_score=ScreeningScore(score=50),
            response_score=ResponseScore(score=50),
            red_flags=["Analysis failed — manual review required"],
            green_flags=[],
            summary=f"Automated analysis failed: {e}",
            recommendation="Maybe",
        )

    analysis = AnalysisResult(
        id=str(uuid.uuid4()),
        candidate_id=candidate.id,
        job_id=job_id or (job.id if job else ""),
        application_id=application_id,
        score=candidate_score,
        analyzed_at=datetime.utcnow(),
        llm_model=MODEL,
    )
    logger.info(f"[ANALYSIS] Complete for {candidate.filename}: score={candidate_score.overall_score}")
    logger.info("=" * 60)
    return analysis


# ---------------------------------------------------------------------------
# Batch: concurrent analysis with semaphore
# ---------------------------------------------------------------------------

async def analyze_candidates_batch(
    candidate_ids: List[str],
    get_candidate: Callable,
    save_candidate: Callable,
    save_analysis: Callable,
    progress_callback: Callable,
    job: Optional[Job] = None,
    job_id: str = "",
    get_application: Optional[Callable] = None,
    save_application: Optional[Callable] = None,
) -> List[str]:
    """Analyze multiple candidates concurrently (up to CONCURRENCY at a time).

    Args:
        candidate_ids: List of candidate IDs to process.
        get_candidate: Function to retrieve a Candidate by ID.
        save_candidate: Function to persist updated candidate data.
        save_analysis: Function to persist AnalysisResult.
        progress_callback: Called after each candidate with (candidate_id, error_or_none).
        job: Optional Job for context-aware analysis.
        job_id: Job ID to scope analyses.
        get_application: Function(candidate_id, job_id) -> Application.
        save_application: Function(application) to persist updated Application.

    Returns:
        List of error strings (empty if all succeeded).
    """
    semaphore = asyncio.Semaphore(CONCURRENCY)
    errors: List[str] = []

    async def _process(cid: str) -> None:
        async with semaphore:
            try:
                candidate = get_candidate(cid)
                if not candidate:
                    err = f"{cid}: Candidate not found"
                    errors.append(err)
                    progress_callback(cid, err)
                    return

                # Resolve application for this job
                application_id = ""
                app = None
                if job_id and get_application:
                    app = get_application(cid, job_id)
                    if app:
                        application_id = app.id
                        # Copy application_responses from app to candidate for analysis
                        if app.application_responses and not candidate.application_responses:
                            candidate.application_responses = app.application_responses

                result = await analyze_candidate(
                    candidate,
                    job=job,
                    job_id=job_id,
                    application_id=application_id,
                )

                if candidate.extracted_data:
                    save_candidate(candidate)

                save_analysis(result)

                # Mark application as analyzed
                if app and save_application:
                    app.analyzed = True
                    save_application(app)

                progress_callback(cid, None)

            except Exception as e:
                err = f"{cid}: {e}"
                errors.append(err)
                progress_callback(cid, err)

    await asyncio.gather(*[_process(cid) for cid in candidate_ids])
    return errors


# ---------------------------------------------------------------------------
# Standalone CV extraction (used by /candidates/{id}/extract)
# ---------------------------------------------------------------------------

async def extract_cv_data_standalone(raw_text: str) -> ExtractedCVData:
    """Extract structured CV data without running the full screening pipeline."""
    logger.info(f"[EXTRACT] Standalone CV extraction ({len(raw_text)} chars)")
    system = "You are an expert CV/resume parser. Return valid JSON only."
    prompt = CV_EXTRACTION_PROMPT.format(cv_text=raw_text[:8000])
    response = await _call_llm_async(system, prompt)
    data = _parse_json_response(response)
    extracted = _build_extracted_data(data)
    logger.info(f"[EXTRACT] Done: name={extracted.name}, skills={len(extracted.skills)}")
    return extracted
