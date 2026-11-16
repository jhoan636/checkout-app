import { useState } from 'react'
import type { Product } from '../api/types'

/**
 * A box reserved before the photo loads, so the page does not jump. The
 * stylesheet decides the size on screen and keeps the photo's proportions.
 */
const PHOTO_SIZE = 480

/**
 * If the photo cannot load, nothing is drawn and the neutral frame around it
 * stays as a clean fallback.
 */
export function ProductPhoto({
  product,
  className,
}: {
  product: Product
  className: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return null
  }
  return (
    <img
      className={className}
      src={product.imageUrl}
      alt={product.name}
      width={PHOTO_SIZE}
      height={PHOTO_SIZE}
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
