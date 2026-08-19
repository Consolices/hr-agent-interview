from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum


class JobStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"


DEFAULT_RESPONSE_QUESTIONS: List[Dict[str, str]] = [
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


def _default_response_questions() -> List[Dict[str, str]]:
    return [dict(q) for q in DEFAULT_RESPONSE_QUESTIONS]


class Job(BaseModel):
    id: str
    title: str
    description: str = ""
    status: JobStatus = JobStatus.OPEN
    company_name: str = "Your Company"
    position_title: str = ""  # defaults to title
    trafft_booking_link: Optional[str] = None
    sender_name: str = "HR Team"
    sender_email: Optional[str] = None
    drive_folder_id: Optional[str] = None
    drive_folder_name: Optional[str] = None
    sheet_spreadsheet_id: Optional[str] = None
    sheet_spreadsheet_name: Optional[str] = None
    sheet_column_mapping: Optional[Dict[str, Any]] = None
    response_questions: List[Dict[str, str]] = Field(default_factory=_default_response_questions)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JobCreate(BaseModel):
    title: str
    description: str = ""
    status: JobStatus = JobStatus.OPEN
    company_name: str = "Your Company"
    position_title: str = ""
    trafft_booking_link: Optional[str] = None
    sender_name: str = "HR Team"
    sender_email: Optional[str] = None
    drive_folder_id: Optional[str] = None
    drive_folder_name: Optional[str] = None
    sheet_spreadsheet_id: Optional[str] = None
    sheet_spreadsheet_name: Optional[str] = None
    sheet_column_mapping: Optional[Dict[str, Any]] = None
    response_questions: List[Dict[str, str]] = Field(default_factory=_default_response_questions)


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[JobStatus] = None
    company_name: Optional[str] = None
    position_title: Optional[str] = None
    trafft_booking_link: Optional[str] = None
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    drive_folder_id: Optional[str] = None
    drive_folder_name: Optional[str] = None
    sheet_spreadsheet_id: Optional[str] = None
    sheet_spreadsheet_name: Optional[str] = None
    sheet_column_mapping: Optional[Dict[str, Any]] = None
    response_questions: Optional[List[Dict[str, str]]] = None
