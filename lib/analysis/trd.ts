import { BANDS, type ActionEffectiveness, type SectorImpactResult, type SectorSnapshot, type Settings } from "@/lib/types/telecom";

const number = (v: unknown): number | undefined => { if (typeof v === "number" && Number.isFinite(v)) return v; if (typeof v === "string") { const n = Number(v.replace(",", ".").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : undefined; } return undefined; };
export const throughputGain = (before?: number, after?: number) => before === undefined || after === undefined || before === 0 ? undefined : after / before - 1;
export const prbRelief = (before?: number, after?: number) => before === undefined || after === undefined ? undefined : before - after;
export function classifyIea(iea: number | undefined, s: Settings): ActionEffectiveness { if (iea === undefined) return "Non mesurable"; if (iea >= s.veryEffective) return "Très efficace"; if (iea >= s.effective) return "Efficace"; if (iea >= s.partial) return "Amélioration partielle"; if (iea < s.regression) return "Régression"; return "Impact faible / non significatif"; }
export function conclusion(qualif: string | undefined, effectiveness: ActionEffectiveness, iea: number | undefined, s: Settings) { const q = (qualif || "").trim(); if (/^normalis[eé]/i.test(q)) return `Normalisé – ${effectiveness}`; if (/^persiste/i.test(q)) { if (iea === undefined) return "Persiste – impact non mesurable"; if (iea >= s.effective) return "Persiste malgré amélioration forte"; if (iea >= s.partial) return "Persiste – amélioration partielle"; if (iea < s.regression) return "Persiste – régression"; return "Persiste – impact faible"; } return q ? `${q} – ${effectiveness}` : effectiveness; }
function latestDate(snapshot: SectorSnapshot) { return [snapshot.prodOptim, snapshot.prodMaintenance, snapshot.prodDeployment, snapshot.prodEngineering].filter((x): x is Date => x instanceof Date && !Number.isNaN(x.getTime())).sort((a,b) => b.getTime() - a.getTime())[0]; }
export function calculateImpact(before: SectorSnapshot, after: SectorSnapshot, settings: Settings): SectorImpactResult {
  let gapDlBefore = 0, gapDlAfter = 0, gapPrbBefore = 0, gapPrbAfter = 0, dlMeasurable = false, prbMeasurable = false;
  const bandResults = {} as SectorImpactResult["bandResults"];
  for (const band of BANDS) {
    const b = before.bands[band], a = after.bands[band], dlBefore = number(b.throughput), dlAfter = number(a.throughput), prbBefore = number(b.prb), prbAfter = number(a.prb);
    const initiallyDegraded = before.degradedBands.includes(band), initiallyCharged = before.chargedBands.includes(band);
    bandResults[band] = { throughputBefore: dlBefore, throughputAfter: dlAfter, throughputGain: throughputGain(dlBefore, dlAfter), prbBefore, prbAfter, prbRelief: prbRelief(prbBefore, prbAfter), initiallyDegraded, initiallyCharged };
    if (initiallyDegraded && dlBefore !== undefined) { const initial = Math.max(0, settings.dlThresholds[band] - dlBefore); if (initial > 0) { dlMeasurable = true; gapDlBefore += initial; gapDlAfter += dlAfter === undefined ? settings.dlThresholds[band] : Math.max(0, settings.dlThresholds[band] - dlAfter); } }
    if (initiallyCharged && prbBefore !== undefined) { const initial = Math.max(0, prbBefore - settings.prbThreshold); if (initial > 0) { prbMeasurable = true; gapPrbBefore += initial; gapPrbAfter += prbAfter === undefined ? 100 - settings.prbThreshold : Math.max(0, prbAfter - settings.prbThreshold); } }
  }
  const trdThroughput = dlMeasurable ? 1 - gapDlAfter / gapDlBefore : undefined;
  const trdPrb = prbMeasurable ? 1 - gapPrbAfter / gapPrbBefore : undefined;
  const iea = trdThroughput !== undefined && trdPrb !== undefined ? trdThroughput * settings.throughputWeight + trdPrb * settings.prbWeight : trdThroughput ?? trdPrb;
  const actionEffectiveness = classifyIea(iea, settings); const initial = before.degradedBands.join("+"); const current = after.degradedBands.join("+");
  return { id: before.sector, sector: before.originalSector, before, after, bandResults, dateAction: latestDate(after), trdThroughput, trdPrb, iea, gapDlBefore: dlMeasurable ? gapDlBefore : undefined, gapDlAfter: dlMeasurable ? gapDlAfter : undefined, gapPrbBefore: prbMeasurable ? gapPrbBefore : undefined, gapPrbAfter: prbMeasurable ? gapPrbAfter : undefined, actionEffectiveness, degradationStatus: after.qualif || "Non renseigné", conclusion: conclusion(after.qualif, actionEffectiveness, iea, settings), confidence: iea === undefined ? "Faible / non mesurable" : "Moyenne – 2 snapshots, trafic non contrôlé", bandMigration: initial && current ? initial === current ? "Même bande(s)" : `Déplacement: ${initial} → ${current}` : "Non renseigné" };
}
export const asNumber = number;
