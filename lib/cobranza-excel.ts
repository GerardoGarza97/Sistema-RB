/**
 * @file Genera y descarga el archivo Excel del historial de facturas y cobros.
 *
 * Este respaldo añade comentarios; la lógica ejecutable permanece sin cambios.
 */
export type CollectionHistoryRow = {
  id: string;
  collectionDate: string;
  customerCode: string;
  customerName: string;
  documentType: "Factura" | "Remisión";
  documentNumber: string;
  amountCents: number;
  paymentCondition: string;
  paymentMethod: string;
  collectionChannel: string;
  comments: string;
};

const BLUE = "0B5068";
const LIGHT_BLUE = "C6E9F4";
const BORDER_BLUE = "2B7086";
const TEXT = "173346";
const WHITE = "FFFFFF";

/** Función auxiliar `excelDate`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const excelDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);

/** Función auxiliar `longDate`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const longDate = (value: string) => new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(excelDate(value));

/** Función auxiliar `rangeLabel`; encapsula esta operación para mantener el módulo pequeño y reutilizable. */
const rangeLabel = (dateFrom: string, dateTo: string) => dateFrom === dateTo
  ? longDate(dateFrom)
  : `${longDate(dateFrom)} al ${longDate(dateTo)}`;

/** Construye en memoria el libro Excel con movimientos, totales y desgloses. */
export async function createCollectionHistoryWorkbook(rows: CollectionHistoryRow[], dateFrom: string, dateTo: string) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Alimentos Congelados Reyes Barreda";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Cobranza", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
    },
  });
  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [
    { width: 22 }, { width: 16 }, { width: 17 }, { width: 28 }, { width: 19 }, { width: 20 },
    { width: 17 }, { width: 18 }, { width: 19 }, { width: 22 }, { width: 42 },
  ];

  sheet.getCell("A1").value = "Fecha de la cobranza";
  sheet.getCell("A1").font = { name: "Aptos", size: 11, bold: true, color: { argb: TEXT } };
  sheet.getCell("A1").alignment = { horizontal: "right", vertical: "middle" };
  sheet.mergeCells("B1:K1");
  sheet.getCell("B1").value = rangeLabel(dateFrom, dateTo);
  sheet.getCell("B1").font = { name: "Aptos", size: 11, color: { argb: "111111" } };
  sheet.getCell("B1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("B1").border = { bottom: { style: "thin", color: { argb: "111111" } } };
  sheet.getRow(1).height = 27;

  const headers = [
    "Movimiento", "Fecha de cobranza", "Clave del cliente", "Nombre del cliente", "Tipo de documento", "Documento pagado",
    "Monto pagado", "Contado/crédito", "Método de pago", "Canal de cobranza", "Comentarios",
  ];
  const headerRow = sheet.getRow(3);
  headerRow.values = headers;
  headerRow.height = 36;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_BLUE } },
      bottom: { style: "thin", color: { argb: BORDER_BLUE } },
    };
  });

  const orderedRows = [...rows].sort((a, b) => a.collectionDate.localeCompare(b.collectionDate) || a.documentNumber.localeCompare(b.documentNumber));
  orderedRows.forEach((record, index) => {
    const row = sheet.getRow(index + 4);
    row.values = [
      index + 1,
      excelDate(record.collectionDate),
      record.customerCode,
      record.customerName,
      record.documentType,
      record.documentNumber,
      record.amountCents / 100,
      record.paymentCondition,
      record.paymentMethod,
      record.collectionChannel,
      record.comments,
    ];
    row.height = 24;
    row.eachCell((cell, column) => {
      cell.font = { name: "Aptos", size: 10, color: { argb: TEXT } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? LIGHT_BLUE : WHITE } };
      cell.alignment = { horizontal: column === 4 || column === 11 ? "left" : column === 7 ? "right" : "center", vertical: "middle", wrapText: column === 11 };
      cell.border = { bottom: { style: "hair", color: { argb: "9CC8D6" } } };
    });
    row.getCell(2).numFmt = "dd-mmm-yyyy";
    row.getCell(7).numFmt = '"$"#,##0.00';
  });

  const firstDataRow = 4;
  const lastDataRow = orderedRows.length + 3;
  sheet.autoFilter = { from: "A3", to: `K${lastDataRow}` };

  const totalRowNumber = lastDataRow + 3;
  sheet.getCell(`F${totalRowNumber}`).value = "Total recibido";
  sheet.getCell(`F${totalRowNumber}`).font = { name: "Aptos", size: 11, bold: true, color: { argb: TEXT } };
  sheet.getCell(`G${totalRowNumber}`).value = { formula: `SUM(G${firstDataRow}:G${lastDataRow})` };
  sheet.getCell(`G${totalRowNumber}`).numFmt = '"$"#,##0.00';
  sheet.getCell(`G${totalRowNumber}`).font = { name: "Aptos", size: 11, bold: true, color: { argb: TEXT } };
  sheet.getCell(`G${totalRowNumber}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EAF4F8" } };
  sheet.getCell(`G${totalRowNumber}`).border = { bottom: { style: "double", color: { argb: BLUE } } };

  const summaryTitleRow = totalRowNumber + 2;
  sheet.mergeCells(`A${summaryTitleRow}:D${summaryTitleRow}`);
  sheet.getCell(`A${summaryTitleRow}`).value = "Desglose de cobranza";
  sheet.getCell(`A${summaryTitleRow}`).font = { name: "Aptos", size: 11, bold: true, color: { argb: TEXT } };

  const summaryHeaderRow = summaryTitleRow + 1;
  ["Método de pago", "Factura", "Remisión", "Total"].forEach((value, index) => {
    const cell = sheet.getCell(summaryHeaderRow, index + 1);
    cell.value = value;
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const methods = ["Efectivo", "Transferencia", "Tarjeta", "Cheque", "Otro", "Sin especificar"];
  methods.forEach((method, index) => {
    const rowNumber = summaryHeaderRow + index + 1;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = method;
    row.getCell(2).value = { formula: `SUMIFS($G$${firstDataRow}:$G$${lastDataRow},$I$${firstDataRow}:$I$${lastDataRow},$A${rowNumber},$E$${firstDataRow}:$E$${lastDataRow},B$${summaryHeaderRow})` };
    row.getCell(3).value = { formula: `SUMIFS($G$${firstDataRow}:$G$${lastDataRow},$I$${firstDataRow}:$I$${lastDataRow},$A${rowNumber},$E$${firstDataRow}:$E$${lastDataRow},C$${summaryHeaderRow})` };
    row.getCell(4).value = { formula: `SUM(B${rowNumber}:C${rowNumber})` };
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = { name: "Aptos", size: 10, color: { argb: TEXT }, bold: column === 1 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? LIGHT_BLUE : WHITE } };
      cell.alignment = { horizontal: column === 1 ? "left" : "right", vertical: "middle" };
      cell.border = { bottom: { style: "hair", color: { argb: "9CC8D6" } } };
      if (column > 1) cell.numFmt = '"$"#,##0.00';
    });
  });

  const summaryEndRow = summaryHeaderRow + methods.length;
  sheet.pageSetup.printArea = `A1:K${summaryEndRow}`;
  sheet.headerFooter.oddFooter = "Alimentos Congelados Reyes Barreda · Historial de facturas y cobros";

  return workbook;
}

/** Genera el libro y dispara su descarga desde el navegador. */
export async function downloadCollectionHistoryExcel(rows: CollectionHistoryRow[], dateFrom: string, dateTo: string) {
  const workbook = await createCollectionHistoryWorkbook(rows, dateFrom, dateTo);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `historial-facturas-cobros-${dateFrom}-a-${dateTo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
