import csv
import os
import json
from typing import Optional, List, Dict
from datetime import datetime
from ..config import get_settings
from ..models.candidate import Candidate, CandidateListItem, PipelineStage
from ..models.analysis import AnalysisResult
from ..models.email import SentEmail, EmailTemplate, RecruitmentSettings
from ..models.job import Job
from ..models.application import Application
from ..models.scoring import ScoringConfig


class StorageService:
    """Simple JSON-based storage for candidates, analysis results, emails, templates, jobs, and applications."""

    def __init__(self):
        self.settings = get_settings()
        self._candidates_path = os.path.join(self.settings.data_path, "candidates.json")
        self._analysis_path = os.path.join(self.settings.data_path, "analysis.json")
        self._emails_path = os.path.join(self.settings.data_path, "emails.json")
        self._templates_path = os.path.join(self.settings.data_path, "templates.json")
        self._recruitment_settings_path = os.path.join(self.settings.data_path, "recruitment_settings.json")
        self._jobs_path = os.path.join(self.settings.data_path, "jobs.json")
        self._applications_path = os.path.join(self.settings.data_path, "applications.json")
        self._scoring_config_path = os.path.join(self.settings.data_path, "scoring_config.json")
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        """Ensure data directory exists."""
        os.makedirs(self.settings.data_path, exist_ok=True)

    def _load_candidates(self) -> Dict[str, dict]:
        """Load candidates from JSON file."""
        if os.path.exists(self._candidates_path):
            with open(self._candidates_path, "r") as f:
                return json.load(f)
        return {}

    def _save_candidates(self, data: Dict[str, dict]):
        """Save candidates to JSON file."""
        with open(self._candidates_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def _load_analysis(self) -> Dict[str, dict]:
        """Load analysis results from JSON file."""
        if os.path.exists(self._analysis_path):
            with open(self._analysis_path, "r") as f:
                return json.load(f)
        return {}

    def _save_analysis(self, data: Dict[str, dict]):
        """Save analysis results to JSON file."""
        with open(self._analysis_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    # ---------------------------------------------------------------
    # Job operations
    # ---------------------------------------------------------------
    def _load_jobs(self) -> Dict[str, dict]:
        if os.path.exists(self._jobs_path):
            with open(self._jobs_path, "r") as f:
                return json.load(f)
        return {}

    def _save_jobs(self, data: Dict[str, dict]):
        with open(self._jobs_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def save_job(self, job: Job) -> Job:
        data = self._load_jobs()
        job.updated_at = datetime.utcnow()
        data[job.id] = job.model_dump(mode="json")
        self._save_jobs(data)
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        data = self._load_jobs()
        if job_id in data:
            return Job(**data[job_id])
        return None

    def list_jobs(self) -> List[Job]:
        data = self._load_jobs()
        return [Job(**j) for j in data.values()]

    def delete_job(self, job_id: str) -> bool:
        data = self._load_jobs()
        if job_id in data:
            del data[job_id]
            self._save_jobs(data)
            # Delete associated applications
            apps_data = self._load_applications()
            to_delete = [aid for aid, a in apps_data.items() if a.get("job_id") == job_id]
            for aid in to_delete:
                del apps_data[aid]
            self._save_applications(apps_data)
            return True
        return False

    # ---------------------------------------------------------------
    # Application operations
    # ---------------------------------------------------------------
    def _load_applications(self) -> Dict[str, dict]:
        if os.path.exists(self._applications_path):
            with open(self._applications_path, "r") as f:
                return json.load(f)
        return {}

    def _save_applications(self, data: Dict[str, dict]):
        with open(self._applications_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def save_application(self, application: Application) -> Application:
        data = self._load_applications()
        application.updated_at = datetime.utcnow()
        data[application.id] = application.model_dump(mode="json")
        self._save_applications(data)
        return application

    def get_application(self, application_id: str) -> Optional[Application]:
        data = self._load_applications()
        if application_id in data:
            return Application(**data[application_id])
        return None

    def get_applications_by_job(self, job_id: str) -> List[Application]:
        data = self._load_applications()
        return [Application(**a) for a in data.values() if a.get("job_id") == job_id]

    def get_applications_by_candidate(self, candidate_id: str) -> List[Application]:
        data = self._load_applications()
        return [Application(**a) for a in data.values() if a.get("candidate_id") == candidate_id]

    def get_application_by_candidate_and_job(self, candidate_id: str, job_id: str) -> Optional[Application]:
        data = self._load_applications()
        for a in data.values():
            if a.get("candidate_id") == candidate_id and a.get("job_id") == job_id:
                return Application(**a)
        return None

    def delete_application(self, application_id: str) -> bool:
        data = self._load_applications()
        if application_id in data:
            del data[application_id]
            self._save_applications(data)
            return True
        return False

    # ---------------------------------------------------------------
    # Candidate operations
    # ---------------------------------------------------------------
    def save_candidate(self, candidate: Candidate) -> Candidate:
        """Save or update a candidate."""
        data = self._load_candidates()
        candidate.updated_at = datetime.utcnow()
        data[candidate.id] = candidate.model_dump(mode="json")
        self._save_candidates(data)
        return candidate

    def get_candidate(self, candidate_id: str) -> Optional[Candidate]:
        """Get a candidate by ID."""
        data = self._load_candidates()
        if candidate_id in data:
            return Candidate(**data[candidate_id])
        return None

    def get_candidate_by_drive_id(self, drive_file_id: str) -> Optional[Candidate]:
        """Get a candidate by Google Drive file ID."""
        data = self._load_candidates()
        for candidate_data in data.values():
            if candidate_data.get("drive_file_id") == drive_file_id:
                return Candidate(**candidate_data)
        return None

    def list_candidates(self) -> List[Candidate]:
        """List all candidates."""
        data = self._load_candidates()
        return [Candidate(**c) for c in data.values()]

    def delete_candidate(self, candidate_id: str) -> bool:
        """Delete a candidate."""
        data = self._load_candidates()
        if candidate_id in data:
            del data[candidate_id]
            self._save_candidates(data)
            # Also delete associated analysis
            analysis_data = self._load_analysis()
            analysis_to_delete = [
                aid for aid, a in analysis_data.items()
                if a.get("candidate_id") == candidate_id
            ]
            for aid in analysis_to_delete:
                del analysis_data[aid]
            self._save_analysis(analysis_data)
            # Delete associated applications
            apps_data = self._load_applications()
            apps_to_delete = [
                aid for aid, a in apps_data.items()
                if a.get("candidate_id") == candidate_id
            ]
            for aid in apps_to_delete:
                del apps_data[aid]
            self._save_applications(apps_data)
            return True
        return False

    # ---------------------------------------------------------------
    # Analysis operations
    # ---------------------------------------------------------------
    def save_analysis(self, result: AnalysisResult) -> AnalysisResult:
        """Save analysis result."""
        data = self._load_analysis()
        data[result.id] = result.model_dump(mode="json")
        self._save_analysis(data)

        # Update application's analyzed flag if application_id is set
        if result.application_id:
            app = self.get_application(result.application_id)
            if app:
                app.analyzed = True
                self.save_application(app)
        else:
            # Fallback: update candidate's analyzed flag (legacy)
            candidate = self.get_candidate(result.candidate_id)
            if candidate:
                candidate.analyzed = True
                self.save_candidate(candidate)

        return result

    def get_analysis_by_candidate(self, candidate_id: str, job_id: str = "") -> Optional[AnalysisResult]:
        """Get the latest analysis for a candidate, optionally scoped by job."""
        data = self._load_analysis()
        results = []
        for a in data.values():
            if a.get("candidate_id") != candidate_id:
                continue
            if job_id and a.get("job_id", "") != job_id:
                continue
            results.append(AnalysisResult(**a))
        if results:
            return max(results, key=lambda x: x.analyzed_at)
        return None

    def get_analysis(self, analysis_id: str) -> Optional[AnalysisResult]:
        """Get analysis by ID."""
        data = self._load_analysis()
        if analysis_id in data:
            return AnalysisResult(**data[analysis_id])
        return None

    def list_analyses(self) -> List[AnalysisResult]:
        """List all analysis results."""
        data = self._load_analysis()
        return [AnalysisResult(**a) for a in data.values()]

    # ---------------------------------------------------------------
    # Combined queries
    # ---------------------------------------------------------------
    @staticmethod
    def _name_from_filename(filename: str) -> str:
        """Best-effort name extraction from a CV filename."""
        import os, re
        name = os.path.splitext(filename)[0]
        name = re.sub(r"^(?:CV|Resume|cv|resume)[_\s-]*(?:\d{4}[-_]\d{2}[-_]\d{2}[_\s-]*)?", "", name)
        if " - " in name:
            name = name.split(" - ")[-1].strip()
        name = name.replace("_", " ").replace("-", " ").strip()
        return name if name else filename

    def get_ranked_candidates(self, job_id: str = "") -> List[Dict]:
        """Get candidates ranked by score, optionally scoped to a job."""
        if job_id:
            # Get applications for this job, then build ranked list
            applications = self.get_applications_by_job(job_id)
            result = []
            for app in applications:
                candidate = self.get_candidate(app.candidate_id)
                if not candidate:
                    continue
                analysis = self.get_analysis_by_candidate(candidate.id, job_id)
                extracted_name = candidate.extracted_data.name if candidate.extracted_data else None
                display_name = extracted_name or self._name_from_filename(candidate.filename)
                item = {
                    "id": candidate.id,
                    "application_id": app.id,
                    "name": display_name,
                    "email": candidate.extracted_data.email if candidate.extracted_data else None,
                    "filename": candidate.filename,
                    "analyzed": app.analyzed,
                    "pipeline_stage": app.pipeline_stage.value,
                    "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
                    "overall_score": None,
                    "recommendation": None,
                    "emails_sent": len(app.emails_sent),
                }
                if analysis:
                    item["overall_score"] = analysis.score.overall_score
                    item["recommendation"] = analysis.score.recommendation
                result.append(item)
        else:
            # Legacy: unscoped
            candidates = self.list_candidates()
            result = []
            for candidate in candidates:
                analysis = self.get_analysis_by_candidate(candidate.id)
                extracted_name = candidate.extracted_data.name if candidate.extracted_data else None
                display_name = extracted_name or self._name_from_filename(candidate.filename)
                item = {
                    "id": candidate.id,
                    "name": display_name,
                    "email": candidate.extracted_data.email if candidate.extracted_data else None,
                    "filename": candidate.filename,
                    "analyzed": candidate.analyzed,
                    "pipeline_stage": candidate.pipeline_stage.value,
                    "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
                    "overall_score": None,
                    "recommendation": None,
                    "emails_sent": len(candidate.emails_sent),
                }
                if analysis:
                    item["overall_score"] = analysis.score.overall_score
                    item["recommendation"] = analysis.score.recommendation
                result.append(item)

        result.sort(
            key=lambda x: (
                x["overall_score"] is not None,
                x["overall_score"] or 0,
            ),
            reverse=True,
        )
        return result

    def get_stats(self, job_id: str = "") -> Dict:
        """Get overview statistics, optionally scoped to a job."""
        if job_id:
            applications = self.get_applications_by_job(job_id)
            candidate_ids = [a.candidate_id for a in applications]
            analyzed_count = sum(1 for a in applications if a.analyzed)
            analyses = self.list_analyses()
            scores = [
                a.score.overall_score for a in analyses
                if a.score and a.candidate_id in candidate_ids and a.job_id == job_id
            ]
            return {
                "total_candidates": len(applications),
                "analyzed_candidates": analyzed_count,
                "pending_analysis": len(applications) - analyzed_count,
                "average_score": sum(scores) / len(scores) if scores else 0,
                "highest_score": max(scores) if scores else 0,
                "lowest_score": min(scores) if scores else 0,
            }
        else:
            candidates = self.list_candidates()
            analyses = self.list_analyses()
            analyzed_count = sum(1 for c in candidates if c.analyzed)
            scores = [a.score.overall_score for a in analyses if a.score]
            return {
                "total_candidates": len(candidates),
                "analyzed_candidates": analyzed_count,
                "pending_analysis": len(candidates) - analyzed_count,
                "average_score": sum(scores) / len(scores) if scores else 0,
                "highest_score": max(scores) if scores else 0,
                "lowest_score": min(scores) if scores else 0,
            }

    # ---------------------------------------------------------------
    # Email operations
    # ---------------------------------------------------------------
    def _load_emails(self) -> Dict[str, dict]:
        if os.path.exists(self._emails_path):
            with open(self._emails_path, "r") as f:
                return json.load(f)
        return {}

    def _save_emails(self, data: Dict[str, dict]):
        with open(self._emails_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def save_email(self, email: SentEmail) -> SentEmail:
        data = self._load_emails()
        data[email.id] = email.model_dump(mode="json")
        self._save_emails(data)
        return email

    def get_email(self, email_id: str) -> Optional[SentEmail]:
        data = self._load_emails()
        if email_id in data:
            return SentEmail(**data[email_id])
        return None

    def list_emails(self) -> List[SentEmail]:
        data = self._load_emails()
        return [SentEmail(**e) for e in data.values()]

    def get_emails_by_candidate(self, candidate_id: str, job_id: str = "") -> List[SentEmail]:
        """Get all emails sent to a candidate, optionally scoped to a job."""
        data = self._load_emails()
        emails = []
        for e in data.values():
            if e.get("candidate_id") != candidate_id:
                continue
            if job_id and e.get("job_id", "") != job_id:
                continue
            emails.append(SentEmail(**e))
        emails.sort(key=lambda x: x.sent_at, reverse=True)
        return emails

    def get_emails_for_reply_check(self, days: int = 14) -> List[SentEmail]:
        from datetime import timedelta
        data = self._load_emails()
        cutoff = datetime.utcnow() - timedelta(days=days)
        emails = []
        for e in data.values():
            email = SentEmail(**e)
            if email.reply_status == "no_reply" and email.sent_at > cutoff:
                emails.append(email)
        return emails

    def update_email(self, email: SentEmail) -> SentEmail:
        data = self._load_emails()
        if email.id in data:
            data[email.id] = email.model_dump(mode="json")
            self._save_emails(data)
        return email

    # ---------------------------------------------------------------
    # Template operations
    # ---------------------------------------------------------------
    def _load_templates(self) -> Dict[str, dict]:
        if os.path.exists(self._templates_path):
            with open(self._templates_path, "r") as f:
                return json.load(f)
        return {}

    def _save_templates(self, data: Dict[str, dict]):
        with open(self._templates_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def save_template(self, template: EmailTemplate) -> EmailTemplate:
        data = self._load_templates()
        template.updated_at = datetime.utcnow()
        data[template.id] = template.model_dump(mode="json")
        self._save_templates(data)
        return template

    def get_template(self, template_id: str) -> Optional[EmailTemplate]:
        data = self._load_templates()
        if template_id in data:
            return EmailTemplate(**data[template_id])
        return None

    def list_templates(self) -> List[EmailTemplate]:
        data = self._load_templates()
        return [EmailTemplate(**t) for t in data.values()]

    def delete_template(self, template_id: str) -> bool:
        data = self._load_templates()
        if template_id in data:
            template = EmailTemplate(**data[template_id])
            if template.is_system:
                return False
            del data[template_id]
            self._save_templates(data)
            return True
        return False

    # ---------------------------------------------------------------
    # Recruitment settings operations
    # ---------------------------------------------------------------
    def get_recruitment_settings(self) -> RecruitmentSettings:
        if os.path.exists(self._recruitment_settings_path):
            with open(self._recruitment_settings_path, "r") as f:
                data = json.load(f)
                return RecruitmentSettings(**data)
        return RecruitmentSettings()

    def save_recruitment_settings(self, settings: RecruitmentSettings) -> RecruitmentSettings:
        with open(self._recruitment_settings_path, "w") as f:
            json.dump(settings.model_dump(mode="json"), f, indent=2)
        return settings

    # ---------------------------------------------------------------
    # Scoring config operations
    # ---------------------------------------------------------------
    def get_scoring_config(self) -> ScoringConfig:
        if os.path.exists(self._scoring_config_path):
            with open(self._scoring_config_path, "r") as f:
                data = json.load(f)
                return ScoringConfig(**data)
        return ScoringConfig()

    def save_scoring_config(self, config: ScoringConfig) -> ScoringConfig:
        with open(self._scoring_config_path, "w") as f:
            json.dump(config.model_dump(mode="json"), f, indent=2)
        return config

    # ---------------------------------------------------------------
    # Pipeline operations (job-scoped)
    # ---------------------------------------------------------------
    def get_candidates_by_stage(self, job_id: str = "") -> Dict[str, List[Dict]]:
        """Get candidates grouped by pipeline stage, optionally scoped to a job."""
        result = {stage.value: [] for stage in PipelineStage}

        if job_id:
            applications = self.get_applications_by_job(job_id)
            for app in applications:
                candidate = self.get_candidate(app.candidate_id)
                if not candidate:
                    continue
                analysis = self.get_analysis_by_candidate(candidate.id, job_id)
                extracted_name = candidate.extracted_data.name if candidate.extracted_data else None
                display_name = extracted_name or self._name_from_filename(candidate.filename)
                item = {
                    "id": candidate.id,
                    "application_id": app.id,
                    "name": display_name,
                    "email": candidate.extracted_data.email if candidate.extracted_data else None,
                    "filename": candidate.filename,
                    "analyzed": app.analyzed,
                    "pipeline_stage": app.pipeline_stage.value,
                    "overall_score": None,
                    "recommendation": None,
                    "emails_sent": len(app.emails_sent),
                }
                if analysis:
                    item["overall_score"] = analysis.score.overall_score
                    item["recommendation"] = analysis.score.recommendation
                result[app.pipeline_stage.value].append(item)
        else:
            # Legacy: use candidate fields
            candidates = self.list_candidates()
            for candidate in candidates:
                analysis = self.get_analysis_by_candidate(candidate.id)
                extracted_name = candidate.extracted_data.name if candidate.extracted_data else None
                display_name = extracted_name or self._name_from_filename(candidate.filename)
                item = {
                    "id": candidate.id,
                    "name": display_name,
                    "email": candidate.extracted_data.email if candidate.extracted_data else None,
                    "filename": candidate.filename,
                    "analyzed": candidate.analyzed,
                    "pipeline_stage": candidate.pipeline_stage.value,
                    "overall_score": None,
                    "recommendation": None,
                    "emails_sent": len(candidate.emails_sent),
                }
                if analysis:
                    item["overall_score"] = analysis.score.overall_score
                    item["recommendation"] = analysis.score.recommendation
                result[candidate.pipeline_stage.value].append(item)

        for stage in result:
            result[stage].sort(
                key=lambda x: (x["overall_score"] is not None, x["overall_score"] or 0),
                reverse=True,
            )
        return result

    def get_pipeline_stats(self, job_id: str = "") -> Dict[str, int]:
        """Get count of candidates per pipeline stage."""
        result = {stage.value: 0 for stage in PipelineStage}
        if job_id:
            applications = self.get_applications_by_job(job_id)
            for app in applications:
                result[app.pipeline_stage.value] += 1
        else:
            candidates = self.list_candidates()
            for candidate in candidates:
                result[candidate.pipeline_stage.value] += 1
        return result

    # ---------------------------------------------------------------
    # CSV export
    # ---------------------------------------------------------------
    def export_candidates_csv(self, job_id: str = "") -> str:
        """Export all analyzed candidates to a CSV file. Returns the file path."""
        from ..models.job import DEFAULT_RESPONSE_QUESTIONS
        csv_path = os.path.join(self.settings.data_path, "analysis_export.csv")

        # Determine response questions for column headers
        response_questions = list(DEFAULT_RESPONSE_QUESTIONS)
        if job_id:
            job_obj = self.get_job(job_id)
            if job_obj and job_obj.response_questions:
                response_questions = job_obj.response_questions

        if job_id:
            applications = self.get_applications_by_job(job_id)
            candidate_app_pairs = []
            for app in applications:
                candidate = self.get_candidate(app.candidate_id)
                if candidate:
                    candidate_app_pairs.append((candidate, app))
        else:
            candidates = self.list_candidates()
            candidate_app_pairs = [(c, None) for c in candidates]

        # Dynamic question headers
        q_labels = [q["label"] for q in response_questions]
        q_keys = [q["key"] for q in response_questions]

        headers = [
            "Name", "Email", "CV Link", "Pipeline Stage",
        ] + q_labels + [
            "Overall Score", "Recommendation", "Summary",
            "Job Match Score",
            "years_experience", "skills_matched", "skills_missing",
            "Screening Score", "has_significant_gaps", "avg_tenure_months",
            "spelling_errors", "grammar_issues", "project_complexity",
            "university_tier",
            "Response Score",
        ] + [f"score_{k}" for k in q_keys] + [
            "Red Flags", "Green Flags",
        ]

        rows = []
        for candidate, app in candidate_app_pairs:
            analysis = self.get_analysis_by_candidate(candidate.id, job_id)
            name = (candidate.extracted_data.name if candidate.extracted_data else None) or self._name_from_filename(candidate.filename)
            email = (candidate.extracted_data.email if candidate.extracted_data else None) or ""
            cv_link = ""
            if candidate.drive_file_id:
                cv_link = f"https://drive.google.com/file/d/{candidate.drive_file_id}/view"

            pipeline_stage = app.pipeline_stage.value if app else (candidate.pipeline_stage.value if candidate.pipeline_stage else "applied")

            # Application responses can come from app or candidate (now a dict)
            responses = (app.application_responses if app else None) or candidate.application_responses
            response_values = []
            for qk in q_keys:
                if responses and isinstance(responses, dict):
                    response_values.append(responses.get(qk) or "")
                else:
                    response_values.append("")

            if analysis and analysis.score:
                s = analysis.score
                jm = s.job_match_score
                ss = s.screening_score
                rs = s.response_score
                dims = rs.get_all_dimensions()
                dim_scores = [dims.get(k, "") for k in q_keys]
                row = [
                    name, email, cv_link, pipeline_stage,
                ] + response_values + [
                    s.overall_score, s.recommendation or "", s.summary or "",
                    jm.score,
                    jm.years_experience,
                    "; ".join(jm.skills_matched),
                    "; ".join(jm.skills_missing),
                    ss.score, ss.has_significant_gaps, ss.avg_tenure_months,
                    ss.spelling_errors, ss.grammar_issues, ss.project_complexity,
                    ss.university_tier or "",
                    rs.score,
                ] + dim_scores + [
                    "; ".join(s.red_flags),
                    "; ".join(s.green_flags),
                ]
            else:
                row = [
                    name, email, cv_link, pipeline_stage,
                ] + response_values + [""] * (len(headers) - 4 - len(q_keys))

            rows.append(row)

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)

        print(f"[CSV] Exported {len(rows)} candidates to {csv_path}")
        return csv_path


# Singleton instance
_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
