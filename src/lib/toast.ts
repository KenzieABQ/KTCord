import { createElement } from "react"
import { toast as sonner } from "sonner"

import {
  CallNotice,
  DmNotice,
  Notice,
  type CallNotification,
  type DmNotification,
  type NoticeAction,
} from "@/components/feedback/notices"

type Options = { id?: string; action?: NoticeAction; description?: string }

function notice(kind: "info" | "error", message: string, options: Options = {}) {
  const text = options.description ? `${message} ${options.description}` : message
  return sonner.custom((id) => createElement(Notice, { id, kind, message: text, action: options.action }), {
    toasterId: "notices",
    id: options.id,
    duration: kind === "error" ? 6000 : 4000,
  })
}

/**
 * KTCord's feedback, used sparingly: a small notice at the top for errors and the odd
 * heads-up, and a card for incoming DMs. Successful actions speak for themselves, so
 * `toast.success` shows nothing.
 */
export const toast = Object.assign((message: string, options?: Options) => notice("info", message, options), {
  error: (message: string, options?: Options) => notice("error", message, options),
  success: (message?: string, options?: Options) => {
    void message
    void options
  },
  dm: (dm: DmNotification) =>
    sonner.custom((id) => createElement(DmNotice, { id, dm }), { toasterId: "dms", duration: 6000 }),
  call: (call: CallNotification) =>
    sonner.custom((id) => createElement(CallNotice, { id, call }), { toasterId: "dms", duration: 30_000 }),
})
