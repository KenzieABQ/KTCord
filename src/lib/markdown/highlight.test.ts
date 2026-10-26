import { describe, expect, it } from "vitest"

import { highlightCode } from "./highlight"

describe("highlightCode", () => {
  it("highlights known languages and aliases", () => {
    const tree = highlightCode("js", "const x = 1")
    expect(tree?.children.some((n) => n.type === "element" && n.properties.className?.toString().includes("hljs-keyword"))).toBe(true)
    expect(highlightCode("Python", "def f(): pass")).not.toBeNull()
  })

  it("skips unknown languages", () => {
    expect(highlightCode("klingon", "qapla")).toBeNull()
  })
})
