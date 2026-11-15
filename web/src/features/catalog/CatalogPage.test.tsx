import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { headphones, keyboard, readyProducts, renderWithStore } from '../../test/render'
import { CatalogPage } from './CatalogPage'

const renderCatalog = (items = [headphones, keyboard]) =>
  renderWithStore(<CatalogPage />, { state: { products: readyProducts(items) } })

const card = (name: string) => screen.getByRole('button', { name: new RegExp(name) })

describe('CatalogPage', () => {
  it('lists every product with its description, price and stock', () => {
    renderCatalog()

    const first = within(card('Aurora Wireless Headphones'))
    expect(
      first.getByText('Over-ear headphones with noise cancelling.'),
    ).toBeInTheDocument()
    expect(first.getByText('$459.900')).toBeInTheDocument()
    expect(first.getByText('12 in stock')).toBeInTheDocument()

    const second = within(card('Nimbus Mechanical Keyboard'))
    expect(second.getByText('$389.500')).toBeInTheDocument()
    expect(second.getByText('3 in stock')).toBeInTheDocument()
  })

  it('says how many products there are', () => {
    renderCatalog()
    expect(screen.getByText('2 products')).toBeInTheDocument()
  })

  it('uses the singular for a single product', () => {
    renderCatalog([headphones])
    expect(screen.getByText('1 product')).toBeInTheDocument()
  })

  // The photo has an empty alt (the card names the product), so it is found
  // as an element rather than by an accessible role.
  it('shows each photo with its real size, so the page does not jump', () => {
    renderCatalog()
    const image = card('Aurora Wireless Headphones').querySelector('img')

    expect(image).toHaveAttribute('src', '/products/aurora-headphones.webp')
    expect(image).toHaveAttribute('width')
    expect(image).toHaveAttribute('height')
    expect(image).toHaveAttribute('alt', '')
  })

  it('keeps the card usable when its photo cannot be loaded', () => {
    renderCatalog()
    const item = card('Aurora Wireless Headphones')

    fireEvent.error(item.querySelector('img')!)

    expect(item.querySelector('img')).toBeNull()
    expect(item).toBeEnabled()
  })

  it('warns when only a few units are left', () => {
    renderCatalog()

    expect(screen.getByText('3 in stock')).toHaveAttribute('data-level', 'low')
  })

  it('marks a product that is sold out', () => {
    renderCatalog([{ ...headphones, stock: 0 }])

    expect(screen.getByText('Sold out')).toHaveAttribute('data-level', 'none')
  })

  it('opens the page of the product that is chosen', async () => {
    const user = userEvent.setup()
    const { store } = renderCatalog()

    await user.click(card('Nimbus Mechanical Keyboard'))

    expect(store.getState().checkout).toMatchObject({
      step: 'product',
      productId: keyboard.id,
      quantity: 1,
    })
  })
})
