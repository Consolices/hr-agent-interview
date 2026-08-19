'use client';

import { useState, useEffect } from 'react';
import { api, EmailTemplate, EmailType, CandidateDetail } from '@/lib/api';

interface EmailComposerProps {
  candidate: CandidateDetail;
  onSent: () => void;
  onCancel: () => void;
  jobId?: string;
}

export default function EmailComposer({ candidate, onSent, onCancel, jobId }: EmailComposerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [emailType, setEmailType] = useState<EmailType>('interview_invitation');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const recipientEmail = candidate.extracted_data?.email;

  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      try {
        const data = await api.getEmailTemplates();
        setTemplates(data);
        // Select first template of the current type
        const defaultTemplate = data.find((t) => t.email_type === emailType);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
        }
      } catch {
        setError('Failed to load templates');
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, []);

  useEffect(() => {
    // Update selected template when email type changes
    const matchingTemplate = templates.find((t) => t.email_type === emailType);
    if (matchingTemplate) {
      setSelectedTemplateId(matchingTemplate.id);
    }
  }, [emailType, templates]);

  const handlePreviewTemplate = async () => {
    if (!selectedTemplateId) return;

    setPreviewing(true);
    setError(null);
    try {
      const preview = await api.previewEmail(candidate.id, selectedTemplateId, jobId);
      setSubject(preview.subject);
      setBody(preview.body);
    } catch {
      setError('Failed to preview template');
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    setError(null);
    try {
      const generated = await api.generateEmail(candidate.id, emailType, jobId);
      setSubject(generated.subject);
      setBody(generated.body);
    } catch {
      setError('Failed to generate email. Make sure OpenAI is configured.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required');
      return;
    }

    if (!recipientEmail) {
      setError('Candidate does not have an email address');
      return;
    }

    setSending(true);
    setError(null);
    try {
      await api.sendEmail(candidate.id, emailType, subject, body, jobId, selectedTemplateId || undefined);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('email-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.slice(0, start) + `{{${variable}}}` + body.slice(end);
      setBody(newBody);
      // Focus and set cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    }
  };

  const filteredTemplates = templates.filter((t) => t.email_type === emailType);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Compose Email</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      {/* Recipient */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">To</label>
        <input
          type="text"
          value={recipientEmail || 'No email address'}
          disabled
          className="input bg-muted opacity-75 cursor-not-allowed"
        />
      </div>

      {/* Email Type */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Email Type</label>
        <select
          value={emailType}
          onChange={(e) => setEmailType(e.target.value as EmailType)}
          className="input-select"
        >
          <option value="interview_invitation">Interview Invitation</option>
          <option value="rejection">Rejection</option>
          <option value="follow_up">Follow-up</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Template Selection */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-1">Template</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            disabled={loading}
            className="input-select"
          >
            <option value="">Select a template...</option>
            {filteredTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.is_system ? '(System)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={handlePreviewTemplate}
            disabled={!selectedTemplateId || previewing}
            className="btn-secondary"
          >
            {previewing ? 'Loading...' : 'Use Template'}
          </button>
          <button
            onClick={handleGenerateAI}
            disabled={generating}
            className="btn-secondary flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {generating ? 'Generating...' : 'Generate with AI'}
          </button>
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject..."
          className="input"
        />
      </div>

      {/* Variables */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Insert Variable</label>
        <div className="flex flex-wrap gap-1">
          {['name', 'position', 'company', 'sender_name', 'booking_link', 'score', 'strengths'].map((v) => (
            <button
              key={v}
              onClick={() => insertVariable(v)}
              className="btn-ghost text-xs px-2 py-1"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-foreground">Body</label>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              showPreview
                ? 'bg-indigo-100 text-indigo-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {showPreview ? (
          <div className="card bg-muted p-4 min-h-[200px] whitespace-pre-wrap text-sm text-foreground">
            {body || 'No content'}
          </div>
        ) : (
          <textarea
            id="email-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Email body..."
            className="input min-h-[200px] resize-y"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button
          onClick={onCancel}
          className="btn-ghost"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !subject.trim() || !body.trim() || !recipientEmail}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          {sending ? 'Sending...' : 'Send Email'}
        </button>
      </div>
    </div>
  );
}
