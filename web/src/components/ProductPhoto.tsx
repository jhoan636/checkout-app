import { useState } from 'react'
import type { Product } from '../api/types'

/**
 * The size of the photo file. Declaring it lets the browser reserve a box
 * with the right proportions before the photo loads, so the page does not
 * jump. The stylesheet decides the size on screen.
 */
const PHOTO_WIDTH = 960
const PHOTO_HEIGHT = 433

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
      width={PHOTO_WIDTH}
      height={PHOTO_HEIGHT}
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
