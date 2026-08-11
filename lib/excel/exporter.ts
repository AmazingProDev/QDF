import { qualificationResponsibility, qualificationStatus } from "@/lib/analysis/qualification";
import { BANDS, type Band, type SectorImpactResult, type SectorSnapshot, type Settings } from "@/lib/types/telecom";

type ImpactHeader = { label: string; value: (result: SectorImpactResult) => string | number | undefined; numberFormat?: string; width?: number };
const bandHeaders = (band: Band): ImpactHeader[] => [
  { label: `${band} DL Avant`, value: (result) => result.bandResults[band].throughputBefore, numberFormat: "0.000000" },
  { label: `${band} DL Après`, value: (result) => result.bandResults[band].throughputAfter, numberFormat: "0.000000" },
  { label: `Gain DL ${band} %`, value: (result) => result.bandResults[band].throughputGain, numberFormat: "0.0%" },
  { label: `${band} PRB Avant`, value: (result) => result.bandResults[band].prbBefore, numberFormat: "0.000000" },
  { label: `${band} PRB Après`, value: (result) => result.bandResults[band].prbAfter, numberFormat: "0.000000" },
  { label: `Soulagement PRB ${band} pts`, value: (result) => result.bandResults[band].prbRelief, numberFormat: "0.000000" },
];
const impactHeaders: ImpactHeader[] = [
  { label: "Dégradation initiale", value: (result) => result.before.degradedBands.join("+") },
  { label: "Dégradation après", value: (result) => result.after.degradedBands.join("+") },
  { label: "Bandes chargées initiales", value: (result) => result.before.chargedBands.join("+") },
  { label: "Gap DL Avant", value: (result) => result.gapDlBefore, numberFormat: "0.000000" },
  { label: "Gap DL Après", value: (result) => result.gapDlAfter, numberFormat: "0.000000" },
  { label: "TRD Débit", value: (result) => result.trdThroughput, numberFormat: "0.0%" },
  { label: "Gap PRB Avant", value: (result) => result.gapPrbBefore, numberFormat: "0.000000" },
  { label: "Gap PRB Après", value: (result) => result.gapPrbAfter, numberFormat: "0.000000" },
  { label: "TRD PRB", value: (result) => result.trdPrb, numberFormat: "0.0%" },
  { label: "IEA Action", value: (result) => result.iea, numberFormat: "0.0%" },
  { label: "Statut Action", value: (result) => result.actionEffectiveness, width: 28 },
  { label: "Statut Dégradation", value: (result) => result.degradationStatus, width: 24 },
  { label: "Conclusion", value: (result) => result.conclusion, width: 44 },
  { label: "Evolution bande dégradée", value: (result) => result.bandMigration, width: 28 },
  ...BANDS.flatMap(bandHeaders),
];
type SummaryRow = { responsibility: string; actions: number; normalized: number; compromised: number; completed: number; persistent: number };

const name = (date: Date) => `Qualification_finale_avec_impact_${date.toISOString().slice(0, 10).replaceAll("-", "")}.xlsx`;
const cellText = (value: unknown) => value && typeof value === "object" && "text" in value ? String((value as { text: unknown }).text ?? "") : String(value ?? "");
const normalized = (value: unknown) => cellText(value).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
const headerStyle = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF12355B" } };
const whiteBold = { bold: true, color: { argb: "FFFFFFFF" } };
const border = { top: { style: "thin" as const, color: { argb: "FF25384B" } }, left: { style: "thin" as const, color: { argb: "FF25384B" } }, bottom: { style: "thin" as const, color: { argb: "FF25384B" } }, right: { style: "thin" as const, color: { argb: "FF25384B" } } };

function findAnalyse(workbook: import("exceljs").Workbook) {
  const sheet = workbook.getWorksheet("Analyse") || workbook.worksheets.find((item) => normalized(item.name) === "analyse");
  if (!sheet) throw new Error("La feuille « Analyse » est introuvable dans le fichier Qualification finale.");
  let headerRow = 0; let sectorColumn = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRow) return;
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => { if (!headerRow && ["secteur", "secteurs"].includes(normalized(cell.value))) { headerRow = rowNumber; sectorColumn = columnNumber; } });
  });
  if (!headerRow || !sectorColumn) throw new Error("La colonne « Secteurs » est introuvable dans la feuille Analyse.");
  return { sheet, headerRow, sectorColumn };
}

function applyImpactColumns(sheet: import("exceljs").Worksheet, headerRow: number, sectorColumn: number, results: SectorImpactResult[]) {
  const bySector = new Map(results.map((item) => [item.after.sector, item]));
  const firstColumn = sheet.columnCount + 1;
  impactHeaders.forEach((header, index) => {
    const cell = sheet.getCell(headerRow, firstColumn + index);
    cell.value = header.label;
    cell.fill = headerStyle;
    cell.font = whiteBold;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
    sheet.getColumn(firstColumn + index).width = header.width || (header.numberFormat ? 16 : 22);
  });
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber); const sector = cellText(row.getCell(sectorColumn).value).replace(/\s+/g, " ").trim(); const result = bySector.get(sector);
    impactHeaders.forEach((header, index) => {
      const cell = row.getCell(firstColumn + index); const value = result ? header.value(result) : undefined;
      cell.value = value === undefined ? null : value;
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = border;
      if (header.numberFormat) cell.numFmt = header.numberFormat;
    });
  }
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: sheet.rowCount, column: firstColumn + impactHeaders.length - 1 } };
}

function addSummary(workbook: import("exceljs").Workbook, before: SectorSnapshot[], after: SectorSnapshot[], settings: Settings) {
  const existing = workbook.getWorksheet("Synthèse opérationnelle"); if (existing) workbook.removeWorksheet(existing.id);
  const sheet = workbook.addWorksheet("Synthèse opérationnelle", { views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });
  const grouped = new Map<string, SummaryRow>();
  after.forEach((item) => { const responsibility = qualificationResponsibility(item.responsibility); const row = grouped.get(responsibility) || { responsibility, actions: 0, normalized: 0, compromised: 0, completed: 0, persistent: 0 }; row.actions++; row[qualificationStatus(item.qualif)]++; grouped.set(responsibility, row); });
  const rows = [...grouped.values()].sort((a, b) => a.responsibility.localeCompare(b.responsibility));
  const total = rows.reduce((sum, row) => ({ responsibility: "Total", actions: sum.actions + row.actions, normalized: sum.normalized + row.normalized, compromised: sum.compromised + row.compromised, completed: sum.completed + row.completed, persistent: sum.persistent + row.persistent }), { responsibility: "Total", actions: 0, normalized: 0, compromised: 0, completed: 0, persistent: 0 });
  sheet.mergeCells("A1:F1"); const title = sheet.getCell("A1"); title.value = "Synthèse opérationnelle — Qualification finale"; title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC90000" } }; title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; title.alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 25;
  sheet.getCell("A2").value = `TRD / IEA · Débit ${settings.throughputWeight * 100}% · PRB ${settings.prbWeight * 100}%`;
  const headers = ["Responsabilité", "Nombre d'actions", "Normalisé", "Compromis", "Action réalisée / Persiste", "Persiste"];
  sheet.addRow(headers); const headerRow = sheet.getRow(3); const fills = ["FFC90000", "FFF1F3F5", "FF92D050", "FFD9EFD0", "FFD9D9D9", "FFD9D9D9"];
  headerRow.eachCell((cell, column) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fills[column - 1] } }; cell.font = column === 1 ? whiteBold : { bold: true, color: { argb: "FF101820" } }; cell.alignment = { horizontal: column === 1 ? "left" : "center", vertical: "middle", wrapText: true }; cell.border = border; });
  rows.forEach((row) => sheet.addRow([row.responsibility, row.actions, row.normalized, row.compromised || null, row.completed || null, row.persistent || null])); sheet.addRow([total.responsibility, total.actions, total.normalized, total.compromised || null, total.completed || null, total.persistent || null]);
  const firstTableEnd = sheet.rowCount; for (let r = 4; r <= firstTableEnd; r++) { const row = sheet.getRow(r); row.eachCell((cell, column) => { cell.border = border; cell.alignment = { horizontal: column === 1 ? "left" : "center", vertical: "middle" }; if (column === 3) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92D050" } }; if (column === 4) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EFD0" } }; if (column >= 5) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } }; }); if (r === firstTableEnd) row.eachCell((cell, column) => { cell.font = column === 1 ? whiteBold : { bold: true, color: { argb: "FF101820" } }; if (column === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC90000" } }; }); }
  const beforeBySector = new Map(before.map((item) => [item.sector, item])); const movements = new Map<string, { responsibility: string; normalized: number; newDegradation: number }>();
  after.forEach((item) => { const responsibility = qualificationResponsibility(item.responsibility); const row = movements.get(responsibility) || { responsibility, normalized: 0, newDegradation: 0 }; const baseline = beforeBySector.get(item.sector); if (!baseline) row.newDegradation++; else { if (qualificationStatus(baseline.qualif) !== "normalized" && qualificationStatus(item.qualif) === "normalized") row.normalized++; if (qualificationStatus(baseline.qualif) === "normalized" && qualificationStatus(item.qualif) !== "normalized") row.newDegradation++; } movements.set(responsibility, row); });
  const movementRows = [...movements.values()].filter((row) => row.normalized || row.newDegradation).sort((a, b) => a.responsibility.localeCompare(b.responsibility)); const movementTotal = movementRows.reduce((sum, row) => ({ normalized: sum.normalized + row.normalized, newDegradation: sum.newDegradation + row.newDegradation }), { normalized: 0, newDegradation: 0 });
  sheet.addRow([]); const subtitleRow = sheet.addRow(["Situation des normalisations et nouvelles apparitions"]); sheet.mergeCells(`A${subtitleRow.number}:D${subtitleRow.number}`); subtitleRow.getCell(1).font = { bold: true, size: 12, color: { argb: "FF244E7C" }, underline: true }; sheet.addRow(["Responsabilité", "Normalisé", "Nouvelle dégradation", "Différence"]); const movementHeader = sheet.getRow(sheet.rowCount); ["FFC90000", "FF92D050", "FFF5C2A3", "FFF1F3F5"].forEach((color, index) => { const cell = movementHeader.getCell(index + 1); cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } }; cell.font = index === 0 ? whiteBold : { bold: true }; cell.alignment = { horizontal: index === 0 ? "left" : "center" }; cell.border = border; });
  movementRows.forEach((row) => sheet.addRow([row.responsibility, row.normalized || null, row.newDegradation || null, row.normalized - row.newDegradation])); sheet.addRow(["Total", movementTotal.normalized, movementTotal.newDegradation, movementTotal.normalized - movementTotal.newDegradation]);
  const movementEnd = sheet.rowCount; const movementStart = movementHeader.number + 1; for (let r = movementStart; r <= movementEnd; r++) { const row = sheet.getRow(r); row.eachCell((cell, column) => { cell.border = border; cell.alignment = { horizontal: column === 1 ? "left" : "center" }; if (column === 2) { cell.font = { bold: true, color: { argb: "FF00A651" } }; } if (column === 3 || (column === 4 && Number(cell.value) < 0)) cell.font = { bold: true, color: { argb: "FFE11D26" } }; }); if (r === movementEnd) { row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC90000" } }; row.getCell(1).font = whiteBold; row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92D050" } }; row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5C2A3" } }; } }
  [34, 20, 18, 24, 29, 16].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
}

export async function buildExportWorkbook(results: SectorImpactResult[], settings: Settings, source: ArrayBuffer, beforeRecords: SectorSnapshot[], afterRecords: SectorSnapshot[]) {
  const ExcelJS = await import("exceljs"); const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(source); workbook.creator = "EMA Solution"; workbook.modified = new Date();
  const { sheet, headerRow, sectorColumn } = findAnalyse(workbook); workbook.worksheets.filter((item) => item.id !== sheet.id).forEach((item) => workbook.removeWorksheet(item.id)); applyImpactColumns(sheet, headerRow, sectorColumn, results); addSummary(workbook, beforeRecords, afterRecords, settings);
  return workbook.xlsx.writeBuffer();
}

export async function exportResults(results: SectorImpactResult[], settings: Settings, afterFile: File | undefined, beforeRecords: SectorSnapshot[], afterRecords: SectorSnapshot[]) {
  if (!afterFile) throw new Error("Le fichier Qualification finale (AFTER) n'est plus disponible. Importez-le à nouveau avant l'export.");
  const buffer = await buildExportWorkbook(results, settings, await afterFile.arrayBuffer(), beforeRecords, afterRecords); const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = name(new Date()); anchor.click(); URL.revokeObjectURL(anchor.href);
}
