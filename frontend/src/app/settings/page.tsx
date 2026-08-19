'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, RecruitmentSettings, OAuthStatus, ScoringConfig, ResponseQuestion } from '@/lib/api';
import DriveConnector from '@/components/DriveConnector';

function SettingsContent() {
  const searchParams = useSearchParams();
  const [health, setHealth] = useState<{
    status: string;
    openai_configured: boolean;
    google_configured: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // OAuth status
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);

  // Recruitment settings state
  const [recruitmentSettings, setRecruitmentSettings] = useState<RecruitmentSettings>({
    trafft_booking_link: null,
    company_name: 'Your Company',
    position_title: 'Software Engineer',
    sender_name: 'HR Team',
    sender_email: null,
  });
  const [recruitmentLoading, setRecruitmentLoading] = useState(true);
  const [recruitmentSaving, setRecruitmentSaving] = useState(false);
  const [recruitmentMessage, setRecruitmentMessage] = useState<string | null>(null);

  // Scoring config state
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>({
    job_match_weight: 40,
    screening_weight: 40,
    response_weight: 20,
    career_gap_threshold_months: 6,
    career_gap_deduction: 8,
    min_tenure_months: 12,
    tenure_deduction: 8,
    spelling_deduction: 3,
    strong_yes_threshold: 80,
    yes_threshold: 65,
    maybe_threshold: 50,
    default_response_questions: [
      { key: 'introduction', label: 'Introduction & Motivation', description: 'Clarity, relevance to role, genuine motivation' },
      { key: 'passion_description', label: 'Passion / Expertise', description: 'Depth of interest, specific examples, enthusiasm' },
      { key: 'self_learning', label: 'Self-Learning Initiatives', description: 'Concrete examples, initiative, growth mindset' },
    ],
  });
  const [scoringLoading, setScoringLoading] = useState(true);
  const [scoringSaving, setScoringSaving] = useState(false);
  const [scoringMessage, setScoringMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await api.healthCheck();
        setHealth(data);
      } catch {
        setHealth(null);
      } finally {
        setLoading(false);
      }
    };

    const loadRecruitmentSettings = async () => {
      try {
        const data = await api.getRecruitmentSettings();
        setRecruitmentSettings(data);
      } catch {
        // Use defaults
      } finally {
        setRecruitmentLoading(false);
      }
    };

    const loadOAuthStatus = async () => {
      try {
        const data = await api.getOAuthStatus();
        setOauthStatus(data);
      } catch {
        // Ignore
      }
    };

    const loadScoringConfig = async () => {
      try {
        const data = await api.getScoringConfig();
        setScoringConfig(data);
      } catch {
        // Use defaults
      } finally {
        setScoringLoading(false);
      }
    };

    checkHealth();
    loadRecruitmentSettings();
    loadOAuthStatus();
    loadScoringConfig();
  }, []);

  const handleSaveRecruitmentSettings = async () => {
    try {
      setRecruitmentSaving(true);
      setRecruitmentMessage(null);
      await api.updateRecruitmentSettings(recruitmentSettings);
      setRecruitmentMessage('Recruitment settings saved successfully.');
      setTimeout(() => setRecruitmentMessage(null), 3000);
    } catch {
      setRecruitmentMessage('Failed to save recruitment settings.');
    } finally {
      setRecruitmentSaving(false);
    }
  };

  const weightsSum = scoringConfig.job_match_weight + scoringConfig.screening_weight + scoringConfig.response_weight;

  const handleSaveScoringConfig = async () => {
    if (weightsSum !== 100) {
      setScoringMessage(`Weights must sum to 100 (currently ${weightsSum}).`);
      return;
    }
    try {
      setScoringSaving(true);
      setScoringMessage(null);
      await api.updateScoringConfig(scoringConfig);
      setScoringMessage('Scoring configuration saved successfully.');
      setTimeout(() => setScoringMessage(null), 3000);
    } catch {
      setScoringMessage('Failed to save scoring configuration.');
    } finally {
      setScoringSaving(false);
    }
  };

  const handleAddQuestion = () => {
    const key = `question_${Date.now()}`;
    setScoringConfig({
      ...scoringConfig,
      default_response_questions: [
        ...scoringConfig.default_response_questions,
        { key, label: 'New Question', description: 'Description of what to evaluate' },
      ],
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setScoringConfig({
      ...scoringConfig,
      default_response_questions: scoringConfig.default_response_questions.filter((_, i) => i !== index),
    });
  };

  const handleUpdateQuestion = (index: number, field: keyof ResponseQuestion, value: string) => {
    const updated = [...scoringConfig.default_response_questions];
    updated[index] = { ...updated[index], [field]: value };
    setScoringConfig({ ...scoringConfig, default_response_questions: updated });
  };

  const connected = searchParams.get('connected');
  const error = searchParams.get('error');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your CV screening agent</p>
      </div>

      {connected === 'true' && (
        <div className="alert-success">
          Successfully connected to Google Drive!
        </div>
      )}

      {error && (
        <div className="alert-error">
          Connection error: {error}
        </div>
      )}

      <div className="space-y-8">
        {/* System Status */}
        <div className="card p-6">
          <h2 className="section-title mb-4">System Status</h2>
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="spinner w-4 h-4" />
              <span className="text-muted-foreground">Checking status...</span>
            </div>
          ) : health ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-foreground">Backend Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-emerald-600 font-medium">{health.status}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">OpenAI API</span>
                {health.openai_configured ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-600 font-medium">Configured</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-sm text-rose-600 font-medium">Not Configured</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">Google OAuth</span>
                {health.google_configured ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-600 font-medium">Configured</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-sm text-rose-600 font-medium">Not Configured</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="alert-error">
              Failed to connect to backend. Make sure the server is running on{' '}
              <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-800 text-sm">http://localhost:8000</code>
            </div>
          )}
        </div>

        {/* OAuth Status / Gmail Scopes */}
        {oauthStatus && (
          <div className="card p-6">
            <h2 className="section-title mb-4">API Permissions</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-foreground">Google Drive (Read)</span>
                {oauthStatus.has_drive_scope ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-600 font-medium">Authorized</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    <span className="text-sm text-muted-foreground font-medium">Not Authorized</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">Google Sheets (Read)</span>
                {oauthStatus.has_sheets_scope ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-600 font-medium">Authorized</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    <span className="text-sm text-muted-foreground font-medium">Not Authorized</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">Gmail (Send)</span>
                {oauthStatus.has_gmail_send_scope ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-600 font-medium">Authorized</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">Re-authorization Required</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">Gmail (Read)</span>
                {oauthStatus.has_gmail_read_scope ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-600 font-medium">Authorized</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">Re-authorization Required</span>
                  </div>
                )}
              </div>
            </div>
            {oauthStatus.needs_reauth && (
              <div className="alert-warning mt-4">
                Gmail permissions are required to send emails. Please re-authorize Google below to grant email access.
              </div>
            )}
          </div>
        )}

        {/* Recruitment Settings */}
        <div className="card p-6">
          <h2 className="section-title mb-1">
            Recruitment Settings
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure settings for email templates and candidate communications.
          </p>

          {recruitmentLoading ? (
            <div className="flex items-center gap-2">
              <div className="spinner w-4 h-4" />
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={recruitmentSettings.company_name}
                    onChange={(e) =>
                      setRecruitmentSettings({ ...recruitmentSettings, company_name: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Position Title
                  </label>
                  <input
                    type="text"
                    value={recruitmentSettings.position_title}
                    onChange={(e) =>
                      setRecruitmentSettings({ ...recruitmentSettings, position_title: e.target.value })
                    }
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={recruitmentSettings.sender_name}
                    onChange={(e) =>
                      setRecruitmentSettings({ ...recruitmentSettings, sender_name: e.target.value })
                    }
                    placeholder="e.g., HR Team, John Doe"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Trafft Booking Link
                  </label>
                  <input
                    type="url"
                    value={recruitmentSettings.trafft_booking_link || ''}
                    onChange={(e) =>
                      setRecruitmentSettings({
                        ...recruitmentSettings,
                        trafft_booking_link: e.target.value || null,
                      })
                    }
                    placeholder="https://your-trafft-link.com/booking"
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveRecruitmentSettings}
                  disabled={recruitmentSaving}
                  className="btn-primary"
                >
                  {recruitmentSaving ? (
                    <>
                      <div className="spinner w-4 h-4" />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
                {recruitmentMessage && (
                  <span
                    className={`text-sm ${
                      recruitmentMessage.includes('Failed') ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {recruitmentMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Job Descriptions */}
        <div className="card p-6">
          <h2 className="section-title mb-1">
            Job Descriptions
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Job descriptions are now managed per-job. Create and edit job postings from the Jobs page.
          </p>
          <a
            href="/jobs"
            className="btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M3 8a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            Manage Jobs
          </a>
        </div>

        {/* Google Drive Connection */}
        <div>
          <h2 className="section-title mb-4">
            Google Drive Integration
          </h2>
          <DriveConnector />
        </div>

        {/* Configuration Guide */}
        <div className="card p-6">
          <h2 className="section-title mb-4">
            Configuration Guide
          </h2>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h3 className="text-base font-medium text-foreground">Backend Setup</h3>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li>
                Copy{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground text-sm">.env.example</code> to{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground text-sm">.env</code> in the backend
                folder
              </li>
              <li>
                Add your OpenAI API key:{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground text-sm">OPENAI_API_KEY=sk-...</code>
              </li>
              <li>Configure Google OAuth credentials (see below)</li>
              <li>
                Run:{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground text-sm">
                  pip install -r requirements.txt && uvicorn app.main:app --reload
                </code>
              </li>
            </ol>

            <h3 className="text-base font-medium text-foreground">
              Google Cloud Setup
            </h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Go to{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-primary"
                >
                  Google Cloud Console
                </a>
              </li>
              <li>Create a new project or select existing</li>
              <li>
                Enable the <strong className="text-foreground">Google Drive API</strong>
              </li>
              <li>
                Enable the <strong className="text-foreground">Google Sheets API</strong>
              </li>
              <li>
                Enable the <strong className="text-foreground">Gmail API</strong> (required for email features)
              </li>
              <li>Configure OAuth consent screen (External, add test users)</li>
              <li>
                Create OAuth credentials (Web application), add redirect URI:{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground text-sm">
                  http://localhost:8000/api/drive/callback
                </code>
              </li>
              <li>Copy Client ID and Secret to your .env file</li>
            </ol>
          </div>
        </div>

        {/* Scoring Configuration */}
        <div className="card p-6">
          <h2 className="section-title mb-1">
            Scoring Configuration
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure how candidates are scored and evaluated.
          </p>

          {scoringLoading ? (
            <div className="flex items-center gap-2">
              <div className="spinner w-4 h-4" />
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Score Weights */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Score Weights</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Job Match %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoringConfig.job_match_weight}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, job_match_weight: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Screening %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoringConfig.screening_weight}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, screening_weight: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Response %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoringConfig.response_weight}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, response_weight: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                </div>
                {weightsSum !== 100 && (
                  <p className="text-sm text-rose-600 mt-2">Weights must sum to 100 (currently {weightsSum})</p>
                )}
                <div className="flex gap-2 mt-3">
                  <div className="flex-1">
                    <div className="w-full bg-muted rounded-full h-1.5 flex overflow-hidden">
                      <div className="bg-indigo-500 h-1.5" style={{ width: `${scoringConfig.job_match_weight}%` }} />
                      <div className="bg-violet-500 h-1.5" style={{ width: `${scoringConfig.screening_weight}%` }} />
                      <div className="bg-emerald-500 h-1.5" style={{ width: `${scoringConfig.response_weight}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Screening Criteria */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Screening Criteria</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Career Gap Threshold (months)</label>
                    <input
                      type="number"
                      min={1}
                      value={scoringConfig.career_gap_threshold_months}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, career_gap_threshold_months: parseInt(e.target.value) || 1 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Career Gap Deduction (pts)</label>
                    <input
                      type="number"
                      min={0}
                      value={scoringConfig.career_gap_deduction}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, career_gap_deduction: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Min Tenure (months)</label>
                    <input
                      type="number"
                      min={1}
                      value={scoringConfig.min_tenure_months}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, min_tenure_months: parseInt(e.target.value) || 1 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Tenure Deduction (pts)</label>
                    <input
                      type="number"
                      min={0}
                      value={scoringConfig.tenure_deduction}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, tenure_deduction: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Spelling Deduction (pts)</label>
                    <input
                      type="number"
                      min={0}
                      value={scoringConfig.spelling_deduction}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, spelling_deduction: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Recommendation Thresholds */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Recommendation Thresholds</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Strong Yes (&gt;=)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoringConfig.strong_yes_threshold}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, strong_yes_threshold: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Yes (&gt;=)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoringConfig.yes_threshold}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, yes_threshold: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Maybe (&gt;=)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoringConfig.maybe_threshold}
                      onChange={(e) => setScoringConfig({ ...scoringConfig, maybe_threshold: parseInt(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Default Response Questions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Default Response Questions</h3>
                  <button onClick={handleAddQuestion} className="btn-secondary text-xs">
                    + Add Question
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Fallback questions used when a job has no custom response questions defined.
                </p>
                <div className="space-y-3">
                  {scoringConfig.default_response_questions.map((q, i) => (
                    <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={q.key}
                          onChange={(e) => handleUpdateQuestion(i, 'key', e.target.value)}
                          className="input text-xs font-mono flex-1"
                          placeholder="key"
                        />
                        <button
                          onClick={() => handleRemoveQuestion(i)}
                          className="text-rose-500 hover:text-rose-700 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={q.label}
                        onChange={(e) => handleUpdateQuestion(i, 'label', e.target.value)}
                        className="input text-sm w-full"
                        placeholder="Label"
                      />
                      <input
                        type="text"
                        value={q.description}
                        onChange={(e) => handleUpdateQuestion(i, 'description', e.target.value)}
                        className="input text-sm w-full"
                        placeholder="Description"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveScoringConfig}
                  disabled={scoringSaving || weightsSum !== 100}
                  className="btn-primary"
                >
                  {scoringSaving ? (
                    <>
                      <div className="spinner w-4 h-4" />
                      Saving...
                    </>
                  ) : (
                    'Save Scoring Config'
                  )}
                </button>
                {scoringMessage && (
                  <span
                    className={`text-sm ${
                      scoringMessage.includes('Failed') || scoringMessage.includes('must')
                        ? 'text-rose-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {scoringMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner w-8 h-8" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
