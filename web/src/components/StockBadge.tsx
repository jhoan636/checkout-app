/** From this many units down, the badge warns that few are left. */
const LOW_STOCK = 3

export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="stock" data-level="none">
        Sold out
      </span>
    )
  }
  return (
    <span className="stock" data-level={stock <= LOW_STOCK ? 'low' : 'ok'}>
      {stock} in stock
    </span>
  )
}
