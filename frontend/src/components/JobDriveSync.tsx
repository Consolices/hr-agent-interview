'use client';

import { useState, useEffect } from 'react';
import { api, Job, DriveFolder, SyncPreview, JobDriveSyncResult } from '@/lib/api';

interface JobDriveSyncProps {
  jobId: string;
  job: Job;
  onSyncComplete?: () => void;
}

export default function JobDriveSync({ jobId, job, onSyncComplete }: JobDriveSyncProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>(job.drive_folder_id || '');
  const [selectedFolderName, setSelectedFolderName] = useState<string>(job.drive_folder_name || '');
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<JobDriveSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(!job.drive_folder_id);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const status = await api.getDriveStatus();
      setConnected(status.connected);
      // Don't auto-load folders — wait for user interaction
    } catch {
      setConnected(false);
    }
  };

  const loadFolders = async () => {
    if (foldersLoaded) return;
    setLoadingFolders(true);
    setFoldersLoaded(true);
    try {
      const folderList = await api.getDriveFolders();
      setFolders(folderList);
    } catch {
      // Silent
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleSaveFolder = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.updateJob(jobId, {
        drive_folder_id: selectedFolder || '',
        drive_folder_name: selectedFolderName || '',
      });
      setMessage('Folder saved.');
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setError('Failed to save folder configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateJob(jobId, {
        drive_folder_id: '',
        drive_folder_name: '',
      });
      setSelectedFolder('');
      setSelectedFolderName('');
      setPreview(null);
      setSyncResult(null);
      setMessage('Folder cleared.');
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setError('Failed to clear folder.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    setSyncResult(null);
    setPreview(null);
    try {
      const result = await api.previewDriveSyncForJob(jobId);
      setPreview(result);
    } catch (err) {
      setError('Preview failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const result = await api.syncDriveForJob(jobId);
      setSyncResult(result);
      setPreview(null);
      onSyncComplete?.();
    } catch (err) {
      setError('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
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
        <a href="/settings" className="text-indigo-600 hover:underline">
          Connect from Settings
        </a>
      </div>
    );
  }

  const configured = !!job.drive_folder_id;

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      {message && (
        <div className="alert-success">
          {message}
        </div>
      )}

      {/* Show folder picker or summary */}
      {showFolderPicker ? (
        <>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Drive Folder
            </label>
            {loadingFolders ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="spinner w-4 h-4" />
                Loading folders...
              </div>
            ) : folders.length === 0 ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">No folders loaded.</p>
                <button onClick={loadFolders} className="text-xs text-primary hover:text-primary/80 font-medium">
                  Load folders
                </button>
              </div>
            ) : (
              <select
                value={selectedFolder}
                onChange={(e) => {
                  setSelectedFolder(e.target.value);
                  const folder = folders.find((f) => f.id === e.target.value);
                  setSelectedFolderName(folder?.name || '');
                }}
                className="input-select"
              >
                <option value="">Select a folder...</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                    {folder.id === job.drive_folder_id ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={handleSaveFolder}
              disabled={saving || !selectedFolder}
              className="btn-secondary"
            >
              {saving ? 'Saving...' : 'Save Folder'}
            </button>
            {configured && (
              <button
                onClick={() => setShowFolderPicker(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      ) : null}

      {configured && !showFolderPicker && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-foreground">{job.drive_folder_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { loadFolders(); setShowFolderPicker(true); }} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
              Change
            </button>
            <button onClick={handleClear} disabled={saving} className="text-xs text-muted-foreground hover:text-rose-600 transition-colors">
              Clear
            </button>
          </div>
        </div>
      )}

      {configured && (
        <>
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Configured folder: <strong className="text-foreground">{job.drive_folder_name}</strong>
              </span>
            </div>
            <button
              onClick={handlePreview}
              disabled={previewing || syncing}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {previewing ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Counting files...
                </>
              ) : (
                'Preview Sync'
              )}
            </button>
          </div>

          {preview && (
            <div className="card bg-muted p-4">
              <h4 className="font-medium text-foreground mb-2">Sync Preview</h4>
              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground">Total Files</span>
                  <p className="font-semibold text-foreground">{preview.total_files}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">New Files</span>
                  <p className="font-semibold text-emerald-600">{preview.new_files}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Already Synced</span>
                  <p className="font-semibold text-muted-foreground">{preview.already_synced}</p>
                </div>
              </div>
              {preview.new_files > 0 && (
                <details className="mb-3">
                  <summary className="text-sm text-indigo-600 cursor-pointer hover:text-indigo-700">
                    Show file names ({preview.new_files})
                  </summary>
                  <ul className="mt-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
                    {preview.file_names.map((name, i) => (
                      <li key={i} className="truncate">- {name}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing || preview.new_files === 0}
                  className="btn-success flex-1 flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <div className="spinner w-4 h-4" />
                      Syncing...
                    </>
                  ) : preview.new_files === 0 ? (
                    'Nothing new to sync'
                  ) : (
                    `Sync ${preview.new_files} files to this job`
                  )}
                </button>
                <button
                  onClick={() => setPreview(null)}
                  disabled={syncing}
                  className="btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {syncResult && (
            <div className="card bg-muted p-4">
              <h4 className="font-medium text-foreground mb-2">Sync Results</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Processed</span>
                  <p className="font-semibold text-emerald-600">{syncResult.processed}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Skipped</span>
                  <p className="font-semibold text-muted-foreground">{syncResult.skipped}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Linked to Job</span>
                  <p className="font-semibold text-indigo-600">{syncResult.linked}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Already Linked</span>
                  <p className="font-semibold text-muted-foreground">{syncResult.already_linked}</p>
                </div>
              </div>
              {syncResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-rose-600 font-medium">Errors:</p>
                  <ul className="text-sm text-rose-600">
                    {syncResult.errors.map((err, i) => (
                      <li key={i}>&#8226; {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
