/**
 * @file Pantalla de Compras para registrar una salida de dinero con varias partidas del mismo proveedor.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleDollarSign, PackagePlus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type SupplierOption = { id: number; name: string; rfc: string; active: boolean };
type InventoryOption = { productId: number; supplierId: number | null; name: string; code: string };
type DraftLine = { id: number; product: string; quantity: string; unit: string; unitPrice: string };
type BatchPayload = {
  supplierId: number;
  movementDate: string;
  method: string;
  notes: string;
  items: { productId: number; product: string; quantity: number; unit: string; unitPrice: string }[];
};

/** Función auxiliar `currency`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const currency = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
/** Función auxiliar `todayInput`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const todayInput = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
/** Función auxiliar `emptyLine`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const emptyLine = (id: number): DraftLine => ({ id, product: "", quantity: "", unit: "CAJA", unitPrice: "" });
/** Función auxiliar `lineHasData`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const lineHasData = (line: DraftLine) => Boolean(line.product.trim() || line.quantity || line.unitPrice);
/** Función auxiliar `lineIsComplete`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const lineIsComplete = (line: DraftLine) => line.product.trim().length >= 2 && Number(line.quantity) > 0 && line.unitPrice.trim() !== "" && Number(line.unitPrice) >= 0;

/** Componente que captura varias partidas y las envía como una sola salida de dinero. */
export function BulkCashOutflow({
  suppliers,
  inventory,
  saving,
  onSubmit,
  onBack,
}: {
  suppliers: SupplierOption[];
  inventory: InventoryOption[];
  saving: boolean;
  onSubmit: (payload: BatchPayload) => Promise<boolean>;
  onBack: () => void;
}) {
  // Los datos generales pertenecen a toda la compra; las líneas conservan el desglose de productos.
  const nextLineId = useRef(2);
  const [supplierId, setSupplierId] = useState("");
  const [movementDate, setMovementDate] = useState(todayInput);
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(1)]);

  const productSuggestions = useMemo(() => {
    const selected = Number(supplierId);
    const matching = inventory.filter((item) => !selected || item.supplierId === selected);
    return [...new Map(matching.map((item) => [item.productId, item])).values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [inventory, supplierId]);
  const completeLines = lines.filter(lineIsComplete);
  const hasPartialLine = lines.some((line) => lineHasData(line) && !lineIsComplete(line));
  const totalCents = completeLines.reduce((sum, line) => sum + Math.round(Number(line.quantity) * Number(line.unitPrice) * 100), 0);

  // Al completar la última partida se añade otra fila vacía sin interrumpir la captura.
  const updateLine = (id: number, field: keyof Omit<DraftLine, "id">, value: string) => {
    setLines((current) => {
      const updated = current.map((line) => line.id === id ? { ...line, [field]: value } : line);
      const last = updated.at(-1);
      if (last && lineIsComplete(last) && updated.length < 100) return [...updated, emptyLine(nextLineId.current++)];
      return updated;
    });
  };

  const removeLine = (id: number) => {
    setLines((current) => {
      const remaining = current.filter((line) => line.id !== id);
      return remaining.length ? remaining : [emptyLine(nextLineId.current++)];
    });
  };

  const reset = () => {
    setSupplierId(""); setMovementDate(todayInput()); setMethod(""); setNotes("");
    setLines([emptyLine(nextLineId.current++)]);
  };

  // El envío agrupa las partidas válidas en un solo movimiento por proveedor.
  const submit = async () => {
    if (!supplierId) return toast.error("Selecciona el proveedor del pedido.");
    if (!movementDate || !method) return toast.error("Completa la fecha y el método de pago.");
    if (!completeLines.length) return toast.error("Agrega por lo menos un producto completo.");
    if (hasPartialLine) return toast.error("Completa o elimina la fila que quedó a medias.");
    const ok = await onSubmit({
      supplierId: Number(supplierId), movementDate, method, notes: notes.trim(),
      items: completeLines.map((line) => ({
        productId: productSuggestions.find((product) => product.name.trim().toLocaleLowerCase("es-MX") === line.product.trim().toLocaleLowerCase("es-MX"))?.productId || 0,
        product: line.product.trim(), quantity: Number(line.quantity), unit: line.unit, unitPrice: line.unitPrice,
      })),
    });
    if (ok) { reset(); onBack(); }
  };

  return <section className="panel full-panel bulk-outflow-panel">
    <div className="section-toolbar bulk-outflow-toolbar"><div><p className="eyebrow">Compras y caja</p><h2>Nuevo pedido a proveedor</h2><p className="section-copy">Registra el pago y los productos sin esperar la factura. El sistema enviará la recepción a Calidad para validarla cuando llegue la mercancía.</p></div><Button variant="outline" onClick={onBack}><ArrowLeft />Volver al historial</Button></div>

    <div className="bulk-outflow-general">
      <div className="field"><Label>Proveedor <span>*</span></Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Seleccionar proveedor…" /></SelectTrigger><SelectContent>{suppliers.filter((supplier) => supplier.active).map((supplier) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}{supplier.rfc ? ` · ${supplier.rfc}` : ""}</SelectItem>)}</SelectContent></Select></div>
      <div className="field"><Label htmlFor="outflow-date">Fecha de pago o salida <span>*</span></Label><Input id="outflow-date" type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} /></div>
      <div className="field"><Label>Método de pago <span>*</span></Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger><SelectContent><SelectItem value="EFECTIVO">Efectivo</SelectItem><SelectItem value="TRANSFERENCIA">Transferencia</SelectItem><SelectItem value="TARJETA">Tarjeta</SelectItem><SelectItem value="CHEQUE">Cheque</SelectItem><SelectItem value="OTRO">Otro</SelectItem></SelectContent></Select></div>
      <div className="field field-wide"><Label htmlFor="outflow-notes">Observaciones</Label><Textarea id="outflow-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Condiciones, número de orden, aclaraciones o datos adicionales…" /></div>
    </div>

    <div className="bulk-outflow-lines">
      <div className="bulk-outflow-lines-heading"><div><span><PackagePlus /></span><div><h3>Productos del pedido</h3><p>Al completar una fila aparecerá automáticamente la siguiente.</p></div></div><strong>{completeLines.length} producto(s)</strong></div>
      <datalist id="bulk-outflow-products">{productSuggestions.map((product) => <option key={product.productId} value={product.name}>{product.code}</option>)}</datalist>
      <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Producto o concepto</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead>Unidad</TableHead><TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead /></TableRow></TableHeader><TableBody>{lines.map((line, index) => {
        const subtotal = lineIsComplete(line) ? Math.round(Number(line.quantity) * Number(line.unitPrice) * 100) : 0;
        const isTrailingBlank = index === lines.length - 1 && !lineHasData(line);
        return <TableRow key={line.id} className={isTrailingBlank ? "bulk-line-empty" : undefined}><TableCell className="bulk-line-number">{index + 1}</TableCell><TableCell><Input list="bulk-outflow-products" aria-label={`Producto de la fila ${index + 1}`} value={line.product} onChange={(event) => updateLine(line.id, "product", event.target.value)} placeholder="Nombre del producto" /></TableCell><TableCell><Input className="text-right" aria-label={`Cantidad de la fila ${index + 1}`} type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} placeholder="0" /></TableCell><TableCell><Select value={line.unit} onValueChange={(value) => updateLine(line.id, "unit", value)}><SelectTrigger aria-label={`Unidad de la fila ${index + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CAJA">Caja(s)</SelectItem><SelectItem value="UNIDAD">Unidad(es)</SelectItem><SelectItem value="KG">Kilogramo(s)</SelectItem><SelectItem value="SERVICIO">Servicio</SelectItem><SelectItem value="OTRO">Otro</SelectItem></SelectContent></Select></TableCell><TableCell><Input className="text-right" aria-label={`Precio unitario de la fila ${index + 1}`} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.id, "unitPrice", event.target.value)} placeholder="$0.00" /></TableCell><TableCell className="text-right bulk-line-subtotal"><strong>{subtotal ? currency(subtotal) : "—"}</strong></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon-sm" className="cancel-action" aria-label={`Eliminar fila ${index + 1}`} disabled={lines.length === 1 && !lineHasData(line)} onClick={() => removeLine(line.id)}><Trash2 /></Button></TableCell></TableRow>;
      })}</TableBody></Table>
    </div>

    <div className="bulk-outflow-footer"><div className="bulk-outflow-total"><span><CircleDollarSign /></span><div><small>TOTAL DEL PEDIDO</small><strong>{currency(totalCents)}</strong><p>{completeLines.length} producto(s) incluidos en una sola salida de dinero</p></div></div><div className="bulk-outflow-actions"><Button variant="outline" onClick={reset} disabled={saving}>Limpiar</Button><Button size="lg" onClick={() => void submit()} disabled={saving || !completeLines.length}>{saving ? "Guardando…" : <><Send />Enviar pedido y registrar salida</>}</Button></div></div>
  </section>;
}
