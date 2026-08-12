export const BANDS = ["L1800", "L2100", "L2600", "L800"] as const;
export type Band = (typeof BANDS)[number];

export interface BandKpi { throughput?: number; prb?: number; traffic?: number; availability?: number; ta?: number }
export interface SectorSnapshot {
  sector: string; originalSector: string; situation?: string; hetsite?: string; dr?: string; plaque?: string; vendor?: string;
  responsibility?: string; action?: string; qualif?: string; degradedBands: Band[]; chargedBands: Band[];
  prodOptim?: Date; prodMaintenance?: Date; prodDeployment?: Date; prodEngineering?: Date;
  bands: Record<Band, BandKpi>;
}
export interface BandImpact extends BandKpi {
  throughputBefore?: number; throughputAfter?: number; throughputGain?: number;
  prbBefore?: number; prbAfter?: number; prbRelief?: number; initiallyDegraded: boolean; initiallyCharged: boolean;
}
export interface SectorImpactResult {
  id: string; sector: string; before: SectorSnapshot; after: SectorSnapshot; bandResults: Record<Band, BandImpact>;
  dateAction?: Date; trdThroughput?: number; trdPrb?: number; iea?: number;
  gapDlBefore?: number; gapDlAfter?: number; gapPrbBefore?: number; gapPrbAfter?: number;
  actionEffectiveness: ActionEffectiveness; degradationStatus: string; conclusion: string; confidence: string; bandMigration: string;
  baselineSource?: "Référence Ookla" | "Fichier BEFORE";
}
export type ActionEffectiveness = "Très efficace" | "Efficace" | "Amélioration partielle" | "Impact faible / non significatif" | "Régression" | "Non mesurable";
export interface Settings { dlThresholds: Record<Band, number>; prbThreshold: number; throughputWeight: number; prbWeight: number; veryEffective: number; effective: number; partial: number; regression: number }
export interface ParseResult { records: Map<string, SectorSnapshot>; allRecords: SectorSnapshot[]; duplicates: string[]; detectedBands: Record<Band, { throughput: boolean; prb: boolean }>; rowCount: number; sheetName: string }
export interface ValidationSummary { beforeRows: number; afterRows: number; common: number; onlyBefore: number; onlyAfter: number; beforeDuplicates: number; afterDuplicates: number; bands: Record<Band, boolean> }
export const defaultSettings: Settings = { dlThresholds: { L1800: 10, L2100: 5, L2600: 10, L800: 5 }, prbThreshold: 70, throughputWeight: .6, prbWeight: .4, veryEffective: .8, effective: .5, partial: .2, regression: -.2 };
