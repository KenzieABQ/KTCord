/**
 * Profile cosmetics: a display name style (font, effect, colors), an avatar decoration,
 * a profile effect over the card and a nameplate behind the name in member lists.
 * Stored together in profiles.cosmetics; the allowed values match valid_cosmetics() in SQL.
 */

export const NAME_FONTS = [
  { id: "default", label: "Default" },
  { id: "rounded", label: "Bubbly" },
  { id: "serif", label: "Royal" },
  { id: "pixel", label: "8-Bit" },
  { id: "script", label: "Breezy" },
  { id: "toon", label: "Comic" },
  { id: "tech", label: "Future" },
  { id: "retro", label: "Retro" },
] as const

export const NAME_EFFECTS = [
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
  { id: "neon", label: "Neon" },
  { id: "toon", label: "Toon" },
  { id: "pop", label: "Pop" },
  { id: "shimmer", label: "Shimmer" },
] as const

export const DECORATIONS = [
  { id: "none", label: "None" },
  { id: "neon", label: "Neon Ring" },
  { id: "rainbow", label: "Rainbow" },
  { id: "fire", label: "On Fire" },
  { id: "sparkles", label: "Sparkles" },
  { id: "halo", label: "Halo" },
  { id: "cat_ears", label: "Cat Ears" },
  { id: "orbit", label: "Orbit" },
  { id: "hearts", label: "Lovestruck" },
] as const

export const PROFILE_EFFECTS = [
  { id: "none", label: "None" },
  { id: "snow", label: "Snowfall" },
  { id: "stars", label: "Starry Night" },
  { id: "hearts", label: "Floating Hearts" },
  { id: "aurora", label: "Aurora" },
  { id: "sakura", label: "Sakura" },
  { id: "bubbles", label: "Bubbles" },
] as const

export const NAMEPLATES = [
  { id: "none", label: "None" },
  { id: "aurora", label: "Aurora" },
  { id: "sunset", label: "Sunset" },
  { id: "ocean", label: "Ocean" },
  { id: "galaxy", label: "Galaxy" },
  { id: "forest", label: "Forest" },
  { id: "candy", label: "Candy" },
] as const

/** Swatches offered for name colors (any hex color can be picked too). */
export const NAME_SWATCHES = [
  "#ffffff",
  "#f23f43",
  "#ff7a45",
  "#f0b232",
  "#57f287",
  "#23a55a",
  "#00c8ff",
  "#5865f2",
  "#9b59b6",
  "#eb459e",
  "#ff8fd1",
  "#a3e4ff",
]

export type NameFont = (typeof NAME_FONTS)[number]["id"]
export type NameEffect = (typeof NAME_EFFECTS)[number]["id"]
export type Decoration = (typeof DECORATIONS)[number]["id"]
export type ProfileEffect = (typeof PROFILE_EFFECTS)[number]["id"]
export type Nameplate = (typeof NAMEPLATES)[number]["id"]

export type Cosmetics = {
  name_font?: NameFont
  name_effect?: NameEffect
  /** One or two "#rrggbb" colors; gradient-style effects use both. */
  name_colors?: string[]
  decoration?: Decoration
  effect?: ProfileEffect
  nameplate?: Nameplate
}

const HEX = /^#[0-9a-f]{6}$/i

function pick<T extends string>(options: readonly { id: T }[], value: unknown): T | undefined {
  return options.find((o) => o.id === value)?.id
}

/** Reads a profile's cosmetics column, dropping anything unknown (older or newer clients). */
export function parseCosmetics(raw: unknown): Cosmetics {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const c = raw as Record<string, unknown>
  const colors = Array.isArray(c.name_colors)
    ? c.name_colors.filter((v): v is string => typeof v === "string" && HEX.test(v)).slice(0, 2)
    : []
  const out: Cosmetics = {
    name_font: pick(NAME_FONTS, c.name_font),
    name_effect: pick(NAME_EFFECTS, c.name_effect),
    name_colors: colors.length ? colors : undefined,
    decoration: pick(DECORATIONS, c.decoration),
    effect: pick(PROFILE_EFFECTS, c.effect),
    nameplate: pick(NAMEPLATES, c.nameplate),
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Cosmetics
}

/** Cosmetics as stored: defaults left out, so an untouched profile stays `{}`. */
export function compactCosmetics(c: Cosmetics): Cosmetics {
  const out: Cosmetics = {}
  if (c.name_font && c.name_font !== "default") out.name_font = c.name_font
  if (c.name_effect && c.name_effect !== "solid") out.name_effect = c.name_effect
  if (c.name_colors?.length) out.name_colors = c.name_colors.slice(0, 2)
  if (c.decoration && c.decoration !== "none") out.decoration = c.decoration
  if (c.effect && c.effect !== "none") out.effect = c.effect
  if (c.nameplate && c.nameplate !== "none") out.nameplate = c.nameplate
  return out
}

export function sameCosmetics(a: Cosmetics, b: Cosmetics) {
  return JSON.stringify(compactCosmetics(a)) === JSON.stringify(compactCosmetics(b))
}

/** Effects that blend two colors; the others use only the first. */
export function effectUsesTwoColors(effect: NameEffect | undefined) {
  return effect === "gradient" || effect === "shimmer" || effect === "pop"
}

/** Second colors for two-color effects when only one was picked. */
const DEFAULT_COLORS: Record<NameEffect, [string, string]> = {
  solid: ["#ffffff", "#ffffff"],
  gradient: ["#5865f2", "#eb459e"],
  neon: ["#00c8ff", "#00c8ff"],
  toon: ["#f0b232", "#f0b232"],
  pop: ["#ffffff", "#eb459e"],
  shimmer: ["#f0b232", "#ffffff"],
}

/**
 * How a name renders: a font class, an effect class and its color variables. With no name
 * style at all this is null, and the caller's usual color (a role color) applies.
 */
export function nameStyle(c: Cosmetics | null | undefined) {
  if (!c) return null
  const font = c.name_font && c.name_font !== "default" ? c.name_font : null
  const effect = c.name_effect ?? "solid"
  const colors = c.name_colors ?? []
  if (!font && effect === "solid" && colors.length === 0) return null

  const [d1, d2] = DEFAULT_COLORS[effect]
  const first = colors[0] ?? d1
  const second = colors[1] ?? (colors[0] && !effectUsesTwoColors(effect) ? colors[0] : d2)
  return {
    className: [font && `name-font-${font}`, `name-fx-${effect}`].filter(Boolean).join(" "),
    // A solid name with no color picked keeps the caller's color.
    colors: effect === "solid" && colors.length === 0 ? null : { first, second },
  }
}
