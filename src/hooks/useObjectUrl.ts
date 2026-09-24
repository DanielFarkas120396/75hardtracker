import { useEffect, useState } from 'react'

/**
 * Derives an object URL for a Blob, revoking it when the blob changes or on
 * unmount. This is the standard React pattern for synchronizing with the
 * browser's object URL store (an external resource that must be released).
 */
export function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return url
}
