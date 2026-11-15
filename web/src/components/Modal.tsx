import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * A native modal dialog: the browser traps the focus inside it, makes the
 * page behind inert and draws the backdrop. Closing is always the parent's
 * decision, so Escape only asks for it.
 */
export function Modal({
  className,
  labelledBy,
  onClose,
  children,
}: {
  className: string
  /** Id of the heading that names the dialog. */
  labelledBy: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) {
      return
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal()
    } else {
      // Browsers without native modals still get an open dialog.
      dialog.setAttribute('open', '')
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      {children}
    </dialog>
  )
}
