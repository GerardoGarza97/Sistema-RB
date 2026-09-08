/**
 * @file Hook que detecta si el navegador tiene el ancho definido para la experiencia móvil.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import * as React from "react"

const MOBILE_BREAKPOINT = 768

/** Observa el ancho de la ventana y devuelve si corresponde al diseño móvil. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
