/**
 * Interpretação automática do perfil SPT como zonas geotécnicas.
 * Heurística determinística — não inventa NSPT nem parâmetros de solo.
 */

import type { ConceptionConfidence, SoilProfileInterpretation, SoilZone } from "../types";

export interface InterpretLayer {
  depth_m: number;
  nspt: number;
  soilTypeId?: number;
  description?: string;
}

function zoneKind(meanNspt: number): SoilZone["kind"] {
  if (meanNspt < 5) return "weak";
  if (meanNspt < 12) return "intermediate";
  if (meanNspt < 25) return "competent";
  return "very_competent";
}

function zoneLabel(kind: SoilZone["kind"]): string {
  switch (kind) {
    case "weak":
      return "baixa resistência";
    case "intermediate":
      return "resistência intermediária";
    case "competent":
      return "camada competente";
    case "very_competent":
      return "camada muito resistente";
  }
}

/**
 * Agrupa metros consecutivos com NSPT na mesma classe de resistência.
 */
export function interpretSoilProfile(layers: InterpretLayer[]): SoilProfileInterpretation {
  const sorted = [...layers]
    .filter((l) => Number.isFinite(l.depth_m) && Number.isFinite(l.nspt) && l.depth_m > 0)
    .sort((a, b) => a.depth_m - b.depth_m);

  const notes: string[] = [];
  if (sorted.length === 0) {
    return {
      layerCount: 0,
      maxDepth_m: 0,
      meanNspt: 0,
      zones: [],
      resistantOnset_m: null,
      weakShallow: true,
      notes: ["Sondagem ausente — interpretação impossível."],
      confidence: "low",
    };
  }

  const nspts = sorted.map((l) => l.nspt);
  const meanNspt = nspts.reduce((a, b) => a + b, 0) / nspts.length;
  const maxDepth_m = sorted[sorted.length - 1]!.depth_m;

  const zones: SoilZone[] = [];
  let zStart = 0;
  let zNspts: number[] = [];
  let zKind: SoilZone["kind"] | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const prevDepth = i === 0 ? 0 : sorted[i - 1]!.depth_m;
    const kind = zoneKind(row.nspt);
    if (zKind == null) {
      zKind = kind;
      zStart = prevDepth;
      zNspts = [row.nspt];
      continue;
    }
    if (kind === zKind) {
      zNspts.push(row.nspt);
      continue;
    }
    const mean = zNspts.reduce((a, b) => a + b, 0) / zNspts.length;
    zones.push({
      from_m: zStart,
      to_m: prevDepth,
      meanNspt: Number(mean.toFixed(1)),
      minNspt: Math.min(...zNspts),
      maxNspt: Math.max(...zNspts),
      label: zoneLabel(zKind),
      kind: zKind,
    });
    zKind = kind;
    zStart = prevDepth;
    zNspts = [row.nspt];
  }
  if (zKind != null && zNspts.length > 0) {
    const mean = zNspts.reduce((a, b) => a + b, 0) / zNspts.length;
    zones.push({
      from_m: zStart,
      to_m: maxDepth_m,
      meanNspt: Number(mean.toFixed(1)),
      minNspt: Math.min(...zNspts),
      maxNspt: Math.max(...zNspts),
      label: zoneLabel(zKind),
      kind: zKind,
    });
  }

  const shallow = sorted.filter((l) => l.depth_m <= 3);
  const shallowMean =
    shallow.length > 0
      ? shallow.reduce((a, l) => a + l.nspt, 0) / shallow.length
      : meanNspt;
  const weakShallow = shallowMean < 8;

  const competent = zones.find(
    (z) => (z.kind === "competent" || z.kind === "very_competent") && z.to_m - z.from_m >= 1,
  );
  const resistantOnset_m = competent ? competent.from_m : null;

  if (weakShallow) {
    notes.push("Perfil raso com baixa resistência — fundação profunda tende a ser mais coerente.");
  }
  if (resistantOnset_m != null) {
    notes.push(
      `Aumento relevante de resistência a partir de ~${resistantOnset_m.toFixed(1)} m (${competent!.label}).`,
    );
  } else {
    notes.push("Não há transição clara para camada muito competente no trecho sondado.");
  }

  let confidence: ConceptionConfidence = "medium";
  if (sorted.length < 4) {
    confidence = "low";
    notes.push("Poucas camadas SPT — recomendação preliminar com confiabilidade reduzida.");
  } else if (sorted.length >= 8 && resistantOnset_m != null) {
    confidence = "high";
  }

  const variance =
    nspts.reduce((a, n) => a + (n - meanNspt) ** 2, 0) / Math.max(1, nspts.length);
  if (variance > 80) {
    notes.push("Alta dispersão de NSPT ao longo do perfil — usar critério governante conservador.");
    if (confidence === "high") confidence = "medium";
  }

  return {
    layerCount: sorted.length,
    maxDepth_m,
    meanNspt: Number(meanNspt.toFixed(1)),
    zones,
    resistantOnset_m,
    weakShallow,
    notes,
    confidence,
  };
}
