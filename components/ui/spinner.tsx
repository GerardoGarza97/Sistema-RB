/**
 * @file Primitiva reutilizable de interfaz “spinner”; encapsula estructura, accesibilidad y estilos compartidos.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Componente React reutilizable `Spinner`; recibe propiedades tipadas y renderiza su parte de la interfaz. */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
