"use client"

import { useState } from "react"
import Cropper, { type Area } from "react-easy-crop"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { cropToSquare } from "@/lib/image"

/** Square crop with a round mask, for avatars and server icons. */
export function AvatarCropDialog({
  src,
  title = "Edit image",
  onCancel,
  onApply,
}: {
  src: string | null
  title?: string
  onCancel: () => void
  onApply: (blob: Blob) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  async function apply() {
    if (!src || !area) return
    setBusy(true)
    try {
      onApply(await cropToSquare(src, area))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(src)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="bg-chat sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Drag to reposition. Use the slider to zoom.</DialogDescription>
        </DialogHeader>
        <div className="relative h-72 overflow-hidden rounded-md bg-rail">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>
        <Slider
          value={[zoom]}
          min={1}
          max={3}
          step={0.01}
          onValueChange={([z]) => setZoom(z)}
          aria-label="Zoom"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!area || busy}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
