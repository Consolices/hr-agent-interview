# HR Agent - Project Context

## What Is It

HR Agent is an AI-powered recruitment management tool built for small to mid-size teams that receive job applications through Google Forms. It automates the most time-consuming parts of hiring: reading CVs, scoring candidates, tracking them through pipeline stages, and sending personalized emails.

## The Problem

Hiring involves a lot of repetitive manual work:

1. **Google Form responses pile up** - Candidates submit applications through Google Forms with their CV link and written responses. Someone has to manually open each CV, read it, and decide if the candidate is a fit.

2. **No structured evaluation** - Without a system, screening is inconsistent. Different reviewers focus on different things. There's no standardized scoring.

3. **Pipeline tracking is scattered** - Teams use spreadsheets or sticky notes to track who's at which stage (applied, screened, interviewing, offered). It's easy to lose track.

4. **Email communication is tedious** - Writing personalized interview invitations, rejections, and follow-ups for each candidate takes significant time.

## What It Does

### Google Integration
- **Drive Sync**: Connect a Google Drive folder containing CVs. The system downloads and parses PDF/DOCX files automatically.
- **Sheets Sync**: Connect a Google Form response sheet. Map columns (name, email, CV link, custom questions) and import candidates with their application responses in one click.
- **Gmail**: Send emails directly from the app. Track threads, check for replies.

### AI-Powered CV Analysis
- Extracts structured data from CVs: name, email, skills, experience, education, projects
- Scores candidates on three dimensions:
  - **Job Match** (40%) - How well skills and experience match the job requirements
  - **CV Screening** (30%) - Quality of CV, career progression, red/green flags
  - **Application Responses** (30%) - Quality of written answers to custom questions
- Generates an overall score (0-100) and recommendation (Strong Yes / Yes / Maybe / No)
- Identifies green flags (strengths) and red flags (concerns)
- Supports batch analysis (analyze all candidates for a job at once)

### Multi-Job Pipeline Management
- Create multiple job listings, each with its own:
  - Candidate pool and rankings
  - Pipeline stages (Applied -> Screened -> Interview Invited -> Interview Scheduled -> Interview Done -> Offer -> Hired/Rejected)
  - Kanban board with drag-and-drop
  - Custom application response questions
  - Google Drive folder and Sheets mapping
  - Email sender name and booking link
- Candidates can apply to multiple jobs (tracked via Application records)

### Email Communication
- **Templates**: Pre-built templates for interview invitations (general + technical), rejections, and follow-ups
- **AI Generation**: Generate personalized emails based on candidate's CV and analysis results
- **Custom Templates**: Create your own templates with variable placeholders
- **Thread Tracking**: Track email conversations, check for replies
- **Sender Name**: Configurable display name per job (shows "HR Team" or your name instead of raw email)

### Candidate Management
- Ranked candidate list sorted by AI score
- Detailed candidate view with tabs: Overview, Raw CV Text, Application Responses, Pipeline History, Communications, Job Applications
- Pipeline stage badges and email count indicators
- Score breakdown with visual bars

## How It Works (Typical Workflow)

1. **Create a Job** - Add a job listing with title, description, and custom response questions
2. **Connect Google** - Link your Google account for Drive, Sheets, and Gmail access
3. **Import Candidates** - Either:
   - Sync from a Google Form response sheet (maps columns to fields)
   - Sync from a Google Drive folder containing CVs
   - Upload CVs directly
4. **Analyze** - Run AI analysis on all candidates (batch or individual)
5. **Review & Rank** - Candidates are ranked by score. Review analysis, green/red flags, responses
6. **Manage Pipeline** - Move candidates through stages using Kanban board or detail page
7. **Communicate** - Send interview invitations, rejections, or follow-ups using templates or AI-generated emails
8. **Track** - Monitor reply status, check for responses, manage across multiple jobs

## Key Features Summary

| Feature | Description |
|---------|-------------|
| Google Forms Integration | Import candidates from form response sheets with column mapping |
| Google Drive Sync | Auto-download and parse CVs from a shared folder |
| AI CV Analysis | GPT-4o-mini scores candidates on job match, CV quality, and responses |
| Multi-Job Support | Manage multiple positions with separate pipelines and candidate pools |
| Kanban Pipeline | Drag-and-drop board with stages from Applied to Hired/Rejected |
| Email Templates | System + custom templates with variable placeholders |
| AI Email Generation | Generate personalized emails based on candidate data |
| Gmail Integration | Send/receive emails directly, track threads and replies |
| Batch Operations | Analyze all candidates for a job in one click |
| Candidate Ranking | Sorted by AI score with recommendation badges |
