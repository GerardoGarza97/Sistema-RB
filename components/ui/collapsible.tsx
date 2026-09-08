/**
 * @file Primitiva reutilizable de interfaz “collapsible”; encapsula estructura, accesibilidad y estilos compartidos.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client"

import { Collapsible as CollapsiblePrimitive } from "radix-ui"

/** Componente React reutilizable `Collapsible`; recibe propiedades tipadas y renderiza su parte de la interfaz. */
function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

/** Componente React reutilizable `CollapsibleTrigger`; recibe propiedades tipadas y renderiza su parte de la interfaz. */
function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

/** Componente React reutilizable `CollapsibleContent`; recibe propiedades tipadas y renderiza su parte de la interfaz. */
function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
