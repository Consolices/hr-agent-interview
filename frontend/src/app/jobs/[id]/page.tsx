'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Job, JobUpdate, JobStatus, Candidate, StageData, BatchProgress } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import KanbanBoard from '@/components/KanbanBoard';
import JobDriveSync from '@/components/JobDriveSync';
import JobSheetSync from '@/components/JobSheetSync';

type Tab = 'description' | 'candidates' | 'pipeline' | 'settings';

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  open: { className: 'badge-emerald', label: 'Open' },
  draft: { className: 'badge-zinc', label: 'Draft' },
  closed: { className: 'badge-rose', label: 'Closed' },
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('candidates');

  // Candidates tab state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);

  // Pipeline tab state
  const [stages, setStages] = useState<StageData[]>([]);

  // Settings tab state
  const [editForm, setEditForm] = useState<JobUpdate>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const data = await api.getJob(jobId);
      setJob(data);
      setEditForm({
        title: data.title,
        description: data.description,
        status: data.status,
        company_name: data.company_name,
        position_title: data.position_title,
        trafft_booking_link: data.trafft_booking_link || '',
        sender_name: data.sender_name,
        sender_email: data.sender_email || '',
      });
      // response_questions now managed inside JobSheetSync
    } catch {
      setError('Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const fetchCandidates = useCallback(async () => {
    try {
      const data = await api.getJobCandidates(jobId);
      setCandidates(data);
    } catch {
      // Silent
    }
  }, [jobId]);

  const fetchStages = useCallback(async () => {
    try {
      const data = await api.getPipelineStages(jobId);
      setStages(data);
    } catch {
      // Silent
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
    fetchCandidates();
    fetchStages();
    // Check if a batch is already running (e.g. user navigated away and came back)
    api.getBatchProgress().then((p) => {
      if (p.in_progress) setBatchProgress(p);
    }).catch(() => {});
  }, [fetchJob, fetchCandidates, fetchStages]);

  // Poll for batch progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (batchProgress?.in_progress) {
      interval = setInterval(async () => {
        try {
          const progress = await api.getBatchProgress();
          setBatchProgress(progress);
          if (!progress.in_progress) {
            fetchCandidates();
            fetchStages();
          }
        } catch {
          // Silent
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [batchProgress?.in_progress, fetchCandidates, fetchStages]);

  const handleAnalyze = async (id: string) => {
    try {
      setAnalyzing(id);
      await api.analyzeCandidate(id, jobId);
      await fetchCandidates();
      await fetchStages();
    } catch {
      setError('Failed to analyze candidate');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleBatchAnalyze = async () => {
    try {
      const { total } = await api.startBatchAnalysis(undefined, jobId);
      if (total > 0) {
        setBatchProgress({ total, completed: 0, in_progress: true, current_candidate: null, errors: [] });
      }
    } catch {
      setError('Failed to start batch analysis');
    }
  };

  const handleCancelBatch = async () => {
    try {
      await api.cancelBatchAnalysis();
      setBatchProgress(null);
      fetchCandidates();
    } catch {
      setError('Failed to cancel batch analysis');
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await api.updateJob(jobId, {
        ...editForm,
        trafft_booking_link: editForm.trafft_booking_link || undefined,
        sender_email: editForm.sender_email || undefined,
      });
      setJob(updated);
      setSaveMessage('Settings saved successfully.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job? All applications will be removed.')) return;
    try {
      await api.deleteJob(jobId);
      router.push('/jobs');
    } catch {
      setError('Failed to delete job');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 spinner" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="alert-error">
        {error || 'Job not found'}
      </div>
    );
  }

  const status = STATUS_BADGE[job.status] || STATUS_BADGE.draft;
  const pendingCount = candidates.filter((c) => !c.analyzed).length;
  const analyzedCount = candidates.length - pendingCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/jobs"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 transition-colors"
          >
            &larr; Back to jobs
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="page-title">{job.title}</h1>
            <span className={status.className}>
              {status.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{job.company_name} &middot; {job.candidate_count} candidates</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'candidates' && pendingCount > 0 && !batchProgress?.in_progress && (
            <button
              onClick={handleBatchAnalyze}
              className="btn-success"
            >
              Analyze All ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="stat-label">Total Candidates</p>
          <p className="stat-value">{candidates.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Analyzed</p>
          <p className="stat-value">{analyzedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pending</p>
          <p className="stat-value">{pendingCount}</p>
        </div>
      </div>

      {/* Batch Progress */}
      {batchProgress?.in_progress && (
        <div className="card border-indigo-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Analyzing candidates...</span>
            <button onClick={handleCancelBatch} className="link-primary">
              Cancel
            </button>
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {batchProgress.completed} of {batchProgress.total} completed
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-group">
        {(['candidates', 'pipeline', 'description', 'settings'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'tab-active' : 'tab'}
          >
            <span className="capitalize">{tab}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'candidates' && (
        <RankingTable
          candidates={candidates}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          jobId={jobId}
        />
      )}

      {activeTab === 'pipeline' && (
        <KanbanBoard
          stages={stages}
          onRefresh={() => { fetchStages(); fetchCandidates(); }}
          jobId={jobId}
        />
      )}

      {activeTab === 'description' && (
        <div className="card p-6">
          <h2 className="section-title mb-4">Job Description</h2>
          {job.description ? (
            <pre className="whitespace-pre-wrap text-sm text-foreground bg-muted border border-border p-4 rounded-lg">
              {job.description}
            </pre>
          ) : (
            <div className="empty-state">
              <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="empty-state-title">No description provided</p>
              <p className="empty-state-desc">Edit in the Settings tab to add a job description.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-3xl">
          {/* Job Settings */}
          <div className="card p-6 space-y-4">
            <h2 className="section-title">Job Settings</h2>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Job Title</label>
              <input
                type="text"
                value={editForm.title || ''}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
              <select
                value={editForm.status || job.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as JobStatus })}
                className="input-select"
              >
                <option value="open">Open</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Job Description</label>
              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={10}
                className="input font-mono resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Company Name</label>
                <input
                  type="text"
                  value={editForm.company_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Position Title</label>
                <input
                  type="text"
                  value={editForm.position_title || ''}
                  onChange={(e) => setEditForm({ ...editForm, position_title: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Sender Name</label>
                <input
                  type="text"
                  value={editForm.sender_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, sender_name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Trafft Booking Link</label>
                <input
                  type="url"
                  value={editForm.trafft_booking_link || ''}
                  onChange={(e) => setEditForm({ ...editForm, trafft_booking_link: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 spinner" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes('Failed') ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {saveMessage}
                </span>
              )}
            </div>
          </div>

          {/* Google Sheets Import — includes question setup */}
          <div className="card p-6">
            <h2 className="section-title mb-1">Google Sheets Import</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect a Google Form response sheet. AI will detect screening questions and map columns automatically.
            </p>
            <JobSheetSync
              jobId={jobId}
              job={job}
              onSyncComplete={() => { fetchCandidates(); fetchStages(); fetchJob(); }}
            />
          </div>

          {/* Google Drive Folder */}
          <div className="card p-6">
            <h2 className="section-title mb-4">Google Drive Folder</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Configure a Drive folder to sync CVs directly into this job.
            </p>
            <JobDriveSync
              jobId={jobId}
              job={job}
              onSyncComplete={() => { fetchCandidates(); fetchStages(); fetchJob(); }}
            />
          </div>

          {/* Danger Zone */}
          <div className="card border-rose-200 p-6">
            <h2 className="text-lg font-semibold text-rose-600 mb-2">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting this job will remove all applications linked to it. Candidates themselves will not be deleted.
            </p>
            <button
              onClick={handleDelete}
              className="btn-danger"
            >
              Delete Job
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
