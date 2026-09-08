/**
 * @file Primitiva reutilizable de interfaz “direction”; encapsula estructura, accesibilidad y estilos compartidos.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client"

import * as React from "react"
import { Direction } from "radix-ui"

/** Componente React reutilizable `DirectionProvider`; recibe propiedades tipadas y renderiza su parte de la interfaz. */
function DirectionProvider({
  dir,
  direction,
  children,
}: React.ComponentProps<typeof Direction.DirectionProvider> & {
  direction?: React.ComponentProps<typeof Direction.DirectionProvider>["dir"]
}) {
  return (
    <Direction.DirectionProvider dir={direction ?? dir}>
      {children}
    </Direction.DirectionProvider>
  )
}

const useDirection = Direction.useDirection

export { DirectionProvider, useDirection }
