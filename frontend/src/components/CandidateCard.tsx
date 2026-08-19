'use client';

import Link from 'next/link';
import { Candidate } from '@/lib/api';

interface CandidateCardProps {
  candidate: Candidate;
}

function getScoreColor(score: number | null) {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 40) return 'text-muted-foreground';
  return 'text-destructive';
}

function getScoreBarColor(score: number | null) {
  if (score === null) return 'bg-muted';
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-gray-400';
  return 'bg-destructive';
}

function getRecommendationBadge(rec: string | null) {
  switch (rec) {
    case 'Strong Yes': return 'badge-emerald';
    case 'Yes': return 'badge-teal';
    case 'Maybe': return 'badge-amber';
    case 'No': return 'badge-rose';
    default: return 'badge-zinc';
  }
}

export default function CandidateCard({ candidate }: CandidateCardProps) {
  const initials = (candidate.name || '?')[0].toUpperCase();
  const score = candidate.overall_score;

  return (
    <Link href={`/candidates/${candidate.id}`}>
      <div className="card-interactive p-4 cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="avatar avatar-md mt-0.5">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">
              {candidate.name || 'Unknown Candidate'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{candidate.email || 'No email'}</p>
          </div>
          {candidate.analyzed && score !== null && (
            <div className="text-right shrink-0">
              <span className={`text-xl font-semibold font-mono tabular-nums ${getScoreColor(score)}`}>
                {Math.round(score)}
              </span>
            </div>
          )}
        </div>

        {/* Score bar */}
        {candidate.analyzed && score !== null && (
          <div className="mt-3">
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(score)}`}
                style={{ width: `${Math.min(score, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="badge-zinc text-[10px]">
            {candidate.file_type.toUpperCase()}
          </span>
          {candidate.analyzed ? (
            <span className="badge-emerald text-[10px]">Analyzed</span>
          ) : (
            <span className="badge-amber text-[10px]">Pending</span>
          )}
          {candidate.recommendation && (
            <span className={`${getRecommendationBadge(candidate.recommendation)} text-[10px]`}>
              {candidate.recommendation}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
