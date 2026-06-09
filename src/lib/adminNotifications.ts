import AsyncStorage from "@react-native-async-storage/async-storage";

// Shared read-state for the admin notification bell, used by both the menu
// screen and the chat screen so the unread badge stays consistent across them.

export type ReadNotificationMap = Record<string, number>;

const READ_NOTIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readNotificationsKey(userId: string): string {
  return `mcc:admin-notifications-read:${userId}`;
}

export function directChatNotificationId(chat: { id: string; last_message_at: string | null }): string {
  return `direct-chat:${chat.id}:${chat.last_message_at ?? "new"}`;
}

export function pruneReadNotifications(readNotifications: ReadNotificationMap): ReadNotificationMap {
  const now = Date.now();
  return Object.fromEntries(Object.entries(readNotifications).filter(([, readAt]) => now - readAt < READ_NOTIFICATION_TTL_MS));
}

export async function loadReadNotifications(userId: string): Promise<ReadNotificationMap> {
  const value = await AsyncStorage.getItem(readNotificationsKey(userId));
  if (!value) return {};
  try {
    return pruneReadNotifications(JSON.parse(value) as ReadNotificationMap);
  } catch {
    return {};
  }
}

export async function saveReadNotifications(userId: string, readNotifications: ReadNotificationMap): Promise<void> {
  await AsyncStorage.setItem(readNotificationsKey(userId), JSON.stringify(pruneReadNotifications(readNotifications)));
}

export async function markNotificationRead(userId: string, id: string): Promise<ReadNotificationMap> {
  const current = await loadReadNotifications(userId);
  const next = { ...current, [id]: Date.now() };
  await saveReadNotifications(userId, next);
  return next;
}

export function isNotificationVisible(id: string, readNotifications: ReadNotificationMap): boolean {
  const readAt = readNotifications[id];
  return !readAt || Date.now() - readAt < READ_NOTIFICATION_TTL_MS;
}

export function isNotificationUnread(id: string, readNotifications: ReadNotificationMap): boolean {
  return !readNotifications[id];
}
