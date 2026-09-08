/**
 * @file Pantalla de Calidad para validar mercancía recibida, factura, lote, caducidad y cantidad que entra al inventario.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, FileCheck2, PackageCheck, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ReceiptItem = {
  productId: number | null;
  product: string;
  quantity: number;
  receivedQuantity: number | null;
  unit: string;
  lot: string;
  expiryDate: string;
  unitsPerBox: number;
  inventoryQuantity: number;
};
type SupplierReceipt = {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  reference: string;
  movementDate: string;
  items: ReceiptItem[];
  notes: string;
  invoiceNumber: string;
  validationNotes: string;
  invoiceValidatedBy: string;
  invoiceValidatedAt: string | null;
  createdBy: string;
  createdAt: string;
};
type InventoryProduct = { productId: number; name: string; code: string; unitsPerBox: number };
type DraftItem = { index: number; productId: string; receivedQuantity: string; lot: string; expiryDate: string };
type ValidationPayload = {
  cashOutflowId: number;
  invoiceNumber: string;
  validationNotes: string;
  receivedConfirmed: boolean;
  items: { index: number; productId: number; receivedQuantity: number; lot: string; expiryDate: string }[];
};

/** Función auxiliar `shortDate`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const shortDate = (value: string) => new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
/** Función auxiliar `dateTime`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const dateTime = (value: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`));
/** Función auxiliar `quantityLabel`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const quantityLabel = (quantity: number, unit: string) => `${quantity.toLocaleString("es-MX")} ${unit.toLowerCase()}`;
/** Función auxiliar `entersInventory`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const entersInventory = (unit: string) => !["SERVICIO", "OTRO"].includes(unit);

/** Componente que agrupa pedidos por proveedor y valida su recepción física. */
export function SupplierReceipts({ receipts, inventory, saving, onSubmit }: {
  receipts: SupplierReceipt[];
  inventory: InventoryProduct[];
  saving: boolean;
  onSubmit: (payload: ValidationPayload) => Promise<boolean>;
}) {
  // Solo una recepción se expande a la vez; el borrador representa lo que realmente llegó.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [validationNotes, setValidationNotes] = useState("");
  const [receivedConfirmed, setReceivedConfirmed] = useState(false);

  const inventoryProducts = useMemo(() => [...new Map(inventory.map((item) => [item.productId, item])).values()].sort((a, b) => a.name.localeCompare(b.name, "es")), [inventory]);
  // Agrupa por proveedor y coloca primero los pedidos todavía pendientes.
  const supplierGroups = useMemo(() => {
    const groups = new Map<string, { supplierName: string; receipts: SupplierReceipt[] }>();
    receipts.forEach((receipt) => {
      const supplierName = receipt.supplierName || "Proveedor sin nombre";
      const key = `${receipt.supplierId || 0}-${supplierName}`;
      const group = groups.get(key) || { supplierName, receipts: [] };
      group.receipts.push(receipt); groups.set(key, group);
    });
    return [...groups.values()].map((group) => ({
      ...group,
      receipts: group.receipts.sort((a, b) => Number(Boolean(a.invoiceValidatedAt)) - Number(Boolean(b.invoiceValidatedAt)) || b.movementDate.localeCompare(a.movementDate)),
    })).sort((a, b) => a.supplierName.localeCompare(b.supplierName, "es"));
  }, [receipts]);
  const pending = receipts.filter((receipt) => !receipt.invoiceValidatedAt).length;
  const expandedReceipt = receipts.find((receipt) => receipt.id === expandedId) || null;

  const suggestedProductId = (item: ReceiptItem) => item.productId || inventoryProducts.find((product) => product.name.trim().toLocaleLowerCase("es-MX") === item.product.trim().toLocaleLowerCase("es-MX"))?.productId || 0;
  const openReceipt = (receipt: SupplierReceipt) => {
    if (expandedId === receipt.id) { setExpandedId(null); return; }
    setExpandedId(receipt.id);
    setInvoiceNumber(receipt.invoiceNumber || ""); setValidationNotes(receipt.validationNotes || ""); setReceivedConfirmed(false);
    setDraftItems(receipt.items.map((item, index) => ({
      index,
      productId: entersInventory(item.unit) ? String(suggestedProductId(item) || "") : "",
      receivedQuantity: String(item.receivedQuantity ?? item.quantity),
      lot: item.lot || "",
      expiryDate: item.expiryDate || "",
    })));
  };
  const updateItem = (index: number, field: keyof Omit<DraftItem, "index">, value: string) => setDraftItems((current) => current.map((item) => item.index === index ? { ...item, [field]: value } : item));
  const productFor = (draft: DraftItem) => inventoryProducts.find((product) => String(product.productId) === draft.productId);
  const inventoryTotal = (item: ReceiptItem, draft: DraftItem) => {
    const received = Number(draft.receivedQuantity) || 0;
    const product = productFor(draft);
    if (!entersInventory(item.unit) || !product || received <= 0) return 0;
    return item.unit === "CAJA" ? received * product.unitsPerBox : received;
  };
  const itemIsComplete = (item: ReceiptItem, draft: DraftItem) => {
    const received = Number(draft.receivedQuantity);
    if (!Number.isFinite(received) || received < 0) return false;
    if (received === 0 || !entersInventory(item.unit)) return true;
    return Boolean(Number(draft.productId) && draft.lot.trim() && /^\d{4}-\d{2}-\d{2}$/.test(draft.expiryDate) && Number.isInteger(inventoryTotal(item, draft)));
  };
  const hasDifferences = expandedReceipt?.items.some((item, index) => Number(draftItems[index]?.receivedQuantity) !== item.quantity) || false;

  // La factura y los datos de lote son obligatorios antes de sumar existencias.
  const validateReceipt = async () => {
    if (!expandedReceipt || expandedReceipt.invoiceValidatedAt) return;
    if (invoiceNumber.trim().length < 3) return toast.error("Escribe el código o folio de la factura.");
    if (draftItems.length !== expandedReceipt.items.length || expandedReceipt.items.some((item, index) => !itemIsComplete(item, draftItems[index]))) return toast.error("Completa la cantidad recibida, producto de inventario, lote y caducidad de cada producto entregado.");
    if (!receivedConfirmed) return toast.error("Confirma que revisaste las cantidades, lotes y caducidades.");
    const ok = await onSubmit({
      cashOutflowId: expandedReceipt.id,
      invoiceNumber: invoiceNumber.trim(), validationNotes: validationNotes.trim(), receivedConfirmed,
      items: draftItems.map((item) => ({ index: item.index, productId: Number(item.productId) || 0, receivedQuantity: Number(item.receivedQuantity), lot: item.lot.trim(), expiryDate: item.expiryDate })),
    });
    if (ok) { setExpandedId(null); setDraftItems([]); setInvoiceNumber(""); setValidationNotes(""); setReceivedConfirmed(false); }
  };

  return <section className="panel full-panel supplier-receipts-panel">
    <div className="section-toolbar"><div><p className="eyebrow">Calidad</p><h2>Validación de entradas de proveedor</h2><p className="section-copy">Los pedidos están agrupados por proveedor. Abre uno para revisar lo solicitado y capturar lo que realmente llegó.</p></div><Badge variant="outline"><ClipboardCheck />{pending} pendiente(s)</Badge></div>
    <div className="receipt-notice"><span><FileCheck2 /></span><div><strong>La factura, los lotes y las caducidades se capturan al recibir</strong><p>Al validar, las cantidades recibidas se suman automáticamente al inventario. Si llegó menos o más, corrige la cantidad antes de guardar.</p></div></div>

    {supplierGroups.length ? <div className="receipt-supplier-list">{supplierGroups.map((group) => {
      const groupPending = group.receipts.filter((receipt) => !receipt.invoiceValidatedAt).length;
      return <section className="receipt-supplier-group" key={group.supplierName}>
        <div className="receipt-supplier-heading"><div><Warehouse /><span><strong>{group.supplierName}</strong><small>{group.receipts.length} pedido(s) registrado(s)</small></span></div><Badge variant="outline">{groupPending} pendiente(s)</Badge></div>
        <div className="receipt-order-list">{group.receipts.map((receipt) => {
          const isExpanded = expandedId === receipt.id;
          return <article className={`receipt-order ${isExpanded ? "expanded" : ""}`} key={receipt.id}>
            <button type="button" className="receipt-order-summary" aria-expanded={isExpanded} aria-controls={`receipt-order-${receipt.id}`} onClick={() => openReceipt(receipt)}>
              <span className="receipt-order-chevron">{isExpanded ? <ChevronDown /> : <ChevronRight />}</span>
              <span><small>Pedido interno</small><strong>{receipt.reference}</strong></span>
              <span><small>Fecha</small><strong>{shortDate(receipt.movementDate)}</strong></span>
              <span><small>Productos</small><strong>{receipt.items.length}</strong></span>
              <span><small>Factura</small><strong>{receipt.invoiceNumber || "Pendiente"}</strong></span>
              {receipt.invoiceValidatedAt ? <Badge variant="outline" className="delivery-registered"><CheckCircle2 />Validada</Badge> : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Esperando recepción</Badge>}
            </button>

            {isExpanded && <div className="receipt-order-detail" id={`receipt-order-${receipt.id}`}>
              <div className="receipt-order-meta"><span><small>Registró el pedido</small><strong>{receipt.createdBy}</strong></span>{receipt.notes && <span><small>Observaciones del pedido</small><strong>{receipt.notes}</strong></span>}</div>
              <div className="receipt-entry-table"><Table><TableHeader><TableRow><TableHead>Producto solicitado</TableHead><TableHead className="text-right">Pedido</TableHead><TableHead className="text-right">Cantidad recibida</TableHead><TableHead>Producto en inventario</TableHead><TableHead>Lote</TableHead><TableHead>Caducidad</TableHead><TableHead className="text-right">Entrada total</TableHead></TableRow></TableHeader><TableBody>{receipt.items.map((item, index) => {
                const draft = draftItems[index] || { index, productId: "", receivedQuantity: String(item.quantity), lot: "", expiryDate: "" };
                const received = item.receivedQuantity ?? item.quantity;
                const displayedReceived = receipt.invoiceValidatedAt ? received : Number(draft.receivedQuantity);
                const differs = Number(draft.receivedQuantity) !== item.quantity;
                return <TableRow key={`${receipt.id}-${index}`}>
                  <TableCell><strong>{item.product}</strong><small className="cell-sub">{entersInventory(item.unit) ? "Se agregará al inventario" : "Concepto sin inventario"}</small></TableCell>
                  <TableCell className="text-right"><strong>{quantityLabel(item.quantity, item.unit)}</strong></TableCell>
                  <TableCell className="text-right">{receipt.invoiceValidatedAt ? <strong className={received !== item.quantity ? "receipt-difference" : ""}>{quantityLabel(received, item.unit)}</strong> : <div className="receipt-quantity-input"><Input aria-label={`Cantidad recibida de ${item.product}`} type="number" min="0" step="1" value={draft.receivedQuantity} onChange={(event) => updateItem(index, "receivedQuantity", event.target.value)} /><small className={differs ? "receipt-difference" : ""}>{differs ? "Cantidad modificada" : "Igual al pedido"}</small></div>}</TableCell>
                  <TableCell>{!entersInventory(item.unit) ? <span className="cell-sub">No aplica</span> : receipt.invoiceValidatedAt ? <strong>{inventoryProducts.find((product) => product.productId === item.productId)?.name || item.product}</strong> : <Select value={draft.productId || undefined} onValueChange={(value) => updateItem(index, "productId", value)}><SelectTrigger aria-label={`Producto de inventario para ${item.product}`}><SelectValue placeholder="Seleccionar producto…" /></SelectTrigger><SelectContent>{inventoryProducts.map((product) => <SelectItem key={product.productId} value={String(product.productId)}>{product.code} · {product.name}</SelectItem>)}</SelectContent></Select>}</TableCell>
                  <TableCell>{!entersInventory(item.unit) || displayedReceived === 0 ? <span className="cell-sub">No aplica</span> : receipt.invoiceValidatedAt ? <strong className="mono">{item.lot || "—"}</strong> : <Input aria-label={`Lote de ${item.product}`} value={draft.lot} onChange={(event) => updateItem(index, "lot", event.target.value)} placeholder="Ej. L240901" />}</TableCell>
                  <TableCell>{!entersInventory(item.unit) || displayedReceived === 0 ? <span className="cell-sub">No aplica</span> : receipt.invoiceValidatedAt ? <strong>{item.expiryDate ? shortDate(item.expiryDate) : "—"}</strong> : <Input aria-label={`Caducidad de ${item.product}`} type="date" value={draft.expiryDate} onChange={(event) => updateItem(index, "expiryDate", event.target.value)} />}</TableCell>
                  <TableCell className="text-right"><strong>{receipt.invoiceValidatedAt ? item.inventoryQuantity || "—" : inventoryTotal(item, draft) || "—"}</strong>{entersInventory(item.unit) && <small className="cell-sub">unidades</small>}</TableCell>
                </TableRow>;
              })}</TableBody></Table></div>

              {receipt.invoiceValidatedAt ? <div className="receipt-validated-summary"><FileCheck2 /><div><strong>Factura {receipt.invoiceNumber}</strong><p>Validó {receipt.invoiceValidatedBy} · {dateTime(receipt.invoiceValidatedAt)}</p>{receipt.validationNotes && <p>{receipt.validationNotes}</p>}</div></div> : <div className="receipt-validation-footer">
                <div className="receipt-validation-fields"><div className="field"><Label htmlFor={`supplier-invoice-${receipt.id}`}>Código o folio de factura <span>*</span></Label><Input id={`supplier-invoice-${receipt.id}`} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Ej. FAC-001258" /></div><div className="field"><Label htmlFor={`supplier-notes-${receipt.id}`}>Observaciones de Calidad</Label><Textarea id={`supplier-notes-${receipt.id}`} rows={2} value={validationNotes} onChange={(event) => setValidationNotes(event.target.value)} placeholder="Faltantes, sobrantes, daños o aclaraciones…" /></div></div>
                {hasDifferences && <div className="receipt-difference-notice">La recepción tiene cantidades diferentes a las solicitadas. Se guardarán las cantidades capturadas por Calidad.</div>}
                <label className="receipt-confirmation"><Checkbox checked={receivedConfirmed} onCheckedChange={(checked) => setReceivedConfirmed(checked === true)} /><span>Confirmo que revisé cantidades, lotes, caducidades y factura.</span></label>
                <div className="receipt-validation-actions"><Button variant="outline" onClick={() => setExpandedId(null)}>Cerrar</Button><Button disabled={saving || !receivedConfirmed} onClick={() => void validateReceipt()}>{saving ? "Guardando…" : <><PackageCheck />Validar entrada y sumar inventario</>}</Button></div>
              </div>}
            </div>}
          </article>;
        })}</div>
      </section>;
    })}</div> : <div className="empty-state"><span className="empty-icon"><PackageCheck /></span><h3>No hay entradas de proveedor</h3><p>Los pedidos nuevos a proveedores aparecerán aquí automáticamente.</p></div>}
  </section>;
}
