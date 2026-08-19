'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PipelineCandidate, PipelineStage } from '@/lib/api';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  stage: PipelineStage;
  label: string;
  candidates: PipelineCandidate[];
  selectedIds: Set<string>;
  onSelectCandidate: (id: string, selected: boolean) => void;
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  applied:             'bg-gray-400',
  screened:            'bg-sky-500',
  interview_invited:   'bg-indigo-500',
  interview_scheduled: 'bg-violet-500',
  interview_done:      'bg-teal-500',
  offer:               'bg-amber-500',
  hired:               'bg-emerald-500',
  rejected:            'bg-rose-500',
};

export default function KanbanColumn({
  stage,
  label,
  candidates,
  selectedIds,
  onSelectCandidate,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { type: 'Column', stage },
  });
  const dotColor = STAGE_COLORS[stage] || STAGE_COLORS.applied;

  const candidateIds = useMemo(
    () => candidates.map((c) => c.id),
    [candidates]
  );

  return (
    <div
      ref={setNodeRef}
      className={`kanban-col transition-colors duration-150 ${
        isOver ? 'ring-2 ring-primary/30 bg-primary/[0.02]' : ''
      }`}
    >
      {/* Column Header */}
      <div className="kanban-col-header">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <h3 className="text-[13px] font-semibold text-foreground">{label}</h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums bg-muted px-2 py-0.5 rounded-md">
          {candidates.length}
        </span>
      </div>

      {/* Cards Area */}
      <div className="kanban-col-body">
        <SortableContext items={candidateIds} strategy={verticalListSortingStrategy}>
          {candidates.map((candidate) => (
            <KanbanCard
              key={candidate.id}
              candidate={candidate}
              isSelected={selectedIds.has(candidate.id)}
              onSelect={onSelectCandidate}
            />
          ))}
        </SortableContext>

        {candidates.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-xs text-muted-foreground">No candidates</p>
          </div>
        )}
      </div>
    </div>
  );
}
