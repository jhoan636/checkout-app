import type { CardBrand } from '../lib/card'

/** Simplified marks, drawn here only to tell the customer which card it is. */
export function BrandLogo({ brand }: { brand: CardBrand }) {
  if (brand === 'visa') {
    return (
      <svg className="brand" viewBox="0 0 48 30" role="img" aria-label="Visa">
        <rect width="48" height="30" rx="4" fill="#1a1f71" />
        <text
          x="24"
          y="20.5"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          fontStyle="italic"
          fontWeight="700"
          fill="#fff"
        >
          VISA
        </text>
      </svg>
    )
  }
  return (
    <svg className="brand" viewBox="0 0 48 30" role="img" aria-label="MasterCard">
      <rect width="48" height="30" rx="4" fill="#1d1d1f" />
      <circle cx="19" cy="15" r="9" fill="#eb001b" />
      <circle cx="29" cy="15" r="9" fill="#f79e1b" fillOpacity="0.9" />
    </svg>
  )
}
