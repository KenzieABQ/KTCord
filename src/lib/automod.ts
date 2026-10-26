/** Discord's limits for custom keyword rules. */
export const AUTOMOD_KEYWORD_RULE_LIMIT = 6
export const AUTOMOD_MAX_KEYWORDS = 1000
export const AUTOMOD_MAX_ALLOWED = 100
export const AUTOMOD_KEYWORD_MAX_LENGTH = 60
export const DEFAULT_MENTION_LIMIT = 5

/**
 * Splits a comma- or newline-separated word list, trimming and dropping blanks and
 * repeats (case-insensitively), and reports the first word that's too long.
 */
export function parseWordList(text: string): { words: string[]; tooLong: string | null } {
  const seen = new Set<string>()
  const words: string[] = []
  let tooLong: string | null = null
  for (const raw of text.split(/[,\n]/)) {
    const word = raw.trim().replace(/\s+/g, " ")
    if (!word || word.replace(/\*/g, "") === "") continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (word.length > AUTOMOD_KEYWORD_MAX_LENGTH && !tooLong) tooLong = word
    words.push(word)
  }
  return { words, tooLong }
}

/** The AutoMod block message, shortened to its reason for the composer's toast. */
export function isAutomodBlock(message: string) {
  return message.startsWith("Your message was blocked by AutoMod")
}
