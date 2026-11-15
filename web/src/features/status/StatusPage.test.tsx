import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CheckoutApi } from '../../api/checkout-api'
import type { Transaction, TransactionStatus } from '../../api/types'
import { initialCheckoutState } from '../../store/checkout.slice'
import type { CheckoutState } from '../../store/checkout.slice'
import type { TransactionState } from '../../store/transaction.slice'
import {
  acceptance,
  approvedTransaction,
  fakeApi,
  headphones,
  readyProducts,
  renderWithStore,
  summaryForOne,
} from '../../test/render'
import { StatusPage } from './StatusPage'

const onStatus: CheckoutState = {
  ...initialCheckoutState,
  step: 'status',
  productId: headphones.id,
  quantity: 1,
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
  cardToken: 'tok_test_1',
}

const settled = (status: TransactionStatus): TransactionState => ({
  id: approvedTransaction.id,
  transaction: { ...approvedTransaction, status },
  phase: 'settled',
  error: null,
  retryable: false,
})

const renderStatus = (transaction: TransactionState, api?: CheckoutApi) =>
  renderWithStore(<StatusPage />, {
    api,
    state: {
      checkout: onStatus,
      products: readyProducts(),
      payment: { summary: summaryForOne, acceptance, status: 'ready', error: null },
      transaction,
    },
  })

const detail = (label: string) =>
  screen.getByText(label).closest('div') as HTMLElement
const backButton = () =>
  screen.getByRole('button', { name: 'Back to the product' })

describe('StatusPage', () => {
  it('says the payment is being processed and offers nothing to press', () => {
    renderStatus({
      id: approvedTransaction.id,
      transaction: null,
      phase: 'processing',
      error: null,
      retryable: false,
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Processing your payment',
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  describe('an approved payment', () => {
    it('confirms it and says where the order goes', () => {
      renderStatus(settled('APPROVED'))

      expect(
        screen.getByRole('heading', { name: 'Payment approved' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Your order will be delivered to Calle 10 # 20-30, Medellin, Antioquia.',
        ),
      ).toBeInTheDocument()
    })

    it('shows what was paid, the reference and the product', () => {
      renderStatus(settled('APPROVED'))

      expect(detail('Total paid')).toHaveTextContent('$474.900')
      expect(detail('Reference')).toHaveTextContent('ORDER-TEST-0001')
      expect(detail('Product')).toHaveTextContent(
        'Aurora Wireless Headphones × 1',
      )
    })
  })

  it.each<[TransactionStatus, string, string]>([
    [
      'DECLINED',
      'Payment declined',
      'Your card was not charged. You can try again with another card.',
    ],
    [
      'ERROR',
      'Payment not completed',
      'Something went wrong with the payment and your card was not charged.',
    ],
    [
      'VOIDED',
      'Payment cancelled',
      'The payment was cancelled and your card was not charged.',
    ],
  ])('explains a %s payment', (status, title, text) => {
    renderStatus(settled(status))

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(detail('Total')).toHaveTextContent('$474.900')
    expect(screen.queryByText('Total paid')).toBeNull()
  })

  describe('a payment that is still not confirmed', () => {
    const pendingTransaction: Transaction = {
      ...approvedTransaction,
      status: 'PENDING',
    }
    const unconfirmed: TransactionState = {
      id: approvedTransaction.id,
      transaction: pendingTransaction,
      phase: 'unconfirmed',
      error: null,
      retryable: false,
    }

    it('says so and promises there will be no second charge', () => {
      renderStatus(unconfirmed)

      expect(
        screen.getByRole('heading', {
          name: 'We are still confirming your payment',
        }),
      ).toBeInTheDocument()
      expect(screen.getByText(/You will not be charged twice/)).toBeInTheDocument()
      expect(detail('Reference')).toHaveTextContent('ORDER-TEST-0001')
    })

    it('checks again when asked', async () => {
      const user = userEvent.setup()
      const { api } = renderStatus(unconfirmed)

      await user.click(screen.getByRole('button', { name: 'Check again' }))

      expect(api.getTransaction).toHaveBeenCalledWith(approvedTransaction.id)
      expect(
        await screen.findByRole('heading', { name: 'Payment approved' }),
      ).toBeInTheDocument()
    })

    it('still works when the payment itself could not be read', () => {
      renderStatus({ ...unconfirmed, transaction: null })

      expect(
        screen.getByRole('heading', {
          name: 'We are still confirming your payment',
        }),
      ).toBeInTheDocument()
      expect(screen.queryByText('Reference')).toBeNull()
    })
  })

  describe('a purchase that could not be sent', () => {
    const failed = (retryable: boolean): TransactionState => ({
      id: approvedTransaction.id,
      transaction: null,
      phase: 'failed',
      error: 'There are not enough units in stock.',
      retryable,
    })

    it('explains the problem', () => {
      renderStatus(failed(false))

      expect(
        screen.getByRole('heading', { name: 'We could not process the payment' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText('There are not enough units in stock.'),
      ).toBeInTheDocument()
    })

    it('does not offer to try again when it would not help', () => {
      renderStatus(failed(false))

      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
      expect(backButton()).toBeInTheDocument()
    })

    it('sends the same purchase again when asked', async () => {
      const user = userEvent.setup()
      const { api } = renderStatus(failed(true))

      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(api.createTransaction).toHaveBeenCalledWith(
        approvedTransaction.id,
        expect.objectContaining({ productId: headphones.id }),
      )
      expect(
        await screen.findByRole('heading', { name: 'Payment approved' }),
      ).toBeInTheDocument()
    })
  })

  describe('going back to the product', () => {
    it('ends the checkout and forgets the payment', async () => {
      const user = userEvent.setup()
      const { store } = renderStatus(settled('APPROVED'))

      await user.click(backButton())

      expect(store.getState().checkout).toEqual({
        ...initialCheckoutState,
        productId: headphones.id,
      })
      expect(store.getState().transaction.phase).toBe('idle')
    })

    it('reads the product again, so the stock is up to date', async () => {
      const user = userEvent.setup()
      const api = fakeApi({
        getProducts: jest
          .fn()
          .mockResolvedValue({ ok: true, data: [{ ...headphones, stock: 11 }] }),
      })
      const { store } = renderStatus(settled('APPROVED'), api)

      await user.click(backButton())

      await waitFor(() =>
        expect(store.getState().products.items[0].stock).toBe(11),
      )
    })
  })

  it('shows nothing when there is no payment at all', () => {
    const { container } = renderStatus({
      id: null,
      transaction: null,
      phase: 'idle',
      error: null,
      retryable: false,
    })

    expect(container).toBeEmptyDOMElement()
  })
})
