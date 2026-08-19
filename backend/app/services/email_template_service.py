import uuid
from typing import Optional, List, Tuple
from datetime import datetime
from openai import AsyncOpenAI

from ..config import get_settings
from ..models.candidate import Candidate
from ..models.email import EmailTemplate, EmailType, RecruitmentSettings
from ..models.analysis import AnalysisResult
from ..models.job import Job
from .storage_service import get_storage_service


# System templates with placeholder variables
SYSTEM_TEMPLATES = [
    EmailTemplate(
        id="system_interview_invitation",
        name="Interview Invitation",
        email_type=EmailType.INTERVIEW_INVITATION,
        subject_template="Interview Invitation: {{position}} at {{company}}",
        body_template="""Dear {{name}},

Thank you for your application for the {{position}} role at {{company}}. We were impressed by your background and would like to invite you for an interview.

Please book your interview slot at your earliest convenience:
{{booking_link}}

If you have any questions or need to reschedule, please don't hesitate to reach out.

Best regards,
{{sender_name}}
{{company}}""",
        is_system=True,
    ),
    EmailTemplate(
        id="system_rejection",
        name="Application Status Update",
        email_type=EmailType.REJECTION,
        subject_template="Application Update: {{position}} at {{company}}",
        body_template="""Dear {{name}},

Thank you for your interest in the {{position}} position at {{company}} and for taking the time to apply.

After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs.

We truly appreciate your interest in {{company}} and encourage you to apply for future opportunities that match your skills and experience.

We wish you the best in your career journey.

Best regards,
{{sender_name}}
{{company}}""",
        is_system=True,
    ),
    EmailTemplate(
        id="system_technical_interview",
        name="Technical Interview Invitation",
        email_type=EmailType.INTERVIEW_INVITATION,
        subject_template="Technical Interview: {{position}} at {{company}}",
        body_template="""Dear {{name}},

Thank you for your interest in the {{position}} role at {{company}}. After reviewing your application, we would like to invite you for a technical interview.

The interview will focus on the following areas:

1. Data Structures & Algorithms
   - Arrays, Linked Lists, Stacks, Queues, Trees, Graphs
   - Searching, Sorting, and common algorithmic patterns

2. Object-Oriented Programming
   - Core principles: Encapsulation, Inheritance, Polymorphism, Abstraction
   - Design patterns and SOLID principles

3. Database Concepts
   - SQL queries, joins, indexing, and normalization
   - Relational vs. non-relational databases

4. Coding Problems
   - You will be asked to solve 1-2 coding problems
   - You may use any programming language of your choice

Please book your interview slot here:
{{booking_link}}

We recommend setting aside approximately 60 minutes for the interview. Feel free to use an IDE or a whiteboard tool during the coding section.

If you have any questions or need to reschedule, please don't hesitate to reach out.

Best regards,
{{sender_name}}
{{company}}""",
        is_system=True,
    ),
    EmailTemplate(
        id="system_follow_up",
        name="Interview Follow-up",
        email_type=EmailType.FOLLOW_UP,
        subject_template="Following Up: {{position}} Interview at {{company}}",
        body_template="""Dear {{name}},

I hope this message finds you well. I wanted to follow up on our recent communication regarding the {{position}} position at {{company}}.

If you have any questions or need any additional information, please don't hesitate to reach out.

Looking forward to hearing from you.

Best regards,
{{sender_name}}
{{company}}""",
        is_system=True,
    ),
]


class EmailTemplateService:
    """Service for email template rendering and AI generation."""

    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[AsyncOpenAI] = None
        self._ensure_system_templates()

    def _get_client(self) -> AsyncOpenAI:
        """Get or create OpenAI client."""
        if not self._client:
            if not self.settings.openai_api_key:
                raise ValueError("OpenAI API key not configured")
            self._client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        return self._client

    def _ensure_system_templates(self):
        """Ensure system templates exist in storage."""
        storage = get_storage_service()
        existing_templates = {t.id for t in storage.list_templates()}

        for template in SYSTEM_TEMPLATES:
            if template.id not in existing_templates:
                storage.save_template(template)

    def get_all_templates(self) -> List[EmailTemplate]:
        """Get all templates (system + custom)."""
        storage = get_storage_service()
        templates = storage.list_templates()
        # Ensure system templates are included
        existing_ids = {t.id for t in templates}
        for system_template in SYSTEM_TEMPLATES:
            if system_template.id not in existing_ids:
                templates.append(system_template)
        return templates

    def get_template(self, template_id: str) -> Optional[EmailTemplate]:
        """Get a specific template."""
        storage = get_storage_service()
        template = storage.get_template(template_id)
        if not template:
            # Check system templates
            for st in SYSTEM_TEMPLATES:
                if st.id == template_id:
                    return st
        return template

    def create_template(
        self,
        name: str,
        email_type: EmailType,
        subject_template: str,
        body_template: str,
    ) -> EmailTemplate:
        """Create a new custom template."""
        storage = get_storage_service()
        template = EmailTemplate(
            id=f"custom_{uuid.uuid4().hex[:8]}",
            name=name,
            email_type=email_type,
            subject_template=subject_template,
            body_template=body_template,
            is_system=False,
        )
        return storage.save_template(template)

    def update_template(
        self,
        template_id: str,
        name: Optional[str] = None,
        subject_template: Optional[str] = None,
        body_template: Optional[str] = None,
    ) -> Optional[EmailTemplate]:
        """Update an existing template (custom only)."""
        storage = get_storage_service()
        template = storage.get_template(template_id)

        if not template or template.is_system:
            return None

        if name is not None:
            template.name = name
        if subject_template is not None:
            template.subject_template = subject_template
        if body_template is not None:
            template.body_template = body_template

        return storage.save_template(template)

    def delete_template(self, template_id: str) -> bool:
        """Delete a custom template."""
        storage = get_storage_service()
        return storage.delete_template(template_id)

    def render_template(
        self,
        template: EmailTemplate,
        candidate: Candidate,
        analysis: Optional[AnalysisResult] = None,
        recruitment_settings: Optional[RecruitmentSettings] = None,
        job: Optional[Job] = None,
    ) -> Tuple[str, str]:
        """
        Render a template with candidate data.

        Returns (subject, body) tuple.
        """
        storage = get_storage_service()
        if recruitment_settings is None:
            recruitment_settings = storage.get_recruitment_settings()

        # Build variable context — prefer Job fields over global settings
        extracted = candidate.extracted_data
        variables = {
            "name": extracted.name if extracted else "Candidate",
            "email": extracted.email if extracted else "",
            "position": job.title if job else recruitment_settings.position_title,
            "company": job.company_name if job else recruitment_settings.company_name,
            "sender_name": job.sender_name if job else recruitment_settings.sender_name,
            "booking_link": (job.trafft_booking_link if job else None) or recruitment_settings.trafft_booking_link or "[Booking link not configured]",
        }

        # Add analysis data if available
        if analysis and analysis.score:
            variables["score"] = str(analysis.score.overall_score)
            variables["recommendation"] = analysis.score.recommendation or ""
            variables["strengths"] = ", ".join(analysis.score.green_flags) if analysis.score.green_flags else "N/A"
            variables["weaknesses"] = ", ".join(analysis.score.red_flags) if analysis.score.red_flags else "N/A"
        else:
            variables["score"] = "N/A"
            variables["recommendation"] = "N/A"
            variables["strengths"] = "N/A"
            variables["weaknesses"] = "N/A"

        # Render templates
        subject = template.subject_template
        body = template.body_template

        for key, value in variables.items():
            placeholder = "{{" + key + "}}"
            subject = subject.replace(placeholder, str(value))
            body = body.replace(placeholder, str(value))

        return subject, body

    async def generate_personalized_email(
        self,
        candidate: Candidate,
        email_type: EmailType,
        analysis: Optional[AnalysisResult] = None,
        job: Optional[Job] = None,
    ) -> Tuple[str, str]:
        """
        Use LLM to generate a personalized email.

        Returns (subject, body) tuple.
        """
        storage = get_storage_service()
        recruitment_settings = storage.get_recruitment_settings()
        extracted = candidate.extracted_data

        # Prefer Job fields over global settings
        company = job.company_name if job else recruitment_settings.company_name
        position = job.title if job else recruitment_settings.position_title
        sender = job.sender_name if job else recruitment_settings.sender_name
        booking_link = (job.trafft_booking_link if job else None) or recruitment_settings.trafft_booking_link or "[BOOKING_LINK]"

        # Build context for the LLM
        candidate_info = f"Name: {extracted.name if extracted else 'Unknown'}\n"
        if extracted:
            if extracted.skills:
                candidate_info += f"Skills: {', '.join(extracted.skills[:10])}\n"
            if extracted.experience:
                recent_exp = extracted.experience[0]
                candidate_info += f"Recent Role: {recent_exp.title} at {recent_exp.company}\n"

        if analysis and analysis.score:
            candidate_info += f"Score: {analysis.score.overall_score}/100\n"
            candidate_info += f"Recommendation: {analysis.score.recommendation}\n"
            if analysis.score.green_flags:
                candidate_info += f"Strengths: {', '.join(analysis.score.green_flags[:3])}\n"

        # Build prompt based on email type
        prompts = {
            EmailType.INTERVIEW_INVITATION: f"""Write a professional interview invitation email for a job candidate.

Company: {company}
Position: {position}
Sender: {sender}

Candidate Information:
{candidate_info}

Booking Link: {booking_link}

Requirements:
- Be warm but professional
- Reference specific strengths from their background
- Include the booking link naturally
- Keep it concise (under 150 words for the body)

Return the email in this exact format:
SUBJECT: <email subject>
BODY:
<email body>""",
            EmailType.REJECTION: f"""Write a professional and empathetic rejection email for a job candidate.

Company: {company}
Position: {position}
Sender: {sender}

Candidate Information:
{candidate_info}

Requirements:
- Be respectful and appreciative of their time
- Don't be overly apologetic or give false hope
- Keep it brief but warm
- Encourage them to apply for future roles

Return the email in this exact format:
SUBJECT: <email subject>
BODY:
<email body>""",
            EmailType.FOLLOW_UP: f"""Write a professional follow-up email for a job candidate.

Company: {company}
Position: {position}
Sender: {sender}

Candidate Information:
{candidate_info}

Requirements:
- Be friendly and professional
- Keep it short and to the point
- Encourage them to reach out with questions

Return the email in this exact format:
SUBJECT: <email subject>
BODY:
<email body>""",
            EmailType.CUSTOM: f"""Write a professional email for a job candidate.

Company: {company}
Position: {position}
Sender: {sender}

Candidate Information:
{candidate_info}

Requirements:
- Be professional and concise

Return the email in this exact format:
SUBJECT: <email subject>
BODY:
<email body>""",
        }

        prompt = prompts.get(email_type, prompts[EmailType.CUSTOM])

        client = self._get_client()
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional HR recruiter writing emails to job candidates. Write clear, warm, and professional emails.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=500,
        )

        # Parse response
        content = response.choices[0].message.content or ""

        # Extract subject and body
        subject = ""
        body = ""

        if "SUBJECT:" in content and "BODY:" in content:
            parts = content.split("BODY:")
            subject_part = parts[0]
            body = parts[1].strip() if len(parts) > 1 else ""

            subject = subject_part.replace("SUBJECT:", "").strip()
        else:
            # Fallback parsing
            lines = content.strip().split("\n")
            subject = lines[0] if lines else f"Regarding your application for {recruitment_settings.position_title}"
            body = "\n".join(lines[1:]).strip() if len(lines) > 1 else content

        return subject, body


# Singleton instance
_template_service: Optional[EmailTemplateService] = None


def get_email_template_service() -> EmailTemplateService:
    global _template_service
    if _template_service is None:
        _template_service = EmailTemplateService()
    return _template_service
