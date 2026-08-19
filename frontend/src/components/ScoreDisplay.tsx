'use client';

import { CandidateScore, ResponseQuestion, ScoringConfig, DEFAULT_RESPONSE_QUESTIONS } from '@/lib/api';

interface ScoreDisplayProps {
  score: CandidateScore;
  responseQuestions?: ResponseQuestion[];
  scoringConfig?: ScoringConfig;
}

export default function ScoreDisplay({ score, responseQuestions, scoringConfig }: ScoreDisplayProps) {
  const jmWeight = scoringConfig?.job_match_weight ?? 40;
  const scWeight = scoringConfig?.screening_weight ?? 40;
  const rsWeight = scoringConfig?.response_weight ?? 20;
  const getScoreBarColor = (value: number) => {
    if (value >= 80) return 'bg-emerald-500';
    if (value >= 60) return 'bg-amber-500';
    if (value >= 40) return 'bg-gray-400';
    return 'bg-rose-500';
  };

  const getScoreTextColor = (value: number) => {
    if (value >= 80) return 'text-emerald-600';
    if (value >= 60) return 'text-amber-600';
    if (value >= 40) return 'text-muted-foreground';
    return 'text-rose-600';
  };

  const getRecommendationBadge = (recommendation: string | null) => {
    switch (recommendation) {
      case 'Strong Yes':
        return 'badge-emerald';
      case 'Yes':
        return 'badge-teal';
      case 'Maybe':
        return 'badge-amber';
      case 'No':
        return 'badge-rose';
      default:
        return 'badge-zinc';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="text-center bg-muted rounded-xl p-6">
        <div className={`text-5xl font-bold font-mono mb-2 ${getScoreTextColor(score.overall_score)}`}>
          {Math.round(score.overall_score)}
        </div>
        <div className="text-sm text-muted-foreground mb-3">Overall Score</div>
        <div className="h-1 bg-muted rounded-full w-32 mx-auto mb-4">
          <div
            className={`h-1 rounded-full ${getScoreBarColor(score.overall_score)}`}
            style={{ width: `${score.overall_score}%` }}
          />
        </div>
        <span className={`${getRecommendationBadge(score.recommendation)} text-sm px-4 py-1.5`}>
          {score.recommendation || 'Not Rated'}
        </span>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-4">
        <h4 className="section-title">Score Breakdown</h4>

        {/* Job Match */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Job Match ({jmWeight}%)</span>
            <span className={`font-mono font-medium ${getScoreTextColor(score.job_match_score.score)}`}>
              {Math.round(score.job_match_score.score)}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full">
            <div
              className={`h-1 rounded-full ${getScoreBarColor(score.job_match_score.score)}`}
              style={{ width: `${score.job_match_score.score}%` }}
            />
          </div>
        </div>

        {/* Screening */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Screening ({scWeight}%)</span>
            <span className={`font-mono font-medium ${getScoreTextColor(score.screening_score.score)}`}>
              {Math.round(score.screening_score.score)}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full">
            <div
              className={`h-1 rounded-full ${getScoreBarColor(score.screening_score.score)}`}
              style={{ width: `${score.screening_score.score}%` }}
            />
          </div>
        </div>

        {/* Response */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Responses ({rsWeight}%)</span>
            <span className={`font-mono font-medium ${getScoreTextColor(score.response_score.score)}`}>
              {Math.round(score.response_score.score)}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full">
            <div
              className={`h-1 rounded-full ${getScoreBarColor(score.response_score.score)}`}
              style={{ width: `${score.response_score.score}%` }}
            />
          </div>

          {/* Per-dimension breakdown */}
          {(() => {
            const dims: Record<string, number> = score.response_score.dimension_scores && typeof score.response_score.dimension_scores === 'object'
              ? score.response_score.dimension_scores
              : {};
            // Fallback to legacy fields if dimension_scores is empty
            const legacyDims: Record<string, number> = {};
            if (Object.keys(dims).length === 0) {
              if (score.response_score.introduction_quality != null)
                legacyDims['introduction'] = score.response_score.introduction_quality;
              if (score.response_score.passion_depth != null)
                legacyDims['passion_description'] = score.response_score.passion_depth;
              if (score.response_score.self_learning_quality != null)
                legacyDims['self_learning'] = score.response_score.self_learning_quality;
            }
            const allDims = Object.keys(dims).length > 0 ? dims : legacyDims;
            if (Object.keys(allDims).length === 0) return null;

            const questions = Array.isArray(responseQuestions) && responseQuestions.length > 0
              ? responseQuestions
              : DEFAULT_RESPONSE_QUESTIONS;
            const labelMap: Record<string, string> = {};
            for (const q of questions) labelMap[q.key] = q.label;

            return (
              <div className="mt-2 space-y-1 pl-2 border-l-2 border-border">
                {Object.entries(allDims).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{labelMap[key] || key.replace(/_/g, ' ')}</span>
                    <span className="font-medium font-mono text-foreground">{val}/10</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Flags */}
      {(score.green_flags.length > 0 || score.red_flags.length > 0) && (
        <div className="space-y-4">
          {score.green_flags.length > 0 && (
            <div>
              <h4 className="font-semibold text-emerald-600 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Strengths
              </h4>
              <ul className="space-y-1">
                {score.green_flags.map((flag, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-emerald-600 mt-1">•</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {score.red_flags.length > 0 && (
            <div>
              <h4 className="font-semibold text-rose-600 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Concerns
              </h4>
              <ul className="space-y-1">
                {score.red_flags.map((flag, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-rose-600 mt-1">•</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {score.summary && (
        <div className="bg-muted rounded-lg p-4">
          <h4 className="font-semibold text-foreground mb-2">Summary</h4>
          <p className="text-sm text-foreground">{score.summary}</p>
        </div>
      )}
    </div>
  );
}
