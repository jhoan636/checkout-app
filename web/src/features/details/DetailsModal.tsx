import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, InputHTMLAttributes, ReactNode, SyntheticEvent } from 'react'
import { BrandLogo } from '../../components/BrandLogo'
import { Modal } from '../../components/Modal'
import { detectBrand, digitsOnly, formatCardNumber, formatExpiry } from '../../lib/card'
import { detailsClosed } from '../../store/checkout.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectProductById } from '../../store/products.slice'
import { submitDetails } from './submit-details'
import { emptyDetails, validateDetails } from './validation'
import type { DetailsField, DetailsValues } from './validation'
import './details.css'

const FIELD_ORDER = Object.keys(emptyDetails) as DetailsField[]

/** How each field cleans up what is typed, before it reaches the state. */
const formatters: Partial<Record<DetailsField, (value: string) => string>> = {
  cardNumber: formatCardNumber,
  expiry: formatExpiry,
  cvc: (value) => digitsOnly(value).slice(0, 3),
}

/** A small picture of the card that fills in as the customer types. */
function CardPreview({ values }: { values: DetailsValues }) {
  const brand = detectBrand(values.cardNumber)
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview__top">
        <span className="preview__chip" />
        {brand && <BrandLogo brand={brand} />}
      </div>
      <p className="preview__number">
        {values.cardNumber || '•••• •••• •••• ••••'}
      </p>
      <div className="preview__bottom">
        <span>{values.cardHolder || 'NAME ON CARD'}</span>
        <span>{values.expiry || 'MM/YY'}</span>
      </div>
    </div>
  )
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: DetailsField
  label: string
  error?: string
  adornment?: ReactNode
  inputRef: (element: HTMLInputElement | null) => void
}

function TextField({
  name,
  label,
  error,
  adornment,
  inputRef,
  ...input
}: TextFieldProps) {
  const id = `details-${name}`
  const errorId = `${id}-error`
  return (
    <div className="field" data-invalid={Boolean(error)}>
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input
          {...input}
          id={id}
          name={name}
          ref={inputRef}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {adornment}
      </div>
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}

export function DetailsModal({ now }: { now?: Date }) {
  const dispatch = useAppDispatch()
  // Today's date is read once, when the form opens.
  const [today] = useState(() => now ?? new Date())
  const { productId, quantity, customer, delivery, submitting, submitError } =
    useAppSelector((state) => state.checkout)
  const product = useAppSelector((state) =>
    selectProductById(state, productId),
  )

  // The card lives only here, in memory, while the form is open.
  const [values, setValues] = useState<DetailsValues>(() => ({
    ...emptyDetails,
    ...customer,
    ...delivery,
  }))
  const [visited, setVisited] = useState<Partial<Record<DetailsField, boolean>>>(
    {},
  )
  const [submitted, setSubmitted] = useState(false)
  const inputs = useRef<Partial<Record<DetailsField, HTMLInputElement | null>>>(
    {},
  )

  // Runs after the modal has opened, so the cursor lands on the first field.
  useEffect(() => {
    inputs.current.cardNumber?.focus()
  }, [])

  if (!product) {
    return null
  }

  const errors = validateDetails(values, today)
  const brand = detectBrand(values.cardNumber)

  const bind = (name: DetailsField) => ({
    name,
    value: values[name],
    error: submitted || visited[name] ? errors[name] : undefined,
    inputRef: (element: HTMLInputElement | null) => {
      inputs.current[name] = element
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const format = formatters[name]
      const value = format ? format(event.target.value) : event.target.value
      setValues((current) => ({ ...current, [name]: value }))
    },
    onBlur: () => setVisited((current) => ({ ...current, [name]: true })),
  })

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    setSubmitted(true)
    const firstInvalid = FIELD_ORDER.find((name) => errors[name])
    if (firstInvalid) {
      inputs.current[firstInvalid]?.focus()
      return
    }
    void dispatch(submitDetails(values))
  }

  const close = () => dispatch(detailsClosed())

  return (
    <Modal className="sheet" labelledBy="details-title" onClose={close}>
      <form className="sheet__form" noValidate onSubmit={submit}>
        <header className="sheet__head">
          <div>
            <h2 id="details-title">Payment details</h2>
            <p>
              {product.name} · {quantity} {quantity === 1 ? 'unit' : 'units'}
            </p>
          </div>
          <button
            type="button"
            className="sheet__close"
            aria-label="Close"
            onClick={close}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="sheet__body">
          <section className="group" aria-labelledby="group-card">
            <h3 id="group-card">
              <span className="group__number">1</span>Card
            </h3>
            <CardPreview values={values} />
            <TextField
              {...bind('cardNumber')}
              label="Card number"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              adornment={brand && <BrandLogo brand={brand} />}
            />
            <TextField
              {...bind('cardHolder')}
              label="Name on card"
              autoComplete="cc-name"
              maxLength={120}
            />
            <div className="group__pair">
              <TextField
                {...bind('expiry')}
                label="Expiry date"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
              />
              <TextField
                {...bind('cvc')}
                label="Security code"
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
              />
            </div>
            <p className="group__hint">
              We accept VISA and MasterCard. Your card is sent encrypted to the
              payment processor and is never stored in this store.
            </p>
          </section>

          <section className="group" aria-labelledby="group-delivery">
            <h3 id="group-delivery">
              <span className="group__number">2</span>Delivery
            </h3>
            <TextField
              {...bind('fullName')}
              label="Full name"
              autoComplete="name"
              maxLength={120}
            />
            <TextField
              {...bind('email')}
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
            />
            <TextField
              {...bind('phone')}
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
            />
            <TextField
              {...bind('addressLine')}
              label="Address"
              autoComplete="street-address"
              maxLength={200}
            />
            <div className="group__pair">
              <TextField
                {...bind('city')}
                label="City"
                autoComplete="address-level2"
                maxLength={80}
              />
              <TextField
                {...bind('region')}
                label="State / Department"
                autoComplete="address-level1"
                maxLength={80}
              />
            </div>
            <TextField
              {...bind('postalCode')}
              label="Postal code (optional)"
              autoComplete="postal-code"
              maxLength={12}
            />
          </section>
        </div>

        <footer className="sheet__foot">
          {submitError && (
            <p className="sheet__error" role="alert">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            className="button button--primary"
            disabled={submitting}
            aria-busy={submitting || undefined}
          >
            {submitting ? 'Verifying card…' : 'Continue'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
