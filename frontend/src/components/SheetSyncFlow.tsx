'use client';

import { useState, useEffect } from 'react';
import { api, SpreadsheetItem, ColumnMapping, SheetSyncResult } from '@/lib/api';

// Legacy global sync uses the fixed 3 question columns
type LegacyMappingKeys = 'name_column' | 'email_column' | 'cv_link_column' | 'introduction_column' | 'passion_column' | 'self_learning_column';

const COLUMN_LABELS: { key: LegacyMappingKeys; label: string }[] = [
  { key: 'name_column', label: 'Name' },
  { key: 'email_column', label: 'Email' },
  { key: 'cv_link_column', label: 'CV Link (Google Drive)' },
  { key: 'introduction_column', label: 'Introduction / Motivation' },
  { key: 'passion_column', label: 'Passion / Expertise' },
  { key: 'self_learning_column', label: 'Self-Learning' },
];

const STORAGE_KEY = 'sheet-sync-mapping';

type MappingState = Record<LegacyMappingKeys, number | ''>;

const emptyMapping: MappingState = {
  name_column: '',
  email_column: '',
  cv_link_column: '',
  introduction_column: '',
  passion_column: '',
  self_learning_column: '',
};

function saveMappingToStorage(sheetId: string, mapping: MappingState) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    stored[sheetId] = mapping;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage unavailable
  }
}

function loadMappingFromStorage(sheetId: string): MappingState | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (stored[sheetId]) return stored[sheetId];
  } catch {
    // localStorage unavailable
  }
  return null;
}

export default function SheetSyncFlow() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetItem[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [loadingSheets, setLoadingSheets] = useState(true);

  // Step 2
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappingState>({ ...emptyMapping });
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Step 3
  const [syncResult, setSyncResult] = useState<SheetSyncResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSpreadsheets();
  }, []);

  const loadSpreadsheets = async () => {
    try {
      setLoadingSheets(true);
      setError(null);
      const sheets = await api.getSpreadsheets();
      setSpreadsheets(sheets);
    } catch (err) {
      setError('Failed to load spreadsheets: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleSelectSheet = async () => {
    if (!selectedSheet) return;
    try {
      setLoadingHeaders(true);
      setError(null);
      const result = await api.getSheetHeaders(selectedSheet);
      setHeaders(result.headers);

      // Restore saved mapping for this sheet, or start fresh
      const saved = loadMappingFromStorage(selectedSheet);
      setMapping(saved || { ...emptyMapping });

      setStep(2);
    } catch (err) {
      setError('Failed to load headers: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingHeaders(false);
    }
  };

  const handleMappingChange = (key: LegacyMappingKeys, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [key]: value === '' ? '' : parseInt(value, 10),
    }));
  };

  const isMappingValid = (): boolean => {
    const values = Object.values(mapping);
    if (values.some((v) => v === '')) return false;
    const nums = values.filter((v): v is number => v !== '');
    return new Set(nums).size === nums.length;
  };

  const handleSync = async () => {
    if (!isMappingValid()) return;

    const columnMapping: ColumnMapping = {
      name_column: mapping.name_column as number,
      email_column: mapping.email_column as number,
      cv_link_column: mapping.cv_link_column as number,
      introduction_column: mapping.introduction_column as number,
      passion_column: mapping.passion_column as number,
      self_learning_column: mapping.self_learning_column as number,
    };

    // Save mapping so it persists across sessions
    saveMappingToStorage(selectedSheet, mapping);

    try {
      setSyncing(true);
      setError(null);
      const result = await api.syncFromSheet(selectedSheet, columnMapping);
      setSyncResult(result);
      setStep(3);
    } catch (err) {
      setError('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleDone = () => {
    // Go back to step 2 (mapping) so you can re-sync without re-mapping
    setSyncResult(null);
    setError(null);
    setStep(2);
  };

  const handleChangeSheet = () => {
    setStep(1);
    setSelectedSheet('');
    setHeaders([]);
    setMapping({ ...emptyMapping });
    setSyncResult(null);
    setError(null);
  };

  // Check for duplicate selections
  const selectedIndices = Object.values(mapping).filter((v): v is number => v !== '');
  const duplicates = selectedIndices.filter((v, i, arr) => arr.indexOf(v) !== i);

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      {/* Step Indicators */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
          step === 1 ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'bg-muted text-muted-foreground'
        }`}>1</span>
        <span className={step === 1 ? 'text-foreground' : 'text-muted-foreground'}>Select</span>
        <div className="w-4 border-t border-gray-300" />
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
          step === 2 ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'bg-muted text-muted-foreground'
        }`}>2</span>
        <span className={step === 2 ? 'text-foreground' : 'text-muted-foreground'}>Map</span>
        <div className="w-4 border-t border-gray-300" />
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
          step === 3 ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'bg-muted text-muted-foreground'
        }`}>3</span>
        <span className={step === 3 ? 'text-foreground' : 'text-muted-foreground'}>Results</span>
      </div>

      {/* Step 1: Select Sheet */}
      {step === 1 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            Select a Google Sheet
          </h4>

          {loadingSheets ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="spinner w-4 h-4" />
              Loading spreadsheets...
            </div>
          ) : spreadsheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No spreadsheets found. Make sure your Google Form responses are saved to a Google Sheet.
            </p>
          ) : (
            <>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="input-select"
              >
                <option value="">Choose a spreadsheet...</option>
                {spreadsheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
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
                    Loading headers...
                  </>
                ) : (
                  'Next'
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 2: Map Columns */}
      {step === 2 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            Map columns to fields
          </h4>
          <p className="text-xs text-muted-foreground">
            Match each field to the corresponding column in your sheet.
          </p>

          <div className="space-y-3">
            {COLUMN_LABELS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm text-foreground mb-1">
                  {label}
                </label>
                <select
                  value={mapping[key]}
                  onChange={(e) => handleMappingChange(key, e.target.value)}
                  className={`input-select ${
                    mapping[key] !== '' && duplicates.includes(mapping[key] as number)
                      ? '!border-rose-300 !bg-rose-50'
                      : ''
                  }`}
                >
                  <option value="">Select column...</option>
                  {headers.map((header, idx) => (
                    <option key={idx} value={idx}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {duplicates.length > 0 && (
            <p className="text-xs text-rose-600">
              Each column can only be used once. Please fix duplicate selections.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleChangeSheet}
              className="btn-ghost"
            >
              Change Sheet
            </button>
            <button
              onClick={handleSync}
              disabled={!isMappingValid() || syncing}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Syncing...
                </>
              ) : (
                'Sync'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
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
                <span className="text-muted-foreground">Processed</span>
                <p className="font-semibold text-emerald-600">{syncResult.processed}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Skipped</span>
                <p className="font-semibold text-muted-foreground">{syncResult.skipped}</p>
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
            <button
              onClick={handleChangeSheet}
              className="btn-ghost"
            >
              Change Sheet
            </button>
            <button
              onClick={handleDone}
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
