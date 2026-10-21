/**
 * The visible element with this id. Next keeps recently visited routes mounted but hidden
 * (React Activity), so a page's ids can appear more than once in the document.
 */
export function visibleElementById<T extends HTMLElement = HTMLElement>(id: string): T | null {
  const matches = document.querySelectorAll<T>(`[id="${CSS.escape(id)}"]`)
  for (const el of matches) {
    if (el.checkVisibility?.() ?? el.offsetParent !== null) return el
  }
  return null
}
