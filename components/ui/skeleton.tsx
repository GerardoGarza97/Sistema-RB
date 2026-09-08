/**
 * @file Primitiva reutilizable de interfaz “skeleton”; encapsula estructura, accesibilidad y estilos compartidos.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { cn } from "@/lib/utils"

/** Componente React reutilizable `Skeleton`; recibe propiedades tipadas y renderiza su parte de la interfaz. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
