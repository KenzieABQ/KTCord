import { describe, expect, it } from "vitest"

import { isEmojiOnly, parseInline, parseMarkdown, toPlainText, type MdNode } from "./parse"

const t = (value: string): MdNode => ({ type: "text", value })
const U = "11111111-2222-3333-4444-555555555555"

describe("inline formatting", () => {
  it("parses the basic styles", () => {
    expect(parseInline("**b** *i* _i_ __u__ ~~s~~ ||x||")).toEqual([
      { type: "strong", children: [t("b")] },
      t(" "),
      { type: "em", children: [t("i")] },
      t(" "),
      { type: "em", children: [t("i")] },
      t(" "),
      { type: "underline", children: [t("u")] },
      t(" "),
      { type: "strike", children: [t("s")] },
      t(" "),
      { type: "spoiler", children: [t("x")] },
    ])
  })

  it("nests bold italic", () => {
    expect(parseInline("***hi***")).toEqual([
      { type: "strong", children: [{ type: "em", children: [t("hi")] }] },
    ])
  })

  it("keeps markdown inside inline code literal", () => {
    expect(parseInline("`**not bold**`")).toEqual([{ type: "inlineCode", value: "**not bold**" }])
    expect(parseInline("`` a`b ``")).toEqual([{ type: "inlineCode", value: "a`b" }])
  })

  it("doesn't italicize snake_case words", () => {
    expect(parseInline("snake_case_name")).toEqual([t("snake_case_name")])
  })

  it("leaves unmatched delimiters alone", () => {
    expect(parseInline("2 * 3 = 6 and ~~nope")).toEqual([t("2 * 3 = 6 and ~~nope")])
  })

  it("supports backslash escapes", () => {
    expect(parseInline("\\*not italic\\*")).toEqual([t("*not italic*")])
  })

  it("turns newlines into breaks", () => {
    expect(parseInline("a\nb")).toEqual([t("a"), { type: "br" }, t("b")])
  })
})

describe("links", () => {
  it("autolinks URLs without trailing punctuation", () => {
    expect(parseInline("see https://ktcord.app/x, ok.")).toEqual([
      t("see "),
      { type: "link", url: "https://ktcord.app/x", children: [t("https://ktcord.app/x")] },
      t(", ok."),
    ])
  })

  it("supports masked and suppressed links", () => {
    expect(parseInline("[docs](https://a.b/c) <https://x.y>")).toEqual([
      { type: "link", url: "https://a.b/c", children: [t("docs")] },
      t(" "),
      { type: "link", url: "https://x.y", children: [t("https://x.y")] },
    ])
  })

  it("never links javascript: URLs", () => {
    const nodes = parseInline("[click](javascript:alert(1))")
    expect(nodes.some((n) => n.type === "link")).toBe(false)
  })
})

describe("mentions", () => {
  it("parses user, role and channel tokens", () => {
    expect(parseInline(`<@${U}> <@&${U}> <#${U}>`)).toEqual([
      { type: "mention", kind: "user", id: U },
      t(" "),
      { type: "mention", kind: "role", id: U },
      t(" "),
      { type: "mention", kind: "channel", id: U },
    ])
  })

  it("parses @everyone and @here but not emails", () => {
    expect(parseInline("hey @everyone")).toEqual([t("hey "), { type: "everyone", value: "everyone" }])
    expect(parseInline("me@here.com")).toEqual([t("me@here.com")])
  })
})

describe("blocks", () => {
  it("parses fenced code with a language", () => {
    expect(parseMarkdown("look:\n```ts\nconst a = 1\n```\ndone")).toEqual([
      t("look:"),
      { type: "codeBlock", lang: "ts", value: "const a = 1" },
      t("done"),
    ])
  })

  it("parses single-line and multi-line quotes", () => {
    expect(parseMarkdown("> quoted\nplain")).toEqual([
      { type: "blockquote", children: [t("quoted")] },
      t("plain"),
    ])
    expect(parseMarkdown("intro\n>>> all\nof this")).toEqual([
      t("intro"),
      { type: "br" },
      { type: "blockquote", children: [t("all"), { type: "br" }, t("of this")] },
    ])
  })

  it("treats an unclosed fence as text", () => {
    expect(toPlainText(parseMarkdown("```oops"))).toBe("```oops")
  })
})

describe("helpers", () => {
  it("renders plain previews with resolved names", () => {
    const nodes = parseMarkdown(`**hi** <@${U}> ||secret||`)
    expect(toPlainText(nodes, { user: () => "kenzie" })).toBe("hi @kenzie ▇▇▇▇")
  })

  it("detects emoji-only messages", () => {
    expect(isEmojiOnly("🔥🔥")).toBe(true)
    expect(isEmojiOnly("👍🏽 ❤️")).toBe(true)
    expect(isEmojiOnly("nice 🔥")).toBe(false)
  })
})
