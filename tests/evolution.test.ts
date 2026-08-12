import { describe, expect, it } from "vitest";
import { calculateEvolutionContribution, calculateEvolutionKpiScores } from "@/lib/analysis/evolution";
import { calculateImpact } from "@/lib/analysis/trd";
import { BANDS, defaultSettings, type SectorImpactResult, type SectorSnapshot } from "@/lib/types/telecom";

function snapshot(values: Partial<Record<(typeof BANDS)[number], { dl?: number; prb?: number; traffic?: number }>>, degraded: (typeof BANDS)[number][] = []): SectorSnapshot {
  return { sector: "S1", originalSector: "S1", degradedBands: degraded, chargedBands: [], bands: Object.fromEntries(BANDS.map((band) => { const value = values[band] || {}; return [band, { throughput: value.dl, prb: value.prb, traffic: value.traffic }]; })) as SectorSnapshot["bands"] };
}

describe("IEA-E — évolution globale", () => {
  it("scores 21 → 19 Mbps as −9.5% and detects a regression even on a healthy band", () => {
    const result = calculateImpact(snapshot({ L1800: { dl: 21, prb: 50, traffic: 100 } }), snapshot({ L1800: { dl: 19, prb: 50, traffic: 100 } }), defaultSettings);
    expect(result.bandResults.L1800.throughputEvolution).toBeCloseTo(-2 / 21);
    expect(result.ieaEvolution).toBeCloseTo(-2 / 21);
    expect(result.evolutionEffectiveness).toBe("Régression");
    expect(result.iea).toBeUndefined();
  });

  it("combines DL and PRB regression to −18.1%", () => {
    const result = calculateImpact(snapshot({ L1800: { dl: 21, prb: 36, traffic: 100 } }), snapshot({ L1800: { dl: 19, prb: 67, traffic: 100 } }), defaultSettings);
    expect(result.bandResults.L1800.prbEvolution).toBeCloseTo(-.31);
    expect(result.ieaEvolution).toBeCloseTo(.6 * (-2 / 21) + .4 * -.31);
    expect(result.evolutionEffectiveness).toBe("Régression");
  });

  it("classifies the inverse KPI movement as an improvement", () => {
    const result = calculateImpact(snapshot({ L1800: { dl: 19, prb: 67, traffic: 100 } }), snapshot({ L1800: { dl: 21, prb: 36, traffic: 100 } }), defaultSettings);
    expect(result.ieaEvolution).toBeCloseTo(.6 * (2 / 21) + .4 * .31);
    expect(result.evolutionEffectiveness).toBe("Amélioration");
  });

  it("uses traffic weights across bands and falls back to equal weights when traffic is incomplete", () => {
    const before = snapshot({ L1800: { dl: 10, prb: 50, traffic: 100 }, L2100: { dl: 10, prb: 50, traffic: 300 } });
    const after = snapshot({ L1800: { dl: 20, prb: 50, traffic: 100 }, L2100: { dl: 5, prb: 50, traffic: 300 } });
    const weighted = calculateImpact(before, after, defaultSettings);
    expect(weighted.evolutionWeighting).toBe("Pondération trafic");
    expect(weighted.bandResults.L1800.evolutionTrafficWeight).toBeCloseTo(.25);
    expect(weighted.bandResults.L2100.evolutionTrafficWeight).toBeCloseTo(.75);
    expect(weighted.ieaEvolution).toBeCloseTo(.25 * .5 + .75 * -.5);
    const fallback = calculateImpact({ ...before, bands: { ...before.bands, L2100: { ...before.bands.L2100, traffic: undefined } } }, after, defaultSettings);
    expect(fallback.evolutionWeighting).toBe("Pondération de secours");
    expect(fallback.evolutionContributionEligible).toBe(false);
    expect(fallback.bandResults.L1800.evolutionTrafficWeight).toBeCloseTo(.5);
  });

  it("reconciles responsibility contributions exactly to the IEA-E global net", () => {
    const make = (responsibility: string, traffic: number, ieaEvolution: number) => ({ id: responsibility, sector: responsibility, before: snapshot({}), after: { ...snapshot({}), responsibility }, bandResults: {} as SectorImpactResult["bandResults"], actionEffectiveness: "Non mesurable", degradationStatus: "Persiste", conclusion: "", confidence: "", bandMigration: "", ieaEvolution, evolutionContributionEligible: true, evolutionTrafficTotal: traffic }) as SectorImpactResult;
    const total = calculateEvolutionContribution([make("Optim", 100, .2), make("Maintenance", 300, -.1)]);
    expect(total.globalNet).toBeCloseTo(-.025);
    expect(total.rows.reduce((sum, row) => sum + row.net, 0)).toBeCloseTo(total.globalNet || 0);
    expect(total.rows.find((row) => row.responsibility === "Optim")?.positiveShare).toBe(1);
    expect(total.rows.find((row) => row.responsibility === "Maintenance")?.regressionShare).toBe(1);
  });

  it("aggregates global and band KPI scores independently with traffic weights", () => {
    const before = snapshot({ L1800: { dl: 10, prb: 50, traffic: 100 }, L2100: { dl: 10, prb: 50, traffic: 300 } });
    const after = snapshot({ L1800: { dl: 20, prb: 40, traffic: 100 }, L2100: { dl: 5, prb: 60, traffic: 300 } });
    const scores = calculateEvolutionKpiScores([calculateImpact(before, after, defaultSettings)]);
    expect(scores.global.throughput.score).toBeCloseTo(.25 * .5 + .75 * -.5);
    expect(scores.global.prb.score).toBeCloseTo(.25 * .1 + .75 * -.1);
    expect(scores.byBand.find((item) => item.band === "L1800")?.throughput.score).toBeCloseTo(.5);
    expect(scores.byBand.find((item) => item.band === "L2100")?.prb.score).toBeCloseTo(-.1);
  });
});
