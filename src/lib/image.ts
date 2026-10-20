export type PixelArea = { x: number; y: number; width: number; height: number }

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Couldn't read that image."))
    image.src = src
  })
}

/** Crops `area` out of the image and scales it to a `size`×`size` WebP. */
export async function cropToSquare(
  src: string,
  area: PixelArea,
  size = 256
): Promise<Blob> {
  const image = await loadImage(src)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Your browser can't process images.")
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size)

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't crop the image."))),
      "image/webp",
      0.9
    )
  )
}
