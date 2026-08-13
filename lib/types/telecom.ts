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
  /** IEA-E: évolution des KPI, indépendante du statut initial de la bande. */
  throughputEvolution?: number; prbEvolution?: number; ieaEvolution?: number;
  evolutionTrafficWeight?: number; evolutionCoverage?: "Complète" | "Partielle";
}
export interface SectorImpactResult {
  id: string; sector: string; before: SectorSnapshot; after: SectorSnapshot; bandResults: Record<Band, BandImpact>;
  dateAction?: Date; trdThroughput?: number; trdPrb?: number; iea?: number;
  gapDlBefore?: number; gapDlAfter?: number; gapPrbBefore?: number; gapPrbAfter?: number;
  actionEffectiveness: ActionEffectiveness; degradationStatus: string; conclusion: string; confidence: string; bandMigration: string;
  baselineSource?: "Référence Ookla" | "Fichier BEFORE";
  afterKpiWarning?: string;
  /** IEA-E: comparaison globale BEFORE → AFTER. */
  ieaEvolution?: number;
  evolutionEffectiveness?: EvolutionEffectiveness;
  evolutionWeighting?: "Pondération trafic" | "Pondération de secours" | "Non mesurable";
  evolutionCoverage?: "Complète" | "Partielle" | "Non mesurable";
  evolutionTrafficTotal?: number;
  evolutionContributionEligible?: boolean;
}
export type ActionEffectiveness = "Très efficace" | "Efficace" | "Amélioration partielle" | "Impact faible / non significatif" | "Régression" | "Non mesurable";
export type EvolutionEffectiveness = "Forte amélioration" | "Amélioration" | "Stable / non significatif" | "Régression" | "Forte régression" | "Non mesurable";
export interface Settings { dlThresholds: Record<Band, number>; prbThreshold: number; throughputWeight: number; prbWeight: number; veryEffective: number; effective: number; partial: number; regression: number; evolutionStable: number; evolutionStrong: number }
export interface ParseResult { records: Map<string, SectorSnapshot>; allRecords: SectorSnapshot[]; duplicates: string[]; detectedBands: Record<Band, { throughput: boolean; prb: boolean }>; rowCount: number; sheetName: string; format: "qualification" | "kpi-snapshot" }
export interface ValidationSummary { beforeRows: number; afterRows: number; common: number; onlyBefore: number; onlyAfter: number; beforeDuplicates: number; afterDuplicates: number; bands: Record<Band, boolean> }
export const defaultSettings: Settings = { dlThresholds: { L1800: 10, L2100: 5, L2600: 10, L800: 5 }, prbThreshold: 70, throughputWeight: .6, prbWeight: .4, veryEffective: .8, effective: .5, partial: .2, regression: -.2, evolutionStable: .05, evolutionStrong: .2 };
