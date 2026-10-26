import { describe, expect, it } from "vitest"

import { isPublicAddress } from "./addresses"

describe("isPublicAddress", () => {
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "142.250.72.14", "2606:4700:4700::1111", "2a00:1450:4001:82a::200e"]) {
      expect(isPublicAddress(ip), ip).toBe(true)
    }
  })

  it("blocks private, loopback, link-local and reserved IPv4", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
      "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.5",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
  })

  it("blocks private and special IPv6, including IPv4 hidden inside", () => {
    for (const ip of [
      "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "2001:db8::1", "2002:7f00:1::1",
      "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "64:ff9b::a9fe:a9fe", "fe80::1%en0",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true)
  })

  it("rejects things that aren't addresses", () => {
    expect(isPublicAddress("localhost")).toBe(false)
    expect(isPublicAddress("999.1.1.1")).toBe(false)
  })
})
