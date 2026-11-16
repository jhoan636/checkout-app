import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initialCheckoutState } from '../../store/checkout.slice'
import type { CheckoutState } from '../../store/checkout.slice'
import type { PaymentGateway } from '../../api/gateway'
import {
  fakeGateway,
  drone,
  readyProducts,
  renderWithStore,
} from '../../test/render'
import { DetailsModal } from './DetailsModal'

const now = new Date(2026, 10, 15)

const onDetails: CheckoutState = {
  ...initialCheckoutState,
  step: 'details',
  productId: drone.id,
  quantity: 2,
}

const renderModal = (
  checkout: CheckoutState = onDetails,
  gateway: PaymentGateway = fakeGateway(),
) =>
  renderWithStore(<DetailsModal now={now} />, {
    gateway,
    state: {
      checkout,
      products: readyProducts(),
    },
  })

const field = (label: string) => screen.getByLabelText(label)

const fillEverything = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(field('Card number'), '4242424242424242')
  await user.type(field('Name on card'), 'Ana Maria Perez')
  await user.type(field('Expiry date'), '1228')
  await user.type(field('Security code'), '123')
  await user.type(field('Full name'), 'Ana Maria Perez')
  await user.type(field('Email'), 'ana@example.com')
  await user.type(field('Phone'), '3001234567')
  await user.type(field('Address'), 'Calle 10 # 20-30')
  await user.type(field('City'), 'Medellin')
  await user.type(field('State / Department'), 'Antioquia')
}

describe('DetailsModal', () => {
  it('opens as a dialog that says what is being paid', () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'Payment details' })
    expect(dialog).toHaveTextContent('Glide Camera Drone')
    expect(dialog).toHaveTextContent('2 units')
  })

  it('starts with the cursor on the card number', () => {
    renderModal()

    expect(field('Card number')).toHaveFocus()
  })

  describe('the card', () => {
    it('shows no brand before the number says which one it is', () => {
      renderModal()

      expect(screen.queryByRole('img', { name: 'Visa' })).toBeNull()
      expect(screen.queryByRole('img', { name: 'MasterCard' })).toBeNull()
    })

    it('recognises a VISA card and groups its digits', async () => {
      const user = userEvent.setup()
      renderModal()

      await user.type(field('Card number'), '4242424242424242')

      expect(field('Card number')).toHaveValue('4242 4242 4242 4242')
      expect(screen.getByRole('img', { name: 'Visa' })).toBeInTheDocument()
    })

    it('recognises a MasterCard card', async () => {
      const user = userEvent.setup()
      renderModal()

      await user.type(field('Card number'), '5555')

      expect(screen.getByRole('img', { name: 'MasterCard' })).toBeInTheDocument()
    })

    it('writes the expiry date as month and year', async () => {
      const user = userEvent.setup()
      renderModal()

      await user.type(field('Expiry date'), '1228')

      expect(field('Expiry date')).toHaveValue('12/28')
    })

    it('hides the security code and keeps only three digits', async () => {
      const user = userEvent.setup()
      renderModal()

      await user.type(field('Security code'), '12a345')

      expect(field('Security code')).toHaveValue('123')
      expect(field('Security code')).toHaveAttribute('type', 'password')
    })

    it('tells the browser these are card fields', () => {
      renderModal()

      expect(field('Card number')).toHaveAttribute('autocomplete', 'cc-number')
      expect(field('Card number')).toHaveAttribute('inputmode', 'numeric')
      expect(field('Security code')).toHaveAttribute('autocomplete', 'cc-csc')
    })
  })

  it('tells assistive technology which fields are required', () => {
    renderModal()

    const required = [
      'Card number',
      'Name on card',
      'Expiry date',
      'Security code',
      'Full name',
      'Email',
      'Phone',
      'Address',
      'City',
      'State / Department',
    ]
    for (const label of required) {
      expect(field(label)).toBeRequired()
    }
    expect(field('Postal code (optional)')).not.toBeRequired()
  })

  describe('validation', () => {
    it('explains every missing field and stays on the form', async () => {
      const user = userEvent.setup()
      const { store } = renderModal()

      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(
        screen.getByText('Enter a valid VISA or MasterCard number.'),
      ).toBeInTheDocument()
      expect(screen.getByText('Enter the delivery address.')).toBeInTheDocument()
      expect(field('Card number')).toHaveAttribute('aria-invalid', 'true')
      expect(field('Card number')).toHaveFocus()
      expect(store.getState().checkout.step).toBe('details')
    })

    it('says nothing about a field the customer has not visited', () => {
      renderModal()

      expect(screen.queryByText('Enter a valid email address.')).toBeNull()
      expect(field('Email')).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('checks a field when the customer leaves it', async () => {
      const user = userEvent.setup()
      renderModal()

      await user.type(field('Email'), 'ana@')
      await user.tab()

      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
      expect(field('Email')).toHaveAccessibleDescription(
        'Enter a valid email address.',
      )
    })

    it('clears the message once the field is fixed', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.type(field('Email'), 'ana@')
      await user.tab()

      await user.type(field('Email'), 'example.com')

      expect(screen.queryByText('Enter a valid email address.')).toBeNull()
    })
  })

  describe('installments', () => {
    it('starts on a single payment', () => {
      renderModal()

      expect(field('Installments')).toHaveValue('1')
    })

    it('sends the purchase on with the payments chosen', async () => {
      const user = userEvent.setup()
      const { store } = renderModal()
      await fillEverything(user)

      await user.selectOptions(field('Installments'), '12 monthly payments')
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() =>
        expect(store.getState().checkout.step).toBe('summary'),
      )
      expect(store.getState().checkout.installments).toBe(12)
    })
  })

  describe('continuing', () => {
    const cardRejected = () =>
      fakeGateway({
        tokenizeCard: jest.fn().mockResolvedValue({
          ok: false,
          error: {
            status: 422,
            code: 'CARD_REJECTED',
            message: 'The card was not accepted. Check its details and try again.',
          },
        }),
      })

    it('exchanges the card for a token and moves to the summary', async () => {
      const user = userEvent.setup()
      const { store, gateway } = renderModal()
      await fillEverything(user)

      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() =>
        expect(store.getState().checkout.step).toBe('summary'),
      )
      expect(gateway.tokenizeCard).toHaveBeenCalledWith({
        number: '4242424242424242',
        cvc: '123',
        expMonth: '12',
        expYear: '28',
        cardHolder: 'Ana Maria Perez',
      })
      expect(store.getState().checkout).toMatchObject({
        cardToken: 'tok_test_1',
        customer: {
          fullName: 'Ana Maria Perez',
          email: 'ana@example.com',
          phone: '3001234567',
        },
        delivery: {
          addressLine: 'Calle 10 # 20-30',
          city: 'Medellin',
          region: 'Antioquia',
        },
        card: { brand: 'visa', lastFour: '4242' },
      })
    })

    it('never puts the card number or the security code in the store', async () => {
      const user = userEvent.setup()
      const { store } = renderModal()
      await fillEverything(user)

      await user.click(screen.getByRole('button', { name: 'Continue' }))
      await waitFor(() =>
        expect(store.getState().checkout.step).toBe('summary'),
      )

      const saved = JSON.stringify(store.getState())
      expect(saved).not.toContain('4242424242424242')
      expect(saved).not.toContain('4242 4242 4242 4242')
      expect(saved).not.toContain('"123"')
      expect(saved).not.toContain('12/28')
    })

    it('cannot be sent twice while the card is being verified', async () => {
      const user = userEvent.setup()
      const { gateway } = renderModal(
        onDetails,
        fakeGateway({ tokenizeCard: jest.fn(() => new Promise(() => undefined)) }),
      )
      await fillEverything(user)

      await user.click(screen.getByRole('button', { name: 'Continue' }))

      const button = screen.getByRole('button', { name: 'Verifying card…' })
      expect(button).toBeDisabled()
      await user.click(button)
      expect(gateway.tokenizeCard).toHaveBeenCalledTimes(1)
    })

    it('does not ask the gateway anything while the form has mistakes', async () => {
      const user = userEvent.setup()
      const { gateway } = renderModal()

      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(gateway.tokenizeCard).not.toHaveBeenCalled()
    })

    it('explains the problem when the card is not accepted', async () => {
      const user = userEvent.setup()
      const { store } = renderModal(onDetails, cardRejected())
      await fillEverything(user)

      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The card was not accepted. Check its details and try again.',
      )
      expect(store.getState().checkout.step).toBe('details')
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    it('keeps what was typed so the customer can correct it', async () => {
      const user = userEvent.setup()
      renderModal(onDetails, cardRejected())
      await fillEverything(user)

      await user.click(screen.getByRole('button', { name: 'Continue' }))
      await screen.findByRole('alert')

      expect(field('Card number')).toHaveValue('4242 4242 4242 4242')
      expect(field('Full name')).toHaveValue('Ana Maria Perez')
    })
  })

  describe('leaving', () => {
    it('goes back to the product with the close button', async () => {
      const user = userEvent.setup()
      const { store } = renderModal()

      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(store.getState().checkout.step).toBe('product')
    })

    it('goes back to the product with the Escape key', () => {
      const { store } = renderModal()

      // Browsers turn Escape on a modal dialog into a "cancel" event.
      fireEvent(screen.getByRole('dialog'), new Event('cancel'))

      expect(store.getState().checkout.step).toBe('product')
    })
  })

  it('brings back the contact details already given', () => {
    renderModal({
      ...onDetails,
      customer: {
        fullName: 'Ana Maria Perez',
        email: 'ana@example.com',
        phone: '3001234567',
      },
      delivery: {
        addressLine: 'Calle 10 # 20-30',
        city: 'Medellin',
        region: 'Antioquia',
        postalCode: '050021',
      },
      card: { brand: 'visa', lastFour: '4242' },
    })

    expect(field('Full name')).toHaveValue('Ana Maria Perez')
    expect(field('City')).toHaveValue('Medellin')
    expect(field('Postal code (optional)')).toHaveValue('050021')
    // The card is never remembered: it has to be typed again.
    expect(field('Card number')).toHaveValue('')
  })

  it('shows nothing when the product is unknown', () => {
    renderModal({ ...onDetails, productId: 'missing' })

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
