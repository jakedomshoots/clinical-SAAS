import type { UUID } from './common';

export interface Message {
  id: UUID;
  sender_id: UUID;
  sender_name: string;
  recipient_id: UUID;
  recipient_name: string;
  subject: string;
  body: string;
  thread_id: UUID | null;
  is_read: boolean;
  created_at: string;
}

export interface MessageThread {
  id: UUID;
  subject: string;
  participants: { id: UUID; name: string }[];
  last_message: Message;
  unread_count: number;
}

export interface MessageSend {
  recipient_id: UUID;
  subject: string;
  body: string;
  thread_id?: UUID;
}
