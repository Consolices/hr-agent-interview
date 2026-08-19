'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { PipelineCandidate } from '@/lib/api';

export interface KanbanCardProps {
  candidate: PipelineCandidate;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  isOverlay?: boolean;
}

function getScoreColor(score: number | null) {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 40) return 'text-muted-foreground';
  return 'text-rose-600';
}

function getScoreBg(score: number | null) {
  if (score === null) return 'bg-muted';
  if (score >= 80) return 'bg-emerald-50';
  if (score >= 60) return 'bg-amber-50';
  if (score >= 40) return 'bg-muted';
  return 'bg-rose-50';
}

function getRecommendationBadge(rec: string | null) {
  switch (rec?.toLowerCase()) {
    case 'strongly recommend': return 'badge-emerald';
    case 'recommend': return 'badge-teal';
    case 'consider': return 'badge-amber';
    case 'do not recommend': return 'badge-rose';
    default: return 'badge-zinc';
  }
}

export default function KanbanCard({ candidate, isSelected, onSelect, isOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: candidate.id,
    data: {
      type: 'Task',
      candidate,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const initials = (candidate.name || '?')[0].toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card rounded-lg border p-3 transition-shadow ${
        isOverlay
          ? 'shadow-lg ring-2 ring-primary/30'
          : isDragging
            ? 'opacity-30 border-primary/30'
            : isSelected
              ? 'border-primary/40 bg-primary/[0.02] shadow-sm'
              : 'border-border hover:border-border hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onSelect(candidate.id, e.target.checked); }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer shrink-0"
        />
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-start gap-2.5 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
        >
          <div className="avatar avatar-sm bg-primary/5 text-primary mt-0.5">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/candidates/${candidate.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] font-medium text-foreground hover:text-primary truncate block transition-colors"
            >
              {candidate.name || 'Unknown'}
            </Link>
            {candidate.email && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{candidate.email}</p>
            )}
          </div>
          {candidate.overall_score !== null && (
            <span className={`text-xs font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded ${getScoreBg(candidate.overall_score)} ${getScoreColor(candidate.overall_score)}`}>
              {candidate.overall_score}
            </span>
          )}
        </div>
      </div>

      {(candidate.recommendation || !candidate.analyzed || candidate.emails_sent > 0) && (
        <div className="flex items-center gap-1 flex-wrap mt-2 ml-[52px]">
          {candidate.recommendation && (
            <span className={`${getRecommendationBadge(candidate.recommendation)} text-[10px] py-0`}>
              {candidate.recommendation}
            </span>
          )}
          {!candidate.analyzed && (
            <span className="badge-zinc text-[10px] py-0">Pending</span>
          )}
          {candidate.emails_sent > 0 && (
            <span className="badge-indigo text-[10px] py-0 inline-flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {candidate.emails_sent}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
