import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';
import { InlineAssistantProposals } from '@/components/assistant/inline-proposals';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import type { Message, MessageThread } from '@concierge-os/shared';
import { Send, Loader2, User, MessageSquare } from 'lucide-react';

interface ThreadListResponse {
  data: MessageThread[];
  total: number;
}

const RECIPIENTS = [
  { id: '00000000-0000-4000-8000-000000000101', name: 'Mary Collins' },
  { id: '00000000-0000-4000-8000-000000000103', name: 'Sofia Nguyen' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Maya Chen, MA' },
  { id: '00000000-0000-4000-8000-000000000005', name: 'Sam Rivera' },
];

const MESSAGE_TEMPLATES = [
  { label: 'Check-in instructions', text: 'Hi, this is ConciergeOS. Please arrive 15 minutes before your scheduled appointment time and bring a valid photo ID and insurance card. Let us know if you need to reschedule.' },
  { label: 'Missing documents', text: 'Hi, we are still missing some intake documents for your upcoming visit. Please click the portal link to fill out the Patient Intake Form before your appointment.' },
  { label: 'Billing inquiry update', text: 'Hello, we have reviewed your insurance claim. The eligibility check has passed and your estimated copay is now updated in the billing center.' },
  { label: 'Post-visit care check', text: 'Hi, we are checking in after your recent visit. How are you feeling? If you have any questions about your care plan, please reply here.' }
];

function clearThreadUnreadFromQueryData<T>(value: T, threadId: string): T {
  if (!value || typeof value !== 'object' || !('data' in value)) return value;
  const candidate = value as { data?: unknown };
  if (!Array.isArray(candidate.data)) return value;

  let changed = false;
  const data = candidate.data.map((item) => {
    if (
      item &&
      typeof item === 'object' &&
      'id' in item &&
      'unread_count' in item &&
      item.id === threadId &&
      typeof item.unread_count === 'number' &&
      item.unread_count > 0
    ) {
      changed = true;
      return { ...item, unread_count: 0 };
    }
    return item;
  });

  return changed ? ({ ...value, data } as T) : value;
}

export const Route = createFileRoute('/messaging/')({
  component: MessagesPage,
});

import { useDocumentTitle } from '@/hooks/use-document-title';

function MessagesPage() {
  useDocumentTitle('Messages');
  const api = useApi();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [recipientId, setRecipientId] = useState(RECIPIENTS[0].id);
  const [replyMessage, setReplyMessage] = useState('');
  const [showCompose, setShowCompose] = useState(false);

  const {
    data: threads,
    isLoading: threadsLoading,
    isError: threadsError,
    error: threadError,
  } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'threads'],
    queryFn: () => api.get<ThreadListResponse>('/messages/threads'),
  });

  const {
    data: messages,
    isLoading: msgsLoading,
    isError: messagesError,
    error: messageError,
  } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'threads', selectedThread],
    queryFn: () => {
      if (!selectedThread) return [];
      return api.get<Message[]>(`/messages/threads/${selectedThread}`);
    },
    enabled: !!selectedThread,
  });

  const sendMutation = useMutation({
    mutationFn: (data: {
      recipient_id: string;
      subject: string;
      body: string;
      thread_id?: string;
    }) => api.post('/messages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.MESSAGES, 'threads'] });
      if (selectedThread)
        queryClient.invalidateQueries({
          queryKey: [...QUERY_KEYS.MESSAGES, 'threads', selectedThread],
        });
      setNewMessage('');
      setNewSubject('');
      setReplyMessage('');
      setShowCompose(false);
      toast.success('Message sent successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    },
  });

  const markThreadReadMutation = useMutation({
    mutationFn: (threadId: string) => api.post<Message[]>(`/messages/threads/${threadId}/read`),
    onMutate: async (threadId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.MESSAGES });
      queryClient.setQueriesData({ queryKey: QUERY_KEYS.MESSAGES }, (previous) =>
        clearThreadUnreadFromQueryData(previous, threadId)
      );
    },
    onSettled: async (_data, _error, threadId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MESSAGES }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.THREAD(threadId) }),
      ]);
    },
  });

  function openThread(thread: MessageThread) {
    setSelectedThread(thread.id);
    if (thread.unread_count > 0) {
      markThreadReadMutation.mutate(thread.id);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-display text-ink">Messages</h1>
        <p className="text-small text-ink-muted mt-1">
          Patient and staff conversations stay draftable until a human sends them.
        </p>
      </div>

      <div className="mb-6">
        <InlineAssistantProposals title="Message command proposals" routePath="/messaging" />
      </div>

      <div className="flex min-h-[32rem] flex-col gap-0 overflow-hidden border border-border lg:flex-row">
        <div className="max-h-80 shrink-0 border-b border-border flex flex-col lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-3">
            <button onClick={() => setShowCompose(true)} className="w-full btn btn-primary">
              New Message
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {threadsLoading ? (
              <LoadingState label="Loading threads" />
            ) : threadsError ? (
              <div className="p-3">
                <ErrorState
                  title="Unable to load messages"
                  detail={
                    threadError instanceof Error
                      ? threadError.message
                      : 'Message threads could not be loaded.'
                  }
                />
              </div>
            ) : (
              threads?.data.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => openThread(thread)}
                  className={`w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas-sunk/50 ${
                    selectedThread === thread.id ? 'bg-canvas-sunk' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-small truncate max-w-[200px] ${thread.unread_count > 0 ? 'font-medium text-ink' : 'text-ink-muted'}`}
                    >
                      {thread.subject}
                    </span>
                    {thread.unread_count > 0 && (
                      <span className="inline-flex items-center rounded-pill bg-accent text-accent-on px-2 py-0.5 text-micro font-medium">
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-micro text-ink-muted">
                    <User className="h-3 w-3" />
                    {thread.participants.map((p) => p.name).join(', ')}
                  </div>
                  <div className="mt-0.5 text-micro text-ink-faint truncate">
                    {thread.last_message.body.slice(0, 60)}
                  </div>
                </button>
              ))
            )}
            {!threadsLoading && !threadsError && (!threads?.data || threads.data.length === 0) && (
              <EmptyState
                title="No messages yet"
                detail="Start a new patient or staff conversation, or seed demo conversations from Setup."
                icon={MessageSquare}
                action={
                  <button
                    type="button"
                    onClick={() => setShowCompose(true)}
                    className="btn btn-primary"
                  >
                    New message
                  </button>
                }
              />
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {showCompose && (
            <div className="border-b border-border p-4">
              <div className="mb-3">
                <label className="mb-1 block text-small font-medium text-ink-secondary">To</label>
                <select
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
                >
                  {RECIPIENTS.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
                  placeholder="Subject"
                />
              </div>
              <div className="mb-2">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-micro font-medium text-ink-muted self-center mr-1">Templates:</span>
                  {MESSAGE_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.label}
                      type="button"
                      onClick={() => {
                        setNewMessage(tmpl.text);
                        if (!newSubject) {
                          setNewSubject(tmpl.label);
                        }
                      }}
                      className="rounded-pill bg-canvas-sunk border border-border px-2 py-0.5 text-micro text-ink hover:bg-border transition-colors duration-150 cursor-pointer"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
                  rows={2}
                  placeholder="Type your message..."
                />
                <button
                  onClick={() => {
                    if (recipientId && newSubject && newMessage) {
                      sendMutation.mutate({
                        recipient_id: recipientId,
                        subject: newSubject,
                        body: newMessage,
                      });
                    }
                  }}
                  disabled={sendMutation.isPending || !recipientId || !newSubject || !newMessage}
                  className="btn btn-primary self-end"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {selectedThread ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {msgsLoading ? (
                  <LoadingState label="Loading conversation" />
                ) : messagesError ? (
                  <ErrorState
                    title="Unable to load conversation"
                    detail={
                      messageError instanceof Error
                        ? messageError.message
                        : 'This conversation could not be loaded.'
                    }
                  />
                ) : (
                  messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md rounded-lg px-4 py-3 text-sm ${
                          msg.sender_id === user?.id
                            ? 'bg-accent text-accent-on'
                            : 'bg-canvas-sunk text-ink'
                        }`}
                      >
                        <div className="mb-1 font-mono text-micro text-ink-faint">
                          {msg.sender_name}
                        </div>
                        <div>{msg.body}</div>
                        <div className="mt-1 text-right font-mono text-micro text-ink-faint">
                          {new Date(msg.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-border p-3">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-micro font-medium text-ink-muted self-center mr-1">Templates:</span>
                  {MESSAGE_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.label}
                      type="button"
                      onClick={() => setReplyMessage(tmpl.text)}
                      className="rounded-pill bg-canvas-sunk border border-border px-2 py-0.5 text-micro text-ink hover:bg-border transition-colors duration-150 cursor-pointer"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    className="min-h-16 flex-1 bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
                    placeholder="Reply to this thread..."
                  />
                  <button
                    onClick={() => {
                      const thread = threads?.data.find((item) => item.id === selectedThread);
                      const recipient = thread?.participants.find(
                        (participant) => participant.id !== user?.id
                      );
                      if (selectedThread && thread && recipient && replyMessage.trim()) {
                        sendMutation.mutate({
                          recipient_id: recipient.id,
                          subject: thread.subject,
                          body: replyMessage,
                          thread_id: selectedThread,
                        });
                      }
                    }}
                    disabled={!replyMessage.trim() || sendMutation.isPending}
                    className="btn btn-primary self-end"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 text-ink-faint" />
                <p className="text-small text-ink-muted">
                  Select a conversation or start a new message
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
