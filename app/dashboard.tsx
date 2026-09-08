/**
 * @file Panel principal del sistema: navegación por rol, inventario, pedidos, facturas, cobros, entregas, alertas y modales operativos.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import * as XLSX from "xlsx";
import {
  Activity, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Banknote, BellRing, Boxes, Building2, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign,
  ClipboardCheck, ClipboardList, Clock3, Download, FileSpreadsheet, FileText, History, KeyRound, LayoutDashboard, Loader2,
  LogOut, PackageCheck, PackageMinus, PackagePlus, Plus, ReceiptText, RefreshCw, Search,
  ContactRound, MapPin, Moon, Pencil, RotateCcw, Send, ShieldCheck, ShoppingCart, Sun, Trash2, Truck, UserPlus, Users, WalletCards, Warehouse, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { downloadCollectionHistoryExcel, type CollectionHistoryRow } from "@/lib/cobranza-excel";
import { BulkCashOutflow } from "@/app/bulk-cash-outflow";
import { SupplierReceipts } from "@/app/supplier-receipts";

// Tipos que reflejan exactamente el contrato JSON devuelto por /api/system.
type Role = "ADMIN" | "COMPRAS" | "CALIDAD" | "CAJA" | "VENDEDOR" | "ALMACEN" | "PRODUCCION";
type View = "resumen" | "inventario" | "minimos" | "proveedores" | "pedidos" | "recepciones" | "calidad_envios" | "clientes" | "entregas" | "facturas" | "historial" | "equipo";
type Modal = "lote" | "salida" | "stock_minimo" | "precio_producto" | "presentacion_producto" | "pedido" | "editar_pedido" | "reprogramar_pedido" | "revision_fefo" | "devolucion" | "factura" | "cobro" | "programar_factura" | "entrega" | "editar_entrega" | "chofer" | "cliente" | "editar_cliente" | "proveedor" | "editar_proveedor" | "usuario" | "restablecer_clave" | "cambiar_usuario" | "cambiar_clave" | null;
type User = { id: number; email: string; username: string; authUserId: string | null; displayName: string; role: Role; active: boolean };
type Lot = { id: number; productId: number; supplierId: number | null; supplierName: string | null; code: string; name: string; lot: string; expiryDate: string; quantity: number; netPriceCents: number; minimumStock: number; unitsPerBox: number; updatedAt: string };
type OrderItem = { id: number; lotId: number; productId: number; quantity: number; returnedQuantity: number; unitPriceCents: number; orderedBoxes: number; orderedUnits: number; unitsPerBox: number; productName: string; productCode: string; lot: string };
type OrderReturn = { id: number; orderId: number; orderItemId: number; lotId: number | null; quantity: number; reason: string; createdBy: string; createdAt: string };
type OrderReschedule = { id: number; orderId: number; previousDate: string; newDate: string; reason: string; createdBy: string; createdAt: string };
type FefoAllocation = { id: number; reviewId: number; orderItemId: number; lotId: number; quantity: number; lot: string; expiryDate: string; productName: string; productCode: string };
type FefoReview = { id: number; orderId: number; notes: string; reviewedBy: string; reviewedAt: string; allocations: FefoAllocation[] };
type Order = { id: number; folio: string; customerId: number | null; customer: string; status: string; notes: string; deliveryDate: string | null; deliveryZone: string | null; deliveryLocation: string | null; createdBy: string; createdAt: string; items: OrderItem[]; returns: OrderReturn[]; reschedules: OrderReschedule[]; fefoReview: FefoReview | null };
type Payment = { id: number; amountCents: number; method: string; reference: string; paymentCondition: string; collectionChannel: string; comments: string; receivedBy: string; createdAt: string };
type Invoice = { id: number; folio: string; orderId: number | null; customerId: number | null; kind: string; customer: string; rfc: string; amountCents: number; status: string; scheduledSendDate: string | null; sendDelayReason: string; sentAt: string | null; createdBy: string; createdAt: string; payments: Payment[] };
type Driver = { id: number; name: string; active: boolean; createdAt: string };
type Delivery = { id: number; orderId: number | null; orderFolio: string | null; driverId: number; driverName: string; customer: string; invoiceNumber: string; contents: string; deliveryDate: string; createdBy: string; createdAt: string; updatedAt: string };
type Customer = { id: number; name: string; rfc: string; phone: string; email: string; address: string; active: boolean; createdAt: string; updatedAt: string };
type Supplier = { id: number; name: string; rfc: string; contactName: string; phone: string; email: string; active: boolean; createdAt: string; updatedAt: string };
type CashOutflowItem = { product: string; quantity: number; unit: string; unitPriceCents: number; subtotalCents: number };
type CashOutflow = { id: number; supplierId: number | null; supplierName: string | null; beneficiary: string; concept: string; amountCents: number; method: string; reference: string; movementDate: string; notes: string; items: CashOutflowItem[]; requiresInvoiceValidation: boolean; invoiceNumber: string; validationNotes: string; invoiceValidatedBy: string; invoiceValidatedAt: string | null; createdBy: string; createdAt: string };
type SupplierReceipt = { id: number; supplierId: number | null; supplierName: string | null; reference: string; movementDate: string; items: { productId: number | null; product: string; quantity: number; receivedQuantity: number | null; unit: string; lot: string; expiryDate: string; unitsPerBox: number; inventoryQuantity: number }[]; notes: string; invoiceNumber: string; validationNotes: string; invoiceValidatedBy: string; invoiceValidatedAt: string | null; createdBy: string; createdAt: string };
type CashLedgerRow = { id: string; type: "ENTRADA" | "SALIDA"; date: string; createdAt: string; party: string; concept: string; method: string; reference: string; amountCents: number; recordedBy: string; items?: CashOutflowItem[]; notes?: string };
type Movement = { id: number; action: string; entityType: string; details: string; quantity: number | null; actorEmail: string; actorName: string; actorRole: string; createdAt: string };
type SystemData = { currentUser: User; inventory: Lot[]; orders: Order[]; invoices: Invoice[]; deliveries: Delivery[]; drivers: Driver[]; customers: Customer[]; suppliers: Supplier[]; cashOutflows: CashOutflow[]; supplierReceipts: SupplierReceipt[]; movements: Movement[]; users: User[]; roleLimits: Record<Role, number> };

// Configuración de presentación: nombres, colores, zonas, módulos y textos por rol.
const emptyData: SystemData = { currentUser: { id: 0, email: "", username: "", authUserId: null, displayName: "", role: "ADMIN", active: true }, inventory: [], orders: [], invoices: [], deliveries: [], drivers: [], customers: [], suppliers: [], cashOutflows: [], supplierReceipts: [], movements: [], users: [], roleLimits: { ADMIN: 4, COMPRAS: 2, CALIDAD: 1, CAJA: 1, VENDEDOR: 4, ALMACEN: 1, PRODUCCION: 1 } };
const roleNames: Record<Role, string> = { ADMIN: "Administrador", COMPRAS: "Compras", CALIDAD: "Calidad", CAJA: "Caja", VENDEDOR: "Vendedor", ALMACEN: "Almacén", PRODUCCION: "Producción" };
const deliveryZoneOptions = [
  { value: "MONTERREY", label: "Monterrey" }, { value: "APODACA", label: "Apodaca" },
  { value: "CADEREYTA", label: "Cadereyta Jiménez" }, { value: "EL_CARMEN", label: "El Carmen" },
  { value: "CIENEGA_DE_FLORES", label: "Ciénega de Flores" }, { value: "GARCIA", label: "García" },
  { value: "ESCOBEDO", label: "General Escobedo" }, { value: "ZUAZUA", label: "General Zuazua" },
  { value: "GUADALUPE", label: "Guadalupe" }, { value: "JUAREZ", label: "Juárez" },
  { value: "PESQUERIA", label: "Pesquería" }, { value: "SALINAS_VICTORIA", label: "Salinas Victoria" },
  { value: "SAN_NICOLAS", label: "San Nicolás de los Garza" }, { value: "SAN_PEDRO", label: "San Pedro Garza García" },
  { value: "SANTA_CATARINA", label: "Santa Catarina" }, { value: "SANTIAGO", label: "Santiago" },
  { value: "FORANEO", label: "Foráneo · fuera del área metropolitana" },
];
const deliveryZoneNames: Record<string, string> = { ...Object.fromEntries(deliveryZoneOptions.map((option) => [option.value, option.label])), EXTRANJERO: "Extranjero (registro anterior)" };
const roleColors: Record<Role, string> = {
  ADMIN: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  COMPRAS: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  CALIDAD: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  CAJA: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  VENDEDOR: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
  ALMACEN: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
  PRODUCCION: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
};
/** Función auxiliar `currency`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const currency = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
/** Función auxiliar `shortDate`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const shortDate = (value: string) => new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
/** Función auxiliar `dateTime`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const dateTime = (value: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`));
/** Función auxiliar `todayInput`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const todayInput = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
/** Función auxiliar `monthStartInput`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const monthStartInput = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`; };
/** Función auxiliar `monthsFromTodayInput`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const monthsFromTodayInput = (months: number) => { const date = new Date(); date.setMonth(date.getMonth() + months); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
/** Función auxiliar `daysTo`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const daysTo = (value: string) => Math.ceil((new Date(`${value}T12:00:00`).getTime() - Date.now()) / 86400000);
/** Función auxiliar `initials`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "US";
const paymentConditionNames: Record<string, string> = { CONTADO: "Contado", CREDITO: "Crédito", SIN_ESPECIFICAR: "Sin especificar" };
const paymentMethodNames: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", TARJETA: "Tarjeta", CHEQUE: "Cheque", OTRO: "Otro" };
const collectionChannelNames: Record<string, string> = { CAJA: "Caja", VENDEDOR: "Vendedor", CHOFER: "Chofer / reparto", COBRANZA_TELEFONICA: "Cobranza telefónica", OTRO: "Otro" };
/** Función auxiliar `orderQuantityLabel`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const orderQuantityLabel = (item: OrderItem) => {
  if (!item.orderedBoxes && !item.orderedUnits) return `${item.quantity} unidad(es)`;
  const parts = [item.orderedBoxes ? `${item.orderedBoxes} caja(s)` : "", item.orderedUnits ? `${item.orderedUnits} unidad(es)` : ""].filter(Boolean);
  return `${parts.join(" + ")} · ${item.quantity} unidades totales`;
};
/** Función auxiliar `fefoSuggestion`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const fefoSuggestion = (item: OrderItem | undefined, inventory: Lot[]) => {
  if (!item) return [] as { lot: Lot; quantity: number }[];
  let remaining = item.quantity;
  return inventory.filter((lot) => lot.productId === item.productId && lot.quantity > 0 && lot.expiryDate >= todayInput()).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).flatMap((lot) => {
    if (remaining <= 0) return [];
    const quantity = Math.min(remaining, lot.quantity); remaining -= quantity; return [{ lot, quantity }];
  });
};

const navItems: { id: View; label: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "inventario", label: "Inventario", icon: Warehouse },
  { id: "minimos", label: "Mínimos de inventario", icon: AlertTriangle, roles: ["ADMIN", "COMPRAS"] },
  { id: "proveedores", label: "Proveedores", icon: Building2, roles: ["ADMIN", "COMPRAS", "CAJA"] },
  { id: "pedidos", label: "Pedidos", icon: ClipboardList, roles: ["ADMIN", "VENDEDOR", "CAJA"] },
  { id: "recepciones", label: "Validar entradas", icon: PackageCheck, roles: ["ADMIN", "CALIDAD"] },
  { id: "calidad_envios", label: "Revisión FEFO", icon: ClipboardCheck, roles: ["ADMIN", "CALIDAD"] },
  { id: "clientes", label: "Clientes", icon: ContactRound, roles: ["ADMIN", "COMPRAS", "CAJA", "VENDEDOR"] },
  { id: "entregas", label: "Entregas", icon: Truck },
  { id: "facturas", label: "Facturación y cobros", icon: ReceiptText, roles: ["ADMIN", "COMPRAS", "CAJA"] },
  { id: "historial", label: "Historial general", icon: History, roles: ["ADMIN"] },
  { id: "equipo", label: "Cuentas y permisos", icon: Users, roles: ["ADMIN"] },
];
const moduleDescriptions: Record<Exclude<View, "resumen">, string> = {
  inventario: "Consulta productos, existencias, lotes, caducidades y precios.",
  minimos: "Define la cantidad que activará la alerta de reposición.",
  proveedores: "Administra los proveedores relacionados con las entradas.",
  pedidos: "Consulta, registra y da seguimiento a los pedidos de clientes.",
  recepciones: "Revisa cantidades, lotes y caducidades por proveedor antes de ingresar la mercancía.",
  calidad_envios: "Selecciona los lotes que se enviarán siguiendo el sistema FEFO.",
  clientes: "Consulta y actualiza los datos de los clientes frecuentes.",
  entregas: "Revisa fechas, ubicaciones, choferes y productos por entregar.",
  facturas: "Gestiona facturas, cobros y movimientos de Caja.",
  historial: "Consulta la bitácora completa de operaciones y responsables.",
  equipo: "Asigna cuentas, perfiles y permisos de acceso.",
};
const roleIntroductions: Record<Role, string> = {
  ADMIN: "Supervisión completa de la operación y de todas las cuentas.",
  COMPRAS: "Control de existencias mínimas, proveedores, clientes y facturación.",
  CALIDAD: "Entradas de producto, facturas de proveedor, caducidades y revisión FEFO de los envíos.",
  CAJA: "Cobros, facturas, salidas de producto y seguimiento de entregas.",
  VENDEDOR: "Pedidos de clientes, consulta de inventario y seguimiento de entregas.",
  ALMACEN: "Consulta de existencias, caducidades y movimientos programados.",
  PRODUCCION: "Consulta de existencias y seguimiento de los productos programados para entrega.",
};

/** Muestra el estado de un pedido o factura con texto y color coherentes. */
function StatusBadge({ status }: { status: string }) {
  const style = status === "PAGADA" || status === "PAGADO" || status === "SURTIDO" || status === "REVISADO_CALIDAD"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
    : status === "CANCELADO" || status === "DEVUELTO"
      ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
      : status === "BORRADOR_CFDI" || status === "DEVOLUCION_PARCIAL"
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
        : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800";
  const label = status === "PENDIENTE" ? "PENDIENTE DE PAGO" : status === "PAGADO" ? "ESPERANDO REVISIÓN FEFO" : status === "REVISADO_CALIDAD" ? "LISTO PARA SURTIR" : status.replaceAll("_", " ");
  return <Badge variant="outline" className={style}>{label}</Badge>;
}

/** Muestra una explicación cuando una lista o tabla no contiene registros. */
function EmptyState({ icon: Icon, title, text }: { icon: typeof Boxes; title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon /></span><h3>{title}</h3><p>{text}</p></div>;
}

/** Permite alternar entre modo claro y oscuro. */
function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return <div className="theme-switch" title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}><Sun aria-hidden="true" /><Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"} /><Moon aria-hidden="true" /></div>;
}

/** Componente principal que carga los datos, calcula alertas y presenta los módulos permitidos por el rol. */
export default function Dashboard() {
  // Estado de datos, navegación, filtros y formularios. Ninguno reemplaza la validación del servidor.
  const [data, setData] = useState<SystemData>(emptyData);
  const [view, setView] = useState<View>("resumen");
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fatal, setFatal] = useState("");
  const [search, setSearch] = useState("");
  const [minimumSearch, setMinimumSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [deliveryZoneFilter, setDeliveryZoneFilter] = useState("TODAS");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState("");
  const [financeTab, setFinanceTab] = useState("facturas");
  const [cashTypeFilter, setCashTypeFilter] = useState("TODOS");
  const [cashDateFrom, setCashDateFrom] = useState("");
  const [cashDateTo, setCashDateTo] = useState("");
  const [invoiceHistoryDateFrom, setInvoiceHistoryDateFrom] = useState(monthStartInput);
  const [invoiceHistoryDateTo, setInvoiceHistoryDateTo] = useState(todayInput);
  const [form, setForm] = useState<Record<string, string>>({});
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Recarga el estado completo; el modo silencioso evita tapar la pantalla durante actualizaciones menores.
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/system", { cache: "no-store" });
      const payload = await response.json() as SystemData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No fue posible cargar el sistema.");
      setData(payload); setFatal("");
    } catch (error) { setFatal(error instanceof Error ? error.message : "No fue posible cargar el sistema."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  // Atajos de permisos y apertura de formularios usados por varios módulos.
  const role = data.currentUser.role;
  const can = (...roles: Role[]) => role === "ADMIN" || roles.includes(role);
  const canManagePending = (order: Order) => order.status === "PENDIENTE" && (role === "ADMIN" || role === "CAJA" || (role === "VENDEDOR" && order.createdBy === data.currentUser.email));
  const remainingToReturn = (order: Order) => order.items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity), 0);
  const openModal = (kind: Modal, values: Record<string, string> = {}) => { setForm(values); setModal(kind); };
  const openFefoReview = (order: Order) => {
    const item = order.items[0]; if (!item) return;
    const values: Record<string, string> = { orderId: String(order.id), orderItemId: String(item.id), notes: order.fefoReview?.notes || "" };
    order.fefoReview?.allocations.forEach((allocation) => { values[`fefo_${allocation.lotId}`] = "true"; values[`fefo_qty_${allocation.lotId}`] = String(allocation.quantity); });
    openModal("revision_fefo", values);
  };

  // Punto común para todas las escrituras del panel: envía, informa el resultado y vuelve a sincronizar datos.
  const post = async (payload: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    try {
      const response = await fetch("/api/system", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el movimiento.");
      toast.success(result.message || "Movimiento guardado."); setModal(null); setForm({}); setCancelOrder(null); setDeleteUser(null); setCancelReason(""); await load(true); return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible guardar."); return false; }
    finally { setSaving(false); }
  };

  const changeOwnPassword = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, password: form.password, confirmation: form.confirmation }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible cambiar la contraseña.");
      toast.success(result.message || "Contraseña actualizada.");
      setModal(null); setForm({});
    } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible cambiar la contraseña."); }
    finally { setSaving(false); }
  };

  const changeOwnUsername = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, username: form.username }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible cambiar el nombre de usuario.");
      toast.success(result.message || "Nombre de usuario actualizado.");
      setModal(null); setForm({}); await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible cambiar el nombre de usuario."); }
    finally { setSaving(false); }
  };

  // Traduce cada modal a la acción de negocio que entiende POST /api/system.
  const submit = () => {
    if (modal === "cambiar_usuario") { void changeOwnUsername(); return; }
    if (modal === "cambiar_clave") { void changeOwnPassword(); return; }
    if (modal === "revision_fefo") {
      const order = data.orders.find((candidate) => String(candidate.id) === form.orderId), item = order?.items[0];
      const allocations = item ? data.inventory.filter((lot) => lot.productId === item.productId && form[`fefo_${lot.id}`] === "true").map((lot) => ({ orderItemId: item.id, lotId: lot.id, quantity: Number(form[`fefo_qty_${lot.id}`] || 0) })) : [];
      void post({ action: "REVIEW_ORDER_FEFO", orderId: form.orderId, notes: form.notes, allocations }); return;
    }
    const payloads: Record<Exclude<Modal, null>, Record<string, unknown>> = {
      lote: { action: "CREATE_LOT", ...form }, salida: { action: "STOCK_EXIT", ...form }, stock_minimo: { action: "UPDATE_MINIMUM_STOCK", ...form }, precio_producto: { action: "UPDATE_PRODUCT_PRICE", ...form }, presentacion_producto: { action: "UPDATE_UNITS_PER_BOX", ...form }, pedido: { action: "CREATE_ORDER", ...form },
      editar_pedido: { action: "UPDATE_ORDER", ...form }, reprogramar_pedido: { action: "RESCHEDULE_ORDER", ...form }, revision_fefo: {}, devolucion: { action: "RETURN_ORDER", ...form },
      factura: { action: "CREATE_INVOICE", ...form }, cobro: { action: "RECORD_PAYMENT", ...form }, programar_factura: { action: "PLAN_INVOICE_SEND", ...form },
      entrega: { action: "CREATE_DELIVERY", ...form }, editar_entrega: { action: "UPDATE_DELIVERY", ...form },
      chofer: { action: "CREATE_DRIVER", ...form }, cliente: { action: "CREATE_CUSTOMER", ...form }, editar_cliente: { action: "UPDATE_CUSTOMER", ...form },
      proveedor: { action: "CREATE_SUPPLIER", ...form }, editar_proveedor: { action: "UPDATE_SUPPLIER", ...form }, usuario: { action: "CREATE_USER", ...form }, restablecer_clave: { action: "RESET_USER_PASSWORD", ...form }, cambiar_usuario: {}, cambiar_clave: {},
    };
    if (modal) void post(payloads[modal]);
  };

  // Lee la plantilla de inventario, tolera nombres equivalentes de columna y normaliza las fechas.
  const importExcel = async (file?: File) => {
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const pick = (row: Record<string, unknown>, names: string[]) => { const key = Object.keys(row).find((candidate) => names.includes(normalize(candidate))); return key ? row[key] : ""; };
      const toDate = (value: unknown) => {
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        if (typeof value === "number") { const parsed = XLSX.SSF.parse_date_code(value); return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}` : ""; }
        const text = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
        const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : text;
      };
      const rows = raw.map((row) => ({
        code: pick(row, ["codigo", "codigoproducto", "sku"]), name: pick(row, ["nombre", "producto", "nombreproducto"]),
        lot: pick(row, ["lote", "numerolote"]), expiryDate: toDate(pick(row, ["caducidad", "fechacaducidad", "vencimiento"])),
        quantity: pick(row, ["cantidad", "existencia", "piezas"]), boxes: pick(row, ["numerodecajas", "cajas", "cantidadcajas"]), units: pick(row, ["unidadessueltas", "piezassueltas"]), unitsPerBox: pick(row, ["unidadesporcaja", "piezasporcaja", "contenidoporcaja"]),
        netPrice: pick(row, ["precioneto", "precio", "costoneto"]), supplier: pick(row, ["proveedor", "nombreproveedor"]),
      }));
      await post({ action: "IMPORT_LOTS", rows });
    } catch { toast.error("No pude leer el Excel. Revisa los encabezados: Código, Producto, Lote, Caducidad, Número de cajas, Unidades por caja, Unidades sueltas, Precio neto y Proveedor."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const downloadInventoryTemplate = () => {
    const link = document.createElement("a"); link.href = "/plantilla-inventario-reyes-barreda.xlsx"; link.download = "plantilla-inventario-reyes-barreda.xlsx"; document.body.appendChild(link); link.click(); link.remove();
  };

  // Datos derivados: filtros, agrupaciones, alertas y totales. No se guardan; se recalculan con el estado actual.
  const filteredInventory = useMemo(() => {
    const term = search.toLowerCase().trim(); if (!term) return data.inventory;
    return data.inventory.filter((row) => [row.name, row.code, row.lot, row.expiryDate, row.supplierName || ""].some((value) => value.toLowerCase().includes(term)));
  }, [data.inventory, search]);
  const filteredCustomers = useMemo(() => { const term = customerSearch.toLowerCase().trim(); if (!term) return data.customers; return data.customers.filter((customer) => [customer.name, customer.rfc, customer.phone, customer.email, customer.address].some((value) => value.toLowerCase().includes(term))); }, [data.customers, customerSearch]);
  const filteredSuppliers = useMemo(() => { const term = supplierSearch.toLowerCase().trim(); if (!term) return data.suppliers; return data.suppliers.filter((supplier) => [supplier.name, supplier.rfc, supplier.contactName, supplier.phone, supplier.email].some((value) => value.toLowerCase().includes(term))); }, [data.suppliers, supplierSearch]);
  const totalUnits = data.inventory.reduce((sum, row) => sum + row.quantity, 0);
  const expiring = data.inventory.filter((row) => row.quantity > 0 && row.expiryDate <= monthsFromTodayInput(6)).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const stockProducts = useMemo(() => {
    const grouped = new Map<number, { productId: number; name: string; code: string; total: number; activeLots: number; minimumStock: number }>();
    data.inventory.forEach((lot) => {
      const current = grouped.get(lot.productId) || { productId: lot.productId, name: lot.name, code: lot.code, total: 0, activeLots: 0, minimumStock: lot.minimumStock };
      if (lot.expiryDate >= todayInput()) { current.total += lot.quantity; current.activeLots += 1; }
      current.minimumStock = lot.minimumStock; grouped.set(lot.productId, current);
    });
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [data.inventory]);
  const filteredStockProducts = useMemo(() => { const term = minimumSearch.toLowerCase().trim(); if (!term) return stockProducts; return stockProducts.filter((product) => [product.name, product.code].some((value) => value.toLowerCase().includes(term))); }, [stockProducts, minimumSearch]);
  const lowStockProducts = useMemo(() => stockProducts.filter((product) => product.minimumStock > 0 && product.total <= product.minimumStock).sort((a, b) => a.total - b.total), [stockProducts]);
  const pendingPriceProducts = useMemo(() => {
    const grouped = new Map<number, { productId: number; name: string; code: string; pendingLots: number }>();
    data.inventory.filter((lot) => lot.netPriceCents <= 0).forEach((lot) => { const current = grouped.get(lot.productId) || { productId: lot.productId, name: lot.name, code: lot.code, pendingLots: 0 }; current.pendingLots += 1; grouped.set(lot.productId, current); });
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [data.inventory]);
  const pendingOrders = data.orders.filter((order) => order.status === "PENDIENTE");
  const openInvoices = data.invoices.filter((invoice) => invoice.status !== "PAGADA");
  const overdueOrders = data.orders.filter((order) => order.deliveryDate && order.deliveryDate < todayInput() && ["PENDIENTE", "PAGADO", "REVISADO_CALIDAD"].includes(order.status) && !data.deliveries.some((delivery) => delivery.orderId === order.id));
  const actionableOverdueOrders = role === "ADMIN" ? overdueOrders : overdueOrders.filter((order) => order.createdBy === data.currentUser.email);
  const unsentInvoices = data.invoices.filter((invoice) => !invoice.sentAt);
  const pendingFefoOrders = data.orders.filter((order) => order.status === "PAGADO");
  const pendingSupplierReceipts = data.supplierReceipts.filter((receipt) => !receipt.invoiceValidatedAt);
  const fefoOrders = data.orders.filter((order) => ["PAGADO", "REVISADO_CALIDAD"].includes(order.status)).sort((a, b) => String(a.deliveryDate).localeCompare(String(b.deliveryDate)));
  const roleAlertCount = role === "ADMIN" ? expiring.length + lowStockProducts.length + pendingPriceProducts.length + overdueOrders.length + unsentInvoices.length + pendingFefoOrders.length + pendingSupplierReceipts.length
    : role === "CALIDAD" ? expiring.length + pendingFefoOrders.length + pendingSupplierReceipts.length
      : role === "COMPRAS" ? expiring.length + lowStockProducts.length + pendingPriceProducts.length
        : role === "ALMACEN" ? expiring.length
          : role === "CAJA" ? unsentInvoices.length + pendingPriceProducts.length
            : role === "VENDEDOR" ? actionableOverdueOrders.length
              : 0;
  const scheduledOrders = useMemo(() => data.orders.filter((order) => order.deliveryDate && ["PAGADO", "REVISADO_CALIDAD", "SURTIDO"].includes(order.status))
    .filter((order) => deliveryZoneFilter === "TODAS" || order.deliveryZone === deliveryZoneFilter)
    .filter((order) => !deliveryDateFilter || order.deliveryDate === deliveryDateFilter)
    .sort((a, b) => String(a.deliveryDate).localeCompare(String(b.deliveryDate))), [data.orders, deliveryZoneFilter, deliveryDateFilter]);
  const cashLedger = useMemo<CashLedgerRow[]>(() => {
    const income = data.invoices.flatMap((invoice) => invoice.payments.map((payment) => ({
      id: `entrada-${payment.id}`, type: "ENTRADA" as const, date: payment.createdAt.slice(0, 10), createdAt: payment.createdAt,
      party: invoice.customer, concept: `Cobro de ${invoice.folio}`, method: payment.method, reference: payment.reference,
      amountCents: payment.amountCents, recordedBy: payment.receivedBy,
    })));
    const outflow = data.cashOutflows.map((movement) => ({
      id: `salida-${movement.id}`, type: "SALIDA" as const, date: movement.movementDate, createdAt: movement.createdAt,
      party: movement.supplierName || movement.beneficiary, concept: movement.concept, method: movement.method,
      reference: movement.invoiceNumber ? `${movement.reference} · Fact. ${movement.invoiceNumber}` : movement.requiresInvoiceValidation ? `${movement.reference} · Factura pendiente` : movement.reference,
      amountCents: movement.amountCents, recordedBy: movement.createdBy,
      items: movement.items, notes: movement.notes,
    }));
    return [...income, ...outflow]
      .filter((movement) => cashTypeFilter === "TODOS" || movement.type === cashTypeFilter)
      .filter((movement) => !cashDateFrom || movement.date >= cashDateFrom)
      .filter((movement) => !cashDateTo || movement.date <= cashDateTo)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [data.invoices, data.cashOutflows, cashTypeFilter, cashDateFrom, cashDateTo]);
  const cashIncome = cashLedger.filter((movement) => movement.type === "ENTRADA").reduce((sum, movement) => sum + movement.amountCents, 0);
  const cashSpent = cashLedger.filter((movement) => movement.type === "SALIDA").reduce((sum, movement) => sum + movement.amountCents, 0);
  const cashBalance = cashIncome - cashSpent;
  const cashDaily = useMemo(() => {
    const days = new Map<string, { date: string; income: number; outflow: number }>();
    cashLedger.forEach((movement) => {
      const day = days.get(movement.date) || { date: movement.date, income: 0, outflow: 0 };
      if (movement.type === "ENTRADA") day.income += movement.amountCents; else day.outflow += movement.amountCents;
      days.set(movement.date, day);
    });
    return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [cashLedger]);
  const collectionHistory = useMemo<CollectionHistoryRow[]>(() => data.invoices.flatMap((invoice) => invoice.payments.map((payment) => ({
    id: `${invoice.id}-${payment.id}`,
    collectionDate: payment.createdAt.slice(0, 10),
    customerCode: invoice.customerId ? `CL-${String(invoice.customerId).padStart(4, "0")}` : "SIN CLAVE",
    customerName: invoice.customer,
    documentType: invoice.kind === "CFDI" ? "Factura" as const : "Remisión" as const,
    documentNumber: invoice.folio,
    amountCents: payment.amountCents,
    paymentCondition: paymentConditionNames[payment.paymentCondition] || "Sin especificar",
    paymentMethod: paymentMethodNames[payment.method] || payment.method || "Sin especificar",
    collectionChannel: collectionChannelNames[payment.collectionChannel] || payment.collectionChannel || "Sin especificar",
    comments: [payment.comments, payment.reference ? `Ref. ${payment.reference}` : ""].filter(Boolean).join(" · ") || "—",
  }))).filter((row) => (!invoiceHistoryDateFrom || row.collectionDate >= invoiceHistoryDateFrom) && (!invoiceHistoryDateTo || row.collectionDate <= invoiceHistoryDateTo))
    .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate) || b.id.localeCompare(a.id)), [data.invoices, invoiceHistoryDateFrom, invoiceHistoryDateTo]);
  const collectionHistoryTotal = collectionHistory.reduce((sum, row) => sum + row.amountCents, 0);
  const collectionHistoryDocuments = new Set(collectionHistory.map((row) => row.documentNumber)).size;
  const exportCollectionHistory = async () => {
    if (!invoiceHistoryDateFrom || !invoiceHistoryDateTo) return toast.error("Selecciona la fecha inicial y la fecha final.");
    if (invoiceHistoryDateFrom > invoiceHistoryDateTo) return toast.error("La fecha inicial no puede ser posterior a la final.");
    if (!collectionHistory.length) return toast.error("No hay cobros en el rango seleccionado.");
    try {
      await downloadCollectionHistoryExcel(collectionHistory, invoiceHistoryDateFrom, invoiceHistoryDateTo);
      toast.success("Excel de facturas y cobros descargado.");
    } catch { toast.error("No fue posible generar el Excel. Intenta de nuevo."); }
  };

  // Estados de pantalla completos antes de construir la navegación y los módulos.
  if (loading) return <div className="loading-screen"><div className="brand-mark"><Warehouse /></div><Loader2 className="spin" /><p>Preparando tu almacén…</p></div>;
  if (fatal) return <div className="loading-screen error-screen"><div className="brand-mark danger"><AlertTriangle /></div><h1>No pudimos abrir el sistema</h1><p>{fatal}</p><Button onClick={() => void load()}><RefreshCw />Intentar de nuevo</Button></div>;

  const visibleNav = navItems.filter((item) => !item.roles || item.roles.includes(role));
  const profileModules = visibleNav.filter((item) => item.id !== "resumen");
  const selectedTitle = view === "resumen" ? `Cuenta de ${roleNames[role]}` : navItems.find((item) => item.id === view)?.label ?? "Resumen";

  // La barra lateral y cada vista usan la misma información ya filtrada por rol.
  return <SidebarProvider>
    <Sidebar collapsible="offcanvas" className="app-sidebar">
      <SidebarHeader className="sidebar-top">
        <div className="company-logo"><Image src="/logo-reyes-barreda.jpg" alt="Alimentos Congelados Reyes Barreda" width={500} height={300} priority /></div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup><SidebarGroupContent><SidebarMenu>
          {visibleNav.map((item) => { const Icon = item.id === "resumen" ? ShieldCheck : item.icon; const label = item.id === "resumen" ? roleNames[role] : item.label; return <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={view === item.id} onClick={() => setView(item.id)} tooltip={label}><Icon /><span>{label}</span>{view === item.id && <ChevronRight className="ml-auto" />}</SidebarMenuButton></SidebarMenuItem>; })}
        </SidebarMenu></SidebarGroupContent></SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="sidebar-footer">
        <div className="user-mini"><span className="avatar">{initials(data.currentUser.displayName)}</span><span className="user-copy"><strong>{data.currentUser.displayName}</strong><small>{roleNames[role]}</small></span></div>
        <Button asChild variant="ghost" size="sm" className="logout"><a href="/api/auth/logout"><LogOut />Cerrar sesión</a></Button>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset className="main-shell">
      <header className="topbar"><div className="topbar-title"><SidebarTrigger /><div><span className="eyebrow">Alimentos Congelados Reyes Barreda</span><h1>{selectedTitle}</h1></div></div><div className="topbar-actions"><ThemeSwitch />{roleAlertCount > 0 && <Button variant="outline" className="alert-button" aria-label={`${roleAlertCount} alertas pendientes`} onClick={() => setView("resumen")}><BellRing /><span>{roleAlertCount}</span></Button>}<Badge variant="outline" className={roleColors[role]}><ShieldCheck />{roleNames[role]}</Badge><Button variant="outline" size="icon" aria-label="Actualizar datos" onClick={() => void load(true)}><RefreshCw /></Button></div></header>
      <main className="content-area">
        {view === "resumen" && <>
          <section className="profile-home panel">
            <div className="profile-home-heading"><span className="profile-home-icon"><ShieldCheck /></span><div><p className="eyebrow">Tipo de cuenta</p><h2>Cuenta de {roleNames[role]}</h2><p>Hola, {data.currentUser.displayName}. {roleIntroductions[role]}</p></div><div className="profile-home-actions"><Button variant="outline" size="sm" onClick={() => openModal("cambiar_usuario")}><Pencil />Cambiar usuario</Button><Button variant="outline" size="sm" onClick={() => openModal("cambiar_clave")}><KeyRound />Cambiar contraseña</Button><Badge variant="outline" className={roleColors[role]}>{roleNames[role]}</Badge></div></div>
            <div className="profile-module-heading"><div><p className="eyebrow">Menú del perfil</p><h3>Apartados disponibles</h3></div><span>{profileModules.length} opciones</span></div>
            <div className="profile-module-list">{profileModules.map((item) => <button type="button" className="profile-module-row" key={item.id} onClick={() => setView(item.id)}><span className="profile-module-icon"><item.icon /></span><span className="profile-module-copy"><strong>{item.label}</strong><small>{moduleDescriptions[item.id as Exclude<View, "resumen">]}</small></span><ChevronRight /></button>)}</div>
          </section>
          <section className="metrics-grid">
            <article className="metric-card"><span className="metric-icon teal"><Boxes /></span><div><p>Unidades disponibles</p><strong>{totalUnits.toLocaleString("es-MX")}</strong><small>{data.inventory.length} lote(s) registrados</small></div></article>
            <article className="metric-card"><span className="metric-icon blue"><ShoppingCart /></span><div><p>Pedidos sin pagar</p><strong>{pendingOrders.length}</strong><small>Esperando factura o cobro</small></div></article>
            <article className="metric-card"><span className="metric-icon amber"><AlertTriangle /></span><div><p>Próximos a caducar</p><strong>{expiring.length}</strong><small>Dentro de los próximos 6 meses</small></div></article>
            <article className="metric-card"><span className="metric-icon violet"><CircleDollarSign /></span><div><p>Facturas abiertas</p><strong>{openInvoices.length}</strong><small>{currency(openInvoices.reduce((sum, row) => sum + row.amountCents - row.payments.reduce((s, p) => s + p.amountCents, 0), 0))} pendiente</small></div></article>
          </section>
          <section className="dashboard-grid alerts-dashboard">
            {can("CALIDAD", "COMPRAS", "ALMACEN") && <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Caducidad</p><h2>Productos a menos de 6 meses</h2></div><Button variant="ghost" size="sm" onClick={() => setView("inventario")}>Ver inventario<ChevronRight /></Button></div>
              {expiring.length ? <div className="alert-list">{expiring.slice(0, 6).map((row) => <div className="alert-row" key={row.id}><span className="product-dot warning"><AlertTriangle /></span><div><strong>{row.name}</strong><small>{row.code} · Lote {row.lot} · {row.quantity} unidad(es)</small></div><span className={`expiry-pill ${daysTo(row.expiryDate) < 0 ? "expired" : ""}`}>{daysTo(row.expiryDate) < 0 ? "Caducado" : `${daysTo(row.expiryDate)} días`}</span></div>)}</div> : <EmptyState icon={CheckCircle2} title="Sin alertas de caducidad" text="No hay existencias que caduquen durante los próximos seis meses." />}
            </article>}
            {can("COMPRAS") && <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Reposición</p><h2>Productos por debajo del mínimo</h2></div><Badge variant="outline">{lowStockProducts.length}</Badge></div>
              {lowStockProducts.length ? <div className="alert-list">{lowStockProducts.slice(0, 6).map((product) => <div className="alert-row" key={product.productId}><span className="product-dot danger"><Boxes /></span><div><strong>{product.name}</strong><small>{product.code} · Quedan {product.total} · Mínimo {product.minimumStock}</small></div><Button variant="ghost" size="sm" onClick={() => openModal("stock_minimo", { productId: String(product.productId), productName: product.name, minimumStock: String(product.minimumStock) })}>Ajustar</Button></div>)}</div> : <EmptyState icon={CheckCircle2} title="Existencias suficientes" text="Ningún producto está por debajo de su mínimo configurado." />}
            </article>}
            {can("COMPRAS", "CAJA") && <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Precios</p><h2>Productos con precio por colocar</h2></div><Badge variant="outline">{pendingPriceProducts.length}</Badge></div>
              {pendingPriceProducts.length ? <div className="alert-list">{pendingPriceProducts.slice(0, 6).map((product) => <div className="alert-row" key={product.productId}><span className="product-dot warning"><CircleDollarSign /></span><div><strong>{product.name}</strong><small>{product.code} · {product.pendingLots} lote(s) sin precio</small></div><Button size="sm" onClick={() => openModal("precio_producto", { productId: String(product.productId), productName: product.name, netPrice: "" })}>Colocar precio</Button></div>)}</div> : <EmptyState icon={CheckCircle2} title="Precios completos" text="Todos los productos registrados ya tienen precio neto." />}
            </article>}
            {can("VENDEDOR") && <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Pedidos atrasados</p><h2>Nueva fecha obligatoria</h2></div><Badge variant="outline">{actionableOverdueOrders.length}</Badge></div>
              {actionableOverdueOrders.length ? <div className="alert-list">{actionableOverdueOrders.slice(0, 6).map((order) => <div className="alert-row" key={order.id}><span className="product-dot danger"><Clock3 /></span><div><strong>{order.folio} · {order.customer}</strong><small>Debía entregarse el {shortDate(order.deliveryDate || "")}</small></div><Button size="sm" onClick={() => openModal("reprogramar_pedido", { orderId: String(order.id), folio: order.folio, previousDate: order.deliveryDate || "", newDeliveryDate: todayInput() })}>Reprogramar</Button></div>)}</div> : <EmptyState icon={CheckCircle2} title="Sin pedidos atrasados" text="Tus pedidos tienen una fecha de entrega vigente." />}
            </article>}
            {can("CAJA") && <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Caja</p><h2>Facturas pendientes de envío</h2></div><Badge variant="outline">{unsentInvoices.length}</Badge></div>
              {unsentInvoices.length ? <div className="alert-list">{unsentInvoices.slice(0, 6).map((invoice) => <div className="alert-row invoice-alert" key={invoice.id}><span className="product-dot warning"><FileText /></span><div><strong>{invoice.folio} · {invoice.customer}</strong><small>{invoice.scheduledSendDate ? `Programada: ${shortDate(invoice.scheduledSendDate)} · ${invoice.sendDelayReason}` : "Falta indicar cuándo se enviará y por qué sigue pendiente"}</small></div><div className="mini-actions"><Button variant="ghost" size="sm" onClick={() => openModal("programar_factura", { invoiceId: String(invoice.id), folio: invoice.folio, customer: invoice.customer, scheduledSendDate: invoice.scheduledSendDate || todayInput(), reason: invoice.sendDelayReason })}>{invoice.scheduledSendDate ? "Actualizar" : "Programar"}</Button><Button variant="outline" size="sm" onClick={() => void post({ action: "MARK_INVOICE_SENT", invoiceId: invoice.id })}><Send />Enviada</Button></div></div>)}</div> : <EmptyState icon={CheckCircle2} title="Facturas al día" text="Todas las facturas están marcadas como enviadas al cliente." />}
            </article>}
            {can("CALIDAD") && <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Recepciones</p><h2>Facturas de proveedor pendientes</h2></div><Button variant="ghost" size="sm" onClick={() => setView("recepciones")}>Abrir entradas<ChevronRight /></Button></div>
              {pendingSupplierReceipts.length ? <div className="alert-list">{pendingSupplierReceipts.slice(0, 6).map((receipt) => <div className="alert-row" key={receipt.id}><span className="product-dot warning"><PackageCheck /></span><div><strong>{receipt.reference} · {receipt.supplierName}</strong><small>{receipt.items.map((item) => `${item.product}: ${item.quantity} ${item.unit.toLowerCase()}`).join(", ")}</small></div><Button size="sm" onClick={() => setView("recepciones")}>Validar</Button></div>)}</div> : <EmptyState icon={CheckCircle2} title="Recepciones al día" text="No hay pedidos de proveedor esperando factura." />}
            </article>}
            {can("CALIDAD") && <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Calidad</p><h2>Revisiones FEFO pendientes</h2></div><Button variant="ghost" size="sm" onClick={() => setView("calidad_envios")}>Abrir revisión<ChevronRight /></Button></div>
              {pendingFefoOrders.length ? <div className="alert-list">{pendingFefoOrders.slice(0, 6).map((order) => <div className="alert-row" key={order.id}><span className="product-dot"><ClipboardCheck /></span><div><strong>{order.folio} · {order.customer}</strong><small>{order.items.map((item) => `${item.productName}: ${item.quantity}`).join(", ")}</small></div><Button size="sm" onClick={() => openFefoReview(order)}>Revisar</Button></div>)}</div> : <EmptyState icon={CheckCircle2} title="Sin revisiones pendientes" text="Los pedidos pagados aparecerán aquí antes de que Caja pueda surtirlos." />}
            </article>}
            <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Actividad</p><h2>Últimos movimientos</h2></div>{role === "ADMIN" && <Button variant="ghost" size="sm" onClick={() => setView("historial")}>Ver todo<ChevronRight /></Button>}</div>
              {data.movements.length ? <div className="timeline">{data.movements.slice(0, 5).map((move) => <div className="timeline-row" key={move.id}><span className="timeline-icon"><Activity /></span><div><strong>{move.action.replaceAll("_", " ")}</strong><p>{move.details}</p><small>{move.actorName} · {dateTime(move.createdAt)}</small></div></div>)}</div> : <EmptyState icon={History} title="Aún no hay movimientos" text="La primera entrada, pedido o cobro iniciará la bitácora." />}
            </article>
          </section>
        </>}

        {view === "inventario" && <section className="panel full-panel"><div className="section-toolbar"><div><p className="eyebrow">Almacén</p><h2>Existencias por lote</h2><p className="section-copy">Consulta por nombre, código, lote, proveedor, caducidad y precio neto.</p></div><div className="action-row">
          {can("CALIDAD") && <><input ref={fileRef} className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void importExcel(event.target.files?.[0])} /><Button variant="outline" onClick={downloadInventoryTemplate}><Download />Plantilla Excel</Button><Button variant="outline" disabled={!data.suppliers.some((supplier) => supplier.active)} title={!data.suppliers.some((supplier) => supplier.active) ? "Primero registra un proveedor activo" : undefined} onClick={() => fileRef.current?.click()}><FileSpreadsheet />Importar Excel</Button><Button disabled={!data.suppliers.some((supplier) => supplier.active)} title={!data.suppliers.some((supplier) => supplier.active) ? "Primero registra un proveedor activo" : undefined} onClick={() => openModal("lote", { productId: "0", boxes: "0", units: "0" })}><PackagePlus />Agregar entrada</Button></>}
          {can("CAJA") && <Button variant="outline" onClick={() => openModal("salida")}><PackageMinus />Registrar salida</Button>}
        </div></div><div className="table-tools"><div className="search-box"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto, código, lote o fecha…" /></div><span className="result-count">{filteredInventory.length} lote(s)</span></div>
          {filteredInventory.length ? <Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Código</TableHead><TableHead>Lote</TableHead><TableHead>Proveedor</TableHead><TableHead>Caducidad</TableHead><TableHead className="text-right">Existencia</TableHead><TableHead className="text-right">Unid./caja</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Precio neto</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{filteredInventory.map((row) => { const days = daysTo(row.expiryDate); return <TableRow key={row.id}><TableCell><strong>{row.name}</strong></TableCell><TableCell className="mono">{row.code}</TableCell><TableCell className="mono">{row.lot}</TableCell><TableCell>{row.supplierName || <span className="cell-sub">Sin proveedor</span>}</TableCell><TableCell>{shortDate(row.expiryDate)}</TableCell><TableCell className="text-right"><strong>{row.quantity}</strong></TableCell><TableCell className="text-right">{can("CALIDAD", "COMPRAS") ? <Button variant="ghost" size="sm" onClick={() => openModal("presentacion_producto", { productId: String(row.productId), productName: row.name, unitsPerBox: String(row.unitsPerBox) })}>{row.unitsPerBox}<Pencil /></Button> : row.unitsPerBox}</TableCell><TableCell className="text-right">{can("COMPRAS") ? <Button variant="ghost" size="sm" onClick={() => openModal("stock_minimo", { productId: String(row.productId), productName: row.name, minimumStock: String(row.minimumStock) })}>{row.minimumStock}<Pencil /></Button> : row.minimumStock}</TableCell><TableCell className="text-right">{can("COMPRAS", "CAJA") ? <Button variant="ghost" size="sm" className={row.netPriceCents <= 0 ? "price-pending-action" : undefined} onClick={() => openModal("precio_producto", { productId: String(row.productId), productName: row.name, netPrice: row.netPriceCents > 0 ? (row.netPriceCents / 100).toFixed(2) : "" })}>{row.netPriceCents > 0 ? currency(row.netPriceCents) : "Pendiente"}<Pencil /></Button> : row.netPriceCents > 0 ? currency(row.netPriceCents) : <span className="price-pending-label">Pendiente</span>}</TableCell><TableCell>{row.quantity === 0 ? <Badge variant="destructive">Agotado</Badge> : days < 0 ? <Badge variant="destructive">Caducado</Badge> : row.expiryDate <= monthsFromTodayInput(6) ? <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Menos de 6 meses</Badge> : <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Disponible</Badge>}</TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={Boxes} title={search ? "Sin coincidencias" : "Inventario vacío"} text={search ? "Prueba con otro nombre, código, lote o proveedor." : "Calidad puede agregar el primer lote manualmente o desde Excel."} />}
        </section>}

        {view === "minimos" && <section className="panel full-panel"><div className="section-toolbar"><div><p className="eyebrow">Compras</p><h2>Mínimos de inventario</h2><p className="section-copy">Consulta la existencia total disponible y define cuándo debe generarse la alerta de reposición para cada producto.</p></div><Badge variant="outline">{lowStockProducts.length} alerta(s) activa(s)</Badge></div>
          <div className="table-tools"><div className="search-box"><Search /><Input value={minimumSearch} onChange={(event) => setMinimumSearch(event.target.value)} placeholder="Buscar producto o código…" /></div><span className="result-count">{filteredStockProducts.length} producto(s)</span></div>
          {filteredStockProducts.length ? <Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Código</TableHead><TableHead className="text-right">Lotes vigentes</TableHead><TableHead className="text-right">Existencia total</TableHead><TableHead className="text-right">Mínimo para alerta</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader><TableBody>{filteredStockProducts.map((product) => { const alertActive = product.minimumStock > 0 && product.total <= product.minimumStock; return <TableRow key={product.productId}><TableCell><strong>{product.name}</strong></TableCell><TableCell className="mono">{product.code}</TableCell><TableCell className="text-right">{product.activeLots}</TableCell><TableCell className="text-right"><strong>{product.total}</strong></TableCell><TableCell className="text-right"><strong>{product.minimumStock}</strong></TableCell><TableCell>{alertActive ? <Badge variant="destructive">Reponer producto</Badge> : product.minimumStock === 0 ? <Badge variant="outline">Alerta desactivada</Badge> : <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Existencia suficiente</Badge>}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => openModal("stock_minimo", { productId: String(product.productId), productName: product.name, minimumStock: String(product.minimumStock) })}><Pencil />Modificar mínimo</Button></TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={Boxes} title={minimumSearch ? "Sin coincidencias" : "No hay productos registrados"} text={minimumSearch ? "Prueba con otro nombre o código." : "Los productos aparecerán aquí después de registrar su primera entrada."} />}
        </section>}

        {view === "proveedores" && can("COMPRAS", "CAJA") && <section className="panel full-panel catalog-panel"><div className="section-toolbar"><div><p className="eyebrow">Compras</p><h2>Proveedores registrados</h2><p className="section-copy">Contactos disponibles para relacionarlos con cada entrada de almacén.</p></div>{can("COMPRAS") && <Button onClick={() => openModal("proveedor")}><Plus />Nuevo proveedor</Button>}</div>
          <div className="table-tools"><div className="search-box"><Search /><Input value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Buscar proveedor, RFC o contacto…" /></div><span className="result-count">{filteredSuppliers.length} proveedor(es)</span></div>
          {filteredSuppliers.length ? <Table><TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead>RFC</TableHead><TableHead>Contacto</TableHead><TableHead>Teléfono / correo</TableHead><TableHead className="text-right">Lotes</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader><TableBody>{filteredSuppliers.map((supplier) => <TableRow key={supplier.id}><TableCell><span className="catalog-name"><span><Building2 /></span><strong>{supplier.name}</strong></span></TableCell><TableCell className="mono">{supplier.rfc || "—"}</TableCell><TableCell>{supplier.contactName || "—"}</TableCell><TableCell><span className="contact-lines"><strong>{supplier.phone || "Sin teléfono"}</strong><small>{supplier.email || "Sin correo"}</small></span></TableCell><TableCell className="text-right"><strong>{data.inventory.filter((lot) => lot.supplierId === supplier.id).length}</strong></TableCell><TableCell><span className={supplier.active ? "state-active" : "state-off"}>{supplier.active ? "Activo" : "Retirado"}</span></TableCell><TableCell><div className="order-actions">{can("COMPRAS") && <Button variant="ghost" size="sm" onClick={() => openModal("editar_proveedor", { supplierId: String(supplier.id), name: supplier.name, rfc: supplier.rfc, contactName: supplier.contactName, phone: supplier.phone, email: supplier.email })}><Pencil />Editar</Button>}{can("COMPRAS") && <Button variant="ghost" size="sm" className={supplier.active ? "cancel-action" : undefined} onClick={() => void post({ action: "TOGGLE_SUPPLIER", supplierId: supplier.id })}>{supplier.active ? "Quitar" : "Reactivar"}</Button>}</div></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={Building2} title={supplierSearch ? "Sin coincidencias" : "Aún no hay proveedores"} text={supplierSearch ? "Prueba con otro nombre, RFC o contacto." : "Compras puede registrar el primer proveedor para habilitar nuevas entradas."} />}
        </section>}

        {view === "pedidos" && <section className="panel full-panel">
          <div className="section-toolbar"><div><p className="eyebrow">Ventas</p><h2>Pedidos de clientes</h2><p className="section-copy">Todos los vendedores pueden consultar la tabla; cada uno solo puede modificar sus propios pedidos.</p></div>{can("VENDEDOR") && <Button disabled={role === "VENDEDOR" && actionableOverdueOrders.length > 0} title={role === "VENDEDOR" && actionableOverdueOrders.length > 0 ? "Primero reprograma tus pedidos atrasados" : undefined} onClick={() => openModal("pedido", { deliveryDate: todayInput(), boxes: "0", units: "0" })}><Plus />Nuevo pedido</Button>}</div>
          {data.orders.length ? <Table><TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Vendedor</TableHead><TableHead>Producto</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Total neto</TableHead><TableHead>Pedido realizado</TableHead><TableHead>Entregar el</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{data.orders.map((order) => {
            const returned = order.items.reduce((sum, item) => sum + item.returnedQuantity, 0);
            const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
            const firstItem = order.items[0];
            const linkedInvoice = data.invoices.find((invoice) => invoice.orderId === order.id);
            const returnAllocations = order.fefoReview?.allocations.filter((allocation) => allocation.orderItemId === firstItem?.id) || [];
            const firstReturnAllocation = returnAllocations.find((allocation) => allocation.quantity > order.returns.filter((returnedItem) => returnedItem.orderItemId === firstItem?.id && returnedItem.lotId === allocation.lotId).reduce((sum, returnedItem) => sum + returnedItem.quantity, 0));
            const returnLotId = firstReturnAllocation?.lotId || firstItem?.lotId;
            const returnMax = (firstReturnAllocation?.quantity || firstItem?.quantity || 0) - order.returns.filter((returnedItem) => returnedItem.orderItemId === firstItem?.id && (returnedItem.lotId === returnLotId || (!returnedItem.lotId && returnLotId === firstItem?.lotId))).reduce((sum, returnedItem) => sum + returnedItem.quantity, 0);
            return <TableRow key={order.id}>
              <TableCell className="mono"><strong>{order.folio}</strong></TableCell><TableCell>{order.customer}</TableCell><TableCell><span className="cell-sub">{order.createdBy}</span></TableCell>
              <TableCell>{order.items.map((item) => `${item.productName} · ${item.productCode}`).join(", ")}{order.fefoReview && <small className="cell-sub">Lotes revisados: {order.fefoReview.allocations.map((allocation) => `${allocation.lot} (${allocation.quantity})`).join(", ")}</small>}</TableCell>
              <TableCell className="text-right"><strong>{order.items.map(orderQuantityLabel).join(", ")}</strong>{returned > 0 && <small className="cell-sub">{returned} devuelta(s)</small>}</TableCell>
              <TableCell className="text-right">{currency(total)}</TableCell><TableCell>{dateTime(order.createdAt)}</TableCell><TableCell>{order.deliveryDate ? <div className="due-cell"><span className={`order-due ${!["CANCELADO", "DEVUELTO"].includes(order.status) && daysTo(order.deliveryDate) < 0 ? "overdue" : !["CANCELADO", "DEVUELTO"].includes(order.status) && daysTo(order.deliveryDate) <= 2 ? "soon" : ""}`}>{shortDate(order.deliveryDate)}</span><small>{order.deliveryZone ? deliveryZoneNames[order.deliveryZone] : "Sin zona"}{order.deliveryLocation ? ` · ${order.deliveryLocation}` : ""}</small>{order.reschedules[0] && <small className="reschedule-note">Último atraso: {order.reschedules[0].reason}</small>}</div> : <span className="cell-sub">Sin fecha</span>}</TableCell><TableCell><StatusBadge status={order.status} /></TableCell>
              <TableCell><div className="order-actions">
                {canManagePending(order) && <><Button variant="ghost" size="sm" onClick={() => openModal("editar_pedido", { orderId: String(order.id), customerId: String(order.customerId || 0), customer: order.customer, lotId: String(firstItem?.lotId || ""), boxes: String(firstItem?.orderedBoxes || 0), units: String(firstItem?.orderedBoxes || firstItem?.orderedUnits ? firstItem.orderedUnits : firstItem?.quantity || 0), notes: order.notes, deliveryDate: order.deliveryDate || "", deliveryZone: order.deliveryZone || "", deliveryLocation: order.deliveryLocation || "" })}><Pencil />Editar</Button><Button variant="ghost" size="sm" className="cancel-action" onClick={() => setCancelOrder(order)}><XCircle />Cancelar</Button></>}
                {order.deliveryDate && order.deliveryDate < todayInput() && ["PENDIENTE", "PAGADO", "REVISADO_CALIDAD"].includes(order.status) && (role === "ADMIN" || (role === "VENDEDOR" && order.createdBy === data.currentUser.email)) && <Button size="sm" className="urgent-action" onClick={() => openModal("reprogramar_pedido", { orderId: String(order.id), folio: order.folio, previousDate: order.deliveryDate || "", newDeliveryDate: todayInput() })}><Clock3 />Reprogramar</Button>}
                {can("CAJA") && order.status === "PENDIENTE" && !linkedInvoice && <Button variant="outline" size="sm" onClick={() => openModal("factura", { kind: "INTERNA", orderId: String(order.id), customerId: String(order.customerId || 0), customer: order.customer, rfc: data.customers.find((customer) => customer.id === order.customerId)?.rfc || "", amount: (total / 100).toFixed(2) })}><FileText />Facturar</Button>}
                {can("CAJA") && order.status === "PENDIENTE" && linkedInvoice && linkedInvoice.status !== "PAGADA" && <Button variant="outline" size="sm" onClick={() => openModal("cobro", { invoiceId: String(linkedInvoice.id), amount: ((linkedInvoice.amountCents - linkedInvoice.payments.reduce((sum, payment) => sum + payment.amountCents, 0)) / 100).toFixed(2), paymentCondition: "CONTADO", collectionChannel: "CAJA" })}><Banknote />Cobrar</Button>}
                {can("CAJA") && order.status === "REVISADO_CALIDAD" && <Button size="sm" onClick={() => void post({ action: "DISPATCH_ORDER", orderId: order.id })}><PackageCheck />Surtir</Button>}
                {can("CAJA") && ["SURTIDO", "DEVOLUCION_PARCIAL"].includes(order.status) && remainingToReturn(order) > 0 && firstItem && returnMax > 0 && <Button variant="outline" size="sm" onClick={() => openModal("devolucion", { orderId: String(order.id), itemId: String(firstItem.id), lotId: String(returnLotId || ""), quantity: String(returnMax), maxQuantity: String(returnMax), folio: order.folio, product: `${firstItem.productName} · Lote ${firstReturnAllocation?.lot || firstItem.lot}` })}><RotateCcw />Devolver</Button>}
              </div></TableCell>
            </TableRow>;
          })}</TableBody></Table> : <EmptyState icon={ClipboardList} title="No hay pedidos" text="Los pedidos capturados por ventas aparecerán aquí." />}
        </section>}

        {view === "recepciones" && <SupplierReceipts receipts={data.supplierReceipts} inventory={data.inventory} saving={saving} onSubmit={(payload) => post({ action: "VALIDATE_SUPPLIER_RECEIPT", ...payload })} />}

        {view === "calidad_envios" && <section className="panel full-panel fefo-panel"><div className="section-toolbar"><div><p className="eyebrow">Calidad</p><h2>Revisión de lotes para envío</h2><p className="section-copy">Los lotes se ordenan por caducidad. Puedes combinar varios cuando el primero no complete el pedido.</p></div><Badge variant="outline"><ClipboardCheck />{pendingFefoOrders.length} pendiente(s)</Badge></div>
          <div className="fefo-notice"><span><BellRing /></span><div><strong>FEFO: primero caduca, primero sale</strong><p>La recomendación comienza con el lote vigente que caduca antes. Caja no podrá surtir hasta que guardes la revisión.</p></div></div>
          {fefoOrders.length ? <Table><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Producto</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead>Entrega</TableHead><TableHead>Recomendación FEFO</TableHead><TableHead>Revisión</TableHead><TableHead /></TableRow></TableHeader><TableBody>{fefoOrders.map((order) => { const item = order.items[0]; const suggestion = fefoSuggestion(item, data.inventory); return <TableRow key={order.id}><TableCell className="mono"><strong>{order.folio}</strong></TableCell><TableCell>{order.customer}</TableCell><TableCell><strong>{item?.productName}</strong><small className="cell-sub">{item?.productCode}</small></TableCell><TableCell className="text-right"><strong>{item ? orderQuantityLabel(item) : "0 unidades"}</strong></TableCell><TableCell>{order.deliveryDate ? shortDate(order.deliveryDate) : "Sin fecha"}</TableCell><TableCell><span className="fefo-route">{suggestion.length ? suggestion.map(({ lot, quantity }) => `${lot.lot}: ${quantity}`).join(" → ") : "Inventario insuficiente"}</span></TableCell><TableCell>{order.fefoReview ? <div className="reviewed-cell"><Badge variant="outline" className="delivery-registered">Revisado</Badge><small>{order.fefoReview.allocations.map((allocation) => `${allocation.lot}: ${allocation.quantity}`).join(", ")}</small></div> : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendiente</Badge>}</TableCell><TableCell><Button size="sm" variant={order.fefoReview ? "outline" : "default"} onClick={() => openFefoReview(order)}>{order.fefoReview ? <Pencil /> : <ClipboardCheck />}{order.fefoReview ? "Actualizar" : "Revisar lotes"}</Button></TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={ClipboardCheck} title="No hay envíos por revisar" text="Aquí aparecerán los pedidos cuando Caja valide su pago." />}
        </section>}

        {view === "clientes" && <section className="panel full-panel catalog-panel"><div className="section-toolbar"><div><p className="eyebrow">Ventas</p><h2>Clientes frecuentes</h2><p className="section-copy">Guarda sus datos una vez y reutilízalos en pedidos y facturas.</p></div>{can("VENDEDOR", "CAJA", "COMPRAS") && <Button onClick={() => openModal("cliente")}><Plus />Nuevo cliente</Button>}</div>
          <div className="table-tools"><div className="search-box"><Search /><Input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Buscar cliente, RFC, teléfono o correo…" /></div><span className="result-count">{filteredCustomers.length} cliente(s)</span></div>
          {filteredCustomers.length ? <Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>RFC</TableHead><TableHead>Contacto</TableHead><TableHead>Dirección</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader><TableBody>{filteredCustomers.map((customer) => <TableRow key={customer.id}><TableCell><span className="catalog-name"><span><ContactRound /></span><strong>{customer.name}</strong></span></TableCell><TableCell className="mono">{customer.rfc || "—"}</TableCell><TableCell><span className="contact-lines"><strong>{customer.phone || "Sin teléfono"}</strong><small>{customer.email || "Sin correo"}</small></span></TableCell><TableCell>{customer.address || "—"}</TableCell><TableCell className="text-right"><strong>{data.orders.filter((order) => order.customerId === customer.id).length}</strong></TableCell><TableCell><span className={customer.active ? "state-active" : "state-off"}>{customer.active ? "Activo" : "Retirado"}</span></TableCell><TableCell><div className="order-actions">{can("VENDEDOR", "CAJA", "COMPRAS") && <Button variant="ghost" size="sm" onClick={() => openModal("editar_cliente", { customerId: String(customer.id), name: customer.name, rfc: customer.rfc, phone: customer.phone, email: customer.email, address: customer.address })}><Pencil />Editar</Button>}{role === "ADMIN" && <Button variant="ghost" size="sm" className={customer.active ? "cancel-action" : undefined} onClick={() => void post({ action: "TOGGLE_CUSTOMER", customerId: customer.id })}>{customer.active ? "Quitar" : "Reactivar"}</Button>}</div></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={ContactRound} title={customerSearch ? "Sin coincidencias" : "Aún no hay clientes frecuentes"} text={customerSearch ? "Prueba con otro nombre, RFC o dato de contacto." : "Registra el primer cliente para reutilizar sus datos en pedidos y facturas."} />}
        </section>}

        {view === "entregas" && <div className="delivery-stack">
          <section className="panel full-panel schedule-panel"><div className="section-toolbar"><div><p className="eyebrow">Agenda</p><h2>Pedidos pagados por entregar</h2><p className="section-copy">Después del pago pasan por revisión FEFO de Calidad y entonces Caja puede surtirlos.</p></div><div className="schedule-filters">
            <Select value={deliveryZoneFilter} onValueChange={setDeliveryZoneFilter}><SelectTrigger aria-label="Filtrar por municipio"><MapPin /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todos los municipios</SelectItem>{deliveryZoneOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            <div className="date-filter"><CalendarDays /><Input aria-label="Filtrar por fecha de entrega" type="date" value={deliveryDateFilter} onChange={(event) => setDeliveryDateFilter(event.target.value)} /></div>
            {(deliveryZoneFilter !== "TODAS" || deliveryDateFilter) && <Button variant="ghost" size="sm" onClick={() => { setDeliveryZoneFilter("TODAS"); setDeliveryDateFilter(""); }}>Limpiar</Button>}
          </div></div>
            {scheduledOrders.length ? <Table><TableHeader><TableRow><TableHead>Entregar el</TableHead><TableHead>Municipio</TableHead><TableHead>Ubicación</TableHead><TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Productos</TableHead><TableHead>Estado</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader><TableBody>{scheduledOrders.map((order) => { const registered = data.deliveries.some((delivery) => delivery.orderId === order.id); const paidInvoice = data.invoices.find((invoice) => invoice.orderId === order.id && invoice.status === "PAGADA"); const contents = order.fefoReview?.allocations.length ? order.fefoReview.allocations.map((allocation) => `${allocation.productName} · Lote ${allocation.lot} · ${allocation.quantity} pza.`).join(", ") : order.items.map((item) => `${item.productName} · ${item.quantity} pza.`).join(", "); return <TableRow key={order.id}><TableCell><span className={`order-due ${daysTo(order.deliveryDate || "") < 0 ? "overdue" : daysTo(order.deliveryDate || "") <= 2 ? "soon" : ""}`}>{shortDate(order.deliveryDate || "")}</span></TableCell><TableCell><span className={`zone-pill ${order.deliveryZone?.toLowerCase() || ""}`}>{order.deliveryZone ? deliveryZoneNames[order.deliveryZone] : "Sin municipio"}</span></TableCell><TableCell><span className="location-cell"><MapPin />{order.deliveryLocation || "Sin ubicación"}</span></TableCell><TableCell className="mono"><strong>{order.folio}</strong></TableCell><TableCell>{order.customer}</TableCell><TableCell>{contents}</TableCell><TableCell><StatusBadge status={order.status} /></TableCell><TableCell><div className="order-actions">{registered ? <Badge variant="outline" className="delivery-registered">Registrada</Badge> : can("CAJA") && order.status === "REVISADO_CALIDAD" ? <Button size="sm" onClick={() => void post({ action: "DISPATCH_ORDER", orderId: order.id })}><PackageCheck />Surtir</Button> : can("CAJA") && order.status === "SURTIDO" ? <Button variant="outline" size="sm" disabled={!data.drivers.some((driver) => driver.active)} title={!data.drivers.some((driver) => driver.active) ? "Primero agrega un chofer activo" : undefined} onClick={() => openModal("entrega", { deliveryDate: order.deliveryDate || todayInput(), orderId: String(order.id), customer: order.customer, invoiceNumber: paidInvoice?.folio || "", contents })}><Truck />Asignar chofer</Button> : <Badge variant="outline">Esperando Calidad</Badge>}</div></TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={CalendarDays} title={deliveryZoneFilter !== "TODAS" || deliveryDateFilter ? "No hay pedidos con estos filtros" : "No hay pedidos pagados por entregar"} text={deliveryZoneFilter !== "TODAS" || deliveryDateFilter ? "Prueba con otro municipio o fecha de entrega." : "Cuando una factura ligada a un pedido quede pagada, aparecerá automáticamente aquí."} />}
          </section>
          <section className="panel full-panel deliveries-panel"><div className="section-toolbar"><div><p className="eyebrow">Logística</p><h2>Entregas registradas</h2><p className="section-copy">Productos enviados, chofer, fecha de salida, factura y cliente.</p></div>{can("CAJA") && <Button disabled={!data.drivers.some((driver) => driver.active)} title={!data.drivers.some((driver) => driver.active) ? "Primero agrega un chofer activo" : undefined} onClick={() => openModal("entrega", { deliveryDate: todayInput(), orderId: "0" })}><Plus />Nueva entrega</Button>}</div>
            {can("CAJA") && !data.drivers.some((driver) => driver.active) && <div className="delivery-notice"><Truck /><span>Para registrar una entrega, un Administrador debe agregar al menos un chofer.</span></div>}
            {data.deliveries.length ? <Table><TableHeader><TableRow><TableHead>Fecha de salida</TableHead><TableHead>Cliente</TableHead><TableHead>Factura</TableHead><TableHead>Qué se envió</TableHead><TableHead>Chofer</TableHead><TableHead>Pedido</TableHead><TableHead>Registró</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.deliveries.map((delivery) => <TableRow key={delivery.id}><TableCell><strong>{shortDate(delivery.deliveryDate)}</strong></TableCell><TableCell>{delivery.customer}</TableCell><TableCell className="mono"><strong>{delivery.invoiceNumber}</strong></TableCell><TableCell>{delivery.contents}</TableCell><TableCell><span className="driver-cell"><Truck />{delivery.driverName}</span></TableCell><TableCell className="mono">{delivery.orderFolio || "—"}</TableCell><TableCell>{delivery.createdBy}</TableCell><TableCell>{can("CAJA") && <Button variant="ghost" size="sm" onClick={() => openModal("editar_entrega", { deliveryId: String(delivery.id), driverId: String(delivery.driverId), customer: delivery.customer, invoiceNumber: delivery.invoiceNumber, contents: delivery.contents, deliveryDate: delivery.deliveryDate, orderId: String(delivery.orderId || 0) })}><Pencil />Editar</Button>}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={Truck} title="No hay entregas registradas" text="Aquí aparecerán las salidas asignadas a cada chofer." />}
          </section>
          {role === "ADMIN" && <section className="panel full-panel drivers-panel"><div className="section-toolbar"><div><p className="eyebrow">Catálogo</p><h2>Choferes</h2><p className="section-copy">Agrega choferes o retíralos de la lista activa sin borrar entregas anteriores.</p></div><Button variant="outline" onClick={() => openModal("chofer")}><UserPlus />Agregar chofer</Button></div>
            {data.drivers.length ? <Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Estado</TableHead><TableHead>Registrado</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.drivers.map((driver) => <TableRow key={driver.id}><TableCell><strong>{driver.name}</strong></TableCell><TableCell><span className={driver.active ? "state-active" : "state-off"}>{driver.active ? "Activo" : "Retirado"}</span></TableCell><TableCell>{dateTime(driver.createdAt)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className={driver.active ? "cancel-action" : undefined} onClick={() => void post({ action: "TOGGLE_DRIVER", driverId: driver.id })}>{driver.active ? "Quitar" : "Reactivar"}</Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={Users} title="Aún no hay choferes" text="Agrega el primer chofer para comenzar a registrar entregas." />}
          </section>}
        </div>}

        {view === "facturas" && <Tabs value={financeTab} onValueChange={setFinanceTab} className="finance-tabs">
          <TabsList className="finance-tabs-list">
            <TabsTrigger value="facturas"><ReceiptText />Facturas y cobros</TabsTrigger>
            <TabsTrigger value="flujo"><WalletCards />Flujo de dinero</TabsTrigger>
            <TabsTrigger value="registrar_salida"><ArrowDownCircle />Nuevo pedido</TabsTrigger>
            <TabsTrigger value="historial_cobros"><History />Historial y Excel</TabsTrigger>
          </TabsList>
          <TabsContent value="facturas">
            <div className="cfdi-notice"><span><ShieldCheck /></span><div><strong>CFDI listo para conectar</strong><p>Los CFDI se guardan como borrador. Para timbrarlos ante el SAT falta conectar el proveedor autorizado (PAC) y sus credenciales.</p></div></div>
            <section className="panel full-panel"><div className="section-toolbar"><div><p className="eyebrow">Caja y compras</p><h2>Facturas y cobros</h2><p className="section-copy">Al liquidarse, el pedido pasa a revisión FEFO; Caja también controla cuándo se envía la factura al cliente.</p></div><div className="action-row"><Button variant="outline" onClick={() => openModal("cobro", { paymentCondition: "CONTADO", collectionChannel: "CAJA" })}><Banknote />Aceptar cobro</Button><Button onClick={() => openModal("factura", { kind: "INTERNA", orderId: "0" })}><FileText />Nueva factura</Button></div></div>
              {data.invoices.length ? <Table><TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Tipo</TableHead><TableHead>Cliente / RFC</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Pagado</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>Envío al cliente</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.invoices.map((invoice) => { const paid = invoice.payments.reduce((sum, p) => sum + p.amountCents, 0); return <TableRow key={invoice.id}><TableCell className="mono"><strong>{invoice.folio}</strong></TableCell><TableCell>{invoice.kind}</TableCell><TableCell><strong>{invoice.customer}</strong><small className="cell-sub">{invoice.rfc || "Sin RFC"}</small></TableCell><TableCell className="text-right">{currency(invoice.amountCents)}</TableCell><TableCell className="text-right">{currency(paid)}</TableCell><TableCell><StatusBadge status={invoice.status} /></TableCell><TableCell>{dateTime(invoice.createdAt)}</TableCell><TableCell>{invoice.sentAt ? <div className="invoice-send-state sent"><Send /><span><strong>Enviada</strong><small>{dateTime(invoice.sentAt)}</small></span></div> : <div className="invoice-send-state pending"><Clock3 /><span><strong>{invoice.scheduledSendDate ? shortDate(invoice.scheduledSendDate) : "Sin programar"}</strong><small>{invoice.sendDelayReason || "Falta fecha y motivo"}</small></span></div>}</TableCell><TableCell><div className="order-actions"><Button variant="ghost" size="icon-sm" aria-label={`Imprimir ${invoice.folio}`} onClick={() => printInvoice(invoice)}><Download /></Button>{!invoice.sentAt && can("CAJA") && <><Button variant="ghost" size="sm" onClick={() => openModal("programar_factura", { invoiceId: String(invoice.id), folio: invoice.folio, customer: invoice.customer, scheduledSendDate: invoice.scheduledSendDate || todayInput(), reason: invoice.sendDelayReason })}>Programar</Button><Button variant="outline" size="sm" onClick={() => void post({ action: "MARK_INVOICE_SENT", invoiceId: invoice.id })}><Send />Enviada</Button></>}</div></TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={ReceiptText} title="No hay facturas" text="Crea un comprobante interno o un borrador CFDI." />}
            </section>
          </TabsContent>
          <TabsContent value="flujo">
            <section className="panel full-panel finance-panel"><div className="section-toolbar"><div><p className="eyebrow">Control de caja</p><h2>Historial de entradas y salidas</h2><p className="section-copy">Consulta el dinero recibido o pagado por día, cliente o proveedor.</p></div><Button onClick={() => setFinanceTab("registrar_salida")}><ArrowDownCircle />Pedido a proveedor</Button></div>
              <div className="cash-filters">
                <Select value={cashTypeFilter} onValueChange={setCashTypeFilter}><SelectTrigger aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos los movimientos</SelectItem><SelectItem value="ENTRADA">Solo entradas</SelectItem><SelectItem value="SALIDA">Solo salidas</SelectItem></SelectContent></Select>
                <div className="date-filter"><CalendarDays /><Input aria-label="Fecha inicial" type="date" value={cashDateFrom} onChange={(event) => setCashDateFrom(event.target.value)} /></div>
                <span className="filter-separator">a</span>
                <div className="date-filter"><CalendarDays /><Input aria-label="Fecha final" type="date" value={cashDateTo} onChange={(event) => setCashDateTo(event.target.value)} /></div>
                {(cashTypeFilter !== "TODOS" || cashDateFrom || cashDateTo) && <Button variant="ghost" size="sm" onClick={() => { setCashTypeFilter("TODOS"); setCashDateFrom(""); setCashDateTo(""); }}>Limpiar filtros</Button>}
              </div>
              <div className="finance-summary">
                <article className="money-card income"><span><ArrowUpCircle /></span><div><small>Entradas del periodo</small><strong>{currency(cashIncome)}</strong></div></article>
                <article className="money-card outflow"><span><ArrowDownCircle /></span><div><small>Salidas del periodo</small><strong>{currency(cashSpent)}</strong></div></article>
                <article className={`money-card balance ${cashBalance < 0 ? "negative" : ""}`}><span><WalletCards /></span><div><small>Balance del periodo</small><strong>{currency(cashBalance)}</strong></div></article>
              </div>
              <div className="finance-block daily-table"><div className="finance-block-heading"><div><h3>Resumen por día</h3><p>Totales calculados con los filtros seleccionados.</p></div><Badge variant="outline">{cashDaily.length} día(s)</Badge></div>
                {cashDaily.length ? <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Salidas</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader><TableBody>{cashDaily.map((day) => <TableRow key={day.date}><TableCell><strong>{shortDate(day.date)}</strong></TableCell><TableCell className="text-right money-income">+ {currency(day.income)}</TableCell><TableCell className="text-right money-outflow">- {currency(day.outflow)}</TableCell><TableCell className={`text-right money-balance ${day.income - day.outflow < 0 ? "negative" : ""}`}><strong>{currency(day.income - day.outflow)}</strong></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={CalendarDays} title="Sin movimientos en este periodo" text="Cambia las fechas o registra el primer cobro o salida." />}
              </div>
              <div className="finance-block ledger-table"><div className="finance-block-heading"><div><h3>Detalle de movimientos</h3><p>Identifica de quién entró el dinero o a quién se pagó.</p></div><Badge variant="outline">{cashLedger.length} movimiento(s)</Badge></div>
                {cashLedger.length ? <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Cliente / proveedor</TableHead><TableHead>Concepto</TableHead><TableHead>Método</TableHead><TableHead>Referencia</TableHead><TableHead>Registró</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader><TableBody>{cashLedger.map((movement) => <TableRow key={movement.id}><TableCell><strong>{shortDate(movement.date)}</strong></TableCell><TableCell><Badge variant="outline" className={`cash-type ${movement.type.toLowerCase()}`}>{movement.type === "ENTRADA" ? <ArrowUpCircle /> : <ArrowDownCircle />}{movement.type}</Badge></TableCell><TableCell><strong>{movement.party}</strong></TableCell><TableCell><span>{movement.concept}</span>{movement.items?.length ? <details className="outflow-breakdown"><summary>Ver {movement.items.length} producto(s)</summary><ul>{movement.items.map((item, index) => <li key={`${movement.id}-${index}`}><span>{item.product} · {item.quantity} {item.unit.toLowerCase()}</span><strong>{currency(item.subtotalCents)}</strong></li>)}</ul>{movement.notes && <p>{movement.notes}</p>}</details> : null}</TableCell><TableCell>{movement.method}</TableCell><TableCell className="mono">{movement.reference || "—"}</TableCell><TableCell>{movement.recordedBy}</TableCell><TableCell className={`text-right ${movement.type === "ENTRADA" ? "money-income" : "money-outflow"}`}><strong>{movement.type === "ENTRADA" ? "+ " : "- "}{currency(movement.amountCents)}</strong></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={WalletCards} title="No hay detalle disponible" text="Los movimientos que coincidan con los filtros aparecerán aquí." />}
              </div>
            </section>
          </TabsContent>
          <TabsContent value="registrar_salida">
            <BulkCashOutflow suppliers={data.suppliers} inventory={data.inventory} saving={saving} onSubmit={(payload) => post({ action: "CREATE_CASH_OUTFLOW_BATCH", ...payload })} onBack={() => setFinanceTab("flujo")} />
          </TabsContent>
          <TabsContent value="historial_cobros">
            <section className="panel full-panel finance-panel collection-history-panel"><div className="section-toolbar"><div><p className="eyebrow">Reportes de cobranza</p><h2>Historial de facturas y cobros</h2><p className="section-copy">Filtra los cobros por fecha y descarga el reporte con el formato de cobranza. Los registros anteriores conservan sus datos disponibles.</p></div><Button disabled={!collectionHistory.length} onClick={() => void exportCollectionHistory()}><FileSpreadsheet />Descargar Excel</Button></div>
              <div className="cash-filters collection-filters">
                <div className="date-filter"><CalendarDays /><Input aria-label="Fecha inicial del historial" type="date" value={invoiceHistoryDateFrom} onChange={(event) => setInvoiceHistoryDateFrom(event.target.value)} /></div>
                <span className="filter-separator">a</span>
                <div className="date-filter"><CalendarDays /><Input aria-label="Fecha final del historial" type="date" value={invoiceHistoryDateTo} onChange={(event) => setInvoiceHistoryDateTo(event.target.value)} /></div>
                <Button variant="ghost" size="sm" onClick={() => { setInvoiceHistoryDateFrom(monthStartInput()); setInvoiceHistoryDateTo(todayInput()); }}>Mes actual</Button>
              </div>
              <div className="finance-summary">
                <article className="money-card balance"><span><Banknote /></span><div><small>Cobros del periodo</small><strong>{collectionHistory.length}</strong></div></article>
                <article className="money-card balance"><span><ReceiptText /></span><div><small>Documentos cobrados</small><strong>{collectionHistoryDocuments}</strong></div></article>
                <article className="money-card income"><span><CircleDollarSign /></span><div><small>Total recibido</small><strong>{currency(collectionHistoryTotal)}</strong></div></article>
              </div>
              <div className="finance-block collection-history-table"><div className="finance-block-heading"><div><h3>Detalle de cobranza</h3><p>Una fila por cada pago registrado dentro del rango.</p></div><Badge variant="outline">{collectionHistory.length} movimiento(s)</Badge></div>
                {collectionHistory.length ? <Table><TableHeader><TableRow><TableHead>Movimiento</TableHead><TableHead>Fecha de cobranza</TableHead><TableHead>Clave del cliente</TableHead><TableHead>Nombre del cliente</TableHead><TableHead>Tipo de documento</TableHead><TableHead>Documento pagado</TableHead><TableHead className="text-right">Monto pagado</TableHead><TableHead>Contado/crédito</TableHead><TableHead>Método de pago</TableHead><TableHead>Canal de cobranza</TableHead><TableHead>Comentarios</TableHead></TableRow></TableHeader><TableBody>{collectionHistory.map((row, index) => <TableRow key={row.id}><TableCell className="text-center">{index + 1}</TableCell><TableCell><strong>{shortDate(row.collectionDate)}</strong></TableCell><TableCell className="mono">{row.customerCode}</TableCell><TableCell><strong>{row.customerName}</strong></TableCell><TableCell><Badge variant="outline">{row.documentType}</Badge></TableCell><TableCell className="mono"><strong>{row.documentNumber}</strong></TableCell><TableCell className="text-right money-income"><strong>{currency(row.amountCents)}</strong></TableCell><TableCell>{row.paymentCondition}</TableCell><TableCell>{row.paymentMethod}</TableCell><TableCell>{row.collectionChannel}</TableCell><TableCell>{row.comments}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={ReceiptText} title="Sin cobros en este rango" text="Cambia las fechas o registra un cobro para generar el historial y su Excel." />}
              </div>
            </section>
          </TabsContent>
        </Tabs>}

        {view === "historial" && <section className="panel full-panel"><div className="section-toolbar"><div><p className="eyebrow">Auditoría</p><h2>Historial de movimientos</h2><p className="section-copy">Cuenta, rol, acción, día y hora de cada operación.</p></div><Button variant="outline" onClick={() => exportMovements(data.movements)}><Download />Exportar CSV</Button></div>
          {data.movements.length ? <Table><TableHeader><TableRow><TableHead>Fecha y hora</TableHead><TableHead>Acción</TableHead><TableHead>Detalle</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead>Cuenta</TableHead><TableHead>Rol</TableHead></TableRow></TableHeader><TableBody>{data.movements.map((move) => <TableRow key={move.id}><TableCell>{dateTime(move.createdAt)}</TableCell><TableCell><Badge variant="outline">{move.action.replaceAll("_", " ")}</Badge></TableCell><TableCell>{move.details}</TableCell><TableCell className="text-right">{move.quantity ?? "—"}</TableCell><TableCell><strong>{move.actorName}</strong><small className="cell-sub">{move.actorEmail}</small></TableCell><TableCell>{roleNames[move.actorRole as Role] || move.actorRole}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={History} title="Bitácora vacía" text="Cada operación realizada en el sistema quedará registrada aquí." />}
        </section>}

        {view === "equipo" && <><section className="role-grid">{(Object.keys(data.roleLimits) as Role[]).map((item) => { const used = data.users.filter((user) => user.role === item && user.active).length; return <article className="role-card" key={item}><div><span className={`role-symbol ${item.toLowerCase()}`}><Users /></span><p>{roleNames[item]}</p></div><strong>{used}<small> / {data.roleLimits[item]}</small></strong><div className="slot-track"><span style={{ width: `${used / data.roleLimits[item] * 100}%` }} /></div></article>; })}</section><section className="panel full-panel"><div className="section-toolbar"><div><p className="eyebrow">Acceso</p><h2>Cuentas y permisos</h2><p className="section-copy">Asigna un nombre de usuario, una contraseña temporal y el tipo de cuenta. Cada persona deberá crear su contraseña personal al ingresar.</p></div><Button onClick={() => openModal("usuario")}><Plus />Crear cuenta</Button></div>
          {data.users.length ? <Table><TableHeader><TableRow><TableHead>Persona</TableHead><TableHead>Usuario</TableHead><TableHead>Tipo de cuenta</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.users.map((user) => <TableRow key={user.id}><TableCell><div className="person-cell"><span className="avatar small">{initials(user.displayName)}</span><strong>{user.displayName}</strong></div></TableCell><TableCell><strong className="mono">{user.username || user.email}</strong>{!user.authUserId && <small className="cell-sub">Acceso anterior · pendiente de actualizar</small>}</TableCell><TableCell><Badge variant="outline" className={roleColors[user.role]}>{roleNames[user.role]}</Badge></TableCell><TableCell><span className={user.active ? "state-active" : "state-off"}>{user.active ? "Activa" : "Desactivada"}</span></TableCell><TableCell className="text-right">{user.id !== data.currentUser.id && <div className="order-actions">{user.authUserId && <Button variant="ghost" size="sm" onClick={() => openModal("restablecer_clave", { userId: String(user.id), authUserId: user.authUserId || "", displayName: user.displayName })}><KeyRound />Contraseña</Button>}<Button variant="ghost" size="sm" disabled={!user.authUserId} onClick={() => void post({ action: "TOGGLE_USER", userId: user.id })}>{user.active ? "Desactivar" : "Activar"}</Button><Button variant="ghost" size="sm" className="cancel-action" onClick={() => setDeleteUser(user)}><Trash2 />Eliminar</Button></div>}</TableCell></TableRow>)}</TableBody></Table> : null}
        </section></>}
      </main>
    </SidebarInset>
    <ActionDialog modal={modal} setModal={setModal} form={form} setForm={setForm} data={data} saving={saving} onSubmit={submit} />
    <AlertDialog open={Boolean(cancelOrder)} onOpenChange={(open) => { if (!open && !saving) { setCancelOrder(null); setCancelReason(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Cancelar {cancelOrder?.folio}</AlertDialogTitle><AlertDialogDescription>El pedido quedará visible como cancelado. Como todavía está pendiente, el inventario no necesita ningún ajuste.</AlertDialogDescription></AlertDialogHeader>
        <div className="field"><Label htmlFor="cancelReason">Motivo de cancelación <span>*</span></Label><Input id="cancelReason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Error de captura, cancelación del cliente…" /></div>
        <AlertDialogFooter><AlertDialogCancel disabled={saving}>Volver</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={saving} onClick={(event) => { event.preventDefault(); if (!cancelReason.trim()) return toast.error("Escribe el motivo de la cancelación."); void post({ action: "CANCEL_ORDER", orderId: cancelOrder?.id, reason: cancelReason }); }}>{saving ? <Loader2 className="spin" /> : <XCircle />}{saving ? "Cancelando…" : "Cancelar pedido"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(deleteUser)} onOpenChange={(open) => { if (!open && !saving) setDeleteUser(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Eliminar cuenta de {deleteUser?.displayName}</AlertDialogTitle><AlertDialogDescription>La persona perderá el acceso asignado al sistema. Su actividad anterior permanecerá en el historial.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={saving}>Volver</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={saving} onClick={(event) => { event.preventDefault(); void post({ action: "DELETE_USER", userId: deleteUser?.id }); }}>{saving ? <Loader2 className="spin" /> : <Trash2 />}{saving ? "Eliminando…" : "Eliminar cuenta"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Toaster richColors position="top-right" />
  </SidebarProvider>;
}

/** Campo de texto reutilizable conectado al estado de un formulario modal. */
function Field({ label, name, form, setForm, type = "text", placeholder, required = true }: { label: string; name: string; form: Record<string, string>; setForm: (value: Record<string, string>) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <div className="field"><Label htmlFor={name}>{label}{required && <span> *</span>}</Label><Input id={name} type={type} placeholder={placeholder} value={form[name] || ""} onChange={(event) => setForm({ ...form, [name]: event.target.value })} /></div>;
}

/** Área de texto reutilizable conectada al estado de un formulario modal. */
function TextAreaField({ label, name, form, setForm, placeholder, required = true }: { label: string; name: string; form: Record<string, string>; setForm: (value: Record<string, string>) => void; placeholder?: string; required?: boolean }) {
  return <div className="field field-wide"><Label htmlFor={name}>{label}{required && <span> *</span>}</Label><Textarea id={name} rows={3} placeholder={placeholder} value={form[name] || ""} onChange={(event) => setForm({ ...form, [name]: event.target.value })} /></div>;
}

/** Construye el contenido y las validaciones de los distintos formularios modales. */
function ActionDialog({ modal, setModal, form, setForm, data, saving, onSubmit }: { modal: Modal; setModal: (value: Modal) => void; form: Record<string, string>; setForm: (value: Record<string, string>) => void; data: SystemData; saving: boolean; onSubmit: () => void }) {
  const titles: Record<Exclude<Modal, null>, [string, string]> = {
    lote: ["Agregar entrada al almacén", "Selecciona un producto registrado o captura uno nuevo. La existencia se calculará con cajas y unidades sueltas."], salida: ["Registrar salida", "La existencia se descontará del lote seleccionado."], stock_minimo: ["Configurar existencia mínima", "Compras recibirá una alerta cuando el total del producto llegue a este número."], precio_producto: ["Colocar precio del producto", "El nuevo precio se aplicará a todos los lotes registrados de este producto."], presentacion_producto: ["Modificar presentación", "Define cuántas unidades contiene una caja de este producto."],
    pedido: ["Nuevo pedido", "Quedará pendiente de pago hasta que su factura sea liquidada."], editar_pedido: ["Modificar pedido", "Solo el vendedor que creó el pedido puede cambiarlo antes de facturarlo."], reprogramar_pedido: ["Reprogramar pedido atrasado", "La nueva fecha y el motivo quedarán guardados en el historial."], revision_fefo: ["Revisión FEFO del envío", "Selecciona uno o varios lotes hasta completar exactamente la cantidad del pedido."],
    devolucion: ["Registrar devolución", "Las unidades regresarán al lote autorizado por Calidad y el movimiento quedará en el historial."], factura: ["Crear factura", "Relaciona el pedido para habilitar su entrega cuando se liquide."],
    cobro: ["Aceptar cobro", "Al liquidar una factura, el pedido pasará a revisión de Calidad."], programar_factura: ["Programar envío de factura", "Caja debe indicar cuándo se enviará y por qué todavía está pendiente."], entrega: ["Nueva entrega", "Registra lo que sale, quién lo lleva y a qué cliente corresponde."],
    editar_entrega: ["Modificar entrega", "Corrige el chofer, la fecha, la factura o los productos enviados."], chofer: ["Agregar chofer", "El chofer quedará disponible para nuevas entregas."],
    cliente: ["Nuevo cliente frecuente", "Guarda sus datos para reutilizarlos en pedidos y facturas."], editar_cliente: ["Modificar cliente", "Actualiza los datos guardados del cliente frecuente."],
    proveedor: ["Nuevo proveedor", "Quedará disponible para relacionarlo con nuevas entradas de almacén."], editar_proveedor: ["Modificar proveedor", "Actualiza sus datos de contacto y facturación."],
    usuario: ["Crear cuenta", "Asigna usuario, contraseña temporal y tipo de cuenta. La persona deberá cambiar la contraseña al primer ingreso."],
    restablecer_clave: ["Restablecer contraseña", "Asigna una nueva contraseña temporal. La persona deberá reemplazarla al volver a ingresar."],
    cambiar_usuario: ["Cambiar mi nombre de usuario", "Escribe un nombre disponible y confirma tu contraseña actual. Lo usarás la próxima vez que ingreses."],
    cambiar_clave: ["Cambiar mi contraseña", "Confirma tu contraseña actual y escribe una nueva. El Administrador puede restablecerla si la olvidas."],
  };
  const open = modal !== null; const title = modal ? titles[modal] : ["", ""];
  const fefoOrder = data.orders.find((order) => String(order.id) === form.orderId), fefoItem = fefoOrder?.items[0];
  const fefoLots = data.inventory.filter((lot) => lot.productId === fefoItem?.productId && lot.quantity > 0 && lot.expiryDate >= todayInput()).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const suggested = new Map(fefoSuggestion(fefoItem, data.inventory).map(({ lot, quantity }) => [lot.id, quantity]));
  const selectedFefoTotal = fefoLots.filter((lot) => form[`fefo_${lot.id}`] === "true").reduce((sum, lot) => sum + Number(form[`fefo_qty_${lot.id}`] || 0), 0);
  const fefoValid = Boolean(fefoItem && selectedFefoTotal === fefoItem.quantity);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) setModal(null); }}><DialogContent className={`action-dialog ${modal === "revision_fefo" ? "fefo-dialog" : ""}`}><DialogHeader><DialogTitle>{title[0]}</DialogTitle><DialogDescription>{title[1]}</DialogDescription></DialogHeader><div className="form-grid">
    {modal === "lote" && <><EntryProductField form={form} setForm={setForm} inventory={data.inventory} suppliers={data.suppliers} />{form.productId === "0" && <><Field label="Código de producto" name="code" form={form} setForm={setForm} placeholder="58-0301009" /><Field label="Nombre del producto" name="name" form={form} setForm={setForm} placeholder="Nombre comercial" /></>}<SelectField label="Proveedor" name="supplierId" form={form} setForm={setForm} options={data.suppliers.filter((supplier) => supplier.active).map((supplier) => ({ value: String(supplier.id), label: supplier.name }))} /><Field label="Lote" name="lot" form={form} setForm={setForm} placeholder="L-2026-01" /><Field label="Caducidad" name="expiryDate" type="date" form={form} setForm={setForm} /><Field label="Número de cajas" name="boxes" type="number" form={form} setForm={setForm} placeholder="0" />{form.productId === "0" && <Field label="Unidades por caja" name="unitsPerBox" type="number" form={form} setForm={setForm} placeholder="12" />}<Field label="Unidades sueltas" name="units" type="number" form={form} setForm={setForm} required={false} placeholder="0" /><EntryQuantitySummary form={form} inventory={data.inventory} />{form.productId === "0" && <Field label="Precio neto (MXN, opcional)" name="netPrice" type="number" form={form} setForm={setForm} required={false} placeholder="Puede dejarse vacío" />}</>}
    {modal === "salida" && <><SelectField label="Lote de inventario" name="lotId" form={form} setForm={setForm} options={data.inventory.filter((row) => row.quantity > 0).map((row) => ({ value: String(row.id), label: `${row.name} · ${row.code} · Lote ${row.lot} (${row.quantity})` }))} /><Field label="Cantidad" name="quantity" type="number" form={form} setForm={setForm} /><Field label="Motivo" name="reason" form={form} setForm={setForm} placeholder="Venta directa, merma…" /></>}
    {modal === "stock_minimo" && <><div className="modal-summary"><span><Boxes /></span><div><small>PRODUCTO</small><strong>{form.productName}</strong></div></div><Field label="Existencia mínima" name="minimumStock" type="number" form={form} setForm={setForm} placeholder="10" /></>}
    {modal === "precio_producto" && <><div className="modal-summary"><span><CircleDollarSign /></span><div><small>PRODUCTO</small><strong>{form.productName}</strong><p>Se actualizarán todos sus lotes.</p></div></div><Field label="Precio neto (MXN)" name="netPrice" type="number" form={form} setForm={setForm} placeholder="0.00" /></>}
    {modal === "presentacion_producto" && <><div className="modal-summary"><span><Boxes /></span><div><small>PRODUCTO</small><strong>{form.productName}</strong><p>Los pedidos nuevos usarán esta presentación.</p></div></div><Field label="Unidades por caja" name="unitsPerBox" type="number" form={form} setForm={setForm} placeholder="12" /></>}
    {modal === "pedido" && <><CustomerCatalogField form={form} setForm={setForm} customers={data.customers} fillAddress /><Field label="Cliente" name="customer" form={form} setForm={setForm} placeholder="Nombre o razón social" /><OrderProductField form={form} setForm={setForm} inventory={data.inventory} /><Field label="Cajas" name="boxes" type="number" form={form} setForm={setForm} placeholder="0" /><Field label="Unidades sueltas" name="units" type="number" form={form} setForm={setForm} placeholder="0" /><OrderQuantitySummary form={form} inventory={data.inventory} /><Field label="Fecha de entrega" name="deliveryDate" type="date" form={form} setForm={setForm} /><SelectField label="Municipio de entrega" name="deliveryZone" form={form} setForm={setForm} options={deliveryZoneOptions} /><Field label="Ubicación o dirección" name="deliveryLocation" form={form} setForm={setForm} placeholder="Calle, colonia y referencias" /><Field label="Notas" name="notes" form={form} setForm={setForm} required={false} placeholder="Indicaciones de entrega" /></>}
    {modal === "editar_pedido" && <><CustomerCatalogField form={form} setForm={setForm} customers={data.customers} fillAddress /><Field label="Cliente" name="customer" form={form} setForm={setForm} placeholder="Nombre o razón social" /><OrderProductField form={form} setForm={setForm} inventory={data.inventory} /><Field label="Cajas" name="boxes" type="number" form={form} setForm={setForm} placeholder="0" /><Field label="Unidades sueltas" name="units" type="number" form={form} setForm={setForm} placeholder="0" /><OrderQuantitySummary form={form} inventory={data.inventory} /><Field label="Fecha de entrega" name="deliveryDate" type="date" form={form} setForm={setForm} /><SelectField label="Municipio de entrega" name="deliveryZone" form={form} setForm={setForm} options={deliveryZoneOptions} /><Field label="Ubicación o dirección" name="deliveryLocation" form={form} setForm={setForm} placeholder="Calle, colonia y referencias" /><Field label="Notas" name="notes" form={form} setForm={setForm} required={false} placeholder="Indicaciones de entrega" /></>}
    {modal === "reprogramar_pedido" && <><div className="modal-summary warning"><span><Clock3 /></span><div><small>PEDIDO ATRASADO</small><strong>{form.folio}</strong><p>Fecha anterior: {form.previousDate ? shortDate(form.previousDate) : "—"}</p></div></div><Field label="Nueva fecha de entrega" name="newDeliveryDate" type="date" form={form} setForm={setForm} /><TextAreaField label="Motivo del atraso" name="reason" form={form} setForm={setForm} placeholder="Explica por qué no se entregó en la fecha anterior…" /></>}
    {modal === "revision_fefo" && <><div className="fefo-order-summary"><div><small>PEDIDO</small><strong>{fefoOrder?.folio} · {fefoOrder?.customer}</strong></div><div><small>PRODUCTO</small><strong>{fefoItem?.productName} · {fefoItem?.quantity || 0} unidad(es)</strong></div><div><small>SELECCIONADO</small><strong className={fefoValid ? "complete" : "incomplete"}>{selectedFefoTotal} / {fefoItem?.quantity || 0}</strong></div></div><div className="fefo-lot-list">{fefoLots.length ? fefoLots.map((lot, index) => { const selected = form[`fefo_${lot.id}`] === "true"; const recommended = suggested.get(lot.id) || 0; return <div className={`fefo-lot-row ${selected ? "selected" : ""}`} key={lot.id}><Checkbox checked={selected} onCheckedChange={(checked) => setForm({ ...form, [`fefo_${lot.id}`]: checked === true ? "true" : "false", [`fefo_qty_${lot.id}`]: checked === true ? String(form[`fefo_qty_${lot.id}`] || recommended || 1) : "" })} aria-label={`Seleccionar lote ${lot.lot}`} /><div className="fefo-lot-copy"><strong>{index + 1}. Lote {lot.lot}</strong><small>Caduca {shortDate(lot.expiryDate)} · {lot.quantity} disponibles</small>{recommended > 0 && <span>FEFO recomienda {recommended}</span>}</div><Input type="number" min="1" max={lot.quantity} disabled={!selected} value={form[`fefo_qty_${lot.id}`] || ""} onChange={(event) => setForm({ ...form, [`fefo_qty_${lot.id}`]: event.target.value })} aria-label={`Cantidad del lote ${lot.lot}`} /></div>; }) : <EmptyState icon={AlertTriangle} title="Inventario insuficiente" text="No hay lotes vigentes disponibles para completar este producto." />}</div><div className="field field-wide"><Label htmlFor="notes">Observaciones</Label><Textarea id="notes" rows={2} value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Estado del empaque, temperatura o alguna indicación…" /></div></>}
    {modal === "devolucion" && <><div className="return-summary"><span><RotateCcw /></span><div><strong>{form.folio}</strong><p>{form.product}</p><small>Máximo disponible para devolver: {form.maxQuantity} unidad(es)</small></div></div><Field label="Cantidad a devolver" name="quantity" type="number" form={form} setForm={setForm} /><Field label="Motivo de devolución" name="reason" form={form} setForm={setForm} placeholder="Producto dañado, error de surtido…" /></>}
    {modal === "factura" && <><InvoiceOrderField form={form} setForm={setForm} data={data} /><SelectField label="Tipo de documento" name="kind" form={form} setForm={setForm} options={[{ value: "INTERNA", label: "Comprobante interno" }, { value: "CFDI", label: "CFDI (borrador para timbrado)" }]} /><CustomerCatalogField form={form} setForm={setForm} customers={data.customers} fillRfc /><Field label="Cliente" name="customer" form={form} setForm={setForm} placeholder="Nombre o razón social" /><Field label="RFC" name="rfc" form={form} setForm={setForm} required={false} placeholder="Obligatorio para CFDI" /><Field label="Monto total (MXN)" name="amount" type="number" form={form} setForm={setForm} /></>}
    {modal === "cobro" && <><SelectField label="Factura" name="invoiceId" form={form} setForm={setForm} options={data.invoices.filter((invoice) => invoice.status !== "PAGADA").map((invoice) => ({ value: String(invoice.id), label: `${invoice.folio} · ${invoice.customer} · ${currency(invoice.amountCents - invoice.payments.reduce((s, p) => s + p.amountCents, 0))} pendiente` }))} /><Field label="Monto recibido (MXN)" name="amount" type="number" form={form} setForm={setForm} /><SelectField label="Contado o crédito" name="paymentCondition" form={form} setForm={setForm} options={[{ value: "CONTADO", label: "Contado" }, { value: "CREDITO", label: "Crédito" }]} /><SelectField label="Método de pago" name="method" form={form} setForm={setForm} options={[{ value: "EFECTIVO", label: "Efectivo" }, { value: "TRANSFERENCIA", label: "Transferencia" }, { value: "TARJETA", label: "Tarjeta" }, { value: "CHEQUE", label: "Cheque" }, { value: "OTRO", label: "Otro" }]} /><SelectField label="Canal de cobranza" name="collectionChannel" form={form} setForm={setForm} options={[{ value: "CAJA", label: "Caja" }, { value: "VENDEDOR", label: "Vendedor" }, { value: "CHOFER", label: "Chofer / reparto" }, { value: "COBRANZA_TELEFONICA", label: "Cobranza telefónica" }, { value: "OTRO", label: "Otro" }]} /><Field label="Referencia" name="reference" form={form} setForm={setForm} required={false} placeholder="Folio bancario o nota" /><TextAreaField label="Comentarios" name="comments" form={form} setForm={setForm} required={false} placeholder="Aclaraciones del cobro, diferencia o seguimiento…" /></>}
    {modal === "programar_factura" && <><div className="modal-summary"><span><FileText /></span><div><small>FACTURA PENDIENTE</small><strong>{form.folio} · {form.customer}</strong></div></div><Field label="Fecha programada de envío" name="scheduledSendDate" type="date" form={form} setForm={setForm} /><TextAreaField label="Motivo por el que no se ha enviado" name="reason" form={form} setForm={setForm} placeholder="Falta información fiscal, corrección pendiente…" /></>}
    {(modal === "entrega" || modal === "editar_entrega") && <><SelectField label="Chofer" name="driverId" form={form} setForm={setForm} options={data.drivers.filter((driver) => driver.active || String(driver.id) === form.driverId).map((driver) => ({ value: String(driver.id), label: `${driver.name}${driver.active ? "" : " · Retirado"}` }))} /><Field label="Fecha de salida" name="deliveryDate" type="date" form={form} setForm={setForm} /><Field label="Número de factura" name="invoiceNumber" form={form} setForm={setForm} placeholder="FACT-000123" /><Field label="Cliente" name="customer" form={form} setForm={setForm} placeholder="Nombre o razón social" /><TextAreaField label="Productos que se envían" name="contents" form={form} setForm={setForm} placeholder="Producto, lote y cantidad…" /><SelectField label="Pedido relacionado" name="orderId" form={form} setForm={setForm} required={false} options={[{ value: "0", label: "Sin pedido relacionado" }, ...data.orders.filter((order) => ["SURTIDO", "DEVOLUCION_PARCIAL"].includes(order.status) || String(order.id) === form.orderId).map((order) => ({ value: String(order.id), label: `${order.folio} · ${order.customer}` }))]} /></>}
    {modal === "chofer" && <Field label="Nombre completo del chofer" name="name" form={form} setForm={setForm} placeholder="Nombre y apellidos" />}
    {(modal === "cliente" || modal === "editar_cliente") && <><Field label="Nombre o razón social" name="name" form={form} setForm={setForm} placeholder="Cliente o empresa" /><Field label="RFC" name="rfc" form={form} setForm={setForm} required={false} placeholder="Opcional para comprobantes internos" /><Field label="Teléfono" name="phone" form={form} setForm={setForm} required={false} placeholder="81 0000 0000" /><Field label="Correo" name="email" type="email" form={form} setForm={setForm} required={false} placeholder="cliente@empresa.com" /><Field label="Dirección" name="address" form={form} setForm={setForm} required={false} placeholder="Calle, colonia, municipio y estado" /></>}
    {(modal === "proveedor" || modal === "editar_proveedor") && <><Field label="Nombre o razón social" name="name" form={form} setForm={setForm} placeholder="Proveedor o empresa" /><Field label="RFC" name="rfc" form={form} setForm={setForm} required={false} placeholder="RFC del proveedor" /><Field label="Persona de contacto" name="contactName" form={form} setForm={setForm} required={false} placeholder="Nombre del contacto" /><Field label="Teléfono" name="phone" form={form} setForm={setForm} required={false} placeholder="81 0000 0000" /><Field label="Correo" name="email" type="email" form={form} setForm={setForm} required={false} placeholder="ventas@proveedor.com" /></>}
    {modal === "usuario" && <><Field label="Nombre completo" name="displayName" form={form} setForm={setForm} placeholder="Nombre y apellidos" /><Field label="Nombre de usuario" name="username" form={form} setForm={setForm} placeholder="ej. lalo.garza" /><Field label="Contraseña temporal" name="password" type="password" form={form} setForm={setForm} placeholder="Mínimo 7 caracteres, letras y números" /><SelectField label="Tipo de cuenta" name="role" form={form} setForm={setForm} options={(Object.keys(data.roleLimits) as Role[]).map((role) => ({ value: role, label: `${roleNames[role]} · máximo ${data.roleLimits[role]}` }))} /></>}
    {modal === "restablecer_clave" && <><div className="modal-summary"><span><KeyRound /></span><div><small>CUENTA</small><strong>{form.displayName}</strong><p>La contraseña nueva será temporal.</p></div></div><Field label="Nueva contraseña temporal" name="password" type="password" form={form} setForm={setForm} placeholder="Mínimo 7 caracteres, letras y números" /></>}
    {modal === "cambiar_usuario" && <><div className="modal-summary"><span><Pencil /></span><div><small>USUARIO ACTUAL</small><strong>{data.currentUser.username}</strong><p>El historial anterior conservará el usuario con el que se registró.</p></div></div><div className="field"><Label htmlFor="username">Nuevo nombre de usuario<span> *</span></Label><Input id="username" value={form.username || ""} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })} placeholder="ej. lalo.garza" autoComplete="username" /><small>De 3 a 32 caracteres: letras minúsculas, números, punto, guion o guion bajo.</small></div><Field label="Contraseña actual" name="currentPassword" type="password" form={form} setForm={setForm} placeholder="Tu contraseña actual" /></>}
    {modal === "cambiar_clave" && <><Field label="Contraseña actual" name="currentPassword" type="password" form={form} setForm={setForm} placeholder="Tu contraseña actual" /><Field label="Nueva contraseña" name="password" type="password" form={form} setForm={setForm} placeholder="Mínimo 7 caracteres, letras y números" /><Field label="Confirmar contraseña nueva" name="confirmation" type="password" form={form} setForm={setForm} placeholder="Repite la contraseña nueva" /></>}
  </div><DialogFooter><Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={onSubmit} disabled={saving || (modal === "revision_fefo" && !fefoValid) || (modal === "cambiar_usuario" && (!form.currentPassword || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(form.username || "") || form.username === data.currentUser.username)) || (modal === "cambiar_clave" && (!form.currentPassword || (form.password || "").length < 7 || form.password !== form.confirmation))}>{saving ? <Loader2 className="spin" /> : modal === "revision_fefo" ? <ClipboardCheck /> : modal === "cambiar_usuario" ? <Pencil /> : modal === "cambiar_clave" ? <KeyRound /> : <CheckCircle2 />}{saving ? "Guardando…" : modal === "revision_fefo" ? "Aprobar lotes" : modal === "cambiar_usuario" ? "Cambiar usuario" : modal === "cambiar_clave" ? "Cambiar contraseña" : "Guardar"}</Button></DialogFooter></DialogContent></Dialog>;
}

/** Selector reutilizable conectado al estado de un formulario modal. */
function SelectField({ label, name, form, setForm, options, required = true }: { label: string; name: string; form: Record<string, string>; setForm: (value: Record<string, string>) => void; options: { value: string; label: string }[]; required?: boolean }) {
  return <div className="field"><Label>{label}{required && <span> *</span>}</Label><Select value={form[name] || ""} onValueChange={(value) => setForm({ ...form, [name]: value })}><SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar…" /></SelectTrigger><SelectContent>{options.length ? options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>) : <SelectItem value="none" disabled>Sin opciones disponibles</SelectItem>}</SelectContent></Select></div>;
}

/** Selecciona un producto existente o habilita la captura de uno nuevo para una entrada. */
function EntryProductField({ form, setForm, inventory, suppliers }: { form: Record<string, string>; setForm: (value: Record<string, string>) => void; inventory: Lot[]; suppliers: Supplier[] }) {
  const products = [...new Map(inventory.map((lot) => [lot.productId, lot])).values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const selected = products.find((product) => String(product.productId) === form.productId);
  const selectProduct = (value: string) => {
    if (value === "0") {
      setForm({ ...form, productId: "0", code: "", name: "", unitsPerBox: "", netPrice: "", supplierId: "", lot: "", expiryDate: "", boxes: form.boxes || "0", units: form.units || "0" });
      return;
    }
    const lots = inventory.filter((lot) => String(lot.productId) === value).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const product = lots[0]; if (!product) return;
    const pricedLot = lots.find((lot) => lot.netPriceCents > 0);
    const savedSupplier = suppliers.find((supplier) => supplier.id === product.supplierId && supplier.active);
    setForm({ ...form, productId: value, code: product.code, name: product.name, unitsPerBox: String(product.unitsPerBox), netPrice: pricedLot ? (pricedLot.netPriceCents / 100).toFixed(2) : "", supplierId: savedSupplier ? String(savedSupplier.id) : form.supplierId || "", lot: product.lot, expiryDate: product.expiryDate, boxes: form.boxes || "0", units: form.units || "0" });
  };
  return <><div className="field field-wide"><Label>Producto <span>*</span></Label><Select value={form.productId || "0"} onValueChange={selectProduct}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Producto nuevo</SelectItem>{products.map((product) => <SelectItem key={product.productId} value={String(product.productId)}>{product.name} · {product.code}</SelectItem>)}</SelectContent></Select><small className="field-help">Al elegir uno registrado se recuperan automáticamente su código, presentación, precio, proveedor y último lote. Puedes cambiar el lote o la caducidad si esta mercancía pertenece a uno nuevo.</small></div>{selected && <div className="modal-summary"><span><PackagePlus /></span><div><small>PRODUCTO REGISTRADO</small><strong>{selected.name} · {selected.code}</strong><p>{selected.unitsPerBox} unidades por caja · {form.netPrice ? `${currency(Math.round(Number(form.netPrice) * 100))} por unidad` : "Precio pendiente"}</p></div></div>}</>;
}

/** Calcula y explica las unidades totales que se agregarán al inventario. */
function EntryQuantitySummary({ form, inventory }: { form: Record<string, string>; inventory: Lot[] }) {
  const selected = inventory.find((lot) => String(lot.productId) === form.productId);
  const unitsPerBox = selected?.unitsPerBox || Math.max(0, Number.parseInt(form.unitsPerBox || "0", 10) || 0);
  const boxes = Math.max(0, Number.parseInt(form.boxes || "0", 10) || 0);
  const units = Math.max(0, Number.parseInt(form.units || "0", 10) || 0);
  const total = boxes * unitsPerBox + units;
  return <div className="modal-summary"><span><Boxes /></span><div><small>ENTRADA CALCULADA</small><strong>{boxes} caja(s) × {unitsPerBox || 0} + {units} unidad(es) = {total} unidades</strong><p>Esta cantidad total se sumará al inventario del nuevo lote.</p></div></div>;
}

/** Selecciona el producto y lote disponibles para un pedido. */
function OrderProductField({ form, setForm, inventory }: { form: Record<string, string>; setForm: (value: Record<string, string>) => void; inventory: Lot[] }) {
  const products = new Map<number, { lot: Lot; total: number }>();
  inventory.filter((lot) => lot.quantity > 0 && lot.expiryDate >= todayInput() && lot.netPriceCents > 0).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).forEach((lot) => {
    const current = products.get(lot.productId); if (current) current.total += lot.quantity; else products.set(lot.productId, { lot, total: lot.quantity });
  });
  const selectedLot = inventory.find((lot) => String(lot.id) === form.lotId), selectedProduct = selectedLot ? products.get(selectedLot.productId) : undefined;
  const value = selectedProduct ? String(selectedProduct.lot.id) : form.lotId || "";
  return <div className="field"><Label>Producto <span>*</span></Label><Select value={value} onValueChange={(lotId) => setForm({ ...form, lotId })}><SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar producto…" /></SelectTrigger><SelectContent>{[...products.values()].map(({ lot, total }) => <SelectItem key={lot.productId} value={String(lot.id)}>{lot.name} · {lot.code} · {lot.unitsPerBox} unid./caja ({total} disponibles)</SelectItem>)}</SelectContent></Select><small className="field-help">Solo aparecen productos con precio. Calidad elegirá después los lotes mediante FEFO.</small></div>;
}

/** Convierte cajas y unidades sueltas al total que descontará el pedido. */
function OrderQuantitySummary({ form, inventory }: { form: Record<string, string>; inventory: Lot[] }) {
  const selectedLot = inventory.find((lot) => String(lot.id) === form.lotId);
  const unitsPerBox = selectedLot?.unitsPerBox || 0;
  const boxes = Math.max(0, Number.parseInt(form.boxes || "0", 10) || 0);
  const units = Math.max(0, Number.parseInt(form.units || "0", 10) || 0);
  const total = boxes * unitsPerBox + units;
  return <div className="modal-summary"><span><ShoppingCart /></span><div><small>TOTAL DEL PEDIDO</small><strong>{selectedLot ? `${boxes} caja(s) × ${unitsPerBox} + ${units} unidad(es) = ${total} unidades` : "Selecciona un producto"}</strong><p>{selectedLot ? `${selectedLot.quantity} unidades visibles en este lote; el sistema valida el total de todos los lotes vigentes.` : "La conversión se calculará automáticamente."}</p></div></div>;
}

/** Relaciona una factura con un pedido pendiente y completa sus datos principales. */
function InvoiceOrderField({ form, setForm, data }: { form: Record<string, string>; setForm: (value: Record<string, string>) => void; data: SystemData }) {
  const selectedId = form.orderId || "0";
  const invoicedOrderIds = new Set(data.invoices.map((invoice) => invoice.orderId).filter(Boolean));
  const available = data.orders.filter((order) => (order.status === "PENDIENTE" && !invoicedOrderIds.has(order.id)) || String(order.id) === selectedId);
  const selectOrder = (value: string) => {
    const order = data.orders.find((item) => String(item.id) === value);
    if (!order) return setForm({ ...form, orderId: "0" });
    const customer = data.customers.find((item) => item.id === order.customerId);
    const totalCents = order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    setForm({ ...form, orderId: value, customerId: String(order.customerId || 0), customer: order.customer, rfc: customer?.rfc || form.rfc || "", amount: (totalCents / 100).toFixed(2) });
  };
  return <div className="field"><Label>Pedido relacionado</Label><Select value={selectedId} onValueChange={selectOrder}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Factura sin pedido</SelectItem>{available.map((order) => <SelectItem key={order.id} value={String(order.id)}>{order.folio} · {order.customer}</SelectItem>)}</SelectContent></Select></div>;
}

/** Selecciona un cliente frecuente y puede copiar dirección o RFC al formulario. */
function CustomerCatalogField({ form, setForm, customers, fillAddress = false, fillRfc = false }: { form: Record<string, string>; setForm: (value: Record<string, string>) => void; customers: Customer[]; fillAddress?: boolean; fillRfc?: boolean }) {
  const selectedId = form.customerId || "0";
  const available = customers.filter((customer) => customer.active || String(customer.id) === selectedId);
  const selectCustomer = (value: string) => {
    const customer = customers.find((item) => String(item.id) === value);
    if (!customer) return setForm({ ...form, customerId: "0" });
    setForm({ ...form, customerId: value, customer: customer.name, ...(fillAddress ? { deliveryLocation: customer.address || form.deliveryLocation || "" } : {}), ...(fillRfc ? { rfc: customer.rfc || "" } : {}) });
  };
  return <div className="field"><Label>Cliente frecuente</Label><Select value={selectedId} onValueChange={selectCustomer}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Captura manual</SelectItem>{available.map((customer) => <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}{customer.rfc ? ` · ${customer.rfc}` : ""}</SelectItem>)}</SelectContent></Select></div>;
}

/** Abre una versión imprimible del comprobante seleccionado. */
function printInvoice(invoice: Invoice) {
  const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const popup = window.open("", "_blank", "width=760,height=820"); if (!popup) return toast.error("Permite ventanas emergentes para imprimir el comprobante.");
  popup.document.write(`<!doctype html><html><head><title>${safe(invoice.folio)}</title><style>body{font-family:Arial,sans-serif;color:#162234;padding:48px}header{border-bottom:3px solid #0b7a75;padding-bottom:20px;margin-bottom:28px}h1{font-size:26px;margin:0}small{color:#657184}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}.box{background:#f4f7f9;padding:18px;border-radius:10px}.total{font-size:28px;font-weight:700;text-align:right;margin-top:32px}.status{color:#0b7a75;font-weight:700}footer{margin-top:80px;border-top:1px solid #ddd;padding-top:16px;color:#657184;font-size:12px}@media print{body{padding:18px}}</style></head><body><header><small>SISTEMA DE ALMACÉN Y VENTAS</small><h1>${safe(invoice.kind === "CFDI" ? "Borrador CFDI" : "Comprobante interno")}</h1><p>Folio: <strong>${safe(invoice.folio)}</strong></p></header><div class="grid"><div class="box"><small>CLIENTE</small><p><strong>${safe(invoice.customer)}</strong><br>RFC: ${safe(invoice.rfc || "No especificado")}</p></div><div class="box"><small>FECHA</small><p>${safe(dateTime(invoice.createdAt))}<br><span class="status">${safe(invoice.status.replaceAll("_", " "))}</span></p></div></div><div class="total">Total: ${safe(currency(invoice.amountCents))}</div><p style="text-align:right">Pagado: ${safe(currency(paid))}<br>Saldo: ${safe(currency(invoice.amountCents - paid))}</p><footer>${invoice.kind === "CFDI" ? "Documento sin validez fiscal hasta ser timbrado por un PAC autorizado." : "Comprobante interno de operación."}</footer><script>window.onload=()=>window.print()</script></body></html>`); popup.document.close();
}

/** Exporta la bitácora visible como CSV compatible con Excel. */
function exportMovements(rows: Movement[]) {
  const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ "Fecha y hora": dateTime(row.createdAt), Acción: row.action, Detalle: row.details, Cantidad: row.quantity ?? "", Cuenta: row.actorName, Correo: row.actorEmail, Rol: row.actorRole })));
  const csv = XLSX.utils.sheet_to_csv(sheet); const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `historial-movimientos-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}
