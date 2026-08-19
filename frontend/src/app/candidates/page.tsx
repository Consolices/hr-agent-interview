'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Candidate, BatchProgress, Job } from '@/lib/api';
import RankingTable from '@/components/RankingTable';
import FileUpload from '@/components/FileUpload';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  useEffect(() => {
    api.getJobs().then(setJobs).catch(() => {});
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      const data = await api.getCandidates(selectedJobId || undefined);
      setCandidates(data);
    } catch {
      setError('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

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
          }
        } catch {
          console.error('Failed to fetch progress');
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [batchProgress?.in_progress, fetchCandidates]);

  const handleAnalyze = async (id: string) => {
    try {
      setAnalyzing(id);
      await api.analyzeCandidate(id, selectedJobId || undefined);
      await fetchCandidates();
    } catch {
      setError('Failed to analyze candidate');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleBatchAnalyze = async () => {
    try {
      const { total } = await api.startBatchAnalysis(undefined, selectedJobId || undefined);
      if (total > 0) {
        setBatchProgress({
          total,
          completed: 0,
          in_progress: true,
          current_candidate: null,
          errors: [],
        });
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

  const pendingCount = candidates.filter((c) => !c.analyzed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Candidates</h1>
          <p className="text-muted-foreground mt-1">
            {candidates.length} total · {pendingCount} pending analysis
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {jobs.length > 0 && (
            <select
              value={selectedJobId}
              onChange={(e) => { setSelectedJobId(e.target.value); setLoading(true); }}
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
          {pendingCount > 0 && !batchProgress?.in_progress && (
            <button
              onClick={handleBatchAnalyze}
              className="btn-primary"
            >
              Analyze All ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-700 ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Batch Progress */}
      {batchProgress?.in_progress && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">
              Analyzing candidates...
            </span>
            <button
              onClick={handleCancelBatch}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${(batchProgress.completed / batchProgress.total) * 100}%`,
              }}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {batchProgress.completed} of {batchProgress.total} completed
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Upload CVs</h2>
        <FileUpload onUploadComplete={fetchCandidates} />
      </div>

      {/* Ranking Table */}
      <RankingTable
        candidates={candidates}
        onAnalyze={handleAnalyze}
        analyzing={analyzing}
        jobId={selectedJobId || undefined}
      />
    </div>
  );
}
