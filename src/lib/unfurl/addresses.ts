import { isIP } from "node:net"

/** Public, globally routable IPv4: no private, loopback, link-local, CGNAT, test or multicast ranges. */
export function isPublicIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b, c] = parts
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false
  if (a === 192 && b === 88 && c === 99) return false
  if (a === 198 && (b === 18 || b === 19)) return false
  if (a === 198 && b === 51 && c === 100) return false
  if (a === 203 && b === 0 && c === 113) return false
  return true
}

/** The eight 16-bit groups of an IPv6 address, or null if it isn't one. */
function ipv6Groups(ip: string): number[] | null {
  let host: string
  try {
    // The URL parser normalizes IPv6, including embedded IPv4 (::ffff:1.2.3.4 → ::ffff:102:304).
    host = new URL(`http://[${ip.split("%")[0]}]`).hostname.slice(1, -1)
  } catch {
    return null
  }
  const [head, tail] = host.split("::")
  const start = head ? head.split(":") : []
  const end = tail === undefined ? null : tail ? tail.split(":") : []
  const groups = end === null ? start : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end]
  return groups.length === 8 ? groups.map((g) => parseInt(g, 16)) : null
}

/** Public IPv6: global unicast only, judging IPv4-mapped and NAT64 addresses by their IPv4 part. */
export function isPublicIPv6(ip: string): boolean {
  const g = ipv6Groups(ip)
  if (!g) return false
  const embedded = () => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) return isPublicIPv4(embedded())
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0)) return isPublicIPv4(embedded())
  if ((g[0] & 0xe000) !== 0x2000) return false
  // Documentation, Teredo and 6to4 ranges.
  if (g[0] === 0x2001 && (g[1] === 0x0db8 || g[1] === 0)) return false
  if (g[0] === 0x2002) return false
  return true
}

export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPublicIPv4(ip)
  if (version === 6) return isPublicIPv6(ip)
  return false
}
