const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Response question configuration
export interface ResponseQuestion {
  key: string;
  label: string;
  description: string;
}

export const DEFAULT_RESPONSE_QUESTIONS: ResponseQuestion[] = [
  { key: 'introduction', label: 'Introduction & Motivation', description: 'Clarity, relevance to role, genuine motivation' },
  { key: 'passion_description', label: 'Passion / Expertise', description: 'Depth of interest, specific examples, enthusiasm' },
  { key: 'self_learning', label: 'Self-Learning Initiatives', description: 'Concrete examples, initiative, growth mindset' },
];

// Job types
export type JobStatus = 'draft' | 'open' | 'closed';

export interface Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  company_name: string;
  position_title: string;
  trafft_booking_link: string | null;
  sender_name: string;
  sender_email: string | null;
  drive_folder_id: string | null;
  drive_folder_name: string | null;
  sheet_spreadsheet_id: string | null;
  sheet_spreadsheet_name: string | null;
  sheet_column_mapping: ColumnMapping | null;
  response_questions: ResponseQuestion[];
  created_at: string;
  updated_at: string;
  candidate_count: number;
  analyzed_count: number;
}

export interface JobCreate {
  title: string;
  description?: string;
  status?: JobStatus;
  company_name?: string;
  position_title?: string;
  trafft_booking_link?: string;
  sender_name?: string;
  sender_email?: string;
  drive_folder_id?: string;
  drive_folder_name?: string;
  sheet_spreadsheet_id?: string;
  sheet_spreadsheet_name?: string;
  sheet_column_mapping?: ColumnMapping;
  response_questions?: ResponseQuestion[];
}

export interface JobUpdate {
  title?: string;
  description?: string;
  status?: JobStatus;
  company_name?: string;
  position_title?: string;
  trafft_booking_link?: string;
  sender_name?: string;
  sender_email?: string;
  drive_folder_id?: string;
  drive_folder_name?: string;
  sheet_spreadsheet_id?: string;
  sheet_spreadsheet_name?: string;
  sheet_column_mapping?: ColumnMapping;
  response_questions?: ResponseQuestion[];
}

// Application types
export interface ApplicationInfo {
  application_id: string;
  job_id: string;
  job_title: string;
  pipeline_stage: string;
  analyzed: boolean;
  overall_score: number | null;
}

export interface Candidate {
  id: string;
  name: string | null;
  email: string | null;
  filename: string;
  file_type: string;
  analyzed: boolean;
  created_at: string;
  overall_score: number | null;
  recommendation: string | null;
  emails_sent: number;
  pipeline_stage?: PipelineStage;
}

export interface CandidateDetail {
  id: string;
  filename: string;
  file_type: string;
  raw_text: string;
  extracted_data: ExtractedData | null;
  application_responses: ApplicationResponses | null;
  analyzed: boolean;
  created_at: string;
  analysis: Analysis | null;
  drive_file_id: string | null;
}

export interface ExtractedData {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  certifications: string[];
  languages: string[];
}

export interface Experience {
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  duration_months: number | null;
  description: string | null;
}

export interface Education {
  institution: string;
  degree: string | null;
  field: string | null;
  graduation_year: number | null;
}

export interface Project {
  name: string;
  description: string | null;
  technologies: string[];
}

export type ApplicationResponses = Record<string, string | null>;

export interface Analysis {
  id: string;
  candidate_id: string;
  score: CandidateScore;
  analyzed_at: string;
  llm_model: string;
}

export interface CandidateScore {
  overall_score: number;
  job_match_score: JobMatchScore;
  screening_score: ScreeningScore;
  response_score: ResponseScore;
  red_flags: string[];
  green_flags: string[];
  summary: string | null;
  recommendation: string | null;
}

export interface JobMatchScore {
  score: number;
  years_experience: number;
  skills_matched: string[];
  skills_missing: string[];
  notes: string | null;
}

export interface ScreeningScore {
  score: number;
  career_gaps: CareerGap[];
  has_significant_gaps: boolean;
  avg_tenure_months: number;
  spelling_errors: number;
  grammar_issues: number;
  project_complexity: number;
  university_tier: string | null;
  notes: string | null;
}

export interface CareerGap {
  start_date: string;
  end_date: string;
  duration_months: number;
  description: string | null;
}

export interface ResponseScore {
  score: number;
  dimension_scores: Record<string, number>;
  // Legacy fields for old data
  introduction_quality?: number;
  passion_depth?: number;
  self_learning_quality?: number;
  notes: string | null;
}

export interface Stats {
  total_candidates: number;
  analyzed_candidates: number;
  pending_analysis: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
}

export interface DriveStatus {
  connected: boolean;
  auth_url: string | null;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mime_type: string;
  created_time: string | null;
  size: number | null;
}

export interface SyncPreview {
  total_files: number;
  new_files: number;
  already_synced: number;
  file_names: string[];
}

export interface SyncResult {
  total_files: number;
  processed: number;
  skipped: number;
  errors: string[];
}

export interface BatchProgress {
  total: number;
  completed: number;
  in_progress: boolean;
  current_candidate: string | null;
  errors: string[];
}

export interface SpreadsheetItem {
  id: string;
  name: string;
  modified_time: string | null;
}

export interface SheetHeaders {
  headers: string[];
  total_rows: number;
}

export interface ColumnMapping {
  name_column?: number | null;
  email_column?: number | null;
  cv_link_column: number;
  question_columns?: Record<string, number>;
  // Legacy fields for backward compat
  introduction_column?: number;
  passion_column?: number;
  self_learning_column?: number;
}

export interface SheetSyncResult {
  total_rows: number;
  processed: number;
  skipped: number;
  errors: string[];
}

export interface JobDriveSyncResult {
  total_files: number;
  processed: number;
  skipped: number;
  errors: string[];
  linked: number;
  already_linked: number;
}

export interface JobSheetSyncResult {
  total_rows: number;
  processed: number;
  skipped: number;
  errors: string[];
  linked: number;
  already_linked: number;
}

export interface SuggestedQuestion {
  key: string;
  label: string;
  description: string;
  header_index: number;
}

export interface HeaderAnalysisResult {
  name_column: number | null;
  email_column: number | null;
  cv_link_column: number | null;
  questions: SuggestedQuestion[];
}

// Pipeline types
export type PipelineStage =
  | 'applied'
  | 'screened'
  | 'interview_invited'
  | 'interview_scheduled'
  | 'interview_done'
  | 'offer'
  | 'hired'
  | 'rejected';

export interface PipelineCandidate {
  id: string;
  name: string | null;
  email: string | null;
  filename: string;
  analyzed: boolean;
  pipeline_stage: PipelineStage;
  overall_score: number | null;
  recommendation: string | null;
  emails_sent: number;
}

export interface StageData {
  stage: PipelineStage;
  label: string;
  candidates: PipelineCandidate[];
}

export interface StageChange {
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
}

export interface MoveResult {
  success: boolean;
  candidate_id: string;
  pipeline_stage: string;
}

export interface BulkMoveResult {
  total: number;
  success: number;
  failed: number;
  results: Record<string, string>;
}

// Email types
export type EmailType = 'interview_invitation' | 'rejection' | 'follow_up' | 'custom';

export interface EmailTemplate {
  id: string;
  name: string;
  email_type: EmailType;
  subject_template: string;
  body_template: string;
  is_system: boolean;
}

export interface SentEmail {
  id: string;
  candidate_id: string;
  email_type: EmailType;
  subject: string;
  body: string;
  to_address: string;
  sent_at: string;
  gmail_thread_id: string | null;
  reply_status: 'no_reply' | 'replied' | 'bounced';
  reply_count: number;
}

export interface ThreadMessage {
  id: string;
  from_address: string;
  to_address: string;
  subject: string;
  body: string;
  timestamp: string;
  is_outbound: boolean;
}

export interface EmailThread {
  thread_id: string;
  messages: ThreadMessage[];
}

export interface EmailPreview {
  subject: string;
  body: string;
}

export interface SendEmailResult {
  email_id: string;
  message_id: string;
  thread_id: string;
  sent_at: string;
}

export interface CheckRepliesResult {
  checked: number;
  new_replies: number;
  errors: string[];
}

// Recruitment settings
export interface RecruitmentSettings {
  trafft_booking_link: string | null;
  company_name: string;
  position_title: string;
  sender_name: string;
  sender_email: string | null;
}

export interface ScoringConfig {
  job_match_weight: number;
  screening_weight: number;
  response_weight: number;
  career_gap_threshold_months: number;
  career_gap_deduction: number;
  min_tenure_months: number;
  tenure_deduction: number;
  spelling_deduction: number;
  strong_yes_threshold: number;
  yes_threshold: number;
  maybe_threshold: number;
  default_response_questions: ResponseQuestion[];
}

export interface OAuthStatus {
  connected: boolean;
  has_drive_scope: boolean;
  has_sheets_scope: boolean;
  has_gmail_send_scope: boolean;
  has_gmail_read_scope: boolean;
  needs_reauth: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Request failed');
    }

    return response.json();
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    return this.request<Job[]>('/api/jobs');
  }

  async getJob(id: string): Promise<Job> {
    return this.request<Job>(`/api/jobs/${id}`);
  }

  async createJob(data: JobCreate): Promise<Job> {
    return this.request<Job>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJob(id: string, data: JobUpdate): Promise<Job> {
    return this.request<Job>(`/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteJob(id: string): Promise<void> {
    await this.request(`/api/jobs/${id}`, { method: 'DELETE' });
  }

  async applyToJob(jobId: string, candidateId: string): Promise<{ application_id: string }> {
    return this.request(`/api/jobs/${jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId }),
    });
  }

  async bulkApplyToJob(jobId: string, candidateIds: string[]): Promise<{ created: number; skipped: number }> {
    return this.request(`/api/jobs/${jobId}/apply-bulk`, {
      method: 'POST',
      body: JSON.stringify({ candidate_ids: candidateIds }),
    });
  }

  async getJobCandidates(jobId: string): Promise<Candidate[]> {
    return this.request<Candidate[]>(`/api/jobs/${jobId}/candidates`);
  }

  async getJobStats(jobId: string): Promise<Stats> {
    return this.request<Stats>(`/api/jobs/${jobId}/stats`);
  }

  async previewDriveSyncForJob(jobId: string): Promise<SyncPreview> {
    return this.request<SyncPreview>(`/api/jobs/${jobId}/sync-drive/preview`, {
      method: 'POST',
    });
  }

  async syncDriveForJob(jobId: string): Promise<JobDriveSyncResult> {
    return this.request<JobDriveSyncResult>(`/api/jobs/${jobId}/sync-drive`, {
      method: 'POST',
    });
  }

  async syncSheetForJob(jobId: string): Promise<JobSheetSyncResult> {
    return this.request<JobSheetSyncResult>(`/api/jobs/${jobId}/sync-sheet`, {
      method: 'POST',
    });
  }

  // Candidates
  async getCandidates(jobId?: string): Promise<Candidate[]> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request<Candidate[]>(`/api/candidates${query}`);
  }

  async getCandidate(id: string, jobId?: string): Promise<CandidateDetail> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request<CandidateDetail>(`/api/candidates/${id}${query}`);
  }

  async getCandidateApplications(id: string): Promise<ApplicationInfo[]> {
    return this.request<ApplicationInfo[]>(`/api/candidates/${id}/applications`);
  }

  async getStats(jobId?: string): Promise<Stats> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request<Stats>(`/api/candidates/stats${query}`);
  }

  async uploadCV(file: File): Promise<Candidate> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/api/candidates/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  async deleteCandidate(id: string): Promise<void> {
    await this.request(`/api/candidates/${id}`, { method: 'DELETE' });
  }

  async updateApplicationResponses(
    id: string,
    responses: ApplicationResponses,
    jobId?: string
  ): Promise<void> {
    const query = jobId ? `?job_id=${jobId}` : '';
    await this.request(`/api/candidates/${id}/responses${query}`, {
      method: 'PUT',
      body: JSON.stringify(responses),
    });
  }

  async extractCVData(id: string): Promise<{ data: ExtractedData }> {
    return this.request(`/api/candidates/${id}/extract`, { method: 'POST' });
  }

  // Analysis
  async analyzeCandidate(id: string, jobId?: string): Promise<Analysis> {
    return this.request<Analysis>(`/api/analysis/${id}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId || '' }),
    });
  }

  async getCandidateAnalysis(id: string, jobId?: string): Promise<Analysis> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request<Analysis>(`/api/analysis/candidate/${id}${query}`);
  }

  async startBatchAnalysis(candidateIds?: string[], jobId?: string): Promise<{ total: number }> {
    return this.request('/api/analysis/batch', {
      method: 'POST',
      body: JSON.stringify({ candidate_ids: candidateIds, job_id: jobId || '' }),
    });
  }

  async getBatchProgress(): Promise<BatchProgress> {
    return this.request<BatchProgress>('/api/analysis/batch/progress');
  }

  async cancelBatchAnalysis(): Promise<void> {
    await this.request('/api/analysis/batch/cancel', { method: 'POST' });
  }

  // Google Drive
  async getDriveStatus(): Promise<DriveStatus> {
    return this.request<DriveStatus>('/api/drive/status');
  }

  async connectDrive(): Promise<{ auth_url: string }> {
    return this.request('/api/drive/connect');
  }

  async disconnectDrive(): Promise<void> {
    await this.request('/api/drive/disconnect', { method: 'POST' });
  }

  async getDriveFolders(): Promise<DriveFolder[]> {
    return this.request<DriveFolder[]>('/api/drive/folders');
  }

  async getDriveFiles(folderId?: string): Promise<DriveFile[]> {
    const query = folderId ? `?folder_id=${folderId}` : '';
    return this.request<DriveFile[]>(`/api/drive/files${query}`);
  }

  async syncDrivePreview(folderId?: string): Promise<SyncPreview> {
    const query = folderId ? `?folder_id=${folderId}` : '';
    return this.request<SyncPreview>(`/api/drive/sync/preview${query}`, {
      method: 'POST',
    });
  }

  async syncDrive(folderId?: string): Promise<SyncResult> {
    const query = folderId ? `?folder_id=${folderId}` : '';
    return this.request<SyncResult>(`/api/drive/sync${query}`, {
      method: 'POST',
    });
  }

  // Google Sheets
  async getSpreadsheets(): Promise<SpreadsheetItem[]> {
    return this.request<SpreadsheetItem[]>('/api/sheets/list');
  }

  async getSheetHeaders(spreadsheetId: string): Promise<SheetHeaders> {
    return this.request<SheetHeaders>(`/api/sheets/${spreadsheetId}/headers`);
  }

  async syncFromSheet(spreadsheetId: string, mapping: ColumnMapping): Promise<SheetSyncResult> {
    return this.request<SheetSyncResult>(`/api/sheets/${spreadsheetId}/sync`, {
      method: 'POST',
      body: JSON.stringify({ mapping }),
    });
  }

  async analyzeSheetHeaders(
    headers: string[],
    jobTitle?: string,
    jobDescription?: string
  ): Promise<HeaderAnalysisResult> {
    return this.request<HeaderAnalysisResult>('/api/sheets/analyze-headers', {
      method: 'POST',
      body: JSON.stringify({
        headers,
        job_title: jobTitle || null,
        job_description: jobDescription || null,
      }),
    });
  }

  // Settings
  async getJobDescription(): Promise<{ content: string }> {
    return this.request<{ content: string }>('/api/settings/job-description');
  }

  async updateJobDescription(content: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/settings/job-description', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  // Health
  async healthCheck(): Promise<{
    status: string;
    openai_configured: boolean;
    google_configured: boolean;
  }> {
    return this.request('/health');
  }

  // Pipeline
  async getPipelineStages(jobId?: string): Promise<StageData[]> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request<StageData[]>(`/api/pipeline/stages${query}`);
  }

  async getPipelineStats(jobId?: string): Promise<Record<PipelineStage, number>> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request(`/api/pipeline/stats${query}`);
  }

  async moveCandidate(
    candidateId: string,
    toStage: PipelineStage,
    jobId?: string,
    notes?: string,
    force?: boolean
  ): Promise<MoveResult> {
    return this.request(`/api/pipeline/candidates/${candidateId}/move`, {
      method: 'POST',
      body: JSON.stringify({ to_stage: toStage, job_id: jobId || '', notes, force }),
    });
  }

  async bulkMoveCandidates(
    candidateIds: string[],
    toStage: PipelineStage,
    jobId?: string,
    notes?: string,
    force?: boolean
  ): Promise<BulkMoveResult> {
    return this.request('/api/pipeline/bulk-move', {
      method: 'POST',
      body: JSON.stringify({ candidate_ids: candidateIds, to_stage: toStage, job_id: jobId || '', notes, force }),
    });
  }

  async getCandidateHistory(candidateId: string, jobId?: string): Promise<StageChange[]> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request<StageChange[]>(`/api/pipeline/candidates/${candidateId}/history${query}`);
  }

  async getValidTransitions(
    candidateId: string,
    jobId?: string
  ): Promise<{ current_stage: string; valid_transitions: string[] }> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request(`/api/pipeline/candidates/${candidateId}/transitions${query}`);
  }

  // Email Templates
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return this.request<EmailTemplate[]>('/api/email/templates');
  }

  async createEmailTemplate(
    name: string,
    emailType: EmailType,
    subjectTemplate: string,
    bodyTemplate: string
  ): Promise<EmailTemplate> {
    return this.request('/api/email/templates', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email_type: emailType,
        subject_template: subjectTemplate,
        body_template: bodyTemplate,
      }),
    });
  }

  async updateEmailTemplate(
    templateId: string,
    updates: { name?: string; subject_template?: string; body_template?: string }
  ): Promise<EmailTemplate> {
    return this.request(`/api/email/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteEmailTemplate(templateId: string): Promise<void> {
    await this.request(`/api/email/templates/${templateId}`, { method: 'DELETE' });
  }

  // Email Operations
  async previewEmail(candidateId: string, templateId: string, jobId?: string): Promise<EmailPreview> {
    return this.request('/api/email/preview', {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId, template_id: templateId, job_id: jobId || '' }),
    });
  }

  async generateEmail(candidateId: string, emailType: EmailType, jobId?: string): Promise<EmailPreview> {
    return this.request('/api/email/generate', {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId, email_type: emailType, job_id: jobId || '' }),
    });
  }

  async sendEmail(
    candidateId: string,
    emailType: EmailType,
    subject: string,
    body: string,
    jobId?: string,
    templateId?: string
  ): Promise<SendEmailResult> {
    return this.request('/api/email/send', {
      method: 'POST',
      body: JSON.stringify({
        candidate_id: candidateId,
        job_id: jobId || '',
        email_type: emailType,
        subject,
        body,
        template_id: templateId,
      }),
    });
  }

  async getCandidateEmails(candidateId: string, jobId?: string): Promise<SentEmail[]> {
    const query = jobId ? `?job_id=${jobId}` : '';
    return this.request<SentEmail[]>(`/api/email/candidates/${candidateId}/emails${query}`);
  }

  async getEmailThread(emailId: string): Promise<EmailThread> {
    return this.request<EmailThread>(`/api/email/emails/${emailId}/thread`);
  }

  async checkReplies(): Promise<CheckRepliesResult> {
    return this.request('/api/email/check-replies', { method: 'POST' });
  }

  // Recruitment Settings
  async getRecruitmentSettings(): Promise<RecruitmentSettings> {
    return this.request<RecruitmentSettings>('/api/settings/recruitment');
  }

  async updateRecruitmentSettings(settings: RecruitmentSettings): Promise<{ message: string }> {
    return this.request('/api/settings/recruitment', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Scoring Config
  async getScoringConfig(): Promise<ScoringConfig> {
    return this.request<ScoringConfig>('/api/settings/scoring');
  }

  async updateScoringConfig(config: ScoringConfig): Promise<{ message: string }> {
    return this.request('/api/settings/scoring', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async getOAuthStatus(): Promise<OAuthStatus> {
    return this.request<OAuthStatus>('/api/settings/oauth/status');
  }
}

export const api = new ApiClient(API_URL);
