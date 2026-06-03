import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { QUERY_KEYS } from '@concierge-os/shared';
import type { Message, MessageThread } from '@concierge-os/shared';
import { Send, Loader2, Mail, User, ArrowLeft } from 'lucide-react';

interface ThreadListResponse {
  data: MessageThread[];
  total: number;
}

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
  const [recipientId, setRecipientId] = useState('');
  const [showCompose, setShowCompose] = useState(false);

  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'threads'],
    queryFn: () => api.get<ThreadListResponse>('/messages/threads'),
  });

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'threads', selectedThread],
    queryFn: () => {
      if (!selectedThread) return [];
      return api.get<Message[]>(`/messages/threads/${selectedThread}`);
    },
    enabled: !!selectedThread,
  });

  const sendMutation = useMutation({
    mutationFn: (data: { recipient_id: string; subject: string; body: string }) =>
      api.post('/messages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.MESSAGES, 'threads'] });
      setNewMessage('');
      setNewSubject('');
      setShowCompose(false);
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-clinic-800">Messages</h1>

      <div className="flex gap-0 rounded-lg border border-clinic-200 bg-white overflow-hidden" style={{ minHeight: '32rem' }}>
        <div className="w-80 shrink-0 border-r border-clinic-200 flex flex-col">
          <div className="border-b border-clinic-200 p-3">
            <button
              onClick={() => setShowCompose(true)}
              className="w-full rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
            >
              New Message
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threadsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-clinic-400" />
              </div>
            ) : (
              threads?.data.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThread(thread.id)}
                  className={`w-full border-b border-clinic-100 px-4 py-3 text-left transition-colors hover:bg-clinic-50 ${
                    selectedThread === thread.id ? 'bg-clinic-100' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-clinic-800 truncate max-w-[200px]">
                      {thread.subject}
                    </span>
                    {thread.unread_count > 0 && (
                      <span className="rounded-full bg-accent-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-clinic-500">
                    <User className="h-3 w-3" />
                    {thread.participants.map((p) => p.name).join(', ')}
                  </div>
                  <div className="mt-0.5 text-xs text-clinic-400 truncate">
                    {thread.last_message.body.slice(0, 60)}
                  </div>
                </button>
              ))
            )}
            {(!threads?.data || threads.data.length === 0) && (
              <p className="px-4 py-8 text-center text-sm text-clinic-400">No messages yet</p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {showCompose && (
            <div className="border-b border-clinic-200 p-4">
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-clinic-500">To (User ID)</label>
                <input
                  type="text"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="w-full rounded-md border border-clinic-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  placeholder="user-uuid-here"
                />
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-md border border-clinic-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  placeholder="Subject"
                />
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 rounded-md border border-clinic-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
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
                  className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50 self-end"
                >
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {selectedThread ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {msgsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-clinic-400" />
                </div>
              ) : (
                messages?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-md rounded-lg px-4 py-3 text-sm ${
                      msg.sender_id === user?.id
                        ? 'bg-accent-600 text-white'
                        : 'bg-clinic-100 text-clinic-800'
                    }`}>
                      <div className="mb-1 text-xs opacity-70">{msg.sender_name}</div>
                      <div>{msg.body}</div>
                      <div className="mt-1 text-right text-xs opacity-60">
                        {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="mx-auto mb-3 h-8 w-8 text-clinic-300" />
                <p className="text-sm text-clinic-400">Select a conversation or start a new message</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
