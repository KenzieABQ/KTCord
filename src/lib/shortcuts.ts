/** Keyboard shortcuts, as listed in the shortcuts dialog and Settings → Keybinds. "Mod" is ⌘ on Apple devices, Ctrl elsewhere. */
export const SHORTCUT_GROUPS: { heading: string; items: { keys: string[]; description: string }[] }[] = [
  {
    heading: "Navigation",
    items: [
      { keys: ["Mod", "K"], description: "Jump to a channel, conversation or server" },
      { keys: ["Alt", "↑"], description: "Previous channel" },
      { keys: ["Alt", "↓"], description: "Next channel" },
      { keys: ["Alt", "Shift", "↑"], description: "Previous unread channel" },
      { keys: ["Alt", "Shift", "↓"], description: "Next unread channel" },
      { keys: ["Mod", "/"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    heading: "Chat",
    items: [
      { keys: ["Esc"], description: "Close the side panel, or mark the channel as read" },
      { keys: ["Shift", "Esc"], description: "Mark the server as read" },
      { keys: ["↑"], description: "Edit your last message (in an empty message box)" },
      { keys: ["Shift", "Enter"], description: "New line in a message" },
      { keys: ["Mod", "Shift", "U"], description: "Upload a file" },
      { keys: ["Shift"], description: "Hold while deleting to skip the confirmation" },
    ],
  },
]

/** Window event fired (with the channel id as detail) when Escape marks a channel as read. */
export const MARK_READ_EVENT = "ktcord:mark-read"

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}

export function formatKey(key: string, apple: boolean): string {
  if (key === "Mod") return apple ? "⌘" : "Ctrl"
  if (key === "Alt") return apple ? "⌥" : "Alt"
  if (key === "Shift") return apple ? "⇧" : "Shift"
  return key
}

/**
 * The id after (or before) `current` in `ids`, wrapping around. With `include`, only ids
 * passing it are candidates. Returns undefined when there's nowhere else to go.
 */
export function adjacentId(
  ids: string[],
  current: string | undefined,
  direction: 1 | -1,
  include: (id: string) => boolean = () => true
): string | undefined {
  if (ids.length === 0) return undefined
  const n = ids.length
  const at = current ? ids.indexOf(current) : -1
  // Not in the list: going forward starts at the first id, going back at the last.
  const from = at !== -1 ? at : direction === 1 ? -1 : n
  for (let step = 1; step <= n; step++) {
    const id = ids[(((from + step * direction) % n) + n) % n]
    if (id !== current && include(id)) return id
  }
  return undefined
}

/** Whether `target` is a text field, where typing (and Escape) belong to the field. */
export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable=true]"))
}

/** Whether an event is a single printable character typed without Ctrl/⌘/Alt. */
export function isPrintableKey(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">): boolean {
  return e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey
}
