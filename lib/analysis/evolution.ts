import { BANDS, type Band, type SectorImpactResult } from "@/lib/types/telecom";
import { qualificationResponsibility } from "@/lib/analysis/qualification";

export type ResponsibilityContribution = {
  responsibility: string;
  positive: number;
  negative: number;
  net: number;
  traffic: number;
  sectors: number;
  positiveShare?: number;
  regressionShare?: number;
};

/**
 * Uses only sectors with complete reference-traffic weights. The denominator is
 * shared by every responsibility, so row.net values reconcile exactly to globalNet.
 */
export function calculateEvolutionContribution(results: SectorImpactResult[]) {
  const eligible = results.filter((result) => result.evolutionContributionEligible && result.ieaEvolution !== undefined && (result.evolutionTrafficTotal || 0) > 0);
  const totalTraffic = eligible.reduce((sum, result) => sum + (result.evolutionTrafficTotal || 0), 0);
  const groups = new Map<string, { traffic: number; sectors: number; positiveRaw: number; negativeRaw: number }>();
  eligible.forEach((result) => {
    const responsibility = qualificationResponsibility(result.after.responsibility);
    const group = groups.get(responsibility) || { traffic: 0, sectors: 0, positiveRaw: 0, negativeRaw: 0 };
    const weightedScore = (result.evolutionTrafficTotal || 0) * (result.ieaEvolution || 0);
    group.traffic += result.evolutionTrafficTotal || 0;
    group.sectors++;
    if (weightedScore >= 0) group.positiveRaw += weightedScore; else group.negativeRaw += weightedScore;
    groups.set(responsibility, group);
  });
  const rows: ResponsibilityContribution[] = [...groups.entries()].map(([responsibility, group]) => ({
    responsibility,
    traffic: group.traffic,
    sectors: group.sectors,
    positive: totalTraffic ? group.positiveRaw / totalTraffic : 0,
    negative: totalTraffic ? group.negativeRaw / totalTraffic : 0,
    net: totalTraffic ? (group.positiveRaw + group.negativeRaw) / totalTraffic : 0,
  })).sort((a, b) => a.responsibility.localeCompare(b.responsibility));
  const positiveTotal = rows.reduce((sum, row) => sum + row.positive, 0);
  const regressionTotal = rows.reduce((sum, row) => sum + Math.abs(row.negative), 0);
  rows.forEach((row) => {
    row.positiveShare = positiveTotal ? row.positive / positiveTotal : undefined;
    row.regressionShare = regressionTotal ? Math.abs(row.negative) / regressionTotal : undefined;
  });
  return {
    rows,
    eligibleSectors: eligible.length,
    totalTraffic,
    globalNet: totalTraffic ? rows.reduce((sum, row) => sum + row.net, 0) : undefined,
  };
}

type WeightedMetric = { score?: number; traffic: number; sectors: number };
const weightedMetric = (values: { score?: number; traffic?: number }[]): WeightedMetric => {
  const valid = values.filter((value): value is { score: number; traffic: number } => value.score !== undefined && value.traffic !== undefined && value.traffic > 0);
  const traffic = valid.reduce((sum, value) => sum + value.traffic, 0);
  return { score: traffic ? valid.reduce((sum, value) => sum + value.score * value.traffic, 0) / traffic : undefined, traffic, sectors: valid.length };
};

/**
 * KPI-only evolution for charts. It uses the same complete-traffic perimeter as
 * the IEA-E global contribution, but does not blend the DL and PRB units.
 */
export function calculateEvolutionKpiScores(results: SectorImpactResult[]) {
  const eligible = results.filter((result) => result.evolutionContributionEligible);
  const byBand = BANDS.map((band) => {
    const throughput = weightedMetric(eligible.map((result) => ({ score: result.bandResults[band].throughputEvolution, traffic: result.before.bands[band].traffic })));
    const prb = weightedMetric(eligible.map((result) => ({ score: result.bandResults[band].prbEvolution, traffic: result.before.bands[band].traffic })));
    return { band, throughput, prb };
  });
  return {
    global: {
      throughput: weightedMetric(eligible.flatMap((result) => BANDS.map((band) => ({ score: result.bandResults[band].throughputEvolution, traffic: result.before.bands[band].traffic })))),
      prb: weightedMetric(eligible.flatMap((result) => BANDS.map((band) => ({ score: result.bandResults[band].prbEvolution, traffic: result.before.bands[band].traffic })))),
    },
    byBand: byBand as { band: Band; throughput: WeightedMetric; prb: WeightedMetric }[],
  };
}
