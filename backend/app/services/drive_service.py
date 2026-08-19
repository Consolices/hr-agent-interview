import os
import json
import re
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse, parse_qs
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

from ..config import get_settings


class DriveService:
    """Service for Google Drive, Google Sheets, and Gmail integration."""

    SCOPES = [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
    ]

    def __init__(self):
        self.settings = get_settings()
        self._credentials: Optional[Credentials] = None
        self._flow: Optional[Flow] = None
        self._service = None
        self._token_path = os.path.join(self.settings.data_path, "drive_token.json")

    def _get_client_config(self) -> Dict[str, Any]:
        """Build OAuth client configuration."""
        return {
            "web": {
                "client_id": self.settings.google_client_id,
                "client_secret": self.settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [self.settings.google_redirect_uri],
            }
        }

    def get_auth_url(self) -> str:
        """Generate OAuth authorization URL."""
        self._flow = Flow.from_client_config(
            self._get_client_config(),
            scopes=self.SCOPES,
            redirect_uri=self.settings.google_redirect_uri,
        )
        auth_url, _ = self._flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        return auth_url

    def handle_callback(self, code: str) -> bool:
        """Handle OAuth callback and store credentials."""
        if not self._flow:
            self._flow = Flow.from_client_config(
                self._get_client_config(),
                scopes=self.SCOPES,
                redirect_uri=self.settings.google_redirect_uri,
            )

        self._flow.fetch_token(code=code)
        self._credentials = self._flow.credentials

        # Save credentials
        self._save_credentials()
        return True

    def _save_credentials(self):
        """Save credentials to file."""
        if self._credentials:
            os.makedirs(os.path.dirname(self._token_path), exist_ok=True)
            with open(self._token_path, "w") as f:
                json.dump(
                    {
                        "token": self._credentials.token,
                        "refresh_token": self._credentials.refresh_token,
                        "token_uri": self._credentials.token_uri,
                        "client_id": self._credentials.client_id,
                        "client_secret": self._credentials.client_secret,
                        "scopes": list(self._credentials.scopes),
                    },
                    f,
                )

    def _load_credentials(self) -> bool:
        """Load credentials from file."""
        if os.path.exists(self._token_path):
            with open(self._token_path, "r") as f:
                data = json.load(f)
                self._credentials = Credentials(
                    token=data["token"],
                    refresh_token=data.get("refresh_token"),
                    token_uri=data["token_uri"],
                    client_id=data["client_id"],
                    client_secret=data["client_secret"],
                    scopes=data["scopes"],
                )
                return True
        return False

    def _has_required_scopes(self) -> bool:
        """Check if stored credentials include all required scopes."""
        if not self._credentials or not self._credentials.scopes:
            return False
        return all(scope in self._credentials.scopes for scope in self.SCOPES)

    def is_connected(self) -> bool:
        """Check if Drive is connected and credentials are valid."""
        if not self._credentials:
            self._load_credentials()
        return (
            self._credentials is not None
            and self._credentials.valid
            and self._has_required_scopes()
        )

    def disconnect(self):
        """Remove stored credentials."""
        self._credentials = None
        self._service = None
        if os.path.exists(self._token_path):
            os.remove(self._token_path)

    def _get_service(self):
        """Get or create Drive API service."""
        if not self._credentials:
            if not self._load_credentials():
                raise ValueError("Not connected to Google Drive")

        if not self._service:
            self._service = build("drive", "v3", credentials=self._credentials)

        return self._service

    def list_files(
        self, folder_id: Optional[str] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """List all files from Google Drive folder, handling pagination."""
        service = self._get_service()

        # Build query for CV files (PDF and DOCX)
        query_parts = [
            "(mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')"
        ]

        if folder_id:
            query_parts.append(f"'{folder_id}' in parents")

        query = " and ".join(query_parts)

        all_files = []
        page_token = None

        while True:
            request_kwargs = dict(
                q=query,
                pageSize=page_size,
                fields="nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, size)",
            )
            if page_token:
                request_kwargs["pageToken"] = page_token

            results = service.files().list(**request_kwargs).execute()
            all_files.extend(results.get("files", []))

            page_token = results.get("nextPageToken")
            if not page_token:
                break

        return all_files

    def list_folders(self) -> List[Dict[str, Any]]:
        """List folders from Google Drive."""
        service = self._get_service()

        results = (
            service.files()
            .list(
                q="mimeType='application/vnd.google-apps.folder'",
                pageSize=50,
                fields="files(id, name)",
            )
            .execute()
        )

        return results.get("files", [])

    # Google Workspace MIME types that need export instead of direct download
    _EXPORT_MIME_MAP = {
        "application/vnd.google-apps.document": "application/pdf",
        "application/vnd.google-apps.spreadsheet": "application/pdf",
        "application/vnd.google-apps.presentation": "application/pdf",
    }

    def download_file(self, file_id: str, mime_type: str = None) -> bytes:
        """Download a file from Google Drive.

        Google Workspace files (Docs, Sheets, Slides) are exported as PDF
        automatically. Binary files (PDF, DOCX) are downloaded directly.
        """
        service = self._get_service()

        # If mime_type indicates a Google Workspace file, use export
        export_mime = self._EXPORT_MIME_MAP.get(mime_type) if mime_type else None

        if export_mime:
            request = service.files().export_media(
                fileId=file_id, mimeType=export_mime
            )
        else:
            request = service.files().get_media(fileId=file_id)

        file_buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(file_buffer, request)

        done = False
        while not done:
            _, done = downloader.next_chunk()

        file_buffer.seek(0)
        return file_buffer.read()

    def get_file_metadata(self, file_id: str) -> Dict[str, Any]:
        """Get metadata for a specific file."""
        service = self._get_service()
        return (
            service.files()
            .get(fileId=file_id, fields="id, name, mimeType, createdTime, size")
            .execute()
        )

    # --- Sheets API methods ---

    def _get_sheets_service(self):
        """Get or create Sheets API service."""
        if not self._credentials:
            if not self._load_credentials():
                raise ValueError("Not connected to Google Drive")
        return build("sheets", "v4", credentials=self._credentials)

    def list_spreadsheets(self) -> List[Dict[str, Any]]:
        """List spreadsheets the user can access, sorted by most recently modified."""
        service = self._get_service()
        query = "mimeType='application/vnd.google-apps.spreadsheet'"

        all_files = []
        page_token = None

        while True:
            request_kwargs = dict(
                q=query,
                pageSize=100,
                fields="nextPageToken, files(id, name, modifiedTime)",
                orderBy="modifiedTime desc",
            )
            if page_token:
                request_kwargs["pageToken"] = page_token

            results = service.files().list(**request_kwargs).execute()
            all_files.extend(results.get("files", []))

            page_token = results.get("nextPageToken")
            if not page_token:
                break

        return [
            {
                "id": f["id"],
                "name": f["name"],
                "modified_time": f.get("modifiedTime"),
            }
            for f in all_files
        ]

    def get_sheet_headers(self, spreadsheet_id: str) -> List[str]:
        """Read row 1 of the first sheet tab and return column headers."""
        sheets = self._get_sheets_service()
        result = (
            sheets.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range="1:1")
            .execute()
        )
        values = result.get("values", [])
        if not values:
            return []
        return values[0]

    def get_sheet_row_count(self, spreadsheet_id: str) -> int:
        """Count data rows (excluding header) by reading column A."""
        sheets = self._get_sheets_service()
        result = (
            sheets.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range="A:A")
            .execute()
        )
        values = result.get("values", [])
        return max(0, len(values) - 1)

    def read_sheet_rows(self, spreadsheet_id: str) -> List[List[str]]:
        """Read all rows after the header row."""
        sheets = self._get_sheets_service()
        result = (
            sheets.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range="A:ZZ")
            .execute()
        )
        values = result.get("values", [])
        if len(values) <= 1:
            return []
        return values[1:]

    # --- URL parsing ---

    @staticmethod
    def extract_drive_file_id(url: str) -> Optional[str]:
        """Extract a Google Drive file ID from various URL formats or a bare ID.

        Handles:
        - https://drive.google.com/open?id=XXXXX
        - https://drive.google.com/file/d/XXXXX/view
        - https://drive.google.com/uc?id=XXXXX
        - Bare file IDs (alphanumeric + hyphens/underscores, typically 25-60 chars)
        """
        if not url:
            return None

        url = url.strip()

        # Try URL patterns
        if url.startswith("http://") or url.startswith("https://"):
            parsed = urlparse(url)

            # ?id=XXXXX pattern
            qs = parse_qs(parsed.query)
            if "id" in qs:
                return qs["id"][0]

            # /file/d/XXXXX/ pattern
            match = re.search(r"/file/d/([a-zA-Z0-9_-]+)", parsed.path)
            if match:
                return match.group(1)

            # /d/XXXXX/ pattern (Sheets/Docs share links)
            match = re.search(r"/d/([a-zA-Z0-9_-]+)", parsed.path)
            if match:
                return match.group(1)

            return None

        # Bare file ID: alphanumeric, hyphens, underscores
        if re.match(r"^[a-zA-Z0-9_-]{10,}$", url):
            return url

        return None


# Singleton instance
_drive_service: Optional[DriveService] = None


def get_drive_service() -> DriveService:
    global _drive_service
    if _drive_service is None:
        _drive_service = DriveService()
    return _drive_service
