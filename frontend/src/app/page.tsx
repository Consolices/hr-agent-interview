'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, Stats, Candidate, Job } from '@/lib/api';
import CandidateCard from '@/components/CandidateCard';
import FileUpload from '@/components/FileUpload';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topCandidates, setTopCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, candidatesData, jobsData] = await Promise.all([
        api.getStats(),
        api.getCandidates(),
        api.getJobs().catch(() => []),
      ]);
      setStats(statsData);
      setTopCandidates(candidatesData.slice(0, 6));
      setJobs(jobsData);
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-neutral';
    return 'score-low';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 spinner" />
      </div>
    );
  }

  if (error) {
    return <div className="alert-error">{error}</div>;
  }

  const openJobs = jobs.filter(j => j.status === 'open');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your recruitment pipeline</p>
        </div>
        <Link href="/candidates" className="btn-primary">
          View All Candidates
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="stat-label">Total Candidates</p>
          <p className="stat-value">{stats?.total_candidates || 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Analyzed</p>
          <p className="stat-value">{stats?.analyzed_candidates || 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pending Analysis</p>
          <p className="stat-value">{stats?.pending_analysis || 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Average Score</p>
          <p className="stat-value">
            {stats?.average_score ? Math.round(stats.average_score) : '\u2014'}
          </p>
        </div>
      </div>

      {/* Active Jobs */}
      {openJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Active Jobs</h2>
            <Link href="/jobs" className="link-primary">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openJobs.slice(0, 3).map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="card-interactive p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{job.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{job.company_name}</p>
                  </div>
                  <span className="badge-emerald shrink-0">Open</span>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{job.candidate_count}</p>
                    <p className="text-xs text-muted-foreground">Candidates</p>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{job.analyzed_count}</p>
                    <p className="text-xs text-muted-foreground">Analyzed</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upload + Top Candidates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="section-title mb-4">Upload CVs</h2>
          <FileUpload onUploadComplete={fetchData} />
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Top Candidates</h2>
            <Link href="/candidates" className="link-primary">
              View all &rarr;
            </Link>
          </div>
          {topCandidates.length > 0 ? (
            <div className="space-y-0.5">
              {topCandidates.slice(0, 5).map((candidate, i) => (
                <Link
                  key={candidate.id}
                  href={`/candidates/${candidate.id}`}
                  className="flex items-center gap-3 py-2.5 px-3 -mx-1 rounded-md hover:bg-accent transition-colors group"
                >
                  <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="avatar avatar-sm">
                    {(candidate.name || '?')[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-foreground flex-1 truncate">
                    {candidate.name || 'Unknown'}
                  </span>
                  {candidate.overall_score != null && (
                    <span className={`text-sm font-mono font-medium tabular-nums ${getScoreColor(candidate.overall_score)}`}>
                      {Math.round(candidate.overall_score)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state py-8">
              <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="empty-state-title">No candidates yet</h3>
              <p className="empty-state-desc">Upload CVs or connect Google Drive to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Full Top Candidates Grid */}
      {topCandidates.length > 4 && (
        <div>
          <h2 className="section-title mb-4">All Top Candidates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/settings" className="card-interactive p-5 flex items-center gap-4">
          <div className="p-2.5 bg-muted rounded-md">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Connect Google Drive</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Sync CVs directly from your Drive</p>
          </div>
        </Link>
        <Link href="/candidates" className="card-interactive p-5 flex items-center gap-4">
          <div className="p-2.5 bg-muted rounded-md">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Analyze Candidates</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Run AI analysis on pending CVs</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
