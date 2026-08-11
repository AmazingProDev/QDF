import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildExportWorkbook } from "@/lib/excel/exporter";
import { BANDS, defaultSettings, type SectorImpactResult, type SectorSnapshot } from "@/lib/types/telecom";

const snapshot = (qualif: string): SectorSnapshot => ({ sector: "RAB_Test_1", originalSector: "RAB_Test_1", responsibility: "Optim", qualif, degradedBands: ["L1800"], chargedBands: [], bands: Object.fromEntries(BANDS.map((band) => [band, {}])) as SectorSnapshot["bands"] });
const asArrayBuffer = (value: Uint8Array) => value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;

describe("Excel export", () => {
  it("keeps Analyse formatting, appends impact columns, and adds the operational summary", async () => {
    const source = new ExcelJS.Workbook(); const analyse = source.addWorksheet("Analyse"); analyse.addRow(["Situation", "Secteurs", "Responsabilité", "Qualif"]); analyse.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC90000" } }; analyse.addRow(["Benchmark", "RAB_Test_1", "Optim", "Persiste"]);
    const before = snapshot("Persiste"); const after = snapshot("Normalisé"); const result = { id: "RAB_Test_1", sector: after.sector, before, after, bandResults: Object.fromEntries(BANDS.map((band) => [band, { initiallyDegraded: band === "L1800", initiallyCharged: false }])) as SectorImpactResult["bandResults"], trdThroughput: .8, trdPrb: .5, iea: .68, actionEffectiveness: "Efficace", degradationStatus: "Normalisé", conclusion: "Amélioration confirmée", confidence: "Mesure fiable", bandMigration: "L1800 normalisée" } as SectorImpactResult;
    const output = await buildExportWorkbook([result], defaultSettings, asArrayBuffer(await source.xlsx.writeBuffer()), [before], [after]); const exported = new ExcelJS.Workbook(); await exported.xlsx.load(output);
    const exportedAnalyse = exported.getWorksheet("Analyse"); const summary = exported.getWorksheet("Synthèse opérationnelle");
    expect(exportedAnalyse?.getCell("A1").fill.fgColor?.argb).toBe("FFC90000");
    expect(exportedAnalyse?.getCell(1, 5).value).toBe("TRD Débit");
    expect(exportedAnalyse?.getCell(2, 7).value).toBe(.68);
    expect(summary?.getCell("A1").value).toContain("Synthèse opérationnelle");
    expect(summary?.getCell("A4").value).toBe("Optim");
  });
});
