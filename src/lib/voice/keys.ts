const NAMED: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Space: "Space",
  CapsLock: "Caps Lock",
  ControlLeft: "Left Ctrl",
  ControlRight: "Right Ctrl",
  ShiftLeft: "Left Shift",
  ShiftRight: "Right Shift",
  AltLeft: "Left Alt",
  AltRight: "Right Alt",
  MetaLeft: "Left ⌘",
  MetaRight: "Right ⌘",
}

/** A readable name for a KeyboardEvent.code, for the push-to-talk setting. */
export function formatKeyCode(code: string): string {
  if (NAMED[code]) return NAMED[code]
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad/.test(code)) return `Num ${code.slice(6)}`
  return code.replace(/([a-z])([A-Z])/g, "$1 $2")
}

/** Keys that don't type anything, so push-to-talk can use them even while a text box is focused. */
export function isNonTypingKey(code: string): boolean {
  return /^(Shift|Control|Alt|Meta|CapsLock|ScrollLock|Pause|Insert|F\d{1,2}$)/.test(code)
}
