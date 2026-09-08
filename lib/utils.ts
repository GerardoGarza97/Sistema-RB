/**
 * @file Funciones pequeñas compartidas por los componentes de interfaz.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases CSS condicionales y resuelve conflictos de Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
