import { useLayoutEffect, useRef, type ImgHTMLAttributes } from 'react'

interface BlobImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  blob: Blob
}

/**
 * An <img> that shows a Blob through an object URL. The URL is created and
 * revoked in a layout effect and set directly on the element (before
 * paint), so there's no React state to keep in sync — and StrictMode's
 * mount → unmount → mount can't leave the image on a revoked URL.
 */
export function BlobImage({ blob, alt, ...rest }: BlobImageProps) {
  const ref = useRef<HTMLImageElement>(null)

  useLayoutEffect(() => {
    const img = ref.current
    if (!img) return
    const url = URL.createObjectURL(blob)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  return <img ref={ref} alt={alt} {...rest} />
}
