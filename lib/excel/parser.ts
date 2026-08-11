import { BANDS, type Band, type ParseResult, type SectorSnapshot } from "@/lib/types/telecom";
import { asNumber } from "@/lib/analysis/trd";

const clean = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
const normalized = (value: unknown) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
const toCellText = (v: unknown): string => { if (v && typeof v === "object" && "text" in v) return clean((v as { text: string }).text); if (v && typeof v === "object" && "result" in v) return clean((v as { result: unknown }).result); return clean(v); };
const valueAt = (row: unknown[], index?: number) => index === undefined ? undefined : row[index];
const headerMatches = (header: string, candidates: string[]) => candidates.some((candidate) => header === candidate || header.includes(candidate) || candidate.includes(header));
const bandList = (value: unknown): Band[] => { const text = clean(value).toUpperCase(); return BANDS.filter((band) => new RegExp(`(^|[^0-9])${band.slice(1)}([^0-9]|$)`).test(text)); };

type Structure = { headerRow: number; columns: Record<string, number | undefined>; bands: Record<Band, { throughput?: number; prb?: number; availability?: number; ta?: number }> };
function findStructure(rows: unknown[][]): Structure {
  const headerRow = rows.findIndex((row) => row.some((cell) => ["secteurs", "secteur"].includes(normalized(toCellText(cell)))));
  if (headerRow < 0) throw new Error("Colonne « Secteurs » introuvable. Vérifiez le fichier de consolidation.");
  const header = rows[headerRow].map((cell) => normalized(toCellText(cell)));
  const find = (...names: string[]) => { const candidates = names.map(normalized); return header.findIndex((item) => headerMatches(item, candidates)); };
  const index = (...names: string[]) => { const result = find(...names); return result < 0 ? undefined : result; };
  const bandAtColumn: Array<Band | undefined> = [];
  let activeBand: Band | undefined;
  for (let c = 0; c < header.length; c++) {
    for (let r = Math.max(0, headerRow - 5); r < headerRow; r++) { const label = clean(toCellText(rows[r]?.[c])).toUpperCase().replace(/\s/g, ""); const found = BANDS.find((band) => label === band); if (found) activeBand = found; }
    bandAtColumn[c] = activeBand;
  }
  const bands = Object.fromEntries(BANDS.map((band) => [band, {}])) as Structure["bands"];
  header.forEach((label, c) => { const band = bandAtColumn[c]; if (!band) return; if ((label.includes("debit") || label.includes("debit 4g") || label.includes("throughput")) && (label.includes("dl") || label.includes("4g"))) bands[band].throughput = c; if (label.includes("prb") && (label.includes("dl") || label.includes("bh") || label === "prb")) bands[band].prb = c; if (label.includes("avail")) bands[band].availability = c; if (label === "ta" || label.includes("timing advance")) bands[band].ta = c; });
  const missing = BANDS.filter((band) => bands[band].throughput === undefined || bands[band].prb === undefined);
  if (missing.length) throw new Error(`KPI Débit 4G DL ou Usage_PRB_DL_BH introuvable pour : ${missing.join(", ")}.`);
  return { headerRow, columns: { situation: index("situation"), sector: index("secteurs", "secteur"), hetsite: index("hetsite"), dr: index("dr"), plaque: index("plaque"), vendor: index("vendor", "fournisseur"), responsibility: index("responsabilite"), action: index("analyse/action", "analyse action", "action deploiement", "action"), qualif: index("qualif", "qualification"), degradedBands: index("bandes debit degrade", "bandes debit degradees"), chargedBands: index("bandes chargees"), prodOptim: index("prod optim"), prodMaintenance: index("prod maintenance"), prodDeployment: index("prod deploiement"), prodEngineering: index("prod ingenierie") }, bands };
}
function dateValue(value: unknown): Date | undefined { if (value instanceof Date && !Number.isNaN(value.getTime())) return value; if (typeof value === "number" && value > 20000 && value < 100000) return new Date(Date.UTC(1899, 11, 30 + value)); const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? undefined : parsed; }
export async function parseTelecomWorkbook(file: File): Promise<ParseResult> {
  const ExcelJS = await import("exceljs"); const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(await file.arrayBuffer()); } catch { throw new Error("Fichier Excel invalide, protégé par mot de passe ou illisible."); }
  const worksheet = workbook.worksheets.find((sheet) => normalized(sheet.name) === "analyse") || workbook.worksheets.find((sheet) => { for (let r = 1; r <= Math.min(30, sheet.rowCount); r++) { const cells = sheet.getRow(r).values; if (Array.isArray(cells) && cells.some((cell) => normalized(toCellText(cell)) === "secteurs")) return true; } return false; });
  if (!worksheet) throw new Error("Onglet « Analyse » ou feuille contenant « Secteurs » introuvable.");
  const upperBound = Math.min(Math.max(worksheet.actualRowCount, 60), 500); const topRows: unknown[][] = []; for (let r = 1; r <= upperBound; r++) topRows.push((worksheet.getRow(r).values as unknown[]).slice(1));
  const structure = findStructure(topRows); const records = new Map<string, SectorSnapshot>(); const allRecords: SectorSnapshot[] = []; const duplicateSet = new Set<string>(); let rowCount = 0, emptyRun = 0;
  const lastRow = Math.max(worksheet.actualRowCount, worksheet.rowCount);
  for (let r = structure.headerRow + 2; r <= lastRow; r++) {
    const row = (worksheet.getRow(r).values as unknown[]).slice(1); const originalSector = toCellText(valueAt(row, structure.columns.sector)); const sector = originalSector.replace(/\s+/g, " ").trim();
    if (!sector) { if (rowCount > 0 && ++emptyRun >= 200) break; continue; } emptyRun = 0; rowCount++;
    const read = (key: string) => toCellText(valueAt(row, structure.columns[key])); const snapshot: SectorSnapshot = { sector, originalSector, situation: read("situation") || undefined, hetsite: read("hetsite") || undefined, dr: read("dr") || undefined, plaque: read("plaque") || undefined, vendor: read("vendor") || undefined, responsibility: read("responsibility") || undefined, action: read("action") || undefined, qualif: read("qualif") || undefined, degradedBands: bandList(valueAt(row, structure.columns.degradedBands)), chargedBands: bandList(valueAt(row, structure.columns.chargedBands)), prodOptim: dateValue(valueAt(row, structure.columns.prodOptim)), prodMaintenance: dateValue(valueAt(row, structure.columns.prodMaintenance)), prodDeployment: dateValue(valueAt(row, structure.columns.prodDeployment)), prodEngineering: dateValue(valueAt(row, structure.columns.prodEngineering)), bands: {} as SectorSnapshot["bands"] };
    for (const band of BANDS) { const cols = structure.bands[band]; snapshot.bands[band] = { throughput: asNumber(valueAt(row, cols.throughput)), prb: asNumber(valueAt(row, cols.prb)), availability: asNumber(valueAt(row, cols.availability)), ta: asNumber(valueAt(row, cols.ta)) }; } allRecords.push(snapshot); if (records.has(sector)) duplicateSet.add(sector); else records.set(sector, snapshot);
  }
  return { records, allRecords, duplicates: [...duplicateSet], rowCount, sheetName: worksheet.name, detectedBands: Object.fromEntries(BANDS.map((band) => [band, { throughput: structure.bands[band].throughput !== undefined, prb: structure.bands[band].prb !== undefined }])) as ParseResult["detectedBands"] };
}
