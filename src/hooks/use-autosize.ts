import { useLayoutEffect, type RefObject } from "react"

/** Grows a textarea with its content (CSS caps it with max-height). */
export function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}
