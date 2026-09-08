/**
 * @file Primitiva reutilizable de interfaz “aspect-ratio”; encapsula estructura, accesibilidad y estilos compartidos.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client"

import { AspectRatio as AspectRatioPrimitive } from "radix-ui"

/** Componente React reutilizable `AspectRatio`; recibe propiedades tipadas y renderiza su parte de la interfaz. */
function AspectRatio({
  ...props
}: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />
}

export { AspectRatio }
