'use client';

import { StageChange } from '@/lib/api';

interface StageHistoryTimelineProps {
  history: StageChange[];
  currentStage: string;
}

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

export default function StageHistoryTimeline({ history, currentStage }: StageHistoryTimelineProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStageLabel = (stage: string) => STAGE_LABELS[stage] || stage.replace('_', ' ');
  const getStageBadge = (stage: string) => STAGE_BADGE[stage] || 'badge-zinc';

  // If no history, show current stage as initial
  if (history.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="section-title">Stage History</h3>
        <div className="relative pl-8">
          <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-200"></div>
          <div className="pb-4">
            <span className={getStageBadge(currentStage)}>
              {getStageLabel(currentStage)}
            </span>
            <p className="text-xs text-muted-foreground/50 mt-1">Initial stage</p>
          </div>
        </div>
      </div>
    );
  }

  // Reverse to show most recent first
  const sortedHistory = [...history].reverse();

  return (
    <div className="space-y-4">
      <h3 className="section-title">Stage History</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[5px] top-0 bottom-0 border-l-2 border-border"></div>

        {/* Current stage */}
        <div className="relative pl-8 pb-5">
          <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-200"></div>
          <div>
            <span className={getStageBadge(currentStage)}>
              {getStageLabel(currentStage)}
            </span>
            <p className="text-xs text-muted-foreground/50 mt-1">Current stage</p>
          </div>
        </div>

        {/* History entries */}
        {sortedHistory.map((change, index) => (
          <div key={index} className="relative pl-8 pb-5">
            <div className="absolute left-[1px] top-1.5 w-2.5 h-2.5 rounded-full bg-gray-200"></div>
            <div>
              <div className="flex items-center gap-2">
                {change.from_stage && (
                  <>
                    <span className={`${getStageBadge(change.from_stage)} opacity-60`}>
                      {getStageLabel(change.from_stage)}
                    </span>
                    <svg className="w-4 h-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
                <span className={getStageBadge(change.to_stage)}>
                  {getStageLabel(change.to_stage)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/50 mt-1">{formatDate(change.changed_at)}</p>
              {change.notes && (
                <p className="text-sm text-muted-foreground mt-1 italic">&ldquo;{change.notes}&rdquo;</p>
              )}
              {change.changed_by && (
                <p className="text-xs text-muted-foreground/50 mt-0.5">by {change.changed_by}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
