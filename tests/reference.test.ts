import { describe, expect, it } from "vitest";
import { matchAndCalculate } from "@/lib/analysis/matching";
import { BANDS, defaultSettings, type ParseResult, type SectorSnapshot } from "@/lib/types/telecom";

const snapshot = (sector: string, throughput: number, traffic?: number): SectorSnapshot => ({ sector, originalSector: sector, degradedBands: ["L1800"], chargedBands: [], bands: Object.fromEntries(BANDS.map((band) => [band, { throughput: band === "L1800" ? throughput : 20, prb: 50, traffic: band === "L1800" ? traffic : undefined }])) as SectorSnapshot["bands"] });
const parsed = (...items: SectorSnapshot[]): ParseResult => ({ records: new Map(items.map((item) => [item.sector, item])), allRecords: items, duplicates: [], rowCount: items.length, sheetName: "Analyse", format: "qualification", detectedBands: Object.fromEntries(BANDS.map((band) => [band, { throughput: true, prb: true }])) as ParseResult["detectedBands"] });

describe("Référence Ookla", () => {
  it("uses the reference KPI and traffic where it is available, otherwise retains BEFORE", () => {
    const before = parsed(snapshot("S1", 4), snapshot("S2", 4)); const after = parsed(snapshot("S1", 7), snapshot("S2", 7)); const reference = parsed(snapshot("S1", 2, 12345));
    const results = matchAndCalculate(before, after, defaultSettings, reference);
    expect(results.find((item) => item.sector === "S1")?.baselineSource).toBe("Référence Ookla");
    expect(results.find((item) => item.sector === "S1")?.trdThroughput).toBeCloseTo(.625);
    expect(results.find((item) => item.sector === "S1")?.before.bands.L1800.traffic).toBe(12345);
    expect(results.find((item) => item.sector === "S2")?.baselineSource).toBe("Fichier BEFORE");
    expect(results.find((item) => item.sector === "S2")?.trdThroughput).toBeCloseTo(.5);
  });
});
