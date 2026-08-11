export type QualificationStatus = "normalized" | "compromised" | "completed" | "persistent";

const normalize = (value?: string) => (value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function qualificationStatus(value?: string): QualificationStatus {
  const text = normalize(value);
  if (/^normalis/.test(text)) return "normalized";
  if (/^compromis/.test(text)) return "compromised";
  if (/^persiste/.test(text)) return "persistent";
  return "completed";
}

export function qualificationResponsibility(value?: string) {
  const text = (value || "Non renseigné").trim();
  return text.toLowerCase() === "maintenance" ? "Maintenance" : text;
}

export const qualificationStatusLabel: Record<QualificationStatus, string> = {
  normalized: "Normalisé",
  compromised: "Compromis",
  completed: "Action réalisée / Persiste",
  persistent: "Persiste",
};
