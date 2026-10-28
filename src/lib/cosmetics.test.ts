import { describe, expect, it } from "vitest"

import { compactCosmetics, nameStyle, parseCosmetics, sameCosmetics } from "./cosmetics"

describe("parseCosmetics", () => {
  it("keeps known values and drops the rest", () => {
    expect(
      parseCosmetics({
        name_font: "pixel",
        name_effect: "lasers",
        name_colors: ["#ff0000", "blue", "#00ff00", "#0000ff"],
        decoration: "halo",
        effect: 3,
        extra: true,
      })
    ).toEqual({ name_font: "pixel", name_colors: ["#ff0000", "#00ff00"], decoration: "halo" })
  })

  it("treats anything that isn't an object as no cosmetics", () => {
    expect(parseCosmetics(null)).toEqual({})
    expect(parseCosmetics(["neon"])).toEqual({})
    expect(parseCosmetics("neon")).toEqual({})
  })
})

describe("compactCosmetics", () => {
  it("leaves defaults out, so an untouched profile stays empty", () => {
    expect(
      compactCosmetics({
        name_font: "default",
        name_effect: "solid",
        decoration: "none",
        effect: "none",
        nameplate: "none",
      })
    ).toEqual({})
    expect(sameCosmetics({ decoration: "none" }, {})).toBe(true)
    expect(sameCosmetics({ decoration: "fire" }, {})).toBe(false)
  })
})

describe("nameStyle", () => {
  it("is null without a name style, so role colors apply", () => {
    expect(nameStyle({})).toBeNull()
    expect(nameStyle({ decoration: "neon" })).toBeNull()
  })

  it("keeps the usual color for a font-only style", () => {
    expect(nameStyle({ name_font: "script" })).toEqual({ className: "name-font-script name-fx-solid", colors: null })
  })

  it("fills in a second color for two-color effects", () => {
    expect(nameStyle({ name_effect: "gradient", name_colors: ["#ff0000"] })?.colors).toEqual({
      first: "#ff0000",
      second: "#eb459e",
    })
    expect(nameStyle({ name_effect: "neon", name_colors: ["#ff0000"] })?.colors).toEqual({
      first: "#ff0000",
      second: "#ff0000",
    })
  })
})
