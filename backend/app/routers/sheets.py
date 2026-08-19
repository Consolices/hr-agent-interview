import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict

from ..services.drive_service import get_drive_service
from ..services.storage_service import get_storage_service
from ..services.sync_helpers import sync_from_sheet as sync_from_sheet_helper
from ..services.agent_service import _call_llm_async, _parse_json_response

logger = logging.getLogger("sheets")

router = APIRouter(prefix="/api/sheets", tags=["sheets"])


class SpreadsheetItem(BaseModel):
    id: str
    name: str
    modified_time: Optional[str] = None


class SheetHeaders(BaseModel):
    headers: List[str]
    total_rows: int = 0


class ColumnMapping(BaseModel):
    name_column: Optional[int] = None
    email_column: Optional[int] = None
    cv_link_column: int
    # Dynamic question columns: question key → column index
    question_columns: Dict[str, int] = {}
    # Legacy fields for backward compat
    introduction_column: Optional[int] = None
    passion_column: Optional[int] = None
    self_learning_column: Optional[int] = None


class SyncRequest(BaseModel):
    mapping: ColumnMapping


class SheetSyncResult(BaseModel):
    total_rows: int
    processed: int
    skipped: int
    errors: List[str]


@router.get("/list", response_model=List[SpreadsheetItem])
async def list_spreadsheets():
    """List all spreadsheets the user can access."""
    logger.info("[SHEETS] Listing spreadsheets...")
    drive = get_drive_service()
    if not drive.is_connected():
        logger.warning("[SHEETS] Not connected to Google Drive")
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    try:
        sheets = drive.list_spreadsheets()
        logger.info(f"[SHEETS] Found {len(sheets)} spreadsheets")
        return [
            SpreadsheetItem(
                id=s["id"],
                name=s["name"],
                modified_time=s.get("modified_time"),
            )
            for s in sheets
        ]
    except Exception as e:
        logger.error(f"[SHEETS] Failed to list spreadsheets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{spreadsheet_id}/headers", response_model=SheetHeaders)
async def get_headers(spreadsheet_id: str):
    """Return column headers (row 1) of the selected sheet."""
    logger.info(f"[SHEETS] Getting headers for sheet {spreadsheet_id}")
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    try:
        headers = drive.get_sheet_headers(spreadsheet_id)
        total_rows = drive.get_sheet_row_count(spreadsheet_id)
        logger.info(f"[SHEETS] Found {len(headers)} headers, {total_rows} data rows")
        return SheetHeaders(headers=headers, total_rows=total_rows)
    except Exception as e:
        logger.error(f"[SHEETS] Failed to get headers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{spreadsheet_id}/sync", response_model=SheetSyncResult)
async def sync_from_sheet(spreadsheet_id: str, body: SyncRequest):
    """Sync candidates from a Google Sheets response sheet."""
    drive = get_drive_service()
    if not drive.is_connected():
        raise HTTPException(status_code=401, detail="Not connected to Google Drive")

    mapping = body.mapping
    mapping_dict: dict = {
        "name_column": mapping.name_column,
        "email_column": mapping.email_column,
        "cv_link_column": mapping.cv_link_column,
    }
    if mapping.question_columns:
        mapping_dict["question_columns"] = mapping.question_columns
    else:
        # Backward compat: use legacy fields
        if mapping.introduction_column is not None:
            mapping_dict["introduction_column"] = mapping.introduction_column
        if mapping.passion_column is not None:
            mapping_dict["passion_column"] = mapping.passion_column
        if mapping.self_learning_column is not None:
            mapping_dict["self_learning_column"] = mapping.self_learning_column

    try:
        helper_result = await sync_from_sheet_helper(spreadsheet_id, mapping_dict)
        return SheetSyncResult(
            total_rows=helper_result.total_rows,
            processed=helper_result.processed,
            skipped=helper_result.skipped,
            errors=helper_result.errors,
        )
    except Exception as e:
        logger.error(f"[SYNC] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── AI Header Analysis ───────────────────────────────────────────────────────

class HeaderAnalysisRequest(BaseModel):
    headers: List[str]
    job_title: Optional[str] = None
    job_description: Optional[str] = None


class SuggestedQuestion(BaseModel):
    key: str
    label: str
    description: str
    header_index: int


class HeaderAnalysisResult(BaseModel):
    name_column: Optional[int] = None
    email_column: Optional[int] = None
    cv_link_column: Optional[int] = None
    questions: List[SuggestedQuestion] = []


HEADER_ANALYSIS_SYSTEM = """You are an HR tool assistant. You analyze column headers from a Google Sheets job application form and suggest:
1. Which column contains the applicant's name (if any)
2. Which column contains the applicant's email (if any)
3. Which column contains a link to their CV/resume on Google Drive (if any)
4. For remaining columns that look like application/screening questions, suggest a short key, label, and AI scoring criteria.

Skip columns like "Timestamp" or other metadata that aren't relevant.

Return ONLY valid JSON with this exact structure:
{
  "name_column": <0-based index or null>,
  "email_column": <0-based index or null>,
  "cv_link_column": <0-based index or null>,
  "questions": [
    {
      "key": "snake_case_key",
      "label": "Short Human Label",
      "description": "Scoring criteria: what to evaluate in the response",
      "header_index": <0-based column index>
    }
  ]
}"""


@router.post("/analyze-headers", response_model=HeaderAnalysisResult)
async def analyze_headers(body: HeaderAnalysisRequest):
    """Use AI to analyze sheet headers and suggest column mappings + question definitions."""
    if not body.headers:
        raise HTTPException(status_code=400, detail="No headers provided")

    logger.info(f"[SHEETS] Analyzing {len(body.headers)} headers with AI")

    # Build the user prompt
    header_list = "\n".join(
        f"  {i}: {h}" for i, h in enumerate(body.headers)
    )
    user_prompt = f"Column headers (0-indexed):\n{header_list}"

    if body.job_title:
        user_prompt += f"\n\nJob title: {body.job_title}"
    if body.job_description:
        desc = body.job_description[:500]
        user_prompt += f"\n\nJob description (excerpt): {desc}"

    try:
        raw = await _call_llm_async(HEADER_ANALYSIS_SYSTEM, user_prompt, temperature=0.1)
        parsed = _parse_json_response(raw)

        questions = []
        for q in parsed.get("questions", []):
            questions.append(SuggestedQuestion(
                key=q["key"],
                label=q["label"],
                description=q["description"],
                header_index=q["header_index"],
            ))

        result = HeaderAnalysisResult(
            name_column=parsed.get("name_column"),
            email_column=parsed.get("email_column"),
            cv_link_column=parsed.get("cv_link_column"),
            questions=questions,
        )
        logger.info(f"[SHEETS] AI suggestion: name={result.name_column}, email={result.email_column}, "
                     f"cv={result.cv_link_column}, {len(questions)} questions")
        return result
    except Exception as e:
        logger.error(f"[SHEETS] AI analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
