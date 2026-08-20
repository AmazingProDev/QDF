import { describe, expect, it } from "vitest";
import { qualificationResponsibility } from "@/lib/analysis/qualification";

describe("normalisation des responsabilités", () => {
  it("unifies casing, accents, spaces and aliases", () => {
    expect(qualificationResponsibility(" ingénierie ")).toBe("Ingénierie");
    expect(qualificationResponsibility("INGENIERIE")).toBe("Ingénierie");
    expect(qualificationResponsibility("deploiement")).toBe("Déploiement");
    expect(qualificationResponsibility("MAINTENANCE")).toBe("Maintenance");
  });

  it("unifies combined responsibilities regardless of separator or order", () => {
    expect(qualificationResponsibility("maintenance + optim")).toBe("Optim + Maintenance");
    expect(qualificationResponsibility("Ingénierie/Optim")).toBe("Optim + Ingénierie");
    expect(qualificationResponsibility("Déploiement et Maintenance")).toBe("Déploiement + Maintenance");
  });
});
