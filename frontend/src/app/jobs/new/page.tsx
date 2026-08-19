'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, JobCreate, JobStatus, ResponseQuestion, DEFAULT_RESPONSE_QUESTIONS } from '@/lib/api';
import { labelToKey, ensureUniqueKey } from '@/lib/utils';

export default function NewJobPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseQuestions, setResponseQuestions] = useState<ResponseQuestion[]>([...DEFAULT_RESPONSE_QUESTIONS]);

  const [form, setForm] = useState<JobCreate>({
    title: '',
    description: '',
    status: 'open',
    company_name: 'Your Company',
    position_title: '',
    sender_name: 'HR Team',
    trafft_booking_link: '',
    sender_email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Job title is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Auto-generate keys from labels before creating
      const usedKeys: string[] = [];
      const questionsWithKeys = responseQuestions.map((q) => {
        const baseKey = labelToKey(q.label) || q.key;
        const uniqueKey = ensureUniqueKey(baseKey, usedKeys);
        usedKeys.push(uniqueKey);
        return { ...q, key: uniqueKey };
      });

      const job = await api.createJob({
        ...form,
        position_title: form.position_title || form.title,
        trafft_booking_link: form.trafft_booking_link || undefined,
        sender_email: form.sender_email || undefined,
        response_questions: questionsWithKeys,
      });
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/jobs"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 transition-colors"
        >
          &larr; Back to jobs
        </Link>
        <h1 className="page-title">Create New Job</h1>
        <p className="text-sm text-muted-foreground mt-1">Set up a new job posting for candidate screening</p>
      </div>

      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Details */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title">Job Details</h2>

          <div>
            <label className="block text-[13px] font-medium text-muted-foreground mb-1">
              Job Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Senior Frontend Developer"
              className="input"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as JobStatus })}
              className="input-select"
            >
              <option value="open">Open</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-muted-foreground mb-1">
              Job Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={10}
              placeholder="Paste the full job description here. The AI will use this to evaluate candidates."
              className="input font-mono resize-y"
            />
          </div>
        </div>

        {/* Company & Sender Settings */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title">Company & Sender Settings</h2>
          <p className="text-sm text-muted-foreground">
            These settings are used in email templates for this job. They override global defaults.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Company Name</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Position Title</label>
              <input
                type="text"
                value={form.position_title}
                onChange={(e) => setForm({ ...form, position_title: e.target.value })}
                placeholder={form.title || 'Defaults to job title'}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Sender Name</label>
              <input
                type="text"
                value={form.sender_name}
                onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                placeholder="e.g., HR Team"
                className="input"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-muted-foreground mb-1">Trafft Booking Link</label>
              <input
                type="url"
                value={form.trafft_booking_link}
                onChange={(e) => setForm({ ...form, trafft_booking_link: e.target.value })}
                placeholder="https://your-trafft-link.com/booking"
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Response Questions */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Response Questions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Define the questions from your Google Form. Each question name will appear as a column to map during Sheet Import below, and the AI will score candidates on each one.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResponseQuestions([...responseQuestions, { key: '', label: '', description: '' }])}
              className="btn-ghost text-indigo-600 hover:text-indigo-700"
            >
              + Add Question
            </button>
          </div>

          <div className="space-y-3">
            {responseQuestions.map((q, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4 space-y-3 bg-muted">
                <div className="flex items-start justify-between">
                  <span className="text-[13px] font-medium text-muted-foreground">Question {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setResponseQuestions(responseQuestions.filter((_, i) => i !== idx))}
                    className="text-[13px] text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <div>
                  <label className="block text-[13px] text-muted-foreground mb-1">Question Name</label>
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => {
                      const updated = [...responseQuestions];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setResponseQuestions(updated);
                    }}
                    placeholder="e.g., Introduction & Motivation"
                    className="input"
                  />
                  {q.label && (
                    <span className="text-[13px] text-muted-foreground mt-1 block">
                      key: {labelToKey(q.label) || '...'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-[13px] text-muted-foreground mb-1">AI Scoring Criteria</label>
                  <input
                    type="text"
                    value={q.description}
                    onChange={(e) => {
                      const updated = [...responseQuestions];
                      updated[idx] = { ...updated[idx], description: e.target.value };
                      setResponseQuestions(updated);
                    }}
                    placeholder="e.g., Clarity, relevance to role, genuine motivation"
                    className="input"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/jobs" className="btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 spinner" />
                Creating...
              </>
            ) : (
              'Create Job'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
