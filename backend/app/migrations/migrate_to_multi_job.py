"""
Migration: Single-job → Multi-job support.

Creates a default Job from existing job-description.txt + recruitment_settings,
creates Application records for every existing Candidate, and backfills job_id /
application_id on analysis and email records.

Idempotent: skips if sentinel file data/.migrated_v2 already exists.
"""

import json
import logging
import os
import uuid
from datetime import datetime

logger = logging.getLogger("migration")

SENTINEL = ".migrated_v2"
DEFAULT_JOB_ID = "default-job"


def run_migration(data_path: str):
    sentinel_path = os.path.join(data_path, SENTINEL)
    if os.path.exists(sentinel_path):
        return  # Already migrated

    logger.info("[MIGRATION] Starting multi-job migration …")

    # ------------------------------------------------------------------
    # 1. Load all existing data
    # ------------------------------------------------------------------
    def _load(filename):
        path = os.path.join(data_path, filename)
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
        return {}

    candidates = _load("candidates.json")
    analyses = _load("analysis.json")
    emails = _load("emails.json")

    # Load recruitment settings
    rs_path = os.path.join(data_path, "recruitment_settings.json")
    if os.path.exists(rs_path):
        with open(rs_path, "r") as f:
            recruitment_settings = json.load(f)
    else:
        recruitment_settings = {}

    # Load job description from file
    jd_path = os.path.normpath(os.path.join(data_path, "..", "job-description.txt"))
    job_description = ""
    if os.path.exists(jd_path):
        with open(jd_path, "r", encoding="utf-8") as f:
            job_description = f.read().strip()

    # ------------------------------------------------------------------
    # 2. Create default job
    # ------------------------------------------------------------------
    now = datetime.utcnow().isoformat()
    title = recruitment_settings.get("position_title", "Software Engineer")

    default_job = {
        "id": DEFAULT_JOB_ID,
        "title": title,
        "description": job_description,
        "status": "open",
        "company_name": recruitment_settings.get("company_name", "Your Company"),
        "position_title": title,
        "trafft_booking_link": recruitment_settings.get("trafft_booking_link"),
        "sender_name": recruitment_settings.get("sender_name", "HR Team"),
        "sender_email": recruitment_settings.get("sender_email"),
        "created_at": now,
        "updated_at": now,
    }

    jobs = _load("jobs.json")
    if DEFAULT_JOB_ID not in jobs:
        jobs[DEFAULT_JOB_ID] = default_job
        logger.info(f"[MIGRATION] Created default job: '{title}'")

    # ------------------------------------------------------------------
    # 3. Create Application for each existing candidate
    # ------------------------------------------------------------------
    applications = _load("applications.json")
    candidate_to_application = {}  # candidate_id → application_id

    for cid, cdata in candidates.items():
        # Check if application already exists
        existing = None
        for a in applications.values():
            if a.get("candidate_id") == cid and a.get("job_id") == DEFAULT_JOB_ID:
                existing = a
                break

        if existing:
            candidate_to_application[cid] = existing["id"]
            continue

        app_id = str(uuid.uuid4())
        candidate_to_application[cid] = app_id

        application = {
            "id": app_id,
            "candidate_id": cid,
            "job_id": DEFAULT_JOB_ID,
            "pipeline_stage": cdata.get("pipeline_stage", "applied"),
            "stage_history": cdata.get("stage_history", []),
            "emails_sent": cdata.get("emails_sent", []),
            "analyzed": cdata.get("analyzed", False),
            "application_responses": cdata.get("application_responses"),
            "created_at": cdata.get("created_at", now),
            "updated_at": now,
        }
        applications[app_id] = application

    logger.info(f"[MIGRATION] Created {len(candidate_to_application)} application(s)")

    # ------------------------------------------------------------------
    # 4. Backfill job_id + application_id on analysis records
    # ------------------------------------------------------------------
    backfilled_analyses = 0
    for aid, adata in analyses.items():
        if not adata.get("job_id"):
            adata["job_id"] = DEFAULT_JOB_ID
            backfilled_analyses += 1
        if not adata.get("application_id"):
            cid = adata.get("candidate_id", "")
            adata["application_id"] = candidate_to_application.get(cid, "")

    logger.info(f"[MIGRATION] Backfilled {backfilled_analyses} analysis record(s)")

    # ------------------------------------------------------------------
    # 5. Backfill job_id + application_id on email records
    # ------------------------------------------------------------------
    backfilled_emails = 0
    for eid, edata in emails.items():
        if not edata.get("job_id"):
            edata["job_id"] = DEFAULT_JOB_ID
            backfilled_emails += 1
        if not edata.get("application_id"):
            cid = edata.get("candidate_id", "")
            edata["application_id"] = candidate_to_application.get(cid, "")

    logger.info(f"[MIGRATION] Backfilled {backfilled_emails} email record(s)")

    # ------------------------------------------------------------------
    # 6. Write all files atomically (load → transform → write)
    # ------------------------------------------------------------------
    def _save(filename, data):
        path = os.path.join(data_path, filename)
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    _save("jobs.json", jobs)
    _save("applications.json", applications)
    _save("analysis.json", analyses)
    _save("emails.json", emails)
    # candidates.json is left as-is (legacy fields remain for backward compat)

    # ------------------------------------------------------------------
    # 7. Write sentinel
    # ------------------------------------------------------------------
    with open(sentinel_path, "w") as f:
        f.write(f"Migrated at {now}\n")

    logger.info("[MIGRATION] Multi-job migration complete.")
