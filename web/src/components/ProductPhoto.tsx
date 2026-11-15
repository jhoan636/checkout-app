import { useState } from 'react'
import type { Product } from '../api/types'

/** Intrinsic size of the product photos; reserves the space before they load. */
const PHOTO_SIZE = 480

/**
 * If the photo cannot load, nothing is drawn and the neutral frame around it
 * stays as a clean fallback.
 */
export function ProductPhoto({
  product,
  className,
  eager = false,
  decorative = false,
}: {
  product: Product
  className: string
  /** Only the photos seen first should compete for bandwidth. */
  eager?: boolean
  /** True when the product name is already read next to the photo. */
  decorative?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return null
  }
  return (
    <img
      className={className}
      src={product.imageUrl}
      alt={decorative ? '' : product.name}
      width={PHOTO_SIZE}
      height={PHOTO_SIZE}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  )
}
