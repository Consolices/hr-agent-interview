'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { api, StageData, PipelineStage, PipelineCandidate } from '@/lib/api';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

interface KanbanBoardProps {
  stages: StageData[];
  onRefresh: () => void;
  jobId?: string;
}

const STAGE_ORDER: PipelineStage[] = [
  'applied',
  'screened',
  'interview_invited',
  'interview_scheduled',
  'interview_done',
  'offer',
  'hired',
  'rejected',
];

type CandidateMap = Map<PipelineStage, PipelineCandidate[]>;

function buildCandidateMap(stages: StageData[]): CandidateMap {
  const map: CandidateMap = new Map();
  for (const stage of STAGE_ORDER) {
    const stageData = stages.find((s) => s.stage === stage);
    map.set(stage, stageData ? [...stageData.candidates] : []);
  }
  return map;
}

export default function KanbanBoard({ stages, onRefresh, jobId }: KanbanBoardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCandidate, setActiveCandidate] = useState<PipelineCandidate | null>(null);
  const [moving, setMoving] = useState(false);
  const [bulkMoveStage, setBulkMoveStage] = useState<PipelineStage | ''>('');

  // Local state for smooth drag — synced from props, optimistically updated during drag
  const [candidateMap, setCandidateMap] = useState<CandidateMap>(() => buildCandidateMap(stages));
  const originalStageRef = useRef<PipelineStage | null>(null);

  // Sync from props (after API calls refresh data)
  useEffect(() => {
    setCandidateMap(buildCandidateMap(stages));
  }, [stages]);

  // Stage labels from props
  const stageLabels = useMemo(() => {
    const map = new Map<PipelineStage, string>();
    for (const s of stages) map.set(s.stage, s.label);
    return map;
  }, [stages]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  // Find which column a card or stage belongs to
  const findColumn = useCallback((id: string): PipelineStage | undefined => {
    if (STAGE_ORDER.includes(id as PipelineStage)) {
      return id as PipelineStage;
    }
    const entries = Array.from(candidateMap.entries());
    for (let i = 0; i < entries.length; i++) {
      const [stage, candidates] = entries[i];
      if (candidates.some((c: PipelineCandidate) => c.id === id)) {
        return stage;
      }
    }
    return undefined;
  }, [candidateMap]);

  const handleSelectCandidate = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    const entries = Array.from(candidateMap.entries());
    for (let i = 0; i < entries.length; i++) {
      const [stage, candidates] = entries[i];
      const candidate = candidates.find((c: PipelineCandidate) => c.id === activeId);
      if (candidate) {
        setActiveCandidate(candidate);
        originalStageRef.current = stage;
        break;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeColumn = findColumn(activeId);
    const overColumn = findColumn(overId);

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    // Move the card from one column to another in local state
    setCandidateMap((prev) => {
      const newMap = new Map(prev);
      const sourceCandidates = [...(newMap.get(activeColumn) || [])];
      const destCandidates = [...(newMap.get(overColumn) || [])];

      const activeIdx = sourceCandidates.findIndex((c) => c.id === activeId);
      if (activeIdx === -1) return prev;

      const [movedCandidate] = sourceCandidates.splice(activeIdx, 1);

      // Insert at the right position
      if (STAGE_ORDER.includes(overId as PipelineStage)) {
        // Dropped on empty column area — add to end
        destCandidates.push(movedCandidate);
      } else {
        // Dropped near a card — insert at that position
        const overIdx = destCandidates.findIndex((c) => c.id === overId);
        destCandidates.splice(overIdx >= 0 ? overIdx : destCandidates.length, 0, movedCandidate);
      }

      newMap.set(activeColumn, sourceCandidates);
      newMap.set(overColumn, destCandidates);
      return newMap;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCandidate(null);

    const { active, over } = event;
    if (!over) {
      // Drag cancelled — revert
      setCandidateMap(buildCandidateMap(stages));
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle same-column reorder (visual only, no API call)
    const activeColumn = findColumn(activeId);
    const overColumn = findColumn(overId);

    if (activeColumn && overColumn && activeColumn === overColumn && activeId !== overId) {
      setCandidateMap((prev) => {
        const newMap = new Map(prev);
        const candidates = [...(newMap.get(activeColumn) || [])];
        const activeIdx = candidates.findIndex((c) => c.id === activeId);
        const overIdx = candidates.findIndex((c) => c.id === overId);
        if (activeIdx !== -1 && overIdx !== -1) {
          newMap.set(activeColumn, arrayMove(candidates, activeIdx, overIdx));
        }
        return newMap;
      });
      return;
    }

    // Cross-column move — persist via API
    const targetStage = overColumn;
    const sourceStage = originalStageRef.current;
    originalStageRef.current = null;

    if (!targetStage || !sourceStage || sourceStage === targetStage) return;

    setMoving(true);
    try {
      if (selectedIds.has(activeId) && selectedIds.size > 1) {
        await api.bulkMoveCandidates(Array.from(selectedIds), targetStage, jobId);
        setSelectedIds(new Set());
      } else {
        await api.moveCandidate(activeId, targetStage, jobId);
      }
      onRefresh();
    } catch (error) {
      console.error('Failed to move candidate:', error);
      // Revert on failure
      setCandidateMap(buildCandidateMap(stages));
    } finally {
      setMoving(false);
    }
  };

  const handleBulkMove = async () => {
    if (!bulkMoveStage || selectedIds.size === 0) return;

    setMoving(true);
    try {
      await api.bulkMoveCandidates(Array.from(selectedIds), bulkMoveStage, jobId, undefined, true);
      setSelectedIds(new Set());
      setBulkMoveStage('');
      onRefresh();
    } catch (error) {
      console.error('Failed to bulk move candidates:', error);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="card p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="badge-indigo">
              {selectedIds.size} candidate{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleClearSelection}
              className="btn-ghost text-sm"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bulkMoveStage}
              onChange={(e) => setBulkMoveStage(e.target.value as PipelineStage | '')}
              className="input-select text-sm"
            >
              <option value="">Move to...</option>
              {STAGE_ORDER.map((stage) => (
                <option key={stage} value={stage}>
                  {stageLabels.get(stage) || stage}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkMove}
              disabled={!bulkMoveStage || moving}
              className="btn-primary text-sm px-3 py-1.5"
            >
              {moving ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_ORDER.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              label={stageLabels.get(stage) || stage.replace('_', ' ')}
              candidates={candidateMap.get(stage) || []}
              selectedIds={selectedIds}
              onSelectCandidate={handleSelectCandidate}
            />
          ))}
        </div>

        {typeof document !== 'undefined' && createPortal(
          <DragOverlay dropAnimation={null}>
            {activeCandidate && (
              <KanbanCard
                candidate={activeCandidate}
                isSelected={selectedIds.has(activeCandidate.id)}
                onSelect={() => {}}
                isOverlay
              />
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}
