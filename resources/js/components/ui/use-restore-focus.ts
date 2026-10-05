import * as React from "react"

/**
 * A controlled overlay without a trigger has nothing for Radix to give focus
 * back to, so focus falls on <body> when it closes. This remembers the element
 * focused when `open` turned true; pass the returned handler to
 * `onCloseAutoFocus` of the overlay content.
 */
function useRestoreFocus(open: boolean): (event: Event) => void {
  const openerRef = React.useRef<HTMLElement | null>(null)

  React.useLayoutEffect(() => {
    if (!open) {
      return
    }

    const active = document.activeElement

    openerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null
  }, [open])

  return React.useCallback((event: Event) => {
    const opener = openerRef.current

    if (!opener || !opener.isConnected) {
      return
    }

    event.preventDefault()
    opener.focus()
  }, [])
}

export { useRestoreFocus }
