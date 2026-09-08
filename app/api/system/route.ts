/**
 * @file API central del negocio. Lee el estado completo y procesa las operaciones autorizadas de cada módulo.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db";
import { appUsers, cashOutflows, customers, deliveries, drivers, invoices, movements, orderItems, orderReschedules, orderReturns, orders, payments, products, shipmentReviewLots, shipmentReviews, stockLots, suppliers } from "@/db/schema";
import { callAccountAdmin, getLocalSession, normalizeUsername, validPassword, validUsername } from "@/app/supabase-auth";

export const dynamic = "force-dynamic";
// Roles reconocidos y número máximo de cuentas activas permitido para cada perfil.
type Role = "ADMIN" | "COMPRAS" | "CALIDAD" | "CAJA" | "VENDEDOR" | "ALMACEN" | "PRODUCCION";
const ROLE_LIMITS: Record<Role, number> = { ADMIN: 4, COMPRAS: 2, CALIDAD: 1, CAJA: 1, VENDEDOR: 4, ALMACEN: 1, PRODUCCION: 1 };
const DELIVERY_ZONES = ["MONTERREY", "APODACA", "CADEREYTA", "EL_CARMEN", "CIENEGA_DE_FLORES", "GARCIA", "ESCOBEDO", "ZUAZUA", "GUADALUPE", "JUAREZ", "PESQUERIA", "SALINAS_VICTORIA", "SAN_NICOLAS", "SAN_PEDRO", "SANTA_CATARINA", "SANTIAGO", "FORANEO"];
/** Función auxiliar `correctSpelling`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const correctSpelling = (value: string) => value.replace(/prueva/gi, (match) => match === match.toUpperCase() ? "PRUEBA" : match[0] === match[0].toUpperCase() ? "Prueba" : "prueba");
/** Función auxiliar `clean`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const clean = (value: unknown) => correctSpelling(String(value ?? "").trim());
/** Función auxiliar `positiveInt`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const positiveInt = (value: unknown) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : 0; };
/** Función auxiliar `wholeNumber`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const wholeNumber = (value: unknown) => { const n = Number(value); return Number.isInteger(n) && n >= 0 ? n : -1; };
/** Función auxiliar `moneyToCents`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const moneyToCents = (value: unknown) => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : -1; };
/** Función auxiliar `todayMexico`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const todayMexico = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Exige una sesión válida antes de ejecutar una operación del sistema. */
async function requireUser(request: Request) {
  return (await getLocalSession(request)).user;
}

/** Comprueba que el rol actual esté autorizado; Administrador conserva acceso total. */
function assertRole(role: string, allowed: Role[]) {
  if (role !== "ADMIN" && !allowed.includes(role as Role)) throw new Error("FORBIDDEN");
}

/** Registra en la bitácora quién realizó una acción, sobre qué entidad y con qué detalle. */
async function audit(user: typeof appUsers.$inferSelect, action: string, entityType: string, entityId: number | null, details: string, quantity?: number) {
  await getDb().insert(movements).values({ action, entityType, entityId, details, quantity, actorEmail: user.email, actorName: user.displayName, actorRole: user.role });
}

/** Aplica una corrección ortográfica única a registros anteriores y deja evidencia en la bitácora. */
async function correctStoredSpelling(db: ReturnType<typeof getDb>) {
  const [done] = await db.select({ id: movements.id }).from(movements).where(eq(movements.action, "CORRECCION_ORTOGRAFICA")).limit(1);
  if (done) return;
  const statements: BatchItem<"sqlite">[] = [
    db.update(suppliers).set({ name: sql<string>`replace(replace(replace(${suppliers.name}, 'prueva', 'prueba'), 'Prueva', 'Prueba'), 'PRUEVA', 'PRUEBA')`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(sql`lower(${suppliers.name}) LIKE '%prueva%'`),
    db.update(products).set({ name: sql<string>`replace(replace(replace(${products.name}, 'prueva', 'prueba'), 'Prueva', 'Prueba'), 'PRUEVA', 'PRUEBA')` }).where(sql`lower(${products.name}) LIKE '%prueva%'`),
    db.update(movements).set({ details: sql<string>`replace(replace(replace(${movements.details}, 'prueva', 'prueba'), 'Prueva', 'Prueba'), 'PRUEVA', 'PRUEBA')` }).where(sql`lower(${movements.details}) LIKE '%prueva%'`),
    db.insert(movements).values({ action: "CORRECCION_ORTOGRAFICA", entityType: "SISTEMA", entityId: null, details: "Se corrigió la ortografía de los registros existentes.", actorEmail: "sistema", actorName: "Sistema", actorRole: "SISTEMA" }),
  ];
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/** Convierte errores internos conocidos en respuestas HTTP y mensajes comprensibles. */
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  if (message === "FORBIDDEN") return Response.json({ error: "Tu cuenta no tiene permiso para esta acción." }, { status: 403 });
  if (message === "ACCOUNT_NOT_ASSIGNED") return Response.json({ error: "Tu usuario todavía no tiene un tipo de cuenta asignado por un administrador." }, { status: 403 });
  if (message === "ACCOUNT_DISABLED") return Response.json({ error: "Esta cuenta está desactivada." }, { status: 403 });
  if (message === "AUTH_REQUIRED") return Response.json({ error: "La sesión venció. Vuelve a ingresar al sistema." }, { status: 401 });
  if (message === "INVALID_ORIGIN") return Response.json({ error: "Solicitud no permitida." }, { status: 403 });
  if (message.includes("no such table")) return Response.json({ error: "La base de datos todavía se está preparando. Intenta de nuevo en un momento." }, { status: 503 });
  return Response.json({ error: message }, { status: 400 });
}

/** Manejador HTTP de lectura: reúne inventario, pedidos, facturas, cobros, catálogos, entregas y permisos para la interfaz. */
export async function GET(request: Request) {
  try {
    // Esta lectura compone un estado coherente para todas las vistas del panel.
    const user = await requireUser(request); const db = getDb();
    await correctStoredSpelling(db);
    const inventory = await db.select({
      id: stockLots.id, productId: products.id, code: products.code, name: products.name, lot: stockLots.lot,
      supplierId: stockLots.supplierId, supplierName: suppliers.name, expiryDate: stockLots.expiryDate,
      quantity: stockLots.quantity, netPriceCents: stockLots.netPriceCents, minimumStock: products.minimumStock, unitsPerBox: products.unitsPerBox, updatedAt: stockLots.updatedAt,
    }).from(stockLots).innerJoin(products, eq(stockLots.productId, products.id)).leftJoin(suppliers, eq(stockLots.supplierId, suppliers.id)).orderBy(asc(products.name), asc(stockLots.expiryDate));
    const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
    const items = await db.select({ id: orderItems.id, orderId: orderItems.orderId, lotId: orderItems.lotId, productId: products.id, quantity: orderItems.quantity,
      unitPriceCents: orderItems.unitPriceCents, orderedBoxes: orderItems.orderedBoxes, orderedUnits: orderItems.orderedUnits, unitsPerBox: orderItems.unitsPerBox,
      productName: products.name, productCode: products.code, lot: stockLots.lot,
    }).from(orderItems).innerJoin(stockLots, eq(orderItems.lotId, stockLots.id)).innerJoin(products, eq(stockLots.productId, products.id));
    const returnRows = await db.select().from(orderReturns).orderBy(desc(orderReturns.createdAt));
    const rescheduleRows = await db.select().from(orderReschedules).orderBy(desc(orderReschedules.createdAt));
    const reviewRows = await db.select().from(shipmentReviews).orderBy(desc(shipmentReviews.reviewedAt));
    const reviewLotRows = await db.select({
      id: shipmentReviewLots.id, reviewId: shipmentReviewLots.reviewId, orderItemId: shipmentReviewLots.orderItemId,
      lotId: shipmentReviewLots.lotId, quantity: shipmentReviewLots.quantity, lot: stockLots.lot,
      expiryDate: stockLots.expiryDate, productName: products.name, productCode: products.code,
    }).from(shipmentReviewLots).innerJoin(stockLots, eq(shipmentReviewLots.lotId, stockLots.id)).innerJoin(products, eq(stockLots.productId, products.id));
    const invoiceRows = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(500);
    const paidOrderIds = new Set(invoiceRows.filter((invoice) => invoice.status === "PAGADA" && invoice.orderId).map((invoice) => invoice.orderId));
    const orderData = orderRows.map((order) => ({
      ...order,
      status: order.status === "PENDIENTE" && paidOrderIds.has(order.id) ? "PAGADO" : order.status,
      items: items.filter((item) => item.orderId === order.id).map((item) => ({
        ...item,
        returnedQuantity: returnRows.filter((returned) => returned.orderItemId === item.id).reduce((sum, returned) => sum + returned.quantity, 0),
      })),
      returns: returnRows.filter((returned) => returned.orderId === order.id),
      reschedules: rescheduleRows.filter((reschedule) => reschedule.orderId === order.id),
      fefoReview: (() => { const review = reviewRows.find((candidate) => candidate.orderId === order.id); return review ? { ...review, allocations: reviewLotRows.filter((allocation) => allocation.reviewId === review.id) } : null; })(),
    }));
    const paymentRows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(500);
    const invoiceData = invoiceRows.map((invoice) => ({ ...invoice, payments: paymentRows.filter((payment) => payment.invoiceId === invoice.id) }));
    const driverRows = await db.select().from(drivers).orderBy(desc(drivers.active), asc(drivers.name));
    const deliveryRows = await db.select({
      id: deliveries.id, orderId: deliveries.orderId, driverId: deliveries.driverId, customer: deliveries.customer,
      invoiceNumber: deliveries.invoiceNumber, contents: deliveries.contents, deliveryDate: deliveries.deliveryDate,
      createdBy: deliveries.createdBy, createdAt: deliveries.createdAt, updatedAt: deliveries.updatedAt,
      driverName: drivers.name, orderFolio: orders.folio,
    }).from(deliveries).innerJoin(drivers, eq(deliveries.driverId, drivers.id)).leftJoin(orders, eq(deliveries.orderId, orders.id))
      .orderBy(desc(deliveries.deliveryDate), desc(deliveries.id)).limit(250);
    const movementRows = await db.select().from(movements).orderBy(desc(movements.createdAt), desc(movements.id)).limit(250);
    const users = user.role === "ADMIN" ? await db.select().from(appUsers).orderBy(asc(appUsers.role), asc(appUsers.displayName)) : [];
    const customerRows = ["ADMIN", "VENDEDOR", "CAJA", "COMPRAS"].includes(user.role) ? await db.select().from(customers).orderBy(desc(customers.active), asc(customers.name)) : [];
    const supplierRows = ["ADMIN", "COMPRAS", "CALIDAD", "CAJA"].includes(user.role) ? await db.select().from(suppliers).orderBy(desc(suppliers.active), asc(suppliers.name)) : [];
    const cashOutflowRecords = ["ADMIN", "COMPRAS", "CAJA"].includes(user.role) ? await db.select({
      id: cashOutflows.id, supplierId: cashOutflows.supplierId, beneficiary: cashOutflows.beneficiary,
      concept: cashOutflows.concept, amountCents: cashOutflows.amountCents, method: cashOutflows.method,
      reference: cashOutflows.reference, movementDate: cashOutflows.movementDate, createdBy: cashOutflows.createdBy,
      createdAt: cashOutflows.createdAt, supplierName: suppliers.name, itemsJson: cashOutflows.itemsJson, notes: cashOutflows.notes,
      requiresInvoiceValidation: cashOutflows.requiresInvoiceValidation, invoiceNumber: cashOutflows.invoiceNumber,
      validationNotes: cashOutflows.validationNotes, invoiceValidatedBy: cashOutflows.invoiceValidatedBy,
      invoiceValidatedAt: cashOutflows.invoiceValidatedAt,
    }).from(cashOutflows).leftJoin(suppliers, eq(cashOutflows.supplierId, suppliers.id))
      .orderBy(desc(cashOutflows.movementDate), desc(cashOutflows.id)).limit(500) : [];
    const cashOutflowRows = cashOutflowRecords.map(({ itemsJson, ...movement }) => {
      let items: unknown[] = [];
      try { const parsed = JSON.parse(itemsJson); if (Array.isArray(parsed)) items = parsed; } catch { items = []; }
      return { ...movement, items };
    });
    const supplierReceiptRecords = ["ADMIN", "CALIDAD"].includes(user.role) ? await db.select({
      id: cashOutflows.id, supplierId: cashOutflows.supplierId, supplierName: suppliers.name,
      reference: cashOutflows.reference, movementDate: cashOutflows.movementDate, itemsJson: cashOutflows.itemsJson,
      notes: cashOutflows.notes, invoiceNumber: cashOutflows.invoiceNumber, validationNotes: cashOutflows.validationNotes,
      invoiceValidatedBy: cashOutflows.invoiceValidatedBy, invoiceValidatedAt: cashOutflows.invoiceValidatedAt,
      createdBy: cashOutflows.createdBy, createdAt: cashOutflows.createdAt,
    }).from(cashOutflows).leftJoin(suppliers, eq(cashOutflows.supplierId, suppliers.id))
      .where(eq(cashOutflows.requiresInvoiceValidation, true))
      .orderBy(sql`${cashOutflows.invoiceValidatedAt} IS NOT NULL`, desc(cashOutflows.movementDate), desc(cashOutflows.id)).limit(500) : [];
    const supplierReceiptRows = supplierReceiptRecords.map(({ itemsJson, ...receipt }) => {
      let items: { productId: number | null; product: string; quantity: number; receivedQuantity: number | null; unit: string; lot: string; expiryDate: string; unitsPerBox: number; inventoryQuantity: number }[] = [];
      try {
        const parsed = JSON.parse(itemsJson);
        if (Array.isArray(parsed)) items = parsed.map((value) => {
          const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
          const receivedQuantity = item.receivedQuantity === null || item.receivedQuantity === undefined ? null : Number(item.receivedQuantity);
          return {
            productId: positiveInt(item.productId) || null,
            product: clean(item.product), quantity: Number(item.quantity) || 0,
            receivedQuantity: Number.isFinite(receivedQuantity) ? receivedQuantity : null,
            unit: clean(item.unit), lot: clean(item.lot), expiryDate: clean(item.expiryDate),
            unitsPerBox: positiveInt(item.unitsPerBox) || 1, inventoryQuantity: wholeNumber(item.inventoryQuantity) < 0 ? 0 : wholeNumber(item.inventoryQuantity),
          };
        }).filter((item) => item.product && item.quantity > 0);
      } catch { items = []; }
      return { ...receipt, items };
    });
    return Response.json({ currentUser: user, inventory, orders: orderData, invoices: invoiceData, deliveries: deliveryRows, drivers: driverRows, customers: customerRows, suppliers: supplierRows, cashOutflows: cashOutflowRows, supplierReceipts: supplierReceiptRows, movements: movementRows, users, roleLimits: ROLE_LIMITS });
  } catch (error) { return errorResponse(error); }
}

/** Manejador HTTP de escritura: valida el rol y dirige cada acción a su bloque transaccional correspondiente. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request); const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action); const db = getDb();

    // INVENTARIO: entradas manuales o Excel, salidas, mínimos, precios y presentación.
    if (action === "CREATE_LOT") {
      assertRole(user.role, ["CALIDAD"]);
      const selectedProductId = positiveInt(body.productId), lot = clean(body.lot), expiryDate = clean(body.expiryDate);
      const supplierId = positiveInt(body.supplierId), orderedBoxes = wholeNumber(body.boxes), orderedUnits = wholeNumber(body.units), priceProvided = clean(body.netPrice) !== ""; let netPriceCents = priceProvided ? moneyToCents(body.netPrice) : 0;
      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      let [product] = selectedProductId ? await db.select().from(products).where(eq(products.id, selectedProductId)).limit(1) : [];
      const existingProduct = Boolean(product);
      if (selectedProductId && !product) throw new Error("El producto seleccionado ya no existe.");
      if (!product) {
        const code = clean(body.code), name = clean(body.name), requestedUnitsPerBox = positiveInt(body.unitsPerBox);
        if (!code || !name || !requestedUnitsPerBox) throw new Error("Completa el código, nombre y unidades por caja del producto nuevo.");
        const [duplicateProduct] = await db.select().from(products).where(eq(products.code, code)).limit(1);
        if (duplicateProduct) throw new Error("Ese código ya está registrado. Selecciona el producto existente en la lista.");
        [product] = await db.insert(products).values({ code, name, unitsPerBox: requestedUnitsPerBox }).returning();
      }
      const quantity = product && orderedBoxes >= 0 && orderedUnits >= 0 ? orderedBoxes * product.unitsPerBox + orderedUnits : 0;
      if (!lot || !expiryDate || !quantity || orderedBoxes < 0 || orderedUnits < 0 || netPriceCents < 0 || !supplier?.active) throw new Error("Completa proveedor, lote, caducidad y una cantidad válida de cajas o unidades.");
      if (!priceProvided && existingProduct) {
        const [savedPrice] = await db.select({ netPriceCents: stockLots.netPriceCents }).from(stockLots).where(and(eq(stockLots.productId, product.id), sql`${stockLots.netPriceCents} > 0`)).orderBy(desc(stockLots.createdAt)).limit(1);
        netPriceCents = savedPrice?.netPriceCents ?? 0;
      }
      const [duplicate] = await db.select().from(stockLots).where(and(eq(stockLots.productId, product.id), eq(stockLots.lot, lot))).limit(1);
      if (duplicate) {
        const updatedQuantity = duplicate.quantity + quantity;
        await db.update(stockLots).set({ supplierId, expiryDate, quantity: updatedQuantity, netPriceCents, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(stockLots.id, duplicate.id));
        await audit(user, "ENTRADA", "LOTE", duplicate.id, `${product.name} · ${product.code} · Lote ${lot} · ${orderedBoxes} caja(s) + ${orderedUnits} unidad(es) · Proveedor: ${supplier.name}`, quantity);
        return Response.json({ ok: true, message: `Entrada agregada al lote ${lot}. Nueva existencia: ${updatedQuantity} unidades.` });
      }
      const [created] = await db.insert(stockLots).values({ productId: product.id, supplierId, lot, expiryDate, quantity, netPriceCents }).returning();
      await audit(user, "ENTRADA", "LOTE", created.id, `${product.name} · ${product.code} · Lote ${lot} · ${orderedBoxes} caja(s) + ${orderedUnits} unidad(es) · Proveedor: ${supplier.name}`, quantity);
      return Response.json({ ok: true, message: netPriceCents > 0 ? "Lote agregado al almacén." : "Lote agregado. Compras, Caja y Administración recibirán el aviso para colocar su precio." });
    }

    if (action === "IMPORT_LOTS") {
      assertRole(user.role, ["CALIDAD"]); const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
      if (!rows.length) throw new Error("El archivo no contiene filas válidas.");
      let imported = 0, skipped = 0;
      for (const value of rows) {
        const row = value as Record<string, unknown>; const code = clean(row.code), name = clean(row.name), lot = clean(row.lot), expiryDate = clean(row.expiryDate), supplierName = clean(row.supplier);
        const requestedUnitsPerBox = positiveInt(row.unitsPerBox), boxes = wholeNumber(row.boxes), looseUnits = wholeNumber(row.units), legacyQuantity = positiveInt(row.quantity), priceProvided = clean(row.netPrice) !== ""; let netPriceCents = priceProvided ? moneyToCents(row.netPrice) : 0;
        const [supplier] = supplierName ? await db.select().from(suppliers).where(sql`lower(${suppliers.name}) = ${supplierName.toLowerCase()}`).limit(1) : [];
        let [product] = await db.select().from(products).where(eq(products.code, code)).limit(1);
        const existingProduct = Boolean(product);
        const unitsPerBox = requestedUnitsPerBox || product?.unitsPerBox || 0;
        const quantity = legacyQuantity || (boxes >= 0 && looseUnits >= 0 ? boxes * unitsPerBox + looseUnits : 0);
        if (!code || !name || !lot || !expiryDate || !quantity || !unitsPerBox || netPriceCents < 0 || !supplier?.active) { skipped++; continue; }
        if (!product) [product] = await db.insert(products).values({ code, name, unitsPerBox: requestedUnitsPerBox }).returning();
        else if (product.name !== name || (requestedUnitsPerBox && product.unitsPerBox !== requestedUnitsPerBox)) {
          await db.update(products).set({ name, ...(requestedUnitsPerBox ? { unitsPerBox: requestedUnitsPerBox } : {}) }).where(eq(products.id, product.id));
        }
        if (!priceProvided && existingProduct) {
          const [savedPrice] = await db.select({ netPriceCents: stockLots.netPriceCents }).from(stockLots).where(and(eq(stockLots.productId, product.id), sql`${stockLots.netPriceCents} > 0`)).orderBy(desc(stockLots.createdAt)).limit(1);
          netPriceCents = savedPrice?.netPriceCents ?? 0;
        }
        const [duplicate] = await db.select().from(stockLots).where(and(eq(stockLots.productId, product.id), eq(stockLots.lot, lot))).limit(1);
        if (duplicate) { skipped++; continue; }
        const [created] = await db.insert(stockLots).values({ productId: product.id, supplierId: supplier.id, lot, expiryDate, quantity, netPriceCents }).returning();
        await audit(user, "ENTRADA", "LOTE", created.id, `${name} · ${code} · Lote ${lot} · ${legacyQuantity ? `${quantity} unidades` : `${boxes} caja(s) + ${looseUnits} unidad(es)`} · Proveedor: ${supplier.name} (Excel)`, quantity); imported++;
      }
      return Response.json({ ok: true, message: `${imported} lote(s) importados; ${skipped} omitidos.` });
    }

    if (action === "STOCK_EXIT") {
      assertRole(user.role, ["CAJA"]); const lotId = positiveInt(body.lotId), quantity = positiveInt(body.quantity), reason = clean(body.reason) || "Salida de almacén";
      const [row] = await db.select({ lot: stockLots, product: products }).from(stockLots).innerJoin(products, eq(stockLots.productId, products.id)).where(eq(stockLots.id, lotId)).limit(1);
      if (!row || !quantity) throw new Error("Selecciona un lote y una cantidad válida.");
      if (row.lot.quantity < quantity) throw new Error("No hay existencia suficiente en ese lote.");
      await db.update(stockLots).set({ quantity: row.lot.quantity - quantity, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(stockLots.id, lotId));
      await audit(user, "SALIDA", "LOTE", lotId, `${row.product.name} · Lote ${row.lot.lot} · ${reason}`, quantity);
      return Response.json({ ok: true, message: "Salida registrada." });
    }

    if (action === "UPDATE_MINIMUM_STOCK") {
      assertRole(user.role, ["COMPRAS"]);
      const productId = positiveInt(body.productId), minimumStock = Number(body.minimumStock);
      const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!product || !Number.isInteger(minimumStock) || minimumStock < 0) throw new Error("Indica un mínimo de inventario válido.");
      await db.update(products).set({ minimumStock }).where(eq(products.id, productId));
      await audit(user, "MINIMO_ACTUALIZADO", "PRODUCTO", product.id, `${product.name} · Mínimo: ${minimumStock}`);
      return Response.json({ ok: true, message: `Mínimo de ${product.name} actualizado a ${minimumStock}.` });
    }

    if (action === "UPDATE_PRODUCT_PRICE") {
      assertRole(user.role, ["COMPRAS", "CAJA"]);
      const productId = positiveInt(body.productId), netPriceCents = moneyToCents(body.netPrice);
      const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!product || netPriceCents <= 0) throw new Error("Indica un precio neto mayor a cero.");
      await db.update(stockLots).set({ netPriceCents, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(stockLots.productId, productId));
      await audit(user, "PRECIO_ACTUALIZADO", "PRODUCTO", product.id, `${product.name} · Precio neto: ${(netPriceCents / 100).toFixed(2)} MXN`);
      return Response.json({ ok: true, message: `Precio de ${product.name} actualizado.` });
    }

    if (action === "UPDATE_UNITS_PER_BOX") {
      assertRole(user.role, ["CALIDAD", "COMPRAS"]);
      const productId = positiveInt(body.productId), unitsPerBox = positiveInt(body.unitsPerBox);
      const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!product || !unitsPerBox) throw new Error("Indica cuántas unidades contiene cada caja.");
      await db.update(products).set({ unitsPerBox }).where(eq(products.id, productId));
      await audit(user, "PRESENTACION_ACTUALIZADA", "PRODUCTO", product.id, `${product.name} · ${unitsPerBox} unidades por caja`);
      return Response.json({ ok: true, message: `Presentación de ${product.name} actualizada.` });
    }

    // PEDIDOS: creación, edición, reprogramación, cancelación, FEFO, surtido y devoluciones.
    if (action === "CREATE_ORDER") {
      assertRole(user.role, ["VENDEDOR"]); const customerId = positiveInt(body.customerId) || null; let customer = clean(body.customer); const lotId = positiveInt(body.lotId), orderedBoxes = wholeNumber(body.boxes), orderedUnits = wholeNumber(body.units), notes = clean(body.notes), deliveryDate = clean(body.deliveryDate), deliveryZone = clean(body.deliveryZone), deliveryLocation = clean(body.deliveryLocation);
      if (user.role === "VENDEDOR") {
        const ownOrders = await db.select().from(orders).where(eq(orders.createdBy, user.email));
        if (ownOrders.some((order) => order.deliveryDate && order.deliveryDate < todayMexico() && ["PENDIENTE", "PAGADO", "REVISADO_CALIDAD"].includes(order.status))) throw new Error("Primero reprograma tus pedidos atrasados e indica el motivo antes de crear uno nuevo.");
      }
      if (customerId) { const [savedCustomer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1); if (!savedCustomer?.active) throw new Error("El cliente frecuente seleccionado no está disponible."); customer = savedCustomer.name; }
      const [lotRow] = await db.select({ lot: stockLots, product: products }).from(stockLots).innerJoin(products, eq(stockLots.productId, products.id)).where(eq(stockLots.id, lotId)).limit(1);
      const quantity = lotRow && orderedBoxes >= 0 && orderedUnits >= 0 ? orderedBoxes * lotRow.product.unitsPerBox + orderedUnits : 0;
      if (!customer || !lotRow || !quantity || orderedBoxes < 0 || orderedUnits < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || deliveryDate < todayMexico() || !DELIVERY_ZONES.includes(deliveryZone) || !deliveryLocation) throw new Error("Completa cliente, producto, cajas o unidades, una fecha vigente y la ubicación de entrega.");
      if (lotRow.lot.netPriceCents <= 0) throw new Error("Este producto todavía tiene el precio pendiente. Compras, Caja o Administración deben colocarlo antes de crear el pedido.");
      const productLots = await db.select().from(stockLots).where(eq(stockLots.productId, lotRow.product.id));
      const available = productLots.filter((lot) => lot.expiryDate >= todayMexico()).reduce((sum, lot) => sum + lot.quantity, 0);
      if (available < quantity) throw new Error(`Solo hay ${available} unidad(es) disponibles de este producto entre todos sus lotes vigentes.`);
      const folio = `PED-${Date.now().toString().slice(-8)}`;
      const [order] = await db.insert(orders).values({ folio, customerId, customer, notes, deliveryDate, deliveryZone, deliveryLocation, createdBy: user.email }).returning();
      await db.insert(orderItems).values({ orderId: order.id, lotId, quantity, unitPriceCents: lotRow.lot.netPriceCents, orderedBoxes, orderedUnits, unitsPerBox: lotRow.product.unitsPerBox });
      await audit(user, "PEDIDO_CREADO", "PEDIDO", order.id, `${folio} · ${customer} · ${lotRow.product.name} · Entrega: ${deliveryDate} · ${deliveryZone}: ${deliveryLocation}`, quantity);
      return Response.json({ ok: true, message: `Pedido ${folio} creado.` });
    }

    if (action === "UPDATE_ORDER") {
      assertRole(user.role, ["VENDEDOR", "CAJA"]);
      const orderId = positiveInt(body.orderId), customerId = positiveInt(body.customerId) || null; let customer = clean(body.customer); const lotId = positiveInt(body.lotId), orderedBoxes = wholeNumber(body.boxes), orderedUnits = wholeNumber(body.units), notes = clean(body.notes), deliveryDate = clean(body.deliveryDate), deliveryZone = clean(body.deliveryZone), deliveryLocation = clean(body.deliveryLocation);
      if (customerId) { const [savedCustomer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1); if (!savedCustomer?.active) throw new Error("El cliente frecuente seleccionado no está disponible."); customer = savedCustomer.name; }
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order || order.status !== "PENDIENTE") throw new Error("Solo se pueden modificar pedidos pendientes.");
      if (user.role === "VENDEDOR" && order.createdBy !== user.email) throw new Error("FORBIDDEN");
      const [linkedInvoice] = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
      if (linkedInvoice) throw new Error("Este pedido ya tiene una factura relacionada y no puede modificarse.");
      const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).limit(1);
      const [lotRow] = await db.select({ lot: stockLots, product: products }).from(stockLots).innerJoin(products, eq(stockLots.productId, products.id)).where(eq(stockLots.id, lotId)).limit(1);
      const quantity = lotRow && orderedBoxes >= 0 && orderedUnits >= 0 ? orderedBoxes * lotRow.product.unitsPerBox + orderedUnits : 0;
      if (!customer || !item || !lotRow || !quantity || orderedBoxes < 0 || orderedUnits < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || deliveryDate < todayMexico() || !DELIVERY_ZONES.includes(deliveryZone) || !deliveryLocation) throw new Error("Completa cliente, producto, cajas o unidades, una fecha vigente y la ubicación de entrega.");
      if (lotRow.lot.netPriceCents <= 0) throw new Error("Este producto todavía tiene el precio pendiente. Compras, Caja o Administración deben colocarlo antes de actualizar el pedido.");
      const productLots = await db.select().from(stockLots).where(eq(stockLots.productId, lotRow.product.id));
      const available = productLots.filter((lot) => lot.expiryDate >= todayMexico()).reduce((sum, lot) => sum + lot.quantity, 0);
      if (available < quantity) throw new Error(`Solo hay ${available} unidad(es) disponibles de este producto entre todos sus lotes vigentes.`);
      await db.update(orders).set({ customerId, customer, notes, deliveryDate, deliveryZone, deliveryLocation }).where(eq(orders.id, orderId));
      await db.update(orderItems).set({ lotId, quantity, unitPriceCents: lotRow.lot.netPriceCents, orderedBoxes, orderedUnits, unitsPerBox: lotRow.product.unitsPerBox }).where(eq(orderItems.id, item.id));
      await audit(user, "PEDIDO_MODIFICADO", "PEDIDO", order.id, `${order.folio} · Cliente: ${order.customer} → ${customer} · Producto: ${lotRow.product.name} · Cantidad: ${item.quantity} → ${quantity} · Entrega: ${deliveryDate} · ${deliveryZone}: ${deliveryLocation}`, quantity);
      return Response.json({ ok: true, message: `Pedido ${order.folio} actualizado.` });
    }

    if (action === "RESCHEDULE_ORDER") {
      assertRole(user.role, ["VENDEDOR"]);
      const orderId = positiveInt(body.orderId), newDate = clean(body.newDeliveryDate), reason = clean(body.reason);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order || !order.deliveryDate || !["PENDIENTE", "PAGADO", "REVISADO_CALIDAD"].includes(order.status)) throw new Error("Este pedido ya no puede reprogramarse.");
      if (user.role === "VENDEDOR" && order.createdBy !== user.email) throw new Error("FORBIDDEN");
      if (order.deliveryDate >= todayMexico()) throw new Error("El pedido todavía no está atrasado.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || newDate < todayMexico() || !reason) throw new Error("Indica una nueva fecha vigente y el motivo del atraso.");
      await db.insert(orderReschedules).values({ orderId, previousDate: order.deliveryDate, newDate, reason, createdBy: user.email });
      await db.update(orders).set({ deliveryDate: newDate }).where(eq(orders.id, orderId));
      await audit(user, "PEDIDO_REPROGRAMADO", "PEDIDO", order.id, `${order.folio} · ${order.deliveryDate} → ${newDate} · Motivo: ${reason}`);
      return Response.json({ ok: true, message: `Pedido ${order.folio} reprogramado para el ${newDate}.` });
    }

    if (action === "CANCEL_ORDER") {
      assertRole(user.role, ["VENDEDOR", "CAJA"]);
      const orderId = positiveInt(body.orderId), reason = clean(body.reason);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order || order.status !== "PENDIENTE") throw new Error("Solo se pueden cancelar pedidos pendientes.");
      if (user.role === "VENDEDOR" && order.createdBy !== user.email) throw new Error("FORBIDDEN");
      if (!reason) throw new Error("Escribe el motivo de la cancelación.");
      const [linkedInvoice] = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
      if (linkedInvoice) throw new Error("Este pedido ya tiene una factura relacionada y no puede cancelarse.");
      await db.update(orders).set({ status: "CANCELADO" }).where(eq(orders.id, orderId));
      await audit(user, "PEDIDO_CANCELADO", "PEDIDO", order.id, `${order.folio} · ${order.customer} · Motivo: ${reason}`);
      return Response.json({ ok: true, message: `Pedido ${order.folio} cancelado.` });
    }

    if (action === "REVIEW_ORDER_FEFO") {
      assertRole(user.role, ["CALIDAD"]);
      const orderId = positiveInt(body.orderId), notes = clean(body.notes);
      const rawAllocations = Array.isArray(body.allocations) ? body.allocations.slice(0, 30) : [];
      const allocations = rawAllocations.map((value) => { const row = value as Record<string, unknown>; return { orderItemId: positiveInt(row.orderItemId), lotId: positiveInt(row.lotId), quantity: positiveInt(row.quantity) }; });
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw new Error("El pedido no existe.");
      if (order.status === "PENDIENTE") {
        const [paidInvoice] = await db.select().from(invoices).where(and(eq(invoices.orderId, orderId), eq(invoices.status, "PAGADA"))).limit(1);
        if (!paidInvoice) throw new Error("Solo pueden revisarse pedidos con pago validado.");
        await db.update(orders).set({ status: "PAGADO" }).where(eq(orders.id, orderId));
      } else if (!["PAGADO", "REVISADO_CALIDAD"].includes(order.status)) throw new Error("Este pedido ya no está disponible para revisión.");
      if (!allocations.length || allocations.some((allocation) => !allocation.orderItemId || !allocation.lotId || !allocation.quantity)) throw new Error("Selecciona al menos un lote e indica las cantidades.");
      const duplicateLots = new Set<number>();
      for (const allocation of allocations) { if (duplicateLots.has(allocation.lotId)) throw new Error("Cada lote solo puede seleccionarse una vez."); duplicateLots.add(allocation.lotId); }
      const items = await db.select({ id: orderItems.id, quantity: orderItems.quantity, productId: stockLots.productId }).from(orderItems).innerJoin(stockLots, eq(orderItems.lotId, stockLots.id)).where(eq(orderItems.orderId, orderId));
      if (!items.length) throw new Error("El pedido no contiene productos para revisar.");
      const selectedLotDetails: string[] = [];
      for (const item of items) {
        const selected = allocations.filter((allocation) => allocation.orderItemId === item.id);
        if (selected.reduce((sum, allocation) => sum + allocation.quantity, 0) !== item.quantity) throw new Error(`La selección debe completar exactamente ${item.quantity} unidad(es) del producto.`);
        for (const allocation of selected) {
          const [lot] = await db.select().from(stockLots).where(eq(stockLots.id, allocation.lotId)).limit(1);
          if (!lot || lot.productId !== item.productId || lot.expiryDate < todayMexico()) throw new Error("Uno de los lotes seleccionados no corresponde al producto o ya caducó.");
          const reservations = await db.select({ quantity: shipmentReviewLots.quantity, orderId: shipmentReviews.orderId, status: orders.status }).from(shipmentReviewLots).innerJoin(shipmentReviews, eq(shipmentReviewLots.reviewId, shipmentReviews.id)).innerJoin(orders, eq(shipmentReviews.orderId, orders.id)).where(eq(shipmentReviewLots.lotId, lot.id));
          const reservedElsewhere = reservations.filter((reservation) => reservation.orderId !== orderId && reservation.status === "REVISADO_CALIDAD").reduce((sum, reservation) => sum + reservation.quantity, 0);
          const available = Math.max(0, lot.quantity - reservedElsewhere);
          if (available < allocation.quantity) throw new Error(`El lote ${lot.lot} solo tiene ${available} unidad(es) libres; el resto ya está asignado a otro pedido.`);
          selectedLotDetails.push(`Lote ${lot.lot}: ${allocation.quantity}`);
        }
      }
      if (allocations.some((allocation) => !items.some((item) => item.id === allocation.orderItemId))) throw new Error("La selección contiene un producto ajeno al pedido.");
      let [review] = await db.select().from(shipmentReviews).where(eq(shipmentReviews.orderId, orderId)).limit(1);
      if (review) {
        await db.delete(shipmentReviewLots).where(eq(shipmentReviewLots.reviewId, review.id));
        await db.update(shipmentReviews).set({ notes, reviewedBy: user.email, reviewedAt: sql`CURRENT_TIMESTAMP` }).where(eq(shipmentReviews.id, review.id));
      } else {
        [review] = await db.insert(shipmentReviews).values({ orderId, notes, reviewedBy: user.email }).returning();
      }
      await db.insert(shipmentReviewLots).values(allocations.map((allocation) => ({ ...allocation, reviewId: review.id })));
      await db.update(orders).set({ status: "REVISADO_CALIDAD" }).where(eq(orders.id, orderId));
      await audit(user, "REVISION_FEFO", "PEDIDO", order.id, `${order.folio} · ${selectedLotDetails.join(" · ")}${notes ? ` · ${notes}` : ""}`);
      return Response.json({ ok: true, message: `Revisión FEFO de ${order.folio} guardada. Caja ya puede surtirlo.` });
    }

    if (action === "DISPATCH_ORDER") {
      assertRole(user.role, ["CAJA"]); const orderId = positiveInt(body.orderId);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order || order.status !== "REVISADO_CALIDAD") throw new Error("Calidad debe completar la revisión FEFO antes de surtir el pedido.");
      const [review] = await db.select().from(shipmentReviews).where(eq(shipmentReviews.orderId, orderId)).limit(1);
      if (!review) throw new Error("No se encontró la revisión de lotes de Calidad.");
      const allocations = await db.select().from(shipmentReviewLots).where(eq(shipmentReviewLots.reviewId, review.id));
      if (!allocations.length) throw new Error("La revisión FEFO no contiene lotes.");
      for (const allocation of allocations) { const [lot] = await db.select().from(stockLots).where(eq(stockLots.id, allocation.lotId)).limit(1); if (!lot || lot.quantity < allocation.quantity) throw new Error(`El lote ${lot?.lot || allocation.lotId} ya no tiene existencia suficiente. Calidad debe actualizar la revisión.`); }
      for (const allocation of allocations) { const [lot] = await db.select().from(stockLots).where(eq(stockLots.id, allocation.lotId)).limit(1); await db.update(stockLots).set({ quantity: lot.quantity - allocation.quantity, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(stockLots.id, allocation.lotId)); }
      await db.update(orders).set({ status: "SURTIDO", completedAt: sql`CURRENT_TIMESTAMP` }).where(eq(orders.id, orderId));
      await audit(user, "PEDIDO_SURTIDO", "PEDIDO", order.id, `${order.folio} · ${order.customer} · Lotes FEFO revisados por ${review.reviewedBy}`);
      return Response.json({ ok: true, message: `Pedido ${order.folio} surtido y descontado del inventario.` });
    }

    if (action === "RETURN_ORDER") {
      assertRole(user.role, ["CAJA"]);
      const orderId = positiveInt(body.orderId), itemId = positiveInt(body.itemId), selectedLotId = positiveInt(body.lotId), quantity = positiveInt(body.quantity), reason = clean(body.reason);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order || !["SURTIDO", "DEVOLUCION_PARCIAL"].includes(order.status)) throw new Error("Este pedido no está disponible para devolución.");
      if (!quantity || !reason) throw new Error("Indica la cantidad y el motivo de la devolución.");
      const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).limit(1);
      if (!item) throw new Error("El producto del pedido no fue encontrado.");
      const lotId = selectedLotId || item.lotId;
      const [review] = await db.select().from(shipmentReviews).where(eq(shipmentReviews.orderId, orderId)).limit(1);
      const [reviewAllocation] = review ? await db.select().from(shipmentReviewLots).where(and(eq(shipmentReviewLots.reviewId, review.id), eq(shipmentReviewLots.orderItemId, item.id), eq(shipmentReviewLots.lotId, lotId))).limit(1) : [];
      if (review && !reviewAllocation) throw new Error("Selecciona uno de los lotes que Calidad autorizó para este pedido.");
      const previousReturns = await db.select().from(orderReturns).where(eq(orderReturns.orderItemId, item.id));
      const returnedForLot = previousReturns.filter((returned) => returned.lotId === lotId || (!returned.lotId && lotId === item.lotId)).reduce((sum, returned) => sum + returned.quantity, 0);
      const remaining = (reviewAllocation?.quantity ?? item.quantity) - returnedForLot;
      if (quantity > remaining) throw new Error(`Solo quedan ${remaining} unidad(es) disponibles para devolver.`);
      const [lotRow] = await db.select({ lot: stockLots, product: products }).from(stockLots).innerJoin(products, eq(stockLots.productId, products.id)).where(eq(stockLots.id, lotId)).limit(1);
      if (!lotRow) throw new Error("El lote original ya no está disponible.");
      await db.update(stockLots).set({ quantity: lotRow.lot.quantity + quantity, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(stockLots.id, lotId));
      await db.insert(orderReturns).values({ orderId, orderItemId: item.id, lotId, quantity, reason, createdBy: user.email });
      const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      let fullyReturned = true;
      for (const orderItem of allItems) {
        const [{ totalReturned }] = await db.select({ totalReturned: sql<number>`coalesce(sum(${orderReturns.quantity}), 0)` }).from(orderReturns).where(eq(orderReturns.orderItemId, orderItem.id));
        if (Number(totalReturned) < orderItem.quantity) fullyReturned = false;
      }
      const nextStatus = fullyReturned ? "DEVUELTO" : "DEVOLUCION_PARCIAL";
      await db.update(orders).set({ status: nextStatus }).where(eq(orders.id, orderId));
      await audit(user, fullyReturned ? "DEVOLUCION_TOTAL" : "DEVOLUCION_PARCIAL", "PEDIDO", order.id, `${order.folio} · ${lotRow.product.name} · Lote ${lotRow.lot.lot} · Motivo: ${reason}`, quantity);
      return Response.json({ ok: true, message: fullyReturned ? `Pedido ${order.folio} devuelto por completo.` : `${quantity} unidad(es) devueltas al lote ${lotRow.lot.lot}.` });
    }

    // FACTURACIÓN: documentos, cobros y seguimiento del envío de la factura al cliente.
    if (action === "CREATE_INVOICE") {
      assertRole(user.role, ["CAJA", "COMPRAS"]); let customerId = positiveInt(body.customerId) || null; let customer = clean(body.customer), rfc = clean(body.rfc).toUpperCase(); const kind = clean(body.kind) === "CFDI" ? "CFDI" : "INTERNA";
      if (customerId) { const [savedCustomer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1); if (!savedCustomer?.active) throw new Error("El cliente frecuente seleccionado no está disponible."); customer = savedCustomer.name; rfc = savedCustomer.rfc || rfc; }
      const amountCents = moneyToCents(body.amount), orderId = positiveInt(body.orderId) || null;
      if (orderId) {
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order || order.status !== "PENDIENTE") throw new Error("Solo se pueden facturar pedidos pendientes de pago.");
        const [existingInvoice] = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
        if (existingInvoice) throw new Error("Ese pedido ya tiene una factura relacionada.");
        customerId = order.customerId; customer = order.customer;
        if (customerId) { const [savedCustomer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1); rfc = savedCustomer?.rfc || rfc; }
      }
      if (!customer || amountCents <= 0) throw new Error("Completa cliente y monto de la factura.");
      if (kind === "CFDI" && !rfc) throw new Error("El RFC es obligatorio para CFDI.");
      const folio = `${kind === "CFDI" ? "CFDI" : "INT"}-${Date.now().toString().slice(-8)}`;
      const [invoice] = await db.insert(invoices).values({ folio, orderId, customerId, kind, customer, rfc, amountCents, status: kind === "CFDI" ? "BORRADOR_CFDI" : "EMITIDA", createdBy: user.email }).returning();
      await audit(user, "FACTURA_CREADA", "FACTURA", invoice.id, `${folio} · ${customer} · ${kind}`);
      return Response.json({ ok: true, message: kind === "CFDI" ? "Borrador CFDI creado; queda pendiente el timbrado con PAC." : "Comprobante interno creado." });
    }

    if (action === "RECORD_PAYMENT") {
      assertRole(user.role, ["CAJA", "COMPRAS"]); const invoiceId = positiveInt(body.invoiceId), amountCents = moneyToCents(body.amount), method = clean(body.method), reference = clean(body.reference);
      const paymentCondition = clean(body.paymentCondition), collectionChannel = clean(body.collectionChannel), comments = clean(body.comments);
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
      if (!invoice || amountCents <= 0 || !method || !["CONTADO", "CREDITO"].includes(paymentCondition) || !collectionChannel) throw new Error("Completa factura, monto, condición, método y canal de cobranza.");
      const [{ paid }] = await db.select({ paid: sql<number>`coalesce(sum(${payments.amountCents}), 0)` }).from(payments).where(eq(payments.invoiceId, invoiceId));
      if (Number(paid) + amountCents > invoice.amountCents) throw new Error("El cobro supera el saldo pendiente de la factura.");
      await db.insert(payments).values({ invoiceId, amountCents, method, reference, paymentCondition, collectionChannel, comments, receivedBy: user.email });
      const fullyPaid = Number(paid) + amountCents === invoice.amountCents;
      if (fullyPaid) {
        await db.update(invoices).set({ status: "PAGADA" }).where(eq(invoices.id, invoiceId));
        if (invoice.orderId) {
          const [order] = await db.select().from(orders).where(eq(orders.id, invoice.orderId)).limit(1);
          if (order?.status === "PENDIENTE") {
            await db.update(orders).set({ status: "PAGADO" }).where(eq(orders.id, order.id));
            await audit(user, "PAGO_VALIDADO", "PEDIDO", order.id, `${order.folio} · ${order.customer} · Factura ${invoice.folio}`);
          }
        }
      }
      await audit(user, "COBRO_REGISTRADO", "FACTURA", invoice.id, `${invoice.folio} · ${paymentCondition} · ${method} · ${collectionChannel}${reference ? ` · Ref. ${reference}` : ""}`);
      return Response.json({ ok: true, message: fullyPaid && invoice.orderId ? "Pago validado; el pedido ya aparece en Revisión FEFO para Calidad." : "Cobro registrado." });
    }

    if (action === "PLAN_INVOICE_SEND") {
      assertRole(user.role, ["CAJA"]);
      const invoiceId = positiveInt(body.invoiceId), scheduledSendDate = clean(body.scheduledSendDate), reason = clean(body.reason);
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
      if (!invoice || invoice.sentAt) throw new Error("Esta factura ya fue enviada o no está disponible.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledSendDate) || scheduledSendDate < todayMexico() || !reason) throw new Error("Indica una fecha vigente y el motivo por el que todavía no se ha enviado.");
      await db.update(invoices).set({ scheduledSendDate, sendDelayReason: reason }).where(eq(invoices.id, invoice.id));
      await audit(user, "ENVIO_FACTURA_PROGRAMADO", "FACTURA", invoice.id, `${invoice.folio} · ${invoice.customer} · ${scheduledSendDate} · Motivo: ${reason}`);
      return Response.json({ ok: true, message: `Envío de ${invoice.folio} programado para el ${scheduledSendDate}.` });
    }

    if (action === "MARK_INVOICE_SENT") {
      assertRole(user.role, ["CAJA"]);
      const invoiceId = positiveInt(body.invoiceId);
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
      if (!invoice || invoice.sentAt) throw new Error("Esta factura ya fue marcada como enviada.");
      await db.update(invoices).set({ sentAt: sql`CURRENT_TIMESTAMP` }).where(eq(invoices.id, invoice.id));
      await audit(user, "FACTURA_ENVIADA", "FACTURA", invoice.id, `${invoice.folio} · ${invoice.customer}`);
      return Response.json({ ok: true, message: `${invoice.folio} marcada como enviada al cliente.` });
    }

    // COMPRAS: salidas de dinero y validación posterior de mercancía por Calidad.
    if (action === "CREATE_CASH_OUTFLOW") {
      assertRole(user.role, ["CAJA", "COMPRAS"]);
      const supplierId = positiveInt(body.supplierId) || null;
      let beneficiary = clean(body.beneficiary);
      const concept = clean(body.concept), amountCents = moneyToCents(body.amount), method = clean(body.method);
      const reference = clean(body.reference), movementDate = clean(body.movementDate);
      if (supplierId) {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
        if (!supplier?.active) throw new Error("El proveedor seleccionado no está disponible.");
        beneficiary = supplier.name;
      }
      if (!beneficiary || !concept || amountCents <= 0 || !method || !/^\d{4}-\d{2}-\d{2}$/.test(movementDate)) {
        throw new Error("Completa beneficiario, concepto, monto, fecha y método.");
      }
      const [created] = await db.insert(cashOutflows).values({ supplierId, beneficiary, concept, amountCents, method, reference, movementDate, createdBy: user.email }).returning();
      await audit(user, "SALIDA_DINERO", "FLUJO_CAJA", created.id, `${beneficiary} · ${concept} · ${method}${reference ? ` · Ref. ${reference}` : ""}`);
      return Response.json({ ok: true, message: "Salida de dinero registrada." });
    }

    if (action === "CREATE_CASH_OUTFLOW_BATCH") {
      assertRole(user.role, ["CAJA", "COMPRAS"]);
      const supplierId = positiveInt(body.supplierId), movementDate = clean(body.movementDate), method = clean(body.method);
      const notes = clean(body.notes);
      const allowedMethods = new Set(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]);
      const allowedUnits = new Set(["CAJA", "UNIDAD", "KG", "SERVICIO", "OTRO"]);
      const rawItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (!supplier?.active) throw new Error("Selecciona un proveedor activo.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(movementDate) || !allowedMethods.has(method)) {
        throw new Error("Completa la fecha y el método de pago.");
      }
      if (!rawItems.length) throw new Error("Agrega por lo menos un producto al pedido.");
      const items = rawItems.map((value) => {
        const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
        const productId = positiveInt(item.productId) || null;
        const product = clean(item.product), quantity = Number(item.quantity), unit = clean(item.unit);
        const unitPriceCents = moneyToCents(item.unitPrice);
        if (product.length < 2 || !Number.isFinite(quantity) || quantity <= 0 || !allowedUnits.has(unit) || unitPriceCents < 0) {
          throw new Error("Revisa que cada producto tenga nombre, cantidad, unidad y precio válidos.");
        }
        return { productId, product, quantity, unit, unitPriceCents, subtotalCents: Math.round(quantity * unitPriceCents) };
      });
      const amountCents = items.reduce((sum, item) => sum + item.subtotalCents, 0);
      if (amountCents <= 0) throw new Error("El total de la salida debe ser mayor a cero.");
      const reference = `OC-${movementDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const concept = `Pedido ${reference} · ${items.length} producto(s)`;
      const [created] = await db.insert(cashOutflows).values({
        supplierId, beneficiary: supplier.name, concept, amountCents, method, reference, movementDate,
        itemsJson: JSON.stringify(items), notes, requiresInvoiceValidation: true, createdBy: user.email,
      }).returning();
      await audit(user, "SALIDA_DINERO", "FLUJO_CAJA", created.id, `${supplier.name} · Pedido ${reference} · ${items.length} producto(s) · ${method} · Total ${amountCents / 100} MXN · Factura pendiente de Calidad`);
      return Response.json({ ok: true, message: `Pedido ${reference} registrado. Calidad ya tiene pendiente validar la factura.` });
    }

    if (action === "VALIDATE_SUPPLIER_RECEIPT") {
      assertRole(user.role, ["CALIDAD"]);
      const cashOutflowId = positiveInt(body.cashOutflowId), invoiceNumber = clean(body.invoiceNumber).toUpperCase();
      const validationNotes = clean(body.validationNotes);
      if (body.receivedConfirmed !== true) throw new Error("Confirma que revisaste las cantidades, lotes, caducidades y factura.");
      if (invoiceNumber.length < 3 || invoiceNumber.length > 80) throw new Error("Escribe un código o folio de factura válido.");
      const [receipt] = await db.select().from(cashOutflows).where(eq(cashOutflows.id, cashOutflowId)).limit(1);
      if (!receipt?.requiresInvoiceValidation) throw new Error("Esta salida no requiere validación de factura.");
      if (receipt.invoiceValidatedAt) throw new Error("Esta recepción ya fue validada por Calidad.");
      let orderedItems: Record<string, unknown>[] = [];
      try {
        const parsed = JSON.parse(receipt.itemsJson);
        if (Array.isArray(parsed)) orderedItems = parsed.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
      } catch { orderedItems = []; }
      const receivedItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
      if (!orderedItems.length || receivedItems.length !== orderedItems.length) throw new Error("La recepción no coincide con los productos del pedido original.");
      const [duplicate] = await db.select({ id: cashOutflows.id }).from(cashOutflows).where(and(
        receipt.supplierId ? eq(cashOutflows.supplierId, receipt.supplierId) : sql`${cashOutflows.supplierId} IS NULL`,
        ne(cashOutflows.id, receipt.id),
        or(eq(cashOutflows.invoiceNumber, invoiceNumber), and(eq(cashOutflows.requiresInvoiceValidation, false), eq(cashOutflows.reference, invoiceNumber))),
      )).limit(1);
      if (duplicate) throw new Error("Ese código de factura ya está registrado para el mismo proveedor.");
      const normalizedItems: Record<string, unknown>[] = [];
      const stockPlans = new Map<string, { productId: number; productName: string; productCode: string; lot: string; expiryDate: string; quantity: number; netPriceCents: number; existingId: number | null; existingQuantity: number }>();
      for (let index = 0; index < orderedItems.length; index++) {
        const ordered = orderedItems[index];
        const receivedValue = receivedItems[index] && typeof receivedItems[index] === "object" ? receivedItems[index] as Record<string, unknown> : {};
        if (wholeNumber(receivedValue.index) !== index) throw new Error("El orden de los productos recibidos no coincide con el pedido.");
        const productName = clean(ordered.product), orderedQuantity = Number(ordered.quantity), unit = clean(ordered.unit);
        const receivedQuantity = Number(receivedValue.receivedQuantity);
        if (!productName || !Number.isFinite(orderedQuantity) || orderedQuantity <= 0 || !Number.isFinite(receivedQuantity) || receivedQuantity < 0) throw new Error(`Revisa la cantidad recibida de ${productName || "uno de los productos"}.`);
        const shouldEnterInventory = !["SERVICIO", "OTRO"].includes(unit) && receivedQuantity > 0;
        const productId = positiveInt(receivedValue.productId) || positiveInt(ordered.productId) || null;
        const lot = shouldEnterInventory ? clean(receivedValue.lot).toUpperCase() : "";
        const expiryDate = shouldEnterInventory ? clean(receivedValue.expiryDate) : "";
        let unitsPerBox = 1, inventoryQuantity = 0;
        if (shouldEnterInventory) {
          if (!productId) throw new Error(`Relaciona ${productName} con un producto del inventario.`);
          const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
          if (!product) throw new Error(`El producto de inventario relacionado con ${productName} ya no existe.`);
          unitsPerBox = product.unitsPerBox;
          inventoryQuantity = unit === "CAJA" ? receivedQuantity * unitsPerBox : receivedQuantity;
          if (!Number.isInteger(inventoryQuantity) || inventoryQuantity <= 0) throw new Error(`La cantidad de ${productName} debe convertirse en unidades enteras para ingresar al inventario.`);
          if (!lot || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) throw new Error(`Completa el lote y la caducidad de ${productName}.`);
          const [existingLot] = await db.select().from(stockLots).where(and(eq(stockLots.productId, product.id), eq(stockLots.lot, lot))).limit(1);
          if (existingLot && existingLot.expiryDate !== expiryDate) throw new Error(`El lote ${lot} ya existe con una caducidad diferente.`);
          const [savedPrice] = await db.select({ netPriceCents: stockLots.netPriceCents }).from(stockLots).where(and(eq(stockLots.productId, product.id), sql`${stockLots.netPriceCents} > 0`)).orderBy(desc(stockLots.createdAt)).limit(1);
          const planKey = `${product.id}:${lot}`;
          const previousPlan = stockPlans.get(planKey);
          if (previousPlan) previousPlan.quantity += inventoryQuantity;
          else stockPlans.set(planKey, {
            productId: product.id, productName: product.name, productCode: product.code, lot, expiryDate,
            quantity: inventoryQuantity, netPriceCents: existingLot?.netPriceCents || savedPrice?.netPriceCents || 0,
            existingId: existingLot?.id || null, existingQuantity: existingLot?.quantity || 0,
          });
        }
        normalizedItems.push({
          ...ordered, productId, product: productName, quantity: orderedQuantity, receivedQuantity, unit,
          lot, expiryDate, unitsPerBox, inventoryQuantity,
        });
      }
      const statements: BatchItem<"sqlite">[] = [];
      for (const plan of stockPlans.values()) {
        if (plan.existingId) statements.push(db.update(stockLots).set({ supplierId: receipt.supplierId, quantity: plan.existingQuantity + plan.quantity, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(stockLots.id, plan.existingId)));
        else statements.push(db.insert(stockLots).values({ productId: plan.productId, supplierId: receipt.supplierId, lot: plan.lot, expiryDate: plan.expiryDate, quantity: plan.quantity, netPriceCents: plan.netPriceCents }));
      }
      statements.push(db.update(cashOutflows).set({
        itemsJson: JSON.stringify(normalizedItems), invoiceNumber, validationNotes,
        invoiceValidatedBy: user.email, invoiceValidatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(cashOutflows.id, receipt.id)));
      await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
      const inventoryAdded = [...stockPlans.values()].reduce((sum, plan) => sum + plan.quantity, 0);
      const receivedSummary = normalizedItems.map((item) => `${clean(item.product)}: ${Number(item.receivedQuantity)} de ${Number(item.quantity)} ${clean(item.unit).toLowerCase()}`).join(" · ");
      await audit(user, "ENTRADA_PROVEEDOR_VALIDADA", "COMPRA_PROVEEDOR", receipt.id, `${receipt.beneficiary} · Pedido ${receipt.reference} · Factura ${invoiceNumber} · ${receivedSummary}${validationNotes ? ` · ${validationNotes}` : ""}`, inventoryAdded || undefined);
      return Response.json({ ok: true, message: inventoryAdded ? `Entrada validada. Se agregaron ${inventoryAdded} unidades al inventario.` : `Entrada validada con la factura ${invoiceNumber}.` });
    }

    // CATÁLOGOS Y LOGÍSTICA: clientes, proveedores, choferes y entregas.
    if (action === "CREATE_CUSTOMER" || action === "UPDATE_CUSTOMER") {
      assertRole(user.role, ["VENDEDOR", "CAJA", "COMPRAS"]);
      const customerId = positiveInt(body.customerId), name = clean(body.name), rfc = clean(body.rfc).toUpperCase();
      const phone = clean(body.phone), email = clean(body.email).toLowerCase(), address = clean(body.address);
      if (name.length < 2) throw new Error("Escribe el nombre o razón social del cliente.");
      if (email && !email.includes("@")) throw new Error("Escribe un correo válido o déjalo vacío.");
      const [duplicate] = await db.select().from(customers).where(sql`lower(${customers.name}) = ${name.toLowerCase()}`).limit(1);
      if (duplicate && duplicate.id !== customerId) throw new Error("Ese cliente ya está registrado.");
      if (action === "CREATE_CUSTOMER") {
        const [created] = await db.insert(customers).values({ name, rfc, phone, email, address }).returning();
        await audit(user, "CLIENTE_AGREGADO", "CLIENTE", created.id, `${name}${rfc ? ` · RFC ${rfc}` : ""}`);
        return Response.json({ ok: true, message: `${name} agregado a clientes frecuentes.` });
      }
      const [existing] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!existing) throw new Error("Cliente no encontrado.");
      await db.update(customers).set({ name, rfc, phone, email, address, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(customers.id, customerId));
      await audit(user, "CLIENTE_MODIFICADO", "CLIENTE", existing.id, `${existing.name} → ${name}${rfc ? ` · RFC ${rfc}` : ""}`);
      return Response.json({ ok: true, message: "Datos del cliente actualizados." });
    }

    if (action === "TOGGLE_CUSTOMER") {
      assertRole(user.role, []); const customerId = positiveInt(body.customerId);
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!customer) throw new Error("Cliente no encontrado.");
      await db.update(customers).set({ active: !customer.active, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(customers.id, customerId));
      await audit(user, customer.active ? "CLIENTE_DESACTIVADO" : "CLIENTE_REACTIVADO", "CLIENTE", customer.id, customer.name);
      return Response.json({ ok: true, message: customer.active ? `${customer.name} fue retirado de la lista activa.` : `${customer.name} volvió a quedar activo.` });
    }

    if (action === "CREATE_SUPPLIER" || action === "UPDATE_SUPPLIER") {
      assertRole(user.role, ["COMPRAS"]);
      const supplierId = positiveInt(body.supplierId), name = clean(body.name), rfc = clean(body.rfc).toUpperCase();
      const contactName = clean(body.contactName), phone = clean(body.phone), email = clean(body.email).toLowerCase();
      if (name.length < 2) throw new Error("Escribe el nombre o razón social del proveedor.");
      if (email && !email.includes("@")) throw new Error("Escribe un correo válido o déjalo vacío.");
      const [duplicate] = await db.select().from(suppliers).where(sql`lower(${suppliers.name}) = ${name.toLowerCase()}`).limit(1);
      if (duplicate && duplicate.id !== supplierId) throw new Error("Ese proveedor ya está registrado.");
      if (action === "CREATE_SUPPLIER") {
        const [created] = await db.insert(suppliers).values({ name, rfc, contactName, phone, email }).returning();
        await audit(user, "PROVEEDOR_AGREGADO", "PROVEEDOR", created.id, `${name}${rfc ? ` · RFC ${rfc}` : ""}`);
        return Response.json({ ok: true, message: `${name} agregado a proveedores.` });
      }
      const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (!existing) throw new Error("Proveedor no encontrado.");
      await db.update(suppliers).set({ name, rfc, contactName, phone, email, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(suppliers.id, supplierId));
      await audit(user, "PROVEEDOR_MODIFICADO", "PROVEEDOR", existing.id, `${existing.name} → ${name}${rfc ? ` · RFC ${rfc}` : ""}`);
      return Response.json({ ok: true, message: "Datos del proveedor actualizados." });
    }

    if (action === "TOGGLE_SUPPLIER") {
      assertRole(user.role, ["COMPRAS"]); const supplierId = positiveInt(body.supplierId);
      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (!supplier) throw new Error("Proveedor no encontrado.");
      await db.update(suppliers).set({ active: !supplier.active, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(suppliers.id, supplierId));
      await audit(user, supplier.active ? "PROVEEDOR_DESACTIVADO" : "PROVEEDOR_REACTIVADO", "PROVEEDOR", supplier.id, supplier.name);
      return Response.json({ ok: true, message: supplier.active ? `${supplier.name} fue retirado de la lista activa.` : `${supplier.name} volvió a quedar activo.` });
    }

    if (action === "CREATE_DRIVER") {
      assertRole(user.role, []); const name = clean(body.name);
      if (name.length < 3) throw new Error("Escribe el nombre completo del chofer.");
      const [duplicate] = await db.select().from(drivers).where(sql`lower(${drivers.name}) = ${name.toLowerCase()}`).limit(1);
      if (duplicate) throw new Error("Ese chofer ya está registrado.");
      const [created] = await db.insert(drivers).values({ name }).returning();
      await audit(user, "CHOFER_AGREGADO", "CHOFER", created.id, name);
      return Response.json({ ok: true, message: `${name} agregado a la lista de choferes.` });
    }

    if (action === "TOGGLE_DRIVER") {
      assertRole(user.role, []); const driverId = positiveInt(body.driverId);
      const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
      if (!driver) throw new Error("Chofer no encontrado.");
      await db.update(drivers).set({ active: !driver.active }).where(eq(drivers.id, driverId));
      await audit(user, driver.active ? "CHOFER_RETIRADO" : "CHOFER_REACTIVADO", "CHOFER", driver.id, driver.name);
      return Response.json({ ok: true, message: driver.active ? `${driver.name} fue retirado de la lista activa.` : `${driver.name} volvió a quedar activo.` });
    }

    if (action === "CREATE_DELIVERY" || action === "UPDATE_DELIVERY") {
      assertRole(user.role, ["CAJA"]);
      const deliveryId = positiveInt(body.deliveryId), driverId = positiveInt(body.driverId), orderId = positiveInt(body.orderId) || null;
      const customer = clean(body.customer), invoiceNumber = clean(body.invoiceNumber), contents = clean(body.contents), deliveryDate = clean(body.deliveryDate);
      if (!driverId || !customer || !invoiceNumber || !contents || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) throw new Error("Completa chofer, fecha, factura, cliente y productos enviados.");
      const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
      if (!driver) throw new Error("El chofer seleccionado no existe.");
      let linkedOrder: typeof orders.$inferSelect | undefined;
      if (orderId) { [linkedOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1); if (!linkedOrder) throw new Error("El pedido relacionado no existe."); }
      if (action === "CREATE_DELIVERY") {
        if (!driver.active) throw new Error("Selecciona un chofer activo.");
        if (linkedOrder && !["SURTIDO", "DEVOLUCION_PARCIAL"].includes(linkedOrder.status)) throw new Error("El pedido debe estar pagado y surtido antes de registrar su salida.");
        const [created] = await db.insert(deliveries).values({ orderId, driverId, customer, invoiceNumber, contents, deliveryDate, createdBy: user.email }).returning();
        await audit(user, "ENTREGA_REGISTRADA", "ENTREGA", created.id, `${invoiceNumber} · ${customer} · Chofer: ${driver.name} · ${contents}`);
        return Response.json({ ok: true, message: `Entrega de la factura ${invoiceNumber} registrada.` });
      }
      const [existing] = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1);
      if (!existing) throw new Error("Entrega no encontrada.");
      if (!driver.active && existing.driverId !== driver.id) throw new Error("Selecciona un chofer activo.");
      await db.update(deliveries).set({ orderId, driverId, customer, invoiceNumber, contents, deliveryDate, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(deliveries.id, deliveryId));
      await audit(user, "ENTREGA_MODIFICADA", "ENTREGA", existing.id, `${invoiceNumber} · ${customer} · Chofer: ${driver.name} · ${contents}`);
      return Response.json({ ok: true, message: `Entrega de la factura ${invoiceNumber} actualizada.` });
    }

    // CUENTAS: altas, activación, contraseñas temporales y eliminación administrativa.
    if (action === "CREATE_USER") {
      assertRole(user.role, []);
      const username = normalizeUsername(body.username), displayName = clean(body.displayName), role = clean(body.role) as Role, password = String(body.password ?? "");
      if (!validUsername(username) || !displayName || !(role in ROLE_LIMITS)) throw new Error("Completa nombre, usuario y tipo de cuenta válidos. El usuario admite letras minúsculas, números, punto, guion y guion bajo.");
      if (!validPassword(password)) throw new Error("La contraseña temporal debe tener al menos 7 caracteres, con letras y números.");
      const [legacy] = await db.select().from(appUsers).where(and(eq(appUsers.role, role), eq(appUsers.displayName, displayName), sql`${appUsers.authUserId} IS NULL`)).limit(1);
      if (!legacy) {
        const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(appUsers).where(and(eq(appUsers.role, role), eq(appUsers.active, true), sql`${appUsers.authUserId} IS NOT NULL`));
        if (Number(total) >= ROLE_LIMITS[role]) throw new Error(`Ya se alcanzó el límite de cuentas para ${role.toLowerCase()}.`);
      }
      const remote = await callAccountAdmin(request, { action: "CREATE_ACCOUNT", username, displayName, role, password });
      if (!remote.authUserId) throw new Error("No fue posible vincular la cuenta.");
      let created: typeof appUsers.$inferSelect;
      try {
        if (legacy) {
          [created] = await db.update(appUsers).set({ email: username, username, authUserId: remote.authUserId, displayName, role, active: true }).where(eq(appUsers.id, legacy.id)).returning();
        } else {
          [created] = await db.insert(appUsers).values({ email: username, username, authUserId: remote.authUserId, displayName, role }).returning();
        }
      } catch (error) {
        await callAccountAdmin(request, { action: "DELETE_ACCOUNT", authUserId: remote.authUserId }).catch(() => undefined);
        throw error;
      }
      await audit(user, "USUARIO_CREADO", "USUARIO", created.id, `${displayName} · ${username} · ${role}`);
      return Response.json({ ok: true, message: "Cuenta creada. La persona deberá cambiar la contraseña temporal al ingresar." });
    }

    if (action === "TOGGLE_USER") {
      assertRole(user.role, []); const userId = positiveInt(body.userId); const [target] = await db.select().from(appUsers).where(eq(appUsers.id, userId)).limit(1);
      if (!target) throw new Error("Cuenta no encontrada."); if (target.email === user.email) throw new Error("No puedes desactivar tu propia cuenta.");
      if (!target.authUserId) throw new Error("Esta cuenta anterior todavía no tiene un acceso por usuario configurado.");
      const remote = await callAccountAdmin(request, { action: "TOGGLE_ACCOUNT", authUserId: target.authUserId });
      await db.update(appUsers).set({ active: remote.active ?? !target.active }).where(eq(appUsers.id, userId));
      await audit(user, target.active ? "USUARIO_DESACTIVADO" : "USUARIO_ACTIVADO", "USUARIO", target.id, `${target.displayName} · ${target.email}`);
      return Response.json({ ok: true, message: target.active ? "Cuenta desactivada." : "Cuenta activada." });
    }

    if (action === "RESET_USER_PASSWORD") {
      assertRole(user.role, []); const userId = positiveInt(body.userId), password = String(body.password ?? "");
      const [target] = await db.select().from(appUsers).where(eq(appUsers.id, userId)).limit(1);
      if (!target?.authUserId) throw new Error("Cuenta no encontrada o pendiente de actualizar.");
      if (target.id === user.id) throw new Error("Cambia tu propia contraseña desde el acceso personal.");
      if (!validPassword(password)) throw new Error("La contraseña temporal debe tener al menos 7 caracteres, con letras y números.");
      await callAccountAdmin(request, { action: "RESET_PASSWORD", authUserId: target.authUserId, password });
      await audit(user, "CONTRASENA_RESTABLECIDA", "USUARIO", target.id, `${target.displayName} · ${target.username || target.email}`);
      return Response.json({ ok: true, message: "Contraseña temporal actualizada." });
    }

    if (action === "DELETE_USER") {
      assertRole(user.role, []); const userId = positiveInt(body.userId); const [target] = await db.select().from(appUsers).where(eq(appUsers.id, userId)).limit(1);
      if (!target) throw new Error("Cuenta no encontrada."); if (target.id === user.id) throw new Error("No puedes eliminar tu propia cuenta.");
      if (target.role === "ADMIN") { const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(appUsers).where(eq(appUsers.role, "ADMIN")); if (Number(total) <= 1) throw new Error("No se puede eliminar la última cuenta de Administrador."); }
      if (target.authUserId) await callAccountAdmin(request, { action: "DELETE_ACCOUNT", authUserId: target.authUserId });
      await db.delete(appUsers).where(eq(appUsers.id, userId));
      await audit(user, "USUARIO_ELIMINADO", "USUARIO", target.id, `${target.displayName} · ${target.email} · ${target.role}`);
      return Response.json({ ok: true, message: "Cuenta eliminada del sistema." });
    }
    throw new Error("Acción no reconocida.");
  } catch (error) { return errorResponse(error); }
}
