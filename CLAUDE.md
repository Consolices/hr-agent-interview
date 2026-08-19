# HR Agent - AI-Powered CV Screening System

## Project Overview

An AI-powered HR recruitment tool that automates CV screening, candidate ranking, and email communication. It integrates with Google Drive, Sheets, and Gmail to pull candidates from Google Form responses, analyze their CVs using GPT-4o-mini, and manage them through a recruitment pipeline.

## Tech Stack

- **Backend**: FastAPI (Python 3.x) + Pydantic v2, JSON file-based storage
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **AI**: OpenAI GPT-4o-mini for CV analysis, data extraction, and email generation
- **Google APIs**: Drive (CV file sync), Sheets (form response import), Gmail (send/receive emails)
- **Drag & Drop**: @dnd-kit for Kanban pipeline board

## Running the Project

```bash
# Backend (port 8000)
cd backend
./venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (port 3000)
cd frontend
npm run dev
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:
```
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/drive/callback
```

## Project Structure

```
backend/
  app/
    main.py              # FastAPI app, CORS, router registration, startup migrations
    config.py            # Settings from .env via pydantic-settings
    routers/             # API endpoints
      jobs.py            # Job CRUD, per-job candidate listing
      candidates.py      # Candidate CRUD, upload, extract, responses
      analysis.py        # Single + batch CV analysis
      pipeline.py        # Pipeline stage transitions, Kanban data
      email.py           # Email templates, preview, generate, send
      drive.py           # Google Drive OAuth, folder listing, sync
      sheets.py          # Google Sheets column mapping, sync
      settings.py        # Recruitment settings, Google connection status
    services/
      storage_service.py # JSON file read/write for all models (singleton)
      agent_service.py   # LLM calls: CV extraction, analysis, scoring
      pipeline_service.py# Stage transition rules and validation
      drive_service.py   # Google Drive/Sheets API wrapper
      gmail_service.py   # Gmail API send/receive
      email_template_service.py # Template CRUD, rendering, AI email generation
      sync_helpers.py    # Google Sheets -> Candidate sync logic
      file_parser.py     # PDF/DOCX text extraction
    models/
      job.py             # Job, JobCreate, JobUpdate
      candidate.py       # Candidate, ExtractedCVData, PipelineStage
      application.py     # Application (many-to-many Candidate <-> Job)
      analysis.py        # AnalysisResult, scoring breakdown
      email.py           # EmailTemplate, SentEmail, RecruitmentSettings
      scoring.py         # Score models (job match, screening, responses)
    prompts/             # LLM prompt templates
    migrations/          # Data migration scripts (e.g., multi-job migration)
  data/                  # JSON storage files (candidates, jobs, applications, etc.)
  venv/                  # Python virtual environment

frontend/
  src/
    app/                 # Next.js App Router pages
      page.tsx           # Dashboard
      jobs/              # /jobs, /jobs/new, /jobs/[id] (tabs: candidates, pipeline, description, settings)
      candidates/        # /candidates, /candidates/[id] (tabs: overview, raw, responses, pipeline, communications, applications)
      pipeline/          # /pipeline (global Kanban board)
      templates/         # /templates (email template management)
      settings/          # /settings (Google connection, recruitment settings)
    components/          # Reusable UI components
      RankingTable.tsx   # Candidate list table with scores and stage badges
      KanbanBoard.tsx    # Drag-and-drop pipeline board
      EmailComposer.tsx  # Email compose/send with template + AI generation
      ScoreDisplay.tsx   # Analysis score breakdown visualization
      JobSheetSync.tsx   # Google Sheets column mapping + sync UI
      JobDriveSync.tsx   # Google Drive folder sync UI
      StageHistoryTimeline.tsx # Pipeline stage change history
      EmailThread.tsx    # Email conversation thread display
    lib/
      api.ts             # API client (class-based, generic request<T>), all TypeScript interfaces
```

## Key Architecture Decisions

### Multi-Job Support
- `Application` model links Candidates to Jobs (many-to-many)
- Per-job state: pipeline_stage, stage_history, emails_sent, analyzed, application_responses
- Legacy fields kept on Candidate for backward compatibility
- Migration script runs at startup (`migrate_to_multi_job.py`), sentinel file `.migrated_v2`

### Data Storage
- JSON files in `backend/data/` (no database)
- `StorageService` singleton handles all CRUD, loaded via `get_storage_service()`
- Files: `candidates.json`, `jobs.json`, `applications.json`, `analyses.json`, `templates.json`, `emails.json`, `settings.json`

### API Conventions
- Services are singletons: `get_storage_service()`, `get_pipeline_service()`, etc.
- Most endpoints accept optional `?job_id=` query param to scope by job
- Frontend `api.ts` uses class-based `ApiClient` with generic `request<T>()` method
- Pipeline stages: applied -> screened -> interview_invited -> interview_scheduled -> interview_done -> offer -> hired/rejected

### Email System
- System templates (Interview Invitation, Technical Interview, Rejection, Follow-up) + custom templates
- Template variables: `{{name}}`, `{{email}}`, `{{position}}`, `{{company}}`, `{{sender_name}}`, `{{booking_link}}`, `{{score}}`, `{{recommendation}}`, `{{strengths}}`, `{{weaknesses}}`
- AI-generated personalized emails via GPT-4o-mini
- Gmail API integration with thread tracking and reply checking
- Sender name from job settings or global recruitment settings

## Development Notes

- TypeScript check: `cd frontend && npx tsc --noEmit`
- Backend venv: use `./venv/bin/python` or `./venv/bin/uvicorn`
- API docs: http://localhost:8000/docs (Swagger UI)
- Frontend auto-reloads on save; backend auto-reloads with `--reload` flag
