import type { Root } from "hast"
import { common, createLowlight } from "lowlight"

const lowlight = createLowlight(common)

/** Longer code isn't highlighted, so one huge paste can't stall the chat. */
const MAX_HIGHLIGHT_LENGTH = 20_000

/**
 * Syntax-highlights a code block whose fence names a language highlight.js knows (by name
 * or alias: js, ts, py, sh…). Returns a tree of spans with hljs-* classes, or null.
 * Loaded on demand, the first time a message has such a block.
 */
export function highlightCode(lang: string, code: string): Root | null {
  if (code.length > MAX_HIGHLIGHT_LENGTH || !lowlight.registered(lang.toLowerCase())) return null
  return lowlight.highlight(lang.toLowerCase(), code)
}
