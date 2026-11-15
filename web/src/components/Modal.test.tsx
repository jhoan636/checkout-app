import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { Modal } from './Modal'

const renderModal = (onClose = jest.fn()) => {
  render(
    <Modal className="sheet" labelledBy="modal-title" onClose={onClose}>
      <h2 id="modal-title">Payment details</h2>
      <p>Content</p>
    </Modal>,
  )
  return onClose
}

describe('Modal', () => {
  afterEach(() => {
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal
  })

  it('shows its content in a dialog named after its title', () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'Payment details' })
    expect(dialog).toHaveTextContent('Content')
    expect(dialog).toHaveClass('sheet')
  })

  it('opens as a native modal where the browser supports it', () => {
    const showModal = jest.fn()
    HTMLDialogElement.prototype.showModal = showModal

    renderModal()

    expect(showModal).toHaveBeenCalledTimes(1)
  })

  // React runs effects twice in development; a dialog cannot be opened twice.
  it('opens only once in strict mode', () => {
    const showModal = jest.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    })
    HTMLDialogElement.prototype.showModal = showModal

    render(
      <StrictMode>
        <Modal className="sheet" labelledBy="t" onClose={jest.fn()}>
          <h2 id="t">Title</h2>
        </Modal>
      </StrictMode>,
    )

    expect(showModal).toHaveBeenCalledTimes(1)
  })

  it('asks to be closed when the customer presses Escape', () => {
    const onClose = renderModal()

    // Browsers turn Escape on a modal dialog into a "cancel" event.
    fireEvent(screen.getByRole('dialog'), new Event('cancel'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
