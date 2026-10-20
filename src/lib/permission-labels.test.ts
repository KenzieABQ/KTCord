import { describe, expect, it } from "vitest"

import { PERMISSION_GROUPS } from "./permission-labels"
import { Permission } from "./permissions"

describe("permission labels", () => {
  it("label every permission exactly once", () => {
    const labelled = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key))
    expect(new Set(labelled).size).toBe(labelled.length)
    expect([...labelled].sort()).toEqual(Object.keys(Permission).sort())
  })
})
