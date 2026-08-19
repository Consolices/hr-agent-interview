"""Shared sync logic for Drive folder and Sheet imports.

Used by both global sync endpoints (drive.py, sheets.py) and per-job sync endpoints (jobs.py).
Returns candidate IDs so callers can create Application records as needed.
"""

import logging
import uuid
from typing import List, Optional, Tuple

from ..services.drive_service import get_drive_service
from ..services.file_parser import parse_cv, UnsupportedFileTypeError
from ..services.storage_service import get_storage_service
from ..services.agent_service import extract_cv_data_standalone
from ..models.candidate import Candidate, FileType, ExtractedCVData

logger = logging.getLogger("sync_helpers")


class SyncPreviewResult:
    def __init__(self, total_files: int, new_files: int, already_synced: int,
                 file_names: List[str], existing_candidate_ids: List[str]):
        self.total_files = total_files
        self.new_files = new_files
        self.already_synced = already_synced
        self.file_names = file_names
        self.existing_candidate_ids = existing_candidate_ids


class DriveSyncResult:
    def __init__(self):
        self.total_files: int = 0
        self.processed: int = 0
        self.skipped: int = 0
        self.errors: List[str] = []
        self.new_candidate_ids: List[str] = []
        self.existing_candidate_ids: List[str] = []


class SheetSyncResult:
    def __init__(self):
        self.total_rows: int = 0
        self.processed: int = 0
        self.skipped: int = 0
        self.errors: List[str] = []
        self.new_candidate_ids: List[str] = []
        self.existing_candidate_ids: List[str] = []


def _safe_get(row: List[str], index: int) -> str:
    """Safely get a value from a row by index, returning empty string if out of bounds."""
    if 0 <= index < len(row):
        return row[index].strip()
    return ""


def preview_drive_folder(folder_id: Optional[str] = None) -> SyncPreviewResult:
    """Count files in a Drive folder before syncing."""
    drive = get_drive_service()
    storage = get_storage_service()

    files = drive.list_files(folder_id)
    already_synced = 0
    new_file_names = []
    existing_candidate_ids = []

    for file_info in files:
        existing = storage.get_candidate_by_drive_id(file_info["id"])
        if existing:
            already_synced += 1
            existing_candidate_ids.append(existing.id)
        else:
            new_file_names.append(file_info["name"])

    return SyncPreviewResult(
        total_files=len(files),
        new_files=len(new_file_names),
        already_synced=already_synced,
        file_names=new_file_names,
        existing_candidate_ids=existing_candidate_ids,
    )


def sync_drive_folder(folder_id: Optional[str] = None) -> DriveSyncResult:
    """Fetch and process all CV files from a Google Drive folder.

    Returns result with candidate IDs for both new and already-existing candidates.
    """
    drive = get_drive_service()
    storage = get_storage_service()

    files = drive.list_files(folder_id)
    result = DriveSyncResult()
    result.total_files = len(files)

    for file_info in files:
        file_id = file_info["id"]
        filename = file_info["name"]
        mime_type = file_info["mimeType"]

        # Check if already processed
        existing = storage.get_candidate_by_drive_id(file_id)
        if existing:
            result.skipped += 1
            result.existing_candidate_ids.append(existing.id)
            continue

        try:
            # Download file
            file_bytes = drive.download_file(file_id, mime_type=mime_type)

            # Parse CV
            text, file_type = parse_cv(file_bytes, filename, mime_type)

            # Create candidate
            candidate = Candidate(
                id=str(uuid.uuid4()),
                drive_file_id=file_id,
                filename=filename,
                file_type=FileType(file_type),
                raw_text=text,
            )

            storage.save_candidate(candidate)
            result.processed += 1
            result.new_candidate_ids.append(candidate.id)

        except UnsupportedFileTypeError:
            result.errors.append(f"Unsupported file: {filename} ({mime_type})")
            result.skipped += 1
        except Exception as e:
            result.errors.append(f"Error processing {filename}: {str(e)}")

    return result


async def sync_from_sheet(
    spreadsheet_id: str,
    mapping_dict: dict,
) -> SheetSyncResult:
    """Sync candidates from a Google Sheet.

    mapping_dict should have keys: name_column, email_column, cv_link_column,
    introduction_column, passion_column, self_learning_column (all ints).
    email_column may be None if the sheet has no email column — in that case,
    name and email are extracted from the CV via LLM.

    Returns result with candidate IDs for both new and already-existing candidates.
    """
    drive = get_drive_service()
    storage = get_storage_service()

    logger.info(f"[SYNC] Starting sync for sheet {spreadsheet_id}")
    logger.info(f"[SYNC] Column mapping: {mapping_dict}")

    rows = drive.read_sheet_rows(spreadsheet_id)
    logger.info(f"[SYNC] Read {len(rows)} data rows from sheet")

    result = SheetSyncResult()
    result.total_rows = len(rows)

    name_col = mapping_dict.get("name_column")  # Optional — may be None
    email_col = mapping_dict.get("email_column")  # Optional — may be None
    cv_link_col = mapping_dict["cv_link_column"]

    # Dynamic question columns — new format stores them in question_columns dict
    question_columns: dict = mapping_dict.get("question_columns", {})
    if not question_columns:
        # Backward compat: build from legacy keys
        if "introduction_column" in mapping_dict:
            question_columns["introduction"] = mapping_dict["introduction_column"]
        if "passion_column" in mapping_dict:
            question_columns["passion_description"] = mapping_dict["passion_column"]
        if "self_learning_column" in mapping_dict:
            question_columns["self_learning"] = mapping_dict["self_learning_column"]

    for row_idx, row in enumerate(rows, start=2):
        try:
            cv_link = _safe_get(row, cv_link_col)
            if not cv_link:
                logger.debug(f"[SYNC] Row {row_idx}: No CV link, skipping")
                result.skipped += 1
                continue

            file_id = drive.extract_drive_file_id(cv_link)
            if not file_id:
                logger.warning(f"[SYNC] Row {row_idx}: Could not parse Drive link: {cv_link[:80]}")
                result.errors.append(f"Row {row_idx}: Could not parse Drive link")
                result.skipped += 1
                continue

            # Check if already synced
            existing = storage.get_candidate_by_drive_id(file_id)
            if existing:
                logger.debug(f"[SYNC] Row {row_idx}: Already synced (file_id={file_id[:20]}...)")
                result.skipped += 1
                result.existing_candidate_ids.append(existing.id)
                continue

            # Get file metadata
            try:
                metadata = drive.get_file_metadata(file_id)
            except Exception as meta_err:
                logger.warning(f"[SYNC] Row {row_idx}: Could not access file {file_id}: {meta_err}")
                result.errors.append(f"Row {row_idx}: Could not access file (check sharing permissions)")
                result.skipped += 1
                continue

            filename = metadata.get("name", "unknown")
            mime_type = metadata.get("mimeType", "")
            logger.info(f"[SYNC] Row {row_idx}: Downloading '{filename}' (mime={mime_type})")

            file_bytes = drive.download_file(file_id, mime_type=mime_type)
            logger.info(f"[SYNC] Row {row_idx}: Downloaded {len(file_bytes)} bytes")

            # If exported from Google Docs, treat as PDF
            parse_mime = mime_type
            parse_filename = filename
            if mime_type.startswith("application/vnd.google-apps."):
                parse_mime = "application/pdf"
                parse_filename = filename + ".pdf"
                logger.info(f"[SYNC] Row {row_idx}: Google Workspace file, exported as PDF")

            text, file_type = parse_cv(file_bytes, parse_filename, parse_mime)
            logger.info(f"[SYNC] Row {row_idx}: Parsed {file_type}, extracted {len(text)} chars")

            # Build application responses dynamically from question_columns
            name = _safe_get(row, name_col) if name_col is not None else ""
            email = _safe_get(row, email_col) if email_col is not None else ""

            responses: dict = {}
            for q_key, q_col in question_columns.items():
                val = _safe_get(row, q_col)
                responses[q_key] = val or None

            candidate = Candidate(
                id=str(uuid.uuid4()),
                drive_file_id=file_id,
                filename=filename,
                file_type=FileType(file_type),
                raw_text=text,
                application_responses=responses if any(responses.values()) else None,
            )

            # If name or email is missing from sheet, extract from CV via LLM
            if not name or not email:
                logger.info(f"[SYNC] Row {row_idx}: Missing name/email from sheet, extracting from CV")
                try:
                    cv_data = await extract_cv_data_standalone(text)
                    # Sheet values win — only fill in what's missing
                    if not name:
                        name = cv_data.name or ""
                    if not email:
                        email = cv_data.email or ""
                    # Store the full extracted data on the candidate
                    candidate.extracted_data = cv_data
                    # Override name/email with merged values
                    candidate.extracted_data.name = name or None
                    candidate.extracted_data.email = email or None
                    logger.info(f"[SYNC] Row {row_idx}: Extracted name={name}, email={email}")
                except Exception as extract_err:
                    logger.warning(f"[SYNC] Row {row_idx}: CV extraction failed: {extract_err}")
                    # Still save the candidate even if extraction fails
                    if name or email:
                        candidate.extracted_data = ExtractedCVData(
                            name=name or None,
                            email=email or None,
                        )
            else:
                candidate.extracted_data = ExtractedCVData(
                    name=name or None,
                    email=email or None,
                )

            storage.save_candidate(candidate)
            result.processed += 1
            result.new_candidate_ids.append(candidate.id)
            logger.info(f"[SYNC] Row {row_idx}: Saved candidate {candidate.id}")

        except UnsupportedFileTypeError:
            fname = locals().get("filename", "unknown")
            fmime = locals().get("mime_type", "")
            logger.warning(f"[SYNC] Row {row_idx}: Unsupported file type - {fname} ({fmime})")
            result.errors.append(f"Row {row_idx}: Unsupported file type - {fname} ({fmime})")
            result.skipped += 1
        except Exception as e:
            logger.error(f"[SYNC] Row {row_idx}: Error - {type(e).__name__}: {e}")
            result.errors.append(f"Row {row_idx}: {str(e)}")
            result.skipped += 1

    logger.info(f"[SYNC] Complete: total={result.total_rows}, processed={result.processed}, "
                f"skipped={result.skipped}, errors={len(result.errors)}")
    return result
