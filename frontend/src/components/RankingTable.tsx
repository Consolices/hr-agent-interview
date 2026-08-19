'use client';

import Link from 'next/link';
import { Candidate, PipelineStage } from '@/lib/api';

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

interface RankingTableProps {
  candidates: Candidate[];
  onAnalyze?: (id: string) => void;
  analyzing?: string | null;
  jobId?: string;
}

export default function RankingTable({ candidates, onAnalyze, analyzing, jobId }: RankingTableProps) {
  const getStageBadgeClass = (stage: PipelineStage) => {
    return STAGE_BADGE[stage] || 'badge-zinc';
  };

  const getStageLabel = (stage: PipelineStage) => {
    return STAGE_LABELS[stage] || stage;
  };

  const getRecommendationBadge = (recommendation: string | null) => {
    const styles: Record<string, string> = {
      'Strong Yes': 'badge-emerald',
      Yes: 'badge-teal',
      Maybe: 'badge-amber',
      No: 'badge-rose',
    };
    return styles[recommendation || ''] || 'badge-zinc';
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    if (score >= 40) return 'text-muted-foreground';
    return 'text-rose-600';
  };

  const getScoreBarColor = (score: number | null) => {
    if (score === null) return 'bg-gray-200';
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-gray-400';
    return 'bg-rose-500';
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (candidates.length === 0) {
    return (
      <div className="card empty-state">
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="empty-state-title">No candidates yet</h3>
        <p className="empty-state-desc">
          Upload CVs or sync from Google Drive to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3.5 text-left table-header w-14">
              Rank
            </th>
            <th className="px-4 py-3.5 text-left table-header">
              Candidate
            </th>
            <th className="px-4 py-3.5 text-left table-header">
              Score
            </th>
            <th className="px-4 py-3.5 text-left table-header">
              Status
            </th>
            <th className="px-4 py-3.5 text-left table-header">
              Recommendation
            </th>
            <th className="px-4 py-3.5 text-right table-header">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate, index) => (
            <tr key={candidate.id} className="table-row">
              <td className="table-cell whitespace-nowrap">
                <span className="text-sm font-semibold font-mono text-muted-foreground">#{index + 1}</span>
              </td>
              <td className="table-cell whitespace-nowrap">
                <Link href={`/candidates/${candidate.id}${jobId ? `?job_id=${jobId}` : ''}`} className="flex items-center gap-3">
                  <div className="avatar avatar-md bg-indigo-50 text-indigo-600">
                    {getInitials(candidate.name)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground hover:text-indigo-700 transition-colors">
                      {candidate.name || 'Unknown'}
                    </div>
                    <div className="text-sm text-muted-foreground">{candidate.email || candidate.filename}</div>
                  </div>
                </Link>
              </td>
              <td className="table-cell whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span className={`text-lg font-bold font-mono ${getScoreColor(candidate.overall_score)}`}>
                    {candidate.overall_score !== null ? Math.round(candidate.overall_score) : '-'}
                  </span>
                  {candidate.overall_score !== null && (
                    <div className="h-1 bg-muted rounded-full w-16">
                      <div
                        className={`h-1 rounded-full ${getScoreBarColor(candidate.overall_score)}`}
                        style={{ width: `${candidate.overall_score}%` }}
                      />
                    </div>
                  )}
                </div>
              </td>
              <td className="table-cell whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  {candidate.pipeline_stage ? (
                    <span className={getStageBadgeClass(candidate.pipeline_stage)}>
                      {getStageLabel(candidate.pipeline_stage)}
                    </span>
                  ) : (
                    <span className="badge-zinc">
                      {candidate.analyzed ? 'Applied' : 'Pending'}
                    </span>
                  )}
                  {candidate.emails_sent > 0 && (
                    <span className="badge-indigo">
                      {candidate.emails_sent} Email{candidate.emails_sent !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </td>
              <td className="table-cell whitespace-nowrap">
                {candidate.recommendation ? (
                  <span className={getRecommendationBadge(candidate.recommendation)}>
                    {candidate.recommendation}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="table-cell whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  {!candidate.analyzed && onAnalyze && (
                    <button
                      onClick={() => onAnalyze(candidate.id)}
                      disabled={analyzing === candidate.id}
                      className="btn-secondary text-xs px-3 py-1 disabled:opacity-50"
                    >
                      {analyzing === candidate.id ? (
                        <span className="flex items-center gap-1">
                          <div className="spinner w-3 h-3"></div>
                          Analyzing...
                        </span>
                      ) : (
                        'Analyze'
                      )}
                    </button>
                  )}
                  <Link
                    href={`/candidates/${candidate.id}${jobId ? `?job_id=${jobId}` : ''}`}
                    className="link-primary"
                  >
                    View
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
