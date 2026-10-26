import { Permission, type PermissionName } from "./permissions"

export type PermissionInfo = { key: PermissionName; label: string; description: string }

/** Grouped, human-readable permissions for the role editor. */
export const PERMISSION_GROUPS: { heading: string; permissions: PermissionInfo[] }[] = [
  {
    heading: "General Server Permissions",
    permissions: [
      { key: "VIEW_CHANNEL", label: "View Channels", description: "Lets members see channels by default (private channels still need access)." },
      { key: "MANAGE_CHANNELS", label: "Manage Channels", description: "Create, edit, reorder or delete channels and categories." },
      { key: "MANAGE_ROLES", label: "Manage Roles", description: "Create roles and edit or assign roles below their highest role." },
      { key: "MANAGE_SERVER", label: "Manage Server", description: "Change the server's name and icon, and see every invite." },
      { key: "MANAGE_EXPRESSIONS", label: "Manage Expressions", description: "Add, rename and remove this server's custom emoji." },
      { key: "VIEW_AUDIT_LOG", label: "View Audit Log", description: "See the record of who changed what in this server." },
    ],
  },
  {
    heading: "Membership Permissions",
    permissions: [
      { key: "CREATE_INVITE", label: "Create Invite", description: "Invite new people to this server." },
      { key: "KICK_MEMBERS", label: "Kick Members", description: "Remove members below their highest role. They can rejoin with an invite." },
      { key: "BAN_MEMBERS", label: "Ban Members", description: "Permanently remove members below their highest role and delete their recent messages." },
      { key: "MODERATE_MEMBERS", label: "Timeout Members", description: "Stop members below their highest role from sending messages for a while, and server mute, deafen or disconnect them in voice." },
    ],
  },
  {
    heading: "Text Channel Permissions",
    permissions: [
      { key: "SEND_MESSAGES", label: "Send Messages", description: "Post messages in text channels." },
      { key: "ATTACH_FILES", label: "Attach Files", description: "Upload images, videos and files." },
      { key: "ADD_REACTIONS", label: "Add Reactions", description: "Add new emoji reactions to messages." },
      { key: "MENTION_EVERYONE", label: "Mention @everyone, @here and All Roles", description: "Ping everyone, or any role even if it isn't mentionable." },
      { key: "MANAGE_MESSAGES", label: "Manage Messages", description: "Delete and pin other members' messages." },
    ],
  },
  {
    heading: "Voice Channel Permissions",
    permissions: [
      { key: "CONNECT", label: "Connect", description: "Join voice channels." },
      { key: "SPEAK", label: "Speak", description: "Talk in voice channels." },
    ],
  },
  {
    heading: "Advanced Permissions",
    permissions: [
      { key: "ADMINISTRATOR", label: "Administrator", description: "Every permission, and access to every channel. Grant with care." },
    ],
  },
]

export function permissionBit(key: PermissionName): number {
  return Permission[key]
}

/** Preset role colors, as in Discord's role editor. */
export const ROLE_COLORS = [
  "#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#e91e63",
  "#f1c40f", "#e67e22", "#e74c3c", "#95a5a6", "#607d8b",
  "#11806a", "#1f8b4c", "#206694", "#71368a", "#ad1457",
  "#c27c0e", "#a84300", "#992d22", "#979c9f", "#546e7a",
]
