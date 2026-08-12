import { BANDS, type ActionEffectiveness, type EvolutionEffectiveness, type SectorImpactResult, type SectorSnapshot, type Settings } from "@/lib/types/telecom";

const number = (v: unknown): number | undefined => { if (typeof v === "number" && Number.isFinite(v)) return v; if (typeof v === "string") { const n = Number(v.replace(",", ".").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : undefined; } return undefined; };
export const throughputGain = (before?: number, after?: number) => before === undefined || after === undefined || before === 0 ? undefined : after / before - 1;
export const prbRelief = (before?: number, after?: number) => before === undefined || after === undefined ? undefined : before - after;
export function classifyIea(iea: number | undefined, s: Settings): ActionEffectiveness { if (iea === undefined) return "Non mesurable"; if (iea >= s.veryEffective) return "Très efficace"; if (iea >= s.effective) return "Efficace"; if (iea >= s.partial) return "Amélioration partielle"; if (iea < s.regression) return "Régression"; return "Impact faible / non significatif"; }
export function classifyEvolution(iea: number | undefined, s: Settings): EvolutionEffectiveness {
  if (iea === undefined) return "Non mesurable";
  if (iea >= s.evolutionStrong) return "Forte amélioration";
  if (iea >= s.evolutionStable) return "Amélioration";
  if (iea <= -s.evolutionStrong) return "Forte régression";
  if (iea <= -s.evolutionStable) return "Régression";
  return "Stable / non significatif";
}
export function conclusion(qualif: string | undefined, effectiveness: ActionEffectiveness, iea: number | undefined, s: Settings) { const q = (qualif || "").trim(); if (/^normalis[eé]/i.test(q)) return `Normalisé – ${effectiveness}`; if (/^persiste/i.test(q)) { if (iea === undefined) return "Persiste – impact non mesurable"; if (iea >= s.effective) return "Persiste malgré amélioration forte"; if (iea >= s.partial) return "Persiste – amélioration partielle"; if (iea < s.regression) return "Persiste – régression"; return "Persiste – impact faible"; } return q ? `${q} – ${effectiveness}` : effectiveness; }
function latestDate(snapshot: SectorSnapshot) { return [snapshot.prodOptim, snapshot.prodMaintenance, snapshot.prodDeployment, snapshot.prodEngineering].filter((x): x is Date => x instanceof Date && !Number.isNaN(x.getTime())).sort((a,b) => b.getTime() - a.getTime())[0]; }
export function calculateImpact(before: SectorSnapshot, after: SectorSnapshot, settings: Settings): SectorImpactResult {
  let gapDlBefore = 0, gapDlAfter = 0, gapPrbBefore = 0, gapPrbAfter = 0, dlMeasurable = false, prbMeasurable = false;
  const bandResults = {} as SectorImpactResult["bandResults"];
  const evolutionBands: { band: (typeof BANDS)[number]; score: number; traffic?: number }[] = [];
  let hasPartialEvolutionCoverage = false;
  for (const band of BANDS) {
    const b = before.bands[band], a = after.bands[band], dlBefore = number(b.throughput), dlAfter = number(a.throughput), prbBefore = number(b.prb), prbAfter = number(a.prb);
    const initiallyDegraded = before.degradedBands.includes(band), initiallyCharged = before.chargedBands.includes(band);
    const dlComparable = dlBefore !== undefined && dlAfter !== undefined && dlBefore >= 0 && dlAfter >= 0 && Math.max(dlBefore, dlAfter) > 0;
    const prbComparable = prbBefore !== undefined && prbAfter !== undefined && prbBefore >= 0 && prbBefore <= 100 && prbAfter >= 0 && prbAfter <= 100;
    const throughputEvolution = dlComparable ? (dlAfter - dlBefore) / Math.max(dlBefore, dlAfter) : undefined;
    const prbEvolution = prbComparable ? (prbBefore - prbAfter) / 100 : undefined;
    // A strictly stable comparable KPI must not dilute the observed evolution of
    // the other KPI (e.g. DL 21 → 19 with stable PRB remains −9.5%). When both
    // KPIs move, or both are stable, the configured 60/40 weights apply.
    const dlActive = throughputEvolution !== undefined && (throughputEvolution !== 0 || prbEvolution === undefined || prbEvolution === 0);
    const prbActive = prbEvolution !== undefined && (prbEvolution !== 0 || throughputEvolution === undefined || throughputEvolution === 0);
    const evolutionWeight = (dlActive ? settings.throughputWeight : 0) + (prbActive ? settings.prbWeight : 0);
    const ieaEvolution = evolutionWeight > 0
      ? ((throughputEvolution ?? 0) * (dlActive ? settings.throughputWeight : 0) + (prbEvolution ?? 0) * (prbActive ? settings.prbWeight : 0)) / evolutionWeight
      : undefined;
    const evolutionCoverage = ieaEvolution === undefined ? undefined : throughputEvolution !== undefined && prbEvolution !== undefined ? "Complète" : "Partielle";
    if (evolutionCoverage === "Partielle") hasPartialEvolutionCoverage = true;
    bandResults[band] = { throughputBefore: dlBefore, throughputAfter: dlAfter, throughputGain: throughputGain(dlBefore, dlAfter), prbBefore, prbAfter, prbRelief: prbRelief(prbBefore, prbAfter), throughputEvolution, prbEvolution, ieaEvolution, evolutionCoverage, initiallyDegraded, initiallyCharged };
    if (ieaEvolution !== undefined) evolutionBands.push({ band, score: ieaEvolution, traffic: number(b.traffic) });
    if (initiallyDegraded && dlBefore !== undefined) { const initial = Math.max(0, settings.dlThresholds[band] - dlBefore); if (initial > 0) { dlMeasurable = true; gapDlBefore += initial; gapDlAfter += dlAfter === undefined ? settings.dlThresholds[band] : Math.max(0, settings.dlThresholds[band] - dlAfter); } }
    if (initiallyCharged && prbBefore !== undefined) { const initial = Math.max(0, prbBefore - settings.prbThreshold); if (initial > 0) { prbMeasurable = true; gapPrbBefore += initial; gapPrbAfter += prbAfter === undefined ? 100 - settings.prbThreshold : Math.max(0, prbAfter - settings.prbThreshold); } }
  }
  const trdThroughput = dlMeasurable ? 1 - gapDlAfter / gapDlBefore : undefined;
  const trdPrb = prbMeasurable ? 1 - gapPrbAfter / gapPrbBefore : undefined;
  const iea = trdThroughput !== undefined && trdPrb !== undefined ? trdThroughput * settings.throughputWeight + trdPrb * settings.prbWeight : trdThroughput ?? trdPrb;
  const actionEffectiveness = classifyIea(iea, settings); const initial = before.degradedBands.join("+"); const current = after.degradedBands.join("+");
  const afterKpiIssues = BANDS.flatMap((band) => { const issues: string[] = []; const kpi = after.bands[band]; if (before.degradedBands.includes(band) && kpi.throughput !== undefined && kpi.throughput < settings.dlThresholds[band]) issues.push(`${band} débit ${kpi.throughput.toFixed(2)} < ${settings.dlThresholds[band]} Mbps`); if (before.chargedBands.includes(band) && kpi.prb !== undefined && kpi.prb > settings.prbThreshold) issues.push(`${band} PRB ${kpi.prb.toFixed(1)} % > ${settings.prbThreshold} %`); return issues; });
  const normalizedAfter = /^normalis/i.test((after.qualif || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const allTrafficAvailable = evolutionBands.length > 0 && evolutionBands.every((item) => item.traffic !== undefined && item.traffic > 0);
  const evolutionTrafficTotal = allTrafficAvailable ? evolutionBands.reduce((sum, item) => sum + (item.traffic || 0), 0) : undefined;
  const equalWeight = evolutionBands.length ? 1 / evolutionBands.length : 0;
  evolutionBands.forEach((item) => { bandResults[item.band].evolutionTrafficWeight = allTrafficAvailable ? (item.traffic || 0) / (evolutionTrafficTotal || 1) : equalWeight; });
  const ieaEvolution = evolutionBands.length ? evolutionBands.reduce((sum, item) => sum + item.score * (bandResults[item.band].evolutionTrafficWeight || 0), 0) : undefined;
  const evolutionEffectiveness = classifyEvolution(ieaEvolution, settings);
  const evolutionWeighting = ieaEvolution === undefined ? "Non mesurable" : allTrafficAvailable ? "Pondération trafic" : "Pondération de secours";
  const evolutionCoverage = ieaEvolution === undefined ? "Non mesurable" : hasPartialEvolutionCoverage ? "Partielle" : "Complète";
  return { id: before.sector, sector: before.originalSector, before, after, bandResults, dateAction: latestDate(after), trdThroughput, trdPrb, iea, gapDlBefore: dlMeasurable ? gapDlBefore : undefined, gapDlAfter: dlMeasurable ? gapDlAfter : undefined, gapPrbBefore: prbMeasurable ? gapPrbBefore : undefined, gapPrbAfter: prbMeasurable ? gapPrbAfter : undefined, actionEffectiveness, degradationStatus: after.qualif || "Non renseigné", conclusion: conclusion(after.qualif, actionEffectiveness, iea, settings), confidence: iea === undefined ? "Faible / non mesurable" : "Moyenne – 2 snapshots, trafic non contrôlé", bandMigration: initial && current ? initial === current ? "Même bande(s)" : `Déplacement: ${initial} → ${current}` : "Non renseigné", afterKpiWarning: normalizedAfter && afterKpiIssues.length ? `Qualif normalisée, KPI AFTER à contrôler : ${afterKpiIssues.join(" · ")}` : undefined, ieaEvolution, evolutionEffectiveness, evolutionWeighting, evolutionCoverage, evolutionTrafficTotal, evolutionContributionEligible: allTrafficAvailable };
}
export const asNumber = number;
