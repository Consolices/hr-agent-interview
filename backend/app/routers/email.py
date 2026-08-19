import uuid
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.email import (
    EmailType,
    SentEmail,
    EmailTemplate,
    EmailReply,
    SendEmailRequest,
    SendEmailResponse,
    EmailPreviewRequest,
    EmailPreviewResponse,
    GenerateEmailRequest,
    GenerateEmailResponse,
    TemplateCreateRequest,
    TemplateUpdateRequest,
)
from ..services.gmail_service import get_gmail_service
from ..services.email_template_service import get_email_template_service
from ..services.storage_service import get_storage_service
from ..services.pipeline_service import get_pipeline_service
from ..models.candidate import PipelineStage

router = APIRouter(prefix="/api/email", tags=["email"])


class TemplateResponse(BaseModel):
    id: str
    name: str
    email_type: str
    subject_template: str
    body_template: str
    is_system: bool


class EmailResponse(BaseModel):
    id: str
    candidate_id: str
    email_type: str
    subject: str
    body: str
    to_address: str
    sent_at: str
    gmail_thread_id: Optional[str]
    reply_status: str
    reply_count: int


class ThreadMessage(BaseModel):
    id: str
    from_address: str
    to_address: str
    subject: str
    body: str
    timestamp: str
    is_outbound: bool


class ThreadResponse(BaseModel):
    thread_id: str
    messages: List[ThreadMessage]


class CheckRepliesResponse(BaseModel):
    checked: int
    new_replies: int
    errors: List[str]


# Template endpoints
@router.get("/templates")
async def list_templates() -> List[TemplateResponse]:
    """List all email templates."""
    template_service = get_email_template_service()
    templates = template_service.get_all_templates()

    return [
        TemplateResponse(
            id=t.id,
            name=t.name,
            email_type=t.email_type.value,
            subject_template=t.subject_template,
            body_template=t.body_template,
            is_system=t.is_system,
        )
        for t in templates
    ]


@router.post("/templates")
async def create_template(request: TemplateCreateRequest) -> TemplateResponse:
    """Create a new custom email template."""
    template_service = get_email_template_service()

    template = template_service.create_template(
        name=request.name,
        email_type=request.email_type,
        subject_template=request.subject_template,
        body_template=request.body_template,
    )

    return TemplateResponse(
        id=template.id,
        name=template.name,
        email_type=template.email_type.value,
        subject_template=template.subject_template,
        body_template=template.body_template,
        is_system=template.is_system,
    )


@router.put("/templates/{template_id}")
async def update_template(template_id: str, request: TemplateUpdateRequest) -> TemplateResponse:
    """Update a custom email template."""
    template_service = get_email_template_service()

    template = template_service.update_template(
        template_id=template_id,
        name=request.name,
        subject_template=request.subject_template,
        body_template=request.body_template,
    )

    if not template:
        raise HTTPException(
            status_code=400,
            detail="Template not found or is a system template (cannot be edited)",
        )

    return TemplateResponse(
        id=template.id,
        name=template.name,
        email_type=template.email_type.value,
        subject_template=template.subject_template,
        body_template=template.body_template,
        is_system=template.is_system,
    )


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str) -> dict:
    """Delete a custom email template."""
    template_service = get_email_template_service()

    success = template_service.delete_template(template_id)

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Template not found or is a system template (cannot be deleted)",
        )

    return {"success": True}


# Email preview and generation
@router.post("/preview")
async def preview_email(request: EmailPreviewRequest) -> EmailPreviewResponse:
    """Preview an email with candidate data rendered."""
    template_service = get_email_template_service()
    storage = get_storage_service()

    template = template_service.get_template(request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    candidate = storage.get_candidate(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    analysis = storage.get_analysis_by_candidate(request.candidate_id, request.job_id)

    # Load job for template variables
    job = storage.get_job(request.job_id) if request.job_id else None

    subject, body = template_service.render_template(
        template=template,
        candidate=candidate,
        analysis=analysis,
        job=job,
    )

    return EmailPreviewResponse(subject=subject, body=body)


@router.post("/generate")
async def generate_email(request: GenerateEmailRequest) -> GenerateEmailResponse:
    """Generate a personalized email using AI."""
    template_service = get_email_template_service()
    storage = get_storage_service()

    candidate = storage.get_candidate(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    analysis = storage.get_analysis_by_candidate(request.candidate_id, request.job_id)
    job = storage.get_job(request.job_id) if request.job_id else None

    try:
        subject, body = await template_service.generate_personalized_email(
            candidate=candidate,
            email_type=request.email_type,
            analysis=analysis,
            job=job,
        )

        return GenerateEmailResponse(subject=subject, body=body)

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Email sending
@router.post("/send")
async def send_email(request: SendEmailRequest) -> SendEmailResponse:
    """Send an email to a candidate."""
    storage = get_storage_service()
    gmail_service = get_gmail_service()
    pipeline_service = get_pipeline_service()

    candidate = storage.get_candidate(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    to_address = candidate.extracted_data.email if candidate.extracted_data else None
    if not to_address:
        raise HTTPException(
            status_code=400,
            detail="Candidate does not have an email address",
        )

    # Load job for sender_name
    job = storage.get_job(request.job_id) if request.job_id else None
    sender_name = job.sender_name if job else None

    if not sender_name:
        recruitment_settings = storage.get_recruitment_settings()
        sender_name = recruitment_settings.sender_name

    # Resolve application
    application_id = ""
    if request.job_id:
        app = storage.get_application_by_candidate_and_job(request.candidate_id, request.job_id)
        if app:
            application_id = app.id

    try:
        result = gmail_service.send_email(
            to=to_address,
            subject=request.subject,
            body=request.body,
            sender_name=sender_name,
        )

        email = SentEmail(
            id=str(uuid.uuid4()),
            candidate_id=request.candidate_id,
            job_id=request.job_id,
            application_id=application_id,
            email_type=request.email_type,
            subject=request.subject,
            body=request.body,
            to_address=to_address,
            gmail_message_id=result["message_id"],
            gmail_thread_id=result["thread_id"],
        )
        storage.save_email(email)

        # Track email on application (if exists) or candidate
        if application_id:
            app = storage.get_application(application_id)
            if app:
                app.emails_sent.append(email.id)
                storage.save_application(app)
        else:
            candidate.emails_sent.append(email.id)
            storage.save_candidate(candidate)

        # Auto-advance pipeline stage on first email sent
        if request.job_id and application_id:
            app = storage.get_application(application_id)
            if app and len(app.emails_sent) == 1 and app.pipeline_stage == PipelineStage.APPLIED:
                try:
                    pipeline_service.move_candidate(
                        candidate_id=request.candidate_id,
                        to_stage=PipelineStage.SCREENED,
                        job_id=request.job_id,
                        notes="Auto-moved after first email sent",
                    )
                except ValueError:
                    pass

            if request.email_type == EmailType.INTERVIEW_INVITATION:
                app = storage.get_application(application_id)
                if app and app.pipeline_stage == PipelineStage.SCREENED:
                    try:
                        pipeline_service.move_candidate(
                            candidate_id=request.candidate_id,
                            to_stage=PipelineStage.INTERVIEW_INVITED,
                            job_id=request.job_id,
                            notes="Auto-moved after sending interview invitation",
                        )
                    except ValueError:
                        pass
        else:
            # Legacy: operate on candidate directly
            is_first_email = len(candidate.emails_sent) == 1
            if is_first_email and candidate.pipeline_stage == PipelineStage.APPLIED:
                try:
                    pipeline_service.move_candidate(
                        candidate_id=candidate.id,
                        to_stage=PipelineStage.SCREENED,
                        notes="Auto-moved after first email sent",
                    )
                    candidate = storage.get_candidate(candidate.id)
                except ValueError:
                    pass

            if request.email_type == EmailType.INTERVIEW_INVITATION:
                if candidate.pipeline_stage == PipelineStage.SCREENED:
                    try:
                        pipeline_service.move_candidate(
                            candidate_id=candidate.id,
                            to_stage=PipelineStage.INTERVIEW_INVITED,
                            notes="Auto-moved after sending interview invitation",
                        )
                    except ValueError:
                        pass

        return SendEmailResponse(
            email_id=email.id,
            message_id=result["message_id"],
            thread_id=result["thread_id"],
            sent_at=email.sent_at,
        )

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Email retrieval
@router.get("/candidates/{candidate_id}/emails")
async def get_candidate_emails(candidate_id: str, job_id: Optional[str] = None) -> List[EmailResponse]:
    """Get all emails sent to a candidate."""
    storage = get_storage_service()

    candidate = storage.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    emails = storage.get_emails_by_candidate(candidate_id, job_id or "")

    return [
        EmailResponse(
            id=e.id,
            candidate_id=e.candidate_id,
            email_type=e.email_type.value,
            subject=e.subject,
            body=e.body,
            to_address=e.to_address,
            sent_at=e.sent_at.isoformat(),
            gmail_thread_id=e.gmail_thread_id,
            reply_status=e.reply_status,
            reply_count=len(e.replies),
        )
        for e in emails
    ]


@router.get("/emails/{email_id}/thread")
async def get_email_thread(email_id: str) -> ThreadResponse:
    """Get the full conversation thread for an email."""
    storage = get_storage_service()
    gmail_service = get_gmail_service()

    email = storage.get_email(email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if not email.gmail_thread_id:
        raise HTTPException(status_code=400, detail="Email has no thread ID")

    try:
        thread_data = gmail_service.get_thread(email.gmail_thread_id)
        user_email = gmail_service.get_user_email()

        messages = []
        for msg in thread_data.get("messages", []):
            is_outbound = user_email.lower() in msg.get("from_address", "").lower()

            messages.append(
                ThreadMessage(
                    id=msg["id"],
                    from_address=msg["from_address"],
                    to_address=msg["to_address"],
                    subject=msg["subject"],
                    body=msg["body"],
                    timestamp=msg["timestamp"],
                    is_outbound=is_outbound,
                )
            )

        return ThreadResponse(
            thread_id=thread_data["thread_id"],
            messages=messages,
        )

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Reply checking
@router.post("/check-replies")
async def check_replies() -> CheckRepliesResponse:
    """Check all recent emails for replies."""
    storage = get_storage_service()
    gmail_service = get_gmail_service()

    emails = storage.get_emails_for_reply_check()
    checked = 0
    new_replies = 0
    errors = []

    for email in emails:
        if not email.gmail_thread_id:
            continue

        try:
            replies = gmail_service.check_replies(
                thread_id=email.gmail_thread_id,
                after=email.last_checked or email.sent_at,
            )

            if replies:
                for reply_data in replies:
                    reply = EmailReply(
                        id=reply_data["id"],
                        from_address=reply_data["from_address"],
                        subject=reply_data["subject"],
                        body=reply_data["body"],
                        received_at=datetime.fromisoformat(reply_data["received_at"]),
                    )

                    existing_ids = {r.id for r in email.replies}
                    if reply.id not in existing_ids:
                        email.replies.append(reply)
                        new_replies += 1

                email.reply_status = "replied"

            email.last_checked = datetime.utcnow()
            storage.update_email(email)
            checked += 1

        except Exception as e:
            errors.append(f"Error checking email {email.id}: {str(e)}")

    return CheckRepliesResponse(
        checked=checked,
        new_replies=new_replies,
        errors=errors,
    )
