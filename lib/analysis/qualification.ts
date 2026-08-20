export type QualificationStatus = "normalized" | "compromised" | "completed" | "persistent";

const normalize = (value?: string) => (value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function qualificationStatus(value?: string): QualificationStatus {
  const text = normalize(value);
  if (/^normalis/.test(text)) return "normalized";
  if (/^compromis/.test(text)) return "compromised";
  if (/^persiste/.test(text)) return "persistent";
  return "completed";
}

const responsibilityOrder = ["Optim", "Déploiement", "Ingénierie", "Maintenance"];
const responsibilityAliases: Record<string, string> = {
  optim: "Optim", optimisation: "Optim", optimization: "Optim",
  deploiement: "Déploiement", deployment: "Déploiement",
  ingenierie: "Ingénierie", engineering: "Ingénierie",
  maintenance: "Maintenance",
};

/** Canonical form used consistently for filters, summaries, contributions and exports. */
export function qualificationResponsibility(value?: string) {
  const source = (value || "").trim();
  if (!source) return "Non renseigné";
  const parts = source.split(/\s*(?:\+|\/|&|,|\bet\b)\s*/i).filter(Boolean).map((part) => {
    const key = normalize(part).replace(/\s+/g, " ");
    return responsibilityAliases[key] || part.trim().replace(/\s+/g, " ");
  });
  const unique = [...new Set(parts)];
  const known = unique.filter((part) => responsibilityOrder.includes(part)).sort((a, b) => responsibilityOrder.indexOf(a) - responsibilityOrder.indexOf(b));
  const unknown = unique.filter((part) => !responsibilityOrder.includes(part)).sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown].join(" + ");
}

export const qualificationStatusLabel: Record<QualificationStatus, string> = {
  normalized: "Normalisé",
  compromised: "Compromis",
  completed: "Action réalisée / Persiste",
  persistent: "Persiste",
};
