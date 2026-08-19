import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from typing import Optional, List, Dict, Any
from datetime import datetime
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .drive_service import get_drive_service


class GmailService:
    """Service for sending emails and checking replies via Gmail API."""

    def __init__(self):
        self._service = None

    def _get_service(self):
        """Get or create Gmail API service using existing Drive credentials."""
        if not self._service:
            drive_service = get_drive_service()
            if not drive_service._credentials:
                if not drive_service._load_credentials():
                    raise ValueError("Not connected to Google. Please authorize first.")

            # Check if Gmail scopes are included
            required_scopes = [
                "https://www.googleapis.com/auth/gmail.send",
                "https://www.googleapis.com/auth/gmail.readonly",
            ]
            if not all(scope in (drive_service._credentials.scopes or []) for scope in required_scopes):
                raise ValueError(
                    "Gmail scopes not authorized. Please re-authorize with Gmail permissions."
                )

            self._service = build("gmail", "v1", credentials=drive_service._credentials)

        return self._service

    def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        sender_name: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Send an email via Gmail.

        Returns dict with message_id and thread_id.
        """
        service = self._get_service()

        # Create message
        message = MIMEMultipart("alternative")
        message["to"] = to
        message["subject"] = subject
        if sender_name:
            try:
                user_email = self.get_user_email()
                if user_email:
                    message["from"] = formataddr((sender_name, user_email))
            except Exception:
                pass  # Send without display name if profile lookup fails

        # Add plain text version
        text_part = MIMEText(body, "plain")
        message.attach(text_part)

        # Add HTML version (convert line breaks to <br>)
        html_body = body.replace("\n", "<br>")
        html_part = MIMEText(f"<html><body>{html_body}</body></html>", "html")
        message.attach(html_part)

        # Encode message
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        try:
            sent_message = (
                service.users()
                .messages()
                .send(userId="me", body={"raw": raw})
                .execute()
            )

            return {
                "message_id": sent_message["id"],
                "thread_id": sent_message["threadId"],
            }
        except HttpError as error:
            raise ValueError(f"Failed to send email: {error}")

    def check_replies(
        self,
        thread_id: str,
        after: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Check a thread for new replies after a given timestamp.

        Returns list of reply messages.
        """
        service = self._get_service()

        try:
            # Get the full thread
            thread = (
                service.users()
                .threads()
                .get(userId="me", id=thread_id, format="full")
                .execute()
            )

            messages = thread.get("messages", [])
            replies = []

            for msg in messages[1:]:  # Skip first message (the one we sent)
                # Get message timestamp
                internal_date = int(msg.get("internalDate", 0)) / 1000
                msg_time = datetime.utcfromtimestamp(internal_date)

                # If after is specified, only include newer messages
                if after and msg_time <= after:
                    continue

                # Parse message details
                headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}

                # Extract body
                body = self._extract_body(msg.get("payload", {}))

                replies.append({
                    "id": msg["id"],
                    "from_address": headers.get("From", ""),
                    "subject": headers.get("Subject", ""),
                    "body": body,
                    "received_at": msg_time.isoformat(),
                })

            return replies

        except HttpError as error:
            if error.resp.status == 404:
                return []  # Thread not found
            raise ValueError(f"Failed to check replies: {error}")

    def _extract_body(self, payload: Dict) -> str:
        """Extract the body text from a message payload."""
        body = ""

        if payload.get("body", {}).get("data"):
            body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
        elif payload.get("parts"):
            for part in payload["parts"]:
                if part.get("mimeType") == "text/plain":
                    if part.get("body", {}).get("data"):
                        body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
                        break
                elif part.get("parts"):
                    # Nested parts
                    body = self._extract_body(part)
                    if body:
                        break

        return body

    def get_thread(self, thread_id: str) -> Dict[str, Any]:
        """
        Get full conversation thread.

        Returns thread with all messages.
        """
        service = self._get_service()

        try:
            thread = (
                service.users()
                .threads()
                .get(userId="me", id=thread_id, format="full")
                .execute()
            )

            messages = []
            for msg in thread.get("messages", []):
                headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
                internal_date = int(msg.get("internalDate", 0)) / 1000
                msg_time = datetime.utcfromtimestamp(internal_date)
                body = self._extract_body(msg.get("payload", {}))

                messages.append({
                    "id": msg["id"],
                    "from_address": headers.get("From", ""),
                    "to_address": headers.get("To", ""),
                    "subject": headers.get("Subject", ""),
                    "body": body,
                    "timestamp": msg_time.isoformat(),
                    "labels": msg.get("labelIds", []),
                })

            return {
                "thread_id": thread["id"],
                "messages": messages,
            }

        except HttpError as error:
            raise ValueError(f"Failed to get thread: {error}")

    def get_user_email(self) -> str:
        """Get the authenticated user's email address."""
        service = self._get_service()
        try:
            profile = service.users().getProfile(userId="me").execute()
            return profile.get("emailAddress", "")
        except HttpError:
            return ""


# Singleton instance
_gmail_service: Optional[GmailService] = None


def get_gmail_service() -> GmailService:
    global _gmail_service
    if _gmail_service is None:
        _gmail_service = GmailService()
    return _gmail_service
