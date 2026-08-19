'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, Job } from '@/lib/api';

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  open: { className: 'badge-emerald', label: 'Open' },
  draft: { className: 'badge-zinc', label: 'Draft' },
  closed: { className: 'badge-rose', label: 'Closed' },
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const data = await api.getJobs();
        setJobs(data);
      } catch {
        setError('Failed to load jobs');
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-error">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {jobs.length} job posting{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/jobs/new" className="btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M3 8a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <h3 className="empty-state-title">No jobs yet</h3>
            <p className="empty-state-desc mb-4">Create your first job posting to get started.</p>
            <Link href="/jobs/new" className="btn-primary">
              Create Job
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => {
            const status = STATUS_BADGE[job.status] || STATUS_BADGE.draft;
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="card-interactive p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-medium text-foreground leading-tight">{job.title}</h3>
                  <span className={`${status.className} ml-2 flex-shrink-0`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{job.company_name}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    {job.candidate_count} candidate{job.candidate_count !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    {job.analyzed_count} analyzed
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground mt-3">
                  Created {new Date(job.created_at).toLocaleDateString()}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
