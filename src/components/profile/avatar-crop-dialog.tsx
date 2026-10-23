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
import { cropToSize } from "@/lib/image"

/**
 * Crop an image before upload: square with a round mask for avatars and server icons by
 * default, or a wide rectangle (`output` 960×340) for profile banners.
 */
export function AvatarCropDialog({
  src,
  title = "Edit image",
  output = { width: 256, height: 256 },
  round = true,
  onCancel,
  onApply,
}: {
  src: string | null
  title?: string
  output?: { width: number; height: number }
  round?: boolean
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
      onApply(await cropToSize(src, area, output.width, output.height))
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
              aspect={output.width / output.height}
              cropShape={round ? "round" : "rect"}
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
