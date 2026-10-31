import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders modal content into <body> (outside the app/layout tree) so the
 * fixed overlay always covers the *entire* viewport — including the sticky
 * navbar and breadcrumb. Rendering a fixed overlay inside the layout subtree
 * leaves the top strip (navbar area) looking un-dimmed/un-blurred because the
 * sticky header sits in its own stacking context. Portalling to body fixes it.
 *
 * Also locks background scroll while a modal is open.
 */
export default function ModalPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(children, document.body)
}
