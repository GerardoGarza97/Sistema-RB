/**
 * @file Primitiva reutilizable de interfaz “separator”; encapsula estructura, accesibilidad y estilos compartidos.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/** Componente React reutilizable `Separator`; recibe propiedades tipadas y renderiza su parte de la interfaz. */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
