/** Every TanStack Query key in one place, so the Realtime layer can patch the right cache entries. */
export const qk = {
  profile: (userId: string) => ["profile", userId] as const,
  servers: (userId: string) => ["servers", userId] as const,
  channels: (serverId: string) => ["channels", serverId] as const,
  members: (serverId: string) => ["members", serverId] as const,
  roles: (serverId: string) => ["roles", serverId] as const,
  invites: (serverId: string) => ["invites", serverId] as const,
  invitePreview: (code: string) => ["invite-preview", code] as const,
  messages: (channelId: string) => ["messages", channelId] as const,
  message: (messageId: string) => ["message", messageId] as const,
  unreadState: (userId: string) => ["unread-state", userId] as const,
}
