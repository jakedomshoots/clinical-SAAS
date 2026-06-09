import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import type { Message, MessageThread } from '@concierge-os/shared';
import { Send, Loader2, Mail, User, MessageSquare } from 'lucide-react';

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

export const Route = createFileRoute('/messaging/')({
  component: MessagesPage,
});

function MessagesPage() {
  const api = useApi();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [recipientId, setRecipientId] = useState(RECIPIENTS[0].id);
  const [replyMessage, setReplyMessage] = useState('');
  const [showCompose, setShowCompose] = useState(false);

  const { data: threads, isLoading: threadsLoading, isError: threadsError, error: threadError } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'threads'],
    queryFn: () => api.get<ThreadListResponse>('/messages/threads'),
  });

  const { data: messages, isLoading: msgsLoading, isError: messagesError, error: messageError } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'threads', selectedThread],
    queryFn: () => {
      if (!selectedThread) return [];
      return api.get<Message[]>(`/messages/threads/${selectedThread}`);
    },
    enabled: !!selectedThread,
  });

  const sendMutation = useMutation({
    mutationFn: (data: { recipient_id: string; subject: string; body: string; thread_id?: string }) =>
      api.post('/messages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.MESSAGES, 'threads'] });
      if (selectedThread) queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.MESSAGES, 'threads', selectedThread] });
      setNewMessage('');
      setNewSubject('');
      setReplyMessage('');
      setShowCompose(false);
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-display text-ink">Messages</h1>
        <p className="text-small text-ink-muted mt-1">Patient and staff conversations stay draftable until a human sends them.</p>
      </div>

      <div className="flex min-h-[32rem] flex-col gap-0 overflow-hidden border border-border lg:flex-row">
        <div className="max-h-80 shrink-0 border-b border-border flex flex-col lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-3">
            <button
              onClick={() => setShowCompose(true)}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on hover:bg-accent-hover"
            >
              New Message
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {threadsLoading ? (
              <LoadingState label="Loading threads" />
            ) : threadsError ? (
              <div className="p-3">
                <ErrorState title="Unable to load messages" detail={threadError instanceof Error ? threadError.message : 'Message threads could not be loaded.'} />
              </div>
            ) : (
              threads?.data.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThread(thread.id)}
                  className={`w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas-sunk/50 ${
                    selectedThread === thread.id ? 'bg-canvas-sunk' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-small truncate max-w-[200px] ${thread.unread_count > 0 ? 'font-medium text-ink' : 'text-ink-muted'}`}>
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
                action={<button type="button" onClick={() => setShowCompose(true)} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-on hover:bg-accent-hover">New message</button>}
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
                    <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
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
                      sendMutation.mutate({ recipient_id: recipientId, subject: newSubject, body: newMessage });
                    }
                  }}
                  disabled={sendMutation.isPending || !recipientId || !newSubject || !newMessage}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on hover:bg-accent-hover disabled:opacity-50 self-end"
                >
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
                  <ErrorState title="Unable to load conversation" detail={messageError instanceof Error ? messageError.message : 'This conversation could not be loaded.'} />
                ) : (
                  messages?.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md rounded-lg px-4 py-3 text-sm ${
                        msg.sender_id === user?.id
                          ? 'bg-accent text-accent-on'
                          : 'bg-canvas-sunk text-ink'
                      }`}>
                        <div className="mb-1 font-mono text-micro text-ink-faint">{msg.sender_name}</div>
                        <div>{msg.body}</div>
                        <div className="mt-1 text-right font-mono text-micro text-ink-faint">
                          {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-border p-3">
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
                      const recipient = thread?.participants.find((participant) => participant.id !== user?.id);
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
                    className="self-end rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on hover:bg-accent-hover disabled:opacity-50"
                  >
                    {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 text-ink-faint" />
                <p className="text-small text-ink-muted">Select a conversation or start a new message</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
