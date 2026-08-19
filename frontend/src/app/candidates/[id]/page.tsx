'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, CandidateDetail, StageChange, SentEmail, PipelineStage, ApplicationInfo, DEFAULT_RESPONSE_QUESTIONS, Job } from '@/lib/api';
import ScoreDisplay from '@/components/ScoreDisplay';
import StageHistoryTimeline from '@/components/StageHistoryTimeline';
import EmailComposer from '@/components/EmailComposer';
import EmailThread from '@/components/EmailThread';

function CandidateDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'raw' | 'responses' | 'pipeline' | 'communications' | 'applications'>('overview');

  // Job context from query params
  const jobId = searchParams.get('job_id') || undefined;

  // Job context for response questions
  const [jobData, setJobData] = useState<Job | null>(null);

  // Applications
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);

  // Pipeline state
  const [stageHistory, setStageHistory] = useState<StageChange[]>([]);
  const [validTransitions, setValidTransitions] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState<string>('applied');
  const [movingStage, setMovingStage] = useState(false);

  // Email state
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);

  const candidateId = params.id as string;

  const fetchCandidate = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCandidate(candidateId, jobId);
      setCandidate(data);
      const [historyData, transitionsData, emailsData, appsData, jobDataResult] = await Promise.all([
        api.getCandidateHistory(candidateId, jobId).catch(() => []),
        api.getValidTransitions(candidateId, jobId).catch(() => ({ current_stage: 'applied', valid_transitions: [] })),
        api.getCandidateEmails(candidateId, jobId).catch(() => []),
        api.getCandidateApplications(candidateId).catch(() => []),
        jobId ? api.getJob(jobId).catch(() => null) : Promise.resolve(null),
      ]);
      setStageHistory(historyData);
      setValidTransitions(transitionsData.valid_transitions);
      setCurrentStage(transitionsData.current_stage);
      setEmails(emailsData);
      setApplications(appsData);
      setJobData(jobDataResult);
    } catch {
      setError('Failed to load candidate');
    } finally {
      setLoading(false);
    }
  }, [candidateId, jobId]);

  useEffect(() => {
    if (candidateId) {
      fetchCandidate();
    }
  }, [candidateId, fetchCandidate]);

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      await api.analyzeCandidate(candidateId, jobId);
      await fetchCandidate();
    } catch {
      setError('Failed to analyze candidate');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;

    try {
      await api.deleteCandidate(candidateId);
      router.push('/candidates');
    } catch {
      setError('Failed to delete candidate');
    }
  };

  const handleMoveStage = async (toStage: PipelineStage) => {
    setMovingStage(true);
    try {
      await api.moveCandidate(candidateId, toStage, jobId);
      const [transitionsData, historyData] = await Promise.all([
        api.getValidTransitions(candidateId, jobId),
        api.getCandidateHistory(candidateId, jobId),
      ]);
      setValidTransitions(transitionsData.valid_transitions);
      setCurrentStage(transitionsData.current_stage);
      setStageHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move candidate');
    } finally {
      setMovingStage(false);
    }
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    try {
      await api.checkReplies();
      const emailsData = await api.getCandidateEmails(candidateId, jobId);
      setEmails(emailsData);
    } catch {
      // Silent fail
    } finally {
      setCheckingReplies(false);
    }
  };

  const handleEmailSent = async () => {
    setShowComposer(false);
    const emailsData = await api.getCandidateEmails(candidateId, jobId);
    setEmails(emailsData);
    const transitionsData = await api.getValidTransitions(candidateId, jobId);
    setValidTransitions(transitionsData.valid_transitions);
    setCurrentStage(transitionsData.current_stage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="alert-error">
        {error || 'Candidate not found'}
      </div>
    );
  }

  const extractedData = candidate.extracted_data;
  const analysis = candidate.analysis;

  const STAGE_LABELS: Record<string, string> = {
    applied: 'Applied',
    screened: 'Screened',
    interview_invited: 'Interview Invited',
    interview_scheduled: 'Interview Scheduled',
    interview_done: 'Interview Done',
    offer: 'Offer',
    hired: 'Hired',
    rejected: 'Rejected',
  };

  const STAGE_BADGE: Record<string, string> = {
    applied: 'badge-zinc',
    screened: 'badge-sky',
    interview_invited: 'badge-indigo',
    interview_scheduled: 'badge-violet',
    interview_done: 'badge-teal',
    offer: 'badge-amber',
    hired: 'badge-emerald',
    rejected: 'badge-rose',
  };

  const tabs = ['overview', 'raw', 'responses', 'pipeline', 'communications', 'applications'] as const;

  const candidateName = extractedData?.name || 'Unknown Candidate';
  const initials = candidateName
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={jobId ? `/jobs/${jobId}` : '/candidates'}
            className="text-sm text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 transition-colors"
          >
            ← {jobId ? 'Back to job' : 'Back to candidates'}
          </Link>
          <div className="flex items-center gap-4 mt-1">
            <div className="avatar avatar-lg bg-indigo-50 text-indigo-600">
              {initials}
            </div>
            <div>
              <h1 className="page-title">
                {candidateName}
              </h1>
              <p className="text-muted-foreground mt-0.5">
                {extractedData?.email || candidate.filename}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className={STAGE_BADGE[currentStage] || 'badge-zinc'}>
              {STAGE_LABELS[currentStage] || currentStage}
            </span>
            {candidate.drive_file_id && (
              <a
                href={`https://drive.google.com/file/d/${candidate.drive_file_id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="link-primary inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View CV
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!candidate.analyzed && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="btn-primary"
            >
              {analyzing ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Analyzing...
                </>
              ) : 'Analyze'}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="btn-danger"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'tab-active' : 'tab'}
          >
            {tab === 'raw' ? 'Raw Text' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'communications' && emails.length > 0 && (
              <span className="ml-2 badge-zinc text-[10px]">
                {emails.length}
              </span>
            )}
            {tab === 'applications' && applications.length > 0 && (
              <span className="ml-2 badge-zinc text-[10px]">
                {applications.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && extractedData && (
            <>
              {/* Contact Info */}
              <div className="card p-6">
                <h2 className="section-title mb-4">Contact Information</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium text-foreground">{extractedData.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <p className="font-medium text-foreground">{extractedData.location || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Skills */}
              {extractedData.skills.length > 0 && (
                <div className="card p-6">
                  <h2 className="section-title mb-4">Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {extractedData.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="badge-indigo"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {extractedData.experience.length > 0 && (
                <div className="card p-6">
                  <h2 className="section-title mb-4">Experience</h2>
                  <div className="space-y-4">
                    {extractedData.experience.map((exp, i) => (
                      <div key={i} className="border-l-2 border-indigo-200 pl-4">
                        <h3 className="font-medium text-foreground">{exp.title}</h3>
                        <p className="text-foreground">{exp.company}</p>
                        <p className="text-sm text-muted-foreground">
                          {exp.start_date || '?'} - {exp.end_date || 'Present'}
                          {exp.duration_months && ` (${exp.duration_months} months)`}
                        </p>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground mt-2">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {extractedData.education.length > 0 && (
                <div className="card p-6">
                  <h2 className="section-title mb-4">Education</h2>
                  <div className="space-y-3">
                    {extractedData.education.map((edu, i) => (
                      <div key={i}>
                        <h3 className="font-medium text-foreground">{edu.institution}</h3>
                        <p className="text-foreground">
                          {edu.degree} {edu.field && `in ${edu.field}`}
                        </p>
                        {edu.graduation_year && (
                          <p className="text-sm text-muted-foreground">
                            Graduated: {edu.graduation_year}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {extractedData.projects.length > 0 && (
                <div className="card p-6">
                  <h2 className="section-title mb-4">Projects</h2>
                  <div className="space-y-4">
                    {extractedData.projects.map((project, i) => (
                      <div key={i}>
                        <h3 className="font-medium text-foreground">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-muted-foreground">{project.description}</p>
                        )}
                        {project.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {project.technologies.map((tech, j) => (
                              <span
                                key={j}
                                className="badge-zinc text-[11px]"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'raw' && (
            <div className="card p-6">
              <h2 className="section-title mb-4">Raw CV Text</h2>
              <pre className="whitespace-pre-wrap text-sm text-foreground bg-muted p-4 rounded-lg overflow-auto max-h-[600px] font-mono">
                {candidate.raw_text}
              </pre>
            </div>
          )}

          {activeTab === 'responses' && (() => {
            const responses = candidate.application_responses;
            // Build a label lookup from job questions and defaults
            const allQuestions = [
              ...(jobData?.response_questions || []),
              ...DEFAULT_RESPONSE_QUESTIONS,
            ];
            const labelMap: Record<string, string> = {};
            for (const q of allQuestions) {
              if (!labelMap[q.key]) labelMap[q.key] = q.label;
            }
            return (
              <div className="card p-6">
                <h2 className="section-title mb-4">Application Responses</h2>
                {responses && Object.keys(responses).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(responses).map(([key, value]) => (
                      <div key={key}>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                          {labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </h3>
                        <p className="text-foreground whitespace-pre-line">
                          {value || 'Not provided'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No application responses recorded.</p>
                )}
              </div>
            );
          })()}

          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              {/* Stage Actions */}
              <div className="card p-6">
                <h2 className="section-title mb-4">Move to Stage</h2>
                <div className="flex flex-wrap gap-2">
                  {validTransitions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No available transitions from this stage.</p>
                  ) : (
                    validTransitions.map((stage) => (
                      <button
                        key={stage}
                        onClick={() => handleMoveStage(stage as PipelineStage)}
                        disabled={movingStage}
                        className={
                          stage === 'rejected'
                            ? 'btn-danger'
                            : stage === 'hired'
                            ? 'btn-success'
                            : 'btn-secondary'
                        }
                      >
                        {movingStage ? (
                          <div className="spinner w-4 h-4" />
                        ) : (STAGE_LABELS[stage] || stage)}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Stage History */}
              <div className="card p-6">
                <StageHistoryTimeline history={stageHistory} currentStage={currentStage} />
              </div>
            </div>
          )}

          {activeTab === 'communications' && (
            <div className="space-y-6">
              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowComposer(true)}
                  disabled={!extractedData?.email}
                  className="btn-primary"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Email
                </button>
                <button
                  onClick={handleCheckReplies}
                  disabled={checkingReplies || emails.length === 0}
                  className="btn-secondary"
                >
                  {checkingReplies ? (
                    <div className="spinner w-4 h-4" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {checkingReplies ? 'Checking...' : 'Check for Replies'}
                </button>
              </div>

              {!extractedData?.email && (
                <div className="alert-warning">
                  This candidate does not have an email address. Extract CV data first to send emails.
                </div>
              )}

              {/* Email Composer */}
              {showComposer && candidate && (
                <EmailComposer
                  candidate={candidate}
                  onSent={handleEmailSent}
                  onCancel={() => setShowComposer(false)}
                  jobId={jobId}
                />
              )}

              {/* Email List */}
              {emails.length === 0 ? (
                <div className="card empty-state">
                  <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="empty-state-desc">No emails sent yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {emails.map((email) => (
                    <EmailThread key={email.id} email={email} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-4">
              <h2 className="section-title">Job Applications</h2>
              {applications.length === 0 ? (
                <div className="card empty-state">
                  <p className="empty-state-desc">Not applied to any jobs yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <Link
                      key={app.application_id}
                      href={`/candidates/${candidateId}?job_id=${app.job_id}`}
                      className={`block card-interactive p-4 ${
                        jobId === app.job_id ? 'border-indigo-300 bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">{app.job_title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={STAGE_BADGE[app.pipeline_stage] || 'badge-zinc'}>
                              {STAGE_LABELS[app.pipeline_stage] || app.pipeline_stage}
                            </span>
                            {app.analyzed && (
                              <span className="badge-zinc">
                                Analyzed
                              </span>
                            )}
                          </div>
                        </div>
                        {app.overall_score !== null && (
                          <span className={`text-2xl font-bold font-mono ${
                            app.overall_score >= 80 ? 'text-emerald-600' :
                            app.overall_score >= 60 ? 'text-amber-600' :
                            app.overall_score < 40 ? 'text-rose-600' :
                            'text-muted-foreground'
                          }`}>
                            {Math.round(app.overall_score)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Score */}
        <div className="lg:col-span-1">
          {analysis ? (
            <div className="card p-6 sticky top-6">
              <h2 className="section-title mb-4">Analysis Results</h2>
              <ScoreDisplay score={analysis.score} responseQuestions={jobData?.response_questions} />
            </div>
          ) : (
            <div className="card p-6 empty-state">
              <svg
                className="empty-state-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="empty-state-title">Not Analyzed</h3>
              <p className="empty-state-desc mb-4">
                Run analysis to see score breakdown and recommendations.
              </p>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="btn-primary w-full"
              >
                {analyzing ? (
                  <>
                    <div className="spinner w-4 h-4" />
                    Analyzing...
                  </>
                ) : 'Analyze Now'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CandidateDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner w-8 h-8" />
      </div>
    }>
      <CandidateDetailContent />
    </Suspense>
  );
}
