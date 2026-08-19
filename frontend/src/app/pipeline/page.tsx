'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, StageData, PipelineStage, Job } from '@/lib/api';
import KanbanBoard from '@/components/KanbanBoard';

export default function PipelinePage() {
  const [stages, setStages] = useState<StageData[]>([]);
  const [stats, setStats] = useState<Record<PipelineStage, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  useEffect(() => {
    api.getJobs().then(setJobs).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [stagesData, statsData] = await Promise.all([
        api.getPipelineStages(selectedJobId || undefined),
        api.getPipelineStats(selectedJobId || undefined),
      ]);
      setStages(stagesData);
      setStats(statsData);
    } catch {
      setError('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const totalCandidates = stats
    ? Object.values(stats).reduce((sum, count) => sum + count, 0)
    : 0;

  const activeCount = stats
    ? totalCandidates - (stats.hired || 0) - (stats.rejected || 0)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-error flex items-center gap-4">
        <span>{error}</span>
        <button
          onClick={fetchData}
          className="text-sm underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track candidates through the hiring process
          </p>
        </div>
        <div className="flex items-center gap-3">
          {jobs.length > 0 && (
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="input-select"
            >
              <option value="">All Jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          )}
          <button onClick={fetchData} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="stat-label">Total Candidates</p>
            <p className="stat-value">{totalCandidates}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Active in Pipeline</p>
            <p className="stat-value">{activeCount}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Hired</p>
            <p className="stat-value">{stats.hired || 0}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Rejected</p>
            <p className="stat-value">{stats.rejected || 0}</p>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <KanbanBoard stages={stages} onRefresh={fetchData} jobId={selectedJobId || undefined} />

      {/* Help Text */}
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          <strong className="text-foreground">Tip:</strong> Drag and drop cards to move candidates between stages.
        </p>
        <p>
          Select multiple candidates using checkboxes, then use the bulk move dropdown.
        </p>
      </div>
    </div>
  );
}
