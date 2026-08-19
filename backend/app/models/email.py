from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class EmailType(str, Enum):
    INTERVIEW_INVITATION = "interview_invitation"
    REJECTION = "rejection"
    FOLLOW_UP = "follow_up"
    CUSTOM = "custom"


class EmailReply(BaseModel):
    id: str
    from_address: str
    subject: str
    body: str
    received_at: datetime
    is_read: bool = False


class SentEmail(BaseModel):
    id: str
    candidate_id: str
    job_id: str = ""
    application_id: str = ""
    email_type: EmailType
    subject: str
    body: str
    to_address: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    gmail_message_id: Optional[str] = None
    gmail_thread_id: Optional[str] = None
    reply_status: str = "no_reply"  # no_reply, replied, bounced
    replies: List[EmailReply] = Field(default_factory=list)
    last_checked: Optional[datetime] = None


class EmailTemplate(BaseModel):
    id: str
    name: str
    email_type: EmailType
    subject_template: str
    body_template: str
    is_system: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RecruitmentSettings(BaseModel):
    trafft_booking_link: Optional[str] = None
    company_name: str = "Your Company"
    position_title: str = "Software Engineer"
    sender_name: str = "HR Team"
    sender_email: Optional[str] = None


# Request/Response models for API endpoints
class SendEmailRequest(BaseModel):
    candidate_id: str
    job_id: str = ""
    email_type: EmailType
    subject: str
    body: str
    template_id: Optional[str] = None


class SendEmailResponse(BaseModel):
    email_id: str
    message_id: str
    thread_id: str
    sent_at: datetime


class EmailPreviewRequest(BaseModel):
    candidate_id: str
    template_id: str
    job_id: str = ""


class EmailPreviewResponse(BaseModel):
    subject: str
    body: str


class GenerateEmailRequest(BaseModel):
    candidate_id: str
    email_type: EmailType
    job_id: str = ""


class GenerateEmailResponse(BaseModel):
    subject: str
    body: str


class TemplateCreateRequest(BaseModel):
    name: str
    email_type: EmailType
    subject_template: str
    body_template: str


class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
