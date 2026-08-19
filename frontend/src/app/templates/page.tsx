'use client';

import { useState, useEffect } from 'react';
import { api, EmailTemplate, EmailType } from '@/lib/api';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<EmailType>('custom');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getEmailTemplates();
      setTemplates(data);
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formSubject.trim() || !formBody.trim()) {
      setError('All fields are required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createEmailTemplate(formName, formType, formSubject, formBody);
      setShowCreate(false);
      resetForm();
      loadTemplates();
    } catch {
      setError('Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (templateId: string) => {
    if (!formName.trim() || !formSubject.trim() || !formBody.trim()) {
      setError('All fields are required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.updateEmailTemplate(templateId, {
        name: formName,
        subject_template: formSubject,
        body_template: formBody,
      });
      setEditingId(null);
      resetForm();
      loadTemplates();
    } catch {
      setError('Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.deleteEmailTemplate(templateId);
      loadTemplates();
    } catch {
      setError('Failed to delete template');
    }
  };

  const startEditing = (template: EmailTemplate) => {
    setEditingId(template.id);
    setFormName(template.name);
    setFormType(template.email_type);
    setFormSubject(template.subject_template);
    setFormBody(template.body_template);
    setShowCreate(false);
  };

  const resetForm = () => {
    setFormName('');
    setFormType('custom');
    setFormSubject('');
    setFormBody('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowCreate(false);
    resetForm();
  };

  const getTypeBadge = (type: EmailType) => {
    const colors: Record<string, string> = {
      interview_invitation: 'badge-violet',
      rejection: 'badge-rose',
      follow_up: 'badge-indigo',
      custom: 'badge-zinc',
    };
    return colors[type] || colors.custom;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Email Templates</h1>
          <p className="text-muted-foreground mt-1">Manage email templates for candidate communication</p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setEditingId(null);
            resetForm();
          }}
          className="btn-primary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {(showCreate || editingId) && (
        <div className="card p-6 space-y-4">
          <h2 className="section-title">
            {showCreate ? 'Create New Template' : 'Edit Template'}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Technical Interview Invitation"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as EmailType)}
                disabled={!!editingId}
                className="input-select disabled:opacity-50"
              >
                <option value="interview_invitation">Interview Invitation</option>
                <option value="rejection">Rejection</option>
                <option value="follow_up">Follow-up</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Subject Template
            </label>
            <input
              type="text"
              value={formSubject}
              onChange={(e) => setFormSubject(e.target.value)}
              placeholder="e.g., Interview Invitation: {{position}} at {{company}}"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Body Template
            </label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={10}
              placeholder="Write your email template here. Use {{variable}} for placeholders."
              className="input font-mono text-sm"
            />
          </div>

          <div className="bg-muted border border-border rounded-lg p-4">
            <p className="text-sm font-medium text-foreground mb-2">Available Variables:</p>
            <div className="flex flex-wrap gap-2">
              {['name', 'email', 'position', 'company', 'sender_name', 'booking_link', 'score', 'recommendation', 'strengths', 'weaknesses'].map((v) => (
                <span key={v} className="badge-indigo font-mono text-[11px]">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={cancelEdit}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => (showCreate ? handleCreate() : handleUpdate(editingId!))}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Saving...
                </>
              ) : showCreate ? 'Create Template' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-6">
        {/* System Templates */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            System Templates
          </h3>
          <div className="grid gap-4">
            {templates
              .filter((t) => t.is_system)
              .map((template) => (
                <TemplateCard key={template.id} template={template} getTypeBadge={getTypeBadge} />
              ))}
          </div>
        </div>

        {/* Custom Templates */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Custom Templates
          </h3>
          {templates.filter((t) => !t.is_system).length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="empty-state-title">No custom templates yet</p>
                <p className="empty-state-desc">Create one to get started with personalized email communication.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates
                .filter((t) => !t.is_system)
                .map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    getTypeBadge={getTypeBadge}
                    onEdit={() => startEditing(template)}
                    onDelete={() => handleDelete(template.id)}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: EmailTemplate;
  getTypeBadge: (type: EmailType) => string;
  onEdit?: () => void;
  onDelete?: () => void;
}

function TemplateCard({ template, getTypeBadge, onEdit, onDelete }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card-interactive overflow-hidden">
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={getTypeBadge(template.email_type)}>
                {template.email_type.replace('_', ' ')}
              </span>
              {template.is_system && (
                <span className="badge-sky">
                  System
                </span>
              )}
            </div>
            <h4 className="font-medium text-foreground">{template.name}</h4>
            <p className="text-sm text-muted-foreground mt-1 truncate max-w-lg">
              Subject: {template.subject_template}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!template.is_system && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                  className="p-1 text-muted-foreground hover:text-indigo-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.();
                  }}
                  className="p-1 text-muted-foreground hover:text-rose-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
            <svg
              className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? 'transform rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 bg-muted">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Subject</p>
              <p className="text-sm text-foreground font-mono mt-0.5">{template.subject_template}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Body</p>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-mono bg-background p-3 rounded-lg border border-border max-h-64 overflow-auto mt-0.5">
                {template.body_template}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
