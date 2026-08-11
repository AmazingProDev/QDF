import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildExportWorkbook } from "@/lib/excel/exporter";
import { BANDS, defaultSettings, type SectorImpactResult, type SectorSnapshot } from "@/lib/types/telecom";

const snapshot = (qualif: string): SectorSnapshot => ({ sector: "RAB_Test_1", originalSector: "RAB_Test_1", responsibility: "Optim", qualif, degradedBands: ["L1800"], chargedBands: [], bands: Object.fromEntries(BANDS.map((band) => [band, {}])) as SectorSnapshot["bands"] });
const asArrayBuffer = (value: Uint8Array) => value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;

describe("Excel export", () => {
  it("keeps Analyse formatting, appends impact columns, and adds the operational summary", async () => {
    const source = new ExcelJS.Workbook(); const analyse = source.addWorksheet("Analyse"); source.addWorksheet("Autre feuille"); analyse.addRow(["Situation", "Secteurs", "Responsabilité", "Qualif"]); analyse.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC90000" } }; analyse.addRow(["Benchmark", "RAB_Test_1", "Optim", "Persiste"]);
    const before = snapshot("Persiste"); const after = snapshot("Normalisé"); const result = { id: "RAB_Test_1", sector: after.sector, before, after, bandResults: Object.fromEntries(BANDS.map((band) => [band, { throughputBefore: 6, throughputAfter: 7, throughputGain: 1 / 6, prbBefore: 80, prbAfter: 70, prbRelief: 10, initiallyDegraded: band === "L1800", initiallyCharged: false }])) as SectorImpactResult["bandResults"], gapDlBefore: 7.722022, gapDlAfter: 2, trdThroughput: .8, gapPrbBefore: 75.764, gapPrbAfter: 10, trdPrb: .5, iea: .68, actionEffectiveness: "Efficace", degradationStatus: "Normalisé", conclusion: "Amélioration confirmée", confidence: "Mesure fiable", bandMigration: "L1800 normalisée" } as SectorImpactResult;
    const output = await buildExportWorkbook([result], defaultSettings, asArrayBuffer(await source.xlsx.writeBuffer()), [before], [after]); const exported = new ExcelJS.Workbook(); await exported.xlsx.load(output);
    const exportedAnalyse = exported.getWorksheet("Analyse"); const summary = exported.getWorksheet("Synthèse opérationnelle");
    expect(exportedAnalyse?.getCell("A1").fill.fgColor?.argb).toBe("FFC90000");
    expect(exported.worksheets.map((sheet) => sheet.name)).toEqual(["Analyse", "Synthèse opérationnelle"]);
    expect(exportedAnalyse?.getCell(1, 5).value).toBe("Dégradation initiale");
    expect(exportedAnalyse?.getCell(1, 14).value).toBe("IEA Action");
    expect(exportedAnalyse?.getCell(2, 14).value).toBe(.68);
    expect(exportedAnalyse?.getCell(1, 19).value).toBe("L1800 DL Avant");
    expect(exportedAnalyse?.getCell(2, 19).value).toBe(6);
    expect(summary?.getCell("A1").value).toContain("Synthèse opérationnelle");
    expect(summary?.getCell("A4").value).toBe("Optim");
  });
});
