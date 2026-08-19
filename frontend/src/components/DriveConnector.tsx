'use client';

import { useState, useEffect } from 'react';
import { api, DriveStatus, DriveFolder, SyncPreview, SyncResult } from '@/lib/api';
import SheetSyncFlow from './SheetSyncFlow';

interface DriveConnectorProps {
  onSyncComplete?: (result: SyncResult) => void;
}

type ActiveTab = 'form-responses' | 'drive-folder';

export default function DriveConnector({ onSyncComplete }: DriveConnectorProps) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('form-responses');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const driveStatus = await api.getDriveStatus();
      setStatus(driveStatus);

      if (driveStatus.connected) {
        const folderList = await api.getDriveFolders();
        setFolders(folderList);
      }
    } catch {
      setError('Failed to check Drive status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { auth_url } = await api.connectDrive();
      window.location.href = auth_url;
    } catch {
      setError('Failed to start authentication');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectDrive();
      setStatus({ connected: false, auth_url: null });
      setFolders([]);
    } catch {
      setError('Failed to disconnect');
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      setError(null);
      setSyncResult(null);
      setPreview(null);

      const result = await api.syncDrivePreview(selectedFolder || undefined);
      setPreview(result);
    } catch (err) {
      setError('Preview failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSyncResult(null);

      const result = await api.syncDrive(selectedFolder || undefined);
      setSyncResult(result);
      setPreview(null);

      if (onSyncComplete) {
        onSyncComplete(result);
      }
    } catch (err) {
      setError('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center">
          <div className="spinner w-5 h-5" />
          <span className="ml-2 text-muted-foreground">Checking connection...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-8 h-8 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.71 3.5L1.15 15l3.42 5.5h4.74l-3.43-5.5L12 3.5H7.71zm8.57 0L10.2 15l3.43 5.5h4.74l-3.43-5.5 6.07-11.5H16.28z" />
        </svg>
        <div>
          <h3 className="font-semibold text-foreground">Google Drive</h3>
          <div className="flex items-center gap-1.5 text-sm">
            <div className={`w-2 h-2 rounded-full ${status?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-muted-foreground">
              {status?.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 alert-error">
          {error}
        </div>
      )}

      {!status?.connected ? (
        <button
          onClick={handleConnect}
          className="btn-primary w-full"
        >
          Connect Google Drive
        </button>
      ) : (
        <div className="space-y-4">
          {/* Tab Controls */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('form-responses')}
              className={`tab ${activeTab === 'form-responses' ? 'tab-active' : ''}`}
            >
              Form Responses
            </button>
            <button
              onClick={() => setActiveTab('drive-folder')}
              className={`tab ${activeTab === 'drive-folder' ? 'tab-active' : ''}`}
            >
              Drive Folder
            </button>
            <div className="flex-1" />
            <button
              onClick={handleDisconnect}
              className="btn-ghost text-sm text-muted-foreground hover:text-rose-600"
            >
              Disconnect
            </button>
          </div>

          {/* Tab Content: Form Responses */}
          {activeTab === 'form-responses' && <SheetSyncFlow />}

          {/* Tab Content: Drive Folder */}
          {activeTab === 'drive-folder' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Select Folder (Optional)
                </label>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="input-select"
                >
                  <option value="">All Files (Root)</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePreview}
                  disabled={previewing || syncing}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {previewing ? (
                    <>
                      <div className="spinner w-4 h-4" />
                      Counting files...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Sync CVs
                    </>
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
                        `Confirm - Sync ${preview.new_files} files`
                      )}
                    </button>
                    <button
                      onClick={handleCancelPreview}
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
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Files</span>
                      <p className="font-semibold text-foreground">{syncResult.total_files}</p>
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
                      <ul className="text-sm text-rose-600">
                        {syncResult.errors.map((err, i) => (
                          <li key={i}>&#8226; {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
