# HR CV Screening Agent

An AI-powered CV screening system that automatically analyzes resumes and ranks candidates based on job requirements.

## Features

- **Google Drive Integration** - Sync CVs directly from your Google Drive
- **Multi-format Support** - Parse PDF and DOCX files
- **AI Analysis** - GPT-4 powered candidate evaluation
- **Scoring System** - 3-part scoring (Job Match, Screening, Responses)
- **Ranked Dashboard** - View candidates sorted by score with recommendations

## Tech Stack

- **Backend:** FastAPI (Python 3.11+)
- **Frontend:** Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **LLM:** OpenAI GPT-4
- **File Parsing:** PyPDF2/pdfplumber (PDF), python-docx (DOCX)
- **Storage:** JSON file-based (suitable for 50-200 CVs)

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key
- (Optional) Google Cloud project with Drive API enabled

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Run the server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local

# Run the dev server
npm run dev
```

### Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Configuration

### Backend (.env)

```
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/drive/callback
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Drive API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it
4. Configure OAuth consent screen:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Select "External" user type
   - Fill in app name, support email
   - Add scopes: `https://www.googleapis.com/auth/drive.readonly`
   - Add your email as a test user
5. Create OAuth credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Add authorized redirect URI: `http://localhost:8000/api/drive/callback`
   - Copy Client ID and Client Secret to your `.env` file

## Scoring System

### Job Match Score (40% weight)
- React/Vue/Angular experience
- Node.js/Python backend experience
- Database design knowledge
- API integration experience
- AI tools experience (bonus)
- Years of experience (1-2 years target)

### Screening Score (40% weight)
- Career gaps detection (flags gaps > 6 months)
- Average tenure calculation
- Spelling/grammar assessment
- Project complexity (1-10 scale)
- University recognition

### Response Score (20% weight)
- Quality of introduction & motivation
- Depth of passion/expertise description
- Self-learning initiative quality

## API Endpoints

```
# Google Drive
GET    /api/drive/status           # Check connection status
GET    /api/drive/connect          # Initiate OAuth flow
GET    /api/drive/callback         # OAuth callback
POST   /api/drive/disconnect       # Disconnect Drive
GET    /api/drive/folders          # List folders
GET    /api/drive/files            # List CV files
POST   /api/drive/sync             # Sync CVs from Drive

# Candidates
GET    /api/candidates             # List all candidates (ranked)
GET    /api/candidates/stats       # Get statistics
GET    /api/candidates/{id}        # Get candidate details
POST   /api/candidates/upload      # Upload CV file
PUT    /api/candidates/{id}/responses  # Update application responses
DELETE /api/candidates/{id}        # Delete candidate

# Analysis
POST   /api/analysis/{id}/analyze  # Analyze single candidate
GET    /api/analysis/{id}          # Get analysis by ID
GET    /api/analysis/candidate/{id}  # Get analysis for candidate
POST   /api/analysis/batch         # Start batch analysis
GET    /api/analysis/batch/progress  # Get batch progress
POST   /api/analysis/batch/cancel  # Cancel batch analysis
```

## Project Structure

```
hr-agent/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI entry point
│   │   ├── config.py               # Environment config
│   │   ├── routers/
│   │   │   ├── candidates.py       # Candidate endpoints
│   │   │   ├── analysis.py         # Analysis endpoints
│   │   │   └── drive.py            # Google Drive endpoints
│   │   ├── services/
│   │   │   ├── file_parser.py      # PDF/DOCX parsing
│   │   │   ├── drive_service.py    # Google Drive integration
│   │   │   ├── llm_service.py      # OpenAI integration
│   │   │   ├── scoring_service.py  # Scoring logic
│   │   │   └── storage_service.py  # JSON storage
│   │   ├── models/
│   │   │   ├── candidate.py        # Candidate models
│   │   │   └── analysis.py         # Analysis models
│   │   └── prompts/
│   │       └── screening.py        # LLM prompts
│   ├── data/                       # JSON storage files
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Dashboard
│   │   │   ├── candidates/
│   │   │   │   ├── page.tsx        # Candidate list
│   │   │   │   └── [id]/page.tsx   # Candidate detail
│   │   │   └── settings/page.tsx   # Settings
│   │   ├── components/
│   │   │   ├── CandidateCard.tsx
│   │   │   ├── ScoreDisplay.tsx
│   │   │   ├── DriveConnector.tsx
│   │   │   ├── RankingTable.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── Navigation.tsx
│   │   └── lib/
│   │       └── api.ts              # API client
│   └── .env.local.example
└── README.md
```

## Usage

1. **Upload CVs** - Either upload files directly or connect Google Drive
2. **Sync from Drive** - Select a folder and click "Sync CVs"
3. **Analyze** - Click "Analyze All" or analyze individual candidates
4. **Review** - View ranked candidates with detailed score breakdowns
5. **Export** - Use the API to export results as needed

## License

MIT

## Sample data

`backend/data/` ships with generated sample records so the app is usable straight after setup. Three open jobs, forty five candidates with parsed CV fields and written responses, fifty three applications spread across the pipeline stages, and a scored analysis for each one. None of it comes from a real person. Every name, email and CV in there was generated.

Delete the JSON files in `backend/data/` if you want to start from an empty database. The app recreates them on first write.

An `OPENAI_API_KEY` is only needed for the analysis and CV extraction endpoints. Everything else, including the ranking table and the pipeline board, runs on the sample data without one.

Python 3.9 runs this fine despite the note above, which is what the original environment used.
