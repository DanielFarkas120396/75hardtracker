/** A picked image shrunk to fit `maxSide` pixels, as a JPEG; the original when the browser can't decode it. */
export async function shrinkImage(file: Blob, maxSide = 600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.85))
  } catch {
    return file
  }
}
