import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

/** A saved photo's longest edge and JPEG quality: the web's compressImage (src/lib/imageCompression.ts). */
export const MAX_EDGE = 1280
export const JPEG_QUALITY = 0.8

/** The centred source rectangle that fills an `aspect` (width / height) box. The web's coverCrop (src/lib/camera.ts). */
export function coverCrop(srcWidth: number, srcHeight: number, aspect: number) {
  if (srcWidth / srcHeight > aspect) {
    const sw = Math.round(srcHeight * aspect)
    return { sx: Math.round((srcWidth - sw) / 2), sy: 0, sw, sh: srcHeight }
  }
  const sh = Math.round(srcWidth / aspect)
  return { sx: 0, sy: Math.round((srcHeight - sh) / 2), sw: srcWidth, sh }
}

/** The size a picture is saved at: its longest edge brought down to 1280, never up. */
export function savedSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Makes a picture ready to keep: cropped to the viewfinder's shape when one
 * is given (the saved photo is exactly what was on screen), brought down to
 * 1280 on its longest edge, and written as a JPEG. Returns the new file's address.
 */
export async function prepareShot(picture: { uri: string; width: number; height: number }, viewfinderAspect?: number): Promise<string> {
  const context = ImageManipulator.manipulate(picture.uri)
  let { width, height } = picture
  if (viewfinderAspect !== undefined && Number.isFinite(viewfinderAspect) && viewfinderAspect > 0) {
    const { sx, sy, sw, sh } = coverCrop(width, height, viewfinderAspect)
    context.crop({ originX: sx, originY: sy, width: sw, height: sh })
    width = sw
    height = sh
  }
  const size = savedSize(width, height)
  if (size.width !== width) context.resize(size)
  const image = await context.renderAsync()
  return (await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY })).uri
}
