import { describe, expect, it } from "vitest"

import { embedUrls, youtubeId } from "@/lib/embeds"

import { decodeEntities, parseMeta } from "./meta"

const page = (head: string) => `<!doctype html><html><head>${head}</head><body><meta property="og:title" content="body"></body></html>`

describe("parseMeta", () => {
  it("reads Open Graph tags, resolving relative images", () => {
    const embed = parseMeta(
      page(`
        <meta property="og:site_name" content="Example">
        <meta property="og:title" content="Hello &amp; welcome">
        <meta content="A  page
          about things" property="og:description" />
        <meta property="og:image" content="/img/card.png">
        <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="theme-color" content="#5865F2">
      `),
      "https://example.com/post/1"
    )
    expect(embed).toEqual({
      url: "https://example.com/post/1",
      kind: "link",
      siteName: "Example",
      author: null,
      title: "Hello & welcome",
      description: "A page about things",
      image: { url: "https://example.com/img/card.png", width: 1200, height: 630 },
      largeImage: true,
      color: "#5865F2",
      youtubeId: null,
    })
  })

  it("falls back to <title> and meta description", () => {
    const embed = parseMeta(page(`<title> Plain page </title><meta name="description" content="Just text">`), "https://a.b/")
    expect(embed).toMatchObject({ title: "Plain page", description: "Just text", image: null, largeImage: false })
  })

  it("returns nothing for pages without metadata, and ignores body tags", () => {
    expect(parseMeta(page(""), "https://a.b/")).toBeNull()
  })

  it("ignores unsafe image URLs and colors", () => {
    const embed = parseMeta(page(`<title>x</title><meta property="og:image" content="javascript:alert(1)"><meta name="theme-color" content="red;x">`), "https://a.b/")
    expect(embed).toMatchObject({ image: null, color: null })
  })

  it("truncates long descriptions", () => {
    const embed = parseMeta(page(`<meta property="og:description" content="${"word ".repeat(200)}">`), "https://a.b/")
    expect(embed!.description!.length).toBeLessThanOrEqual(350)
    expect(embed!.description!.endsWith("…")).toBe(true)
  })

  it("marks YouTube videos", () => {
    const embed = parseMeta(page(`<meta property="og:title" content="A video"><meta property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg">`), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    expect(embed).toMatchObject({ kind: "video", youtubeId: "dQw4w9WgXcQ", siteName: "YouTube", largeImage: true })
  })
})

describe("helpers", () => {
  it("decodes entities", () => {
    expect(decodeEntities("&lt;b&gt; &#39;hi&#x27; &hellip; &bogus;")).toBe("<b> 'hi' … &bogus;")
  })

  it("finds YouTube ids", () => {
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=5")).toBe("dQw4w9WgXcQ")
    expect(youtubeId("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(youtubeId("https://youtube.com/watch?v=short")).toBeNull()
    expect(youtubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull()
  })

  it("picks embeddable links: not suppressed, not spoilered, not our own", () => {
    expect(
      embedUrls(
        "see https://a.com and <https://b.com> ||https://c.com|| [d](https://d.com) https://a.com https://app.test/invite/x",
        "https://app.test"
      )
    ).toEqual(["https://a.com", "https://d.com"])
  })
})

describe("youtubeEmbed", () => {
  it("builds a video embed from oEmbed", async () => {
    const { youtubeEmbed } = await import("./meta")
    expect(youtubeEmbed("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ", { title: "Song", author_name: "Rick" })).toMatchObject({
      kind: "video",
      author: "Rick",
      title: "Song",
      image: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
    })
  })
})
