import "server-only"

import { lookup, type LookupAddress } from "node:dns"
import http, { type IncomingMessage } from "node:http"
import https from "node:https"
import { isIP, type LookupFunction } from "node:net"
import zlib from "node:zlib"

import { isPublicAddress } from "./addresses"

const TIMEOUT_MS = 6000
const MAX_REDIRECTS = 4
const USER_AGENT = "Mozilla/5.0 (compatible; KTCordBot/1.0; link previews)"

export class UnfurlError extends Error {}

/** DNS lookup that refuses names resolving to private or reserved addresses (incl. on redirects). */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    const list = addresses as unknown as LookupAddress[]
    if (error) return callback(error, "", 0)
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new UnfurlError(`${hostname} isn't a public address`), "", 0)
    }
    if (options.all) (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list)
    else callback(null, list[0].address, list[0].family)
  })
}

/** Only http(s) on the default ports, without credentials, to public hosts. */
export function checkUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnfurlError("Not a URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnfurlError("Only http(s) links")
  if (url.username || url.password) throw new UnfurlError("No credentials in links")
  if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) throw new UnfurlError("Only default ports")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  // IP literals skip DNS, so check them here.
  if (isIP(host) && !isPublicAddress(host)) throw new UnfurlError("Not a public address")
  if (!host.includes(".") && !isIP(host)) throw new UnfurlError("Not a public host")
  return url
}

function request(url: URL, accept: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http
    const req = client.get(
      url,
      {
        lookup: publicLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: accept,
          "Accept-Language": "en-US,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      resolve
    )
    req.on("timeout", () => req.destroy(new UnfurlError("Timed out")))
    req.on("error", reject)
  })
}

function decoded(res: IncomingMessage) {
  switch (res.headers["content-encoding"]) {
    case "gzip":
      return res.pipe(zlib.createGunzip())
    case "deflate":
      return res.pipe(zlib.createInflate())
    case "br":
      return res.pipe(zlib.createBrotliDecompress())
    default:
      return res
  }
}

export type Fetched = { url: string; contentType: string; body: Buffer }

/**
 * GETs a public URL, following a few redirects (each one re-checked), and reads at most
 * `maxBytes` after decompression. With `stopAt`, stops early once the text so far matches.
 */
export async function safeGet(raw: string, opts: { accept: string; maxBytes: number; stopAt?: RegExp }): Promise<Fetched> {
  let url = checkUrl(raw)
  const deadline = AbortSignal.timeout(TIMEOUT_MS * 2)
  for (let hop = 0; ; hop++) {
    const res = await request(url, opts.accept)
    const status = res.statusCode ?? 0
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume()
      if (hop >= MAX_REDIRECTS) throw new UnfurlError("Too many redirects")
      url = checkUrl(new URL(res.headers.location, url).href)
      continue
    }
    if (status < 200 || status >= 300) {
      res.resume()
      throw new UnfurlError(`HTTP ${status}`)
    }
    const declared = Number(res.headers["content-length"])
    if (!opts.stopAt && declared > opts.maxBytes) {
      res.destroy()
      throw new UnfurlError("Too large")
    }

    const stream = decoded(res)
    const chunks: Buffer[] = []
    let size = 0
    try {
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        if (deadline.aborted) throw new UnfurlError("Timed out")
        chunks.push(chunk)
        size += chunk.length
        if (size > opts.maxBytes) {
          if (!opts.stopAt) throw new UnfurlError("Too large")
          break
        }
        if (opts.stopAt && opts.stopAt.test(chunk.toString("latin1"))) break
      }
    } finally {
      res.destroy()
    }
    return {
      url: url.href,
      contentType: String(res.headers["content-type"] ?? "").toLowerCase(),
      body: Buffer.concat(chunks).subarray(0, opts.maxBytes),
    }
  }
}
