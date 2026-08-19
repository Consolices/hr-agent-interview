'use client';

import { useState, useEffect } from 'react';
import { api, Job, SpreadsheetItem, ColumnMapping, JobSheetSyncResult, ResponseQuestion, HeaderAnalysisResult } from '@/lib/api';
import { labelToKey, ensureUniqueKey } from '@/lib/utils';

interface JobSheetSyncProps {
  jobId: string;
  job: Job;
  onSyncComplete?: () => void;
}

type FixedMappingState = { name_column: number | ''; email_column: number | ''; cv_link_column: number | '' };

const emptyFixedMapping: FixedMappingState = {
  name_column: '',
  email_column: '',
  cv_link_column: '',
};

// Each question card: editable label + description + column mapping
interface QuestionRow {
  key: string;
  label: string;
  description: string;
  headerIndex: number | '';
  originalHeader?: string;
}

export default function JobSheetSync({ jobId, job, onSyncComplete }: JobSheetSyncProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  // 'summary' = already configured, show compact view. 1/2/3 = wizard steps.
  const [step, setStep] = useState<'summary' | 1 | 2 | 3>(job.sheet_spreadsheet_id ? 'summary' : 1);
  const [sheetsLoaded, setSheetsLoaded] = useState(false);

  // Step 1: Select sheet
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetItem[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>(job.sheet_spreadsheet_id || '');
  const [selectedSheetName, setSelectedSheetName] = useState<string>(job.sheet_spreadsheet_name || '');
  const [loadingSheets, setLoadingSheets] = useState(false);

  // Step 2: Headers + mapping
  const [headers, setHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [fixedMapping, setFixedMapping] = useState<FixedMappingState>(() => {
    if (job.sheet_column_mapping) {
      return {
        name_column: job.sheet_column_mapping.name_column ?? '',
        email_column: job.sheet_column_mapping.email_column ?? '',
        cv_link_column: job.sheet_column_mapping.cv_link_column ?? '',
      };
    }
    return { ...emptyFixedMapping };
  });
  const [questionRows, setQuestionRows] = useState<QuestionRow[]>([]);
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // AI analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  // Step 3: Results
  const [syncResult, setSyncResult] = useState<JobSheetSyncResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  // Load spreadsheets when step 1 is active and not yet loaded
  useEffect(() => {
    if (step === 1 && connected && !sheetsLoaded) {
      setSheetsLoaded(true);
      loadSpreadsheets();
    }
  }, [step, connected, sheetsLoaded]);

  const checkConnection = async () => {
    try {
      const status = await api.getDriveStatus();
      setConnected(status.connected);
      // Don't auto-load spreadsheets or headers — wait for user interaction
    } catch {
      setConnected(false);
    }
  };

  const loadSpreadsheets = async () => {
    setLoadingSheets(true);
    try {
      const sheets = await api.getSpreadsheets();
      setSpreadsheets(sheets);
    } catch {
      // Silent
    } finally {
      setLoadingSheets(false);
    }
  };

  const loadHeadersForSheet = async (sheetId: string) => {
    setLoadingHeaders(true);
    try {
      const result = await api.getSheetHeaders(sheetId);
      setHeaders(result.headers);
      setTotalRows(result.total_rows);
      return result.headers;
    } catch {
      setError('Failed to load sheet headers.');
      return [];
    } finally {
      setLoadingHeaders(false);
    }
  };

  // Initialize question rows from existing job config
  const initFromExistingConfig = (headersList: string[]) => {
    const existingQuestions = job.response_questions || [];
    const qc = job.sheet_column_mapping?.question_columns || {};

    if (existingQuestions.length > 0) {
      const rows: QuestionRow[] = existingQuestions.map((q) => ({
        key: q.key,
        label: q.label,
        description: q.description,
        headerIndex: qc[q.key] ?? '',
        originalHeader: qc[q.key] != null ? headersList[qc[q.key]] : undefined,
      }));
      setQuestionRows(rows);
      setAiDone(true); // Don't auto-run AI if already configured
    }
  };

  const runAISuggestion = async (headersList: string[]) => {
    setAnalyzing(true);
    setAiDone(false);
    try {
      const result = await api.analyzeSheetHeaders(
        headersList,
        job.title || undefined,
        job.description || undefined,
      );

      // Apply fixed column suggestions
      setFixedMapping({
        name_column: result.name_column ?? '',
        email_column: result.email_column ?? '',
        cv_link_column: result.cv_link_column ?? '',
      });

      // Build question rows from AI suggestions
      if (result.questions.length > 0) {
        const rows: QuestionRow[] = result.questions.map((q) => ({
          key: q.key,
          label: q.label,
          description: q.description,
          headerIndex: q.header_index,
          originalHeader: headersList[q.header_index],
        }));
        setQuestionRows(rows);
      }
      setAiDone(true);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiDone(true); // Let user map manually
    } finally {
      setAnalyzing(false);
    }
  };

  const buildColumnMapping = (): ColumnMapping => {
    const qc: Record<string, number> = {};
    for (const row of questionRows) {
      if (row.headerIndex !== '' && row.key) {
        qc[row.key] = row.headerIndex as number;
      }
    }
    return {
      name_column: fixedMapping.name_column !== '' ? (fixedMapping.name_column as number) : null,
      email_column: fixedMapping.email_column !== '' ? (fixedMapping.email_column as number) : null,
      cv_link_column: fixedMapping.cv_link_column as number,
      question_columns: qc,
    };
  };

  const buildResponseQuestions = (): ResponseQuestion[] => {
    const usedKeys: string[] = [];
    return questionRows
      .filter((r) => r.label.trim())
      .map((r) => {
        const baseKey = labelToKey(r.label) || r.key;
        const uniqueKey = ensureUniqueKey(baseKey, usedKeys);
        usedKeys.push(uniqueKey);
        return { key: uniqueKey, label: r.label, description: r.description };
      });
  };

  const handleSelectSheet = async () => {
    if (!selectedSheet) return;
    setError(null);
    setFixedMapping({ ...emptyFixedMapping });
    setQuestionRows([]);
    setAiDone(false);

    const headersList = await loadHeadersForSheet(selectedSheet);
    if (headersList.length > 0) {
      setStep(2);
      runAISuggestion(headersList);
    }
  };

  // When user clicks "Edit Mapping" on an already-configured sheet
  const handleEditExisting = async () => {
    setError(null);
    const sheetId = job.sheet_spreadsheet_id!;
    setSelectedSheet(sheetId);
    setSelectedSheetName(job.sheet_spreadsheet_name || '');

    const headersList = await loadHeadersForSheet(sheetId);
    if (headersList.length > 0) {
      initFromExistingConfig(headersList);
      setStep(2);
    }
  };

  // When user clicks "Change Sheet" to pick a different one
  const handleStartSelectSheet = async () => {
    await loadSpreadsheets();
    setStep(1);
  };

  const handleFixedMappingChange = (key: keyof FixedMappingState, value: string) => {
    setFixedMapping((prev) => ({
      ...prev,
      [key]: value === '' ? '' : parseInt(value, 10),
    }));
  };

  const handleQuestionRowChange = (idx: number, field: keyof QuestionRow, value: string | number) => {
    setQuestionRows((prev) => {
      const updated = [...prev];
      if (field === 'headerIndex') {
        updated[idx] = { ...updated[idx], headerIndex: value === '' ? '' : (value as number) };
      } else {
        updated[idx] = { ...updated[idx], [field]: value };
      }
      // Auto-update key when label changes
      if (field === 'label') {
        updated[idx] = { ...updated[idx], key: labelToKey(value as string) };
      }
      return updated;
    });
  };

  const handleAddQuestion = () => {
    setQuestionRows((prev) => [...prev, { key: '', label: '', description: '', headerIndex: '' }]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestionRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const allMappedIndices = (): number[] => {
    const indices: number[] = [];
    if (fixedMapping.name_column !== '') indices.push(fixedMapping.name_column as number);
    if (fixedMapping.email_column !== '') indices.push(fixedMapping.email_column as number);
    if (fixedMapping.cv_link_column !== '') indices.push(fixedMapping.cv_link_column as number);
    for (const row of questionRows) {
      if (row.headerIndex !== '') indices.push(row.headerIndex as number);
    }
    return indices;
  };

  const getDuplicates = (): number[] => {
    const all = allMappedIndices();
    return all.filter((v, i, arr) => arr.indexOf(v) !== i);
  };

  const isMappingValid = (): boolean => {
    if (fixedMapping.cv_link_column === '') return false;
    // All question rows with a label must have a column mapped
    for (const row of questionRows) {
      if (row.label.trim() && row.headerIndex === '') return false;
    }
    return getDuplicates().length === 0;
  };

  const saveJobConfig = async () => {
    const responseQuestions = buildResponseQuestions();
    const columnMapping = buildColumnMapping();

    // Re-key the question_columns to match the finalized keys
    const reKeyedQc: Record<string, number> = {};
    for (let i = 0; i < questionRows.length; i++) {
      const row = questionRows[i];
      if (row.headerIndex !== '' && responseQuestions[i]) {
        reKeyedQc[responseQuestions[i].key] = row.headerIndex as number;
      }
    }
    columnMapping.question_columns = reKeyedQc;

    await api.updateJob(jobId, {
      sheet_spreadsheet_id: selectedSheet,
      sheet_spreadsheet_name: selectedSheetName,
      sheet_column_mapping: columnMapping,
      response_questions: responseQuestions,
    });
  };

  const handleSaveConfig = async () => {
    if (!isMappingValid()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveJobConfig();
      setMessage('Configuration saved.');
      setTimeout(() => setMessage(null), 3000);
      onSyncComplete?.();
    } catch {
      setError('Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const result = await api.syncSheetForJob(jobId);
      setSyncResult(result);
      onSyncComplete?.();
    } catch (err) {
      setError('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      if (isMappingValid()) {
        await saveJobConfig();
      }
      const result = await api.syncSheetForJob(jobId);
      setSyncResult(result);
      setStep(3);
      onSyncComplete?.();
    } catch (err) {
      setError('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleChangeSheet = async () => {
    setSelectedSheet('');
    setSelectedSheetName('');
    setHeaders([]);
    setTotalRows(0);
    setFixedMapping({ ...emptyFixedMapping });
    setQuestionRows([]);
    setSyncResult(null);
    setAiDone(false);
    setError(null);
    await loadSpreadsheets();
    setStep(1);
  };

  const handleClearConfig = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateJob(jobId, {
        sheet_spreadsheet_id: '',
        sheet_spreadsheet_name: '',
        sheet_column_mapping: { name_column: null, email_column: null, cv_link_column: 0, question_columns: {} },
        response_questions: [],
      });
      setSelectedSheet('');
      setSelectedSheetName('');
      setHeaders([]);
      setTotalRows(0);
      setFixedMapping({ ...emptyFixedMapping });
      setQuestionRows([]);
      setSyncResult(null);
      setAiDone(false);
      setStep(1);
      setMessage('Sheet configuration cleared.');
      setTimeout(() => setMessage(null), 3000);
      onSyncComplete?.();
    } catch {
      setError('Failed to clear configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (connected === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="spinner w-4 h-4" />
        Checking Drive connection...
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="text-sm text-muted-foreground">
        Google Drive is not connected.{' '}
        <a href="/settings" className="text-primary hover:underline">
          Connect from Settings
        </a>
      </div>
    );
  }

  const duplicates = getDuplicates();
  const existingQuestions = job.response_questions || [];
  const isWizardStep = step === 1 || step === 2 || step === 3;

  return (
    <div className="space-y-4">
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {/* ── Summary View (already configured) ────────────────── */}
      {step === 'summary' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-foreground">{job.sheet_spreadsheet_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleEditExisting} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                Edit Mapping
              </button>
              <button onClick={handleChangeSheet} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Change Sheet
              </button>
            </div>
          </div>

          {existingQuestions.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {existingQuestions.length} screening question{existingQuestions.length !== 1 ? 's' : ''}: {existingQuestions.map(q => q.label).join(', ')}
            </div>
          )}

          <button
            onClick={handleQuickSync}
            disabled={syncing}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <div className="spinner w-4 h-4" />
                Syncing...
              </>
            ) : (
              'Sync Now'
            )}
          </button>

          {syncResult && (
            <div className="card bg-muted p-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Rows</span>
                  <p className="font-semibold text-foreground">{syncResult.total_rows}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">New</span>
                  <p className="font-semibold text-emerald-600">{syncResult.processed}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Already Synced</span>
                  <p className="font-semibold text-muted-foreground">{syncResult.total_rows - syncResult.processed - syncResult.errors.length}</p>
                </div>
              </div>
              {syncResult.errors.length > 0 && (
                <p className="text-xs text-rose-600 mt-2">{syncResult.errors.length} error{syncResult.errors.length !== 1 ? 's' : ''}</p>
              )}
            </div>
          )}

          <button
            onClick={handleClearConfig}
            disabled={saving}
            className="text-xs text-muted-foreground hover:text-rose-600 transition-colors"
          >
            Clear sheet configuration
          </button>
        </div>
      )}

      {/* Step Indicators (only during wizard) */}
      {isWizardStep && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {[
            { n: 1, label: 'Select' },
            { n: 2, label: 'Setup' },
            { n: 3, label: 'Results' },
          ].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-2">
              {i > 0 && <div className="w-4 border-t border-border" />}
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                step === n ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'bg-muted text-muted-foreground'
              }`}>{n}</span>
              <span className={step === n ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Step 1: Select Sheet ─────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Select a Google Sheet</h4>

          {loadingSheets ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="spinner w-4 h-4" />
              Loading spreadsheets...
            </div>
          ) : spreadsheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spreadsheets found.</p>
          ) : (
            <>
              <select
                value={selectedSheet}
                onChange={(e) => {
                  setSelectedSheet(e.target.value);
                  const sheet = spreadsheets.find((s) => s.id === e.target.value);
                  setSelectedSheetName(sheet?.name || '');
                }}
                className="input-select"
              >
                <option value="">Choose a spreadsheet...</option>
                {spreadsheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                    {sheet.id === job.sheet_spreadsheet_id ? ' (current)' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSelectSheet}
                disabled={!selectedSheet || loadingHeaders}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loadingHeaders ? (
                  <>
                    <div className="spinner w-4 h-4" />
                    Loading...
                  </>
                ) : (
                  'Next'
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: AI Setup + Questions + Mapping ───────────── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Sheet info bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="badge-zinc text-xs">{selectedSheetName || job.sheet_spreadsheet_name}</span>
              {totalRows > 0 && (
                <span className="text-xs text-muted-foreground">{totalRows} row{totalRows !== 1 ? 's' : ''} found</span>
              )}
            </div>
            <button onClick={handleChangeSheet} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Change sheet
            </button>
          </div>

          {/* AI analyzing state */}
          {analyzing && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/5 border border-primary/10 rounded-lg text-sm text-primary">
              <div className="spinner w-3.5 h-3.5" />
              AI is analyzing your sheet headers...
            </div>
          )}

          {/* AI done banner */}
          {aiDone && !analyzing && questionRows.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Found {questionRows.length} screening question{questionRows.length !== 1 ? 's' : ''} and mapped columns. Review below.
            </div>
          )}

          {loadingHeaders ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="spinner w-4 h-4" />
              Loading headers...
            </div>
          ) : (
            <>
              {/* ── Screening Questions ──────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Screening Questions</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Each question maps to a sheet column. AI will score candidates on each one.
                    </p>
                  </div>
                  <button onClick={handleAddQuestion} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    + Add Question
                  </button>
                </div>

                {questionRows.length === 0 && !analyzing && (
                  <div className="text-center py-6 border border-dashed border-border rounded-lg">
                    <p className="text-xs text-muted-foreground">No questions detected. Add questions manually or re-analyze.</p>
                  </div>
                )}

                {questionRows.map((row, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-3 space-y-2.5 bg-card">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Q{idx + 1}</span>
                        {row.originalHeader && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[300px]" title={row.originalHeader}>
                            Sheet: {row.originalHeader.length > 50 ? row.originalHeader.slice(0, 50) + '...' : row.originalHeader}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveQuestion(idx)}
                        className="text-xs text-muted-foreground hover:text-rose-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-0.5">Question Name</label>
                        <input
                          type="text"
                          value={row.label}
                          onChange={(e) => handleQuestionRowChange(idx, 'label', e.target.value)}
                          placeholder="e.g., Coordination Experience"
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-0.5">Sheet Column</label>
                        <select
                          value={row.headerIndex}
                          onChange={(e) => handleQuestionRowChange(idx, 'headerIndex', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                          className={`input-select text-sm ${
                            row.headerIndex !== '' && duplicates.includes(row.headerIndex as number)
                              ? '!border-rose-300 !bg-rose-50' : ''
                          }`}
                        >
                          <option value="">Select column...</option>
                          {headers.map((header, i) => (
                            <option key={i} value={i}>{header.length > 60 ? header.slice(0, 60) + '...' : header}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-0.5">AI Scoring Criteria</label>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleQuestionRowChange(idx, 'description', e.target.value)}
                        placeholder="e.g., Look for specific examples, leadership, communication skills"
                        className="input text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Fixed Column Mappings ────────────────────── */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-sm font-medium text-foreground">Column Mappings</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'name_column' as const, label: 'Name', optional: true },
                    { key: 'email_column' as const, label: 'Email', optional: true },
                    { key: 'cv_link_column' as const, label: 'CV Link', optional: false },
                  ].map(({ key, label, optional }) => (
                    <div key={key}>
                      <label className="block text-[11px] text-muted-foreground mb-0.5">
                        {label}{optional && ' (optional)'}
                      </label>
                      <select
                        value={fixedMapping[key]}
                        onChange={(e) => handleFixedMappingChange(key, e.target.value)}
                        className={`input-select text-sm ${
                          fixedMapping[key] !== '' && duplicates.includes(fixedMapping[key] as number)
                            ? '!border-rose-300 !bg-rose-50' : ''
                        }`}
                      >
                        <option value="">Select...</option>
                        {headers.map((header, i) => (
                          <option key={i} value={i}>{header.length > 40 ? header.slice(0, 40) + '...' : header}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {duplicates.length > 0 && (
            <p className="text-xs text-rose-600">Each column can only be used once.</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSaveConfig} disabled={!isMappingValid() || saving} className="btn-secondary">
              {saving ? 'Saving...' : 'Save Config'}
            </button>
            <button
              onClick={handleSync}
              disabled={!isMappingValid() || syncing}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Syncing {totalRows} row{totalRows !== 1 ? 's' : ''}...
                </>
              ) : (
                <>Sync{totalRows > 0 ? ` (${totalRows} rows)` : ''}</>
              )}
            </button>
          </div>

          {job.sheet_spreadsheet_id && (
            <button
              onClick={handleClearConfig}
              disabled={saving}
              className="text-xs text-muted-foreground hover:text-rose-600 transition-colors"
            >
              Clear sheet configuration
            </button>
          )}
        </div>
      )}

      {/* ── Step 3: Results ──────────────────────────────────── */}
      {step === 3 && syncResult && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Sync Complete</h4>

          <div className="card bg-muted p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Rows</span>
                <p className="font-semibold text-foreground">{syncResult.total_rows}</p>
              </div>
              <div>
                <span className="text-muted-foreground">New Candidates</span>
                <p className="font-semibold text-emerald-600">{syncResult.processed}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Already Synced</span>
                <p className="font-semibold text-muted-foreground">{syncResult.total_rows - syncResult.processed - syncResult.errors.length}</p>
              </div>
            </div>

            {syncResult.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-rose-600 font-medium">Errors:</p>
                <ul className="text-sm text-rose-600 max-h-40 overflow-y-auto">
                  {syncResult.errors.map((err, i) => (
                    <li key={i}>&#8226; {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={handleChangeSheet} className="btn-ghost">
              Change Sheet
            </button>
            <button
              onClick={() => { setSyncResult(null); setStep(2); }}
              className="btn-primary flex-1"
            >
              Sync Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
