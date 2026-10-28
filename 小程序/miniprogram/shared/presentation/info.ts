// Pure view shapes for unavailable information feeds.

export type OrderMessageView = {
  id: string;
  orderId: string;
  title: string;
  content: string;
  timeText: string;
  deviceName: string;
  statusText: string;
};

export type PrivateConversationView = {
  id: string;
  orderId: string;
  avatarText: string;
  counterpartName: string;
  counterpartRoleText: string;
  deviceName: string;
  lastMessage: string;
  timeText: string;
  statusText: string;
  deviceImage: string;
  activityAt: string;
};

export function formatInfoTime(value?: string | null): string {
  if (!value) return '';
  return value.replace('T', ' ').slice(0, 16);
}
