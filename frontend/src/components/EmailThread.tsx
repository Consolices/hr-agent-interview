'use client';

import { useState, useEffect } from 'react';
import { api, SentEmail, EmailThread as EmailThreadType, ThreadMessage } from '@/lib/api';

interface EmailThreadProps {
  email: SentEmail;
}

export default function EmailThread({ email }: EmailThreadProps) {
  const [thread, setThread] = useState<EmailThreadType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadThread = async () => {
    if (!email.gmail_thread_id) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.getEmailThread(email.id);
      setThread(data);
    } catch {
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && !thread && email.gmail_thread_id) {
      loadThread();
    }
  }, [expanded, email.gmail_thread_id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusBadge = () => {
    switch (email.reply_status) {
      case 'replied':
        return (
          <span className="badge-emerald">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Replied
          </span>
        );
      case 'bounced':
        return (
          <span className="badge-rose">
            Bounced
          </span>
        );
      default:
        return (
          <span className="badge-amber">
            Awaiting Reply
          </span>
        );
    }
  };

  const getEmailTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      interview_invitation: 'badge-violet',
      rejection: 'badge-rose',
      follow_up: 'badge-indigo',
      custom: 'badge-zinc',
    };
    return colors[type] || colors.custom;
  };

  return (
    <div className="card overflow-hidden">
      {/* Email Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={getEmailTypeBadge(email.email_type)}>
              {email.email_type.replace('_', ' ')}
            </span>
            {getStatusBadge()}
            {email.reply_count > 0 && (
              <span className="text-xs text-muted-foreground">
                {email.reply_count} {email.reply_count === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>
          <h4 className="font-medium text-foreground truncate">{email.subject}</h4>
          <p className="text-sm text-muted-foreground">
            To: {email.to_address} · {formatDate(email.sent_at)}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border">
          {loading ? (
            <div className="p-4 flex items-center justify-center">
              <div className="spinner w-5 h-5" />
            </div>
          ) : error ? (
            <div className="p-4"><div className="alert-error">{error}</div></div>
          ) : thread ? (
            <div className="p-4 space-y-3">
              {thread.messages.map((msg, index) => (
                <div key={msg.id} className="relative">
                  {index > 0 && (
                    <div className="absolute left-4 -top-3 h-3 border-l-2 border-border" />
                  )}
                  <MessageBubble message={msg} isFirst={index === 0} />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <div className="bg-muted border border-border rounded-lg p-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{email.body}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, isFirst }: { message: ThreadMessage; isFirst: boolean }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className={`rounded-lg p-3 ${
      message.is_outbound
        ? 'bg-muted border border-border'
        : 'bg-indigo-50 border border-indigo-100'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium ${
          message.is_outbound ? 'bg-indigo-600' : 'bg-emerald-600'
        }`}>
          {message.is_outbound ? 'You' : message.from_address.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {message.is_outbound ? 'You' : message.from_address}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(message.timestamp)}</p>
        </div>
      </div>
      {!isFirst && (
        <p className="text-xs text-muted-foreground mb-1">
          <span className="font-medium">Subject:</span> {message.subject}
        </p>
      )}
      <div className="text-sm text-foreground whitespace-pre-wrap">{message.body}</div>
    </div>
  );
}
