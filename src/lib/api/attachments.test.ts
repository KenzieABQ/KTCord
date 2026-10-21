import { describe, expect, it } from "vitest"

import { attachmentKind, attachmentPath, formatBytes, safeFileName } from "./attachments"

describe("attachments", () => {
  it("classifies files, treating SVG as a plain file", () => {
    expect(attachmentKind("image/png")).toBe("image")
    expect(attachmentKind("image/svg+xml")).toBe("file")
    expect(attachmentKind("video/mp4")).toBe("video")
    expect(attachmentKind("application/pdf")).toBe("file")
  })

  it("makes storage-safe paths under the message folder", () => {
    expect(safeFileName("my photo (1).PNG")).toBe("my_photo_1_.PNG")
    expect(safeFileName("../../etc/passwd")).toBe(".._.._etc_passwd")
    expect(attachmentPath("c", "m", 2, "a b.txt")).toBe("c/m/2-a_b.txt")
  })

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2.0 KB")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB")
  })
})
