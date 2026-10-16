/**
 * Assistente de engenharia — Fase 10 (DEC-27).
 * Regra de ouro: NUNCA calcula Padm/As/σ. Só interpreta resultados já emitidos
 * pelos motores e propõe patches para o usuário confirmar + recalcular no engine.
 */

export type AssistSeverity = "info" | "warning" | "tip";

export interface AssistAction {
  id: string;
  label: string;
  /** Patch aplicado no store; o cálculo real ocorre só após runCalculation/run*. */
  patch: Record<string, number | string | boolean | null>;
}

export interface AssistFinding {
  id: string;
  severity: AssistSeverity;
  title: string;
  message: string;
  actions?: AssistAction[];
}

export interface AssistPileSnapshot {
  tipDepth_m: number;
  diameterCm: number;
  designLoad_kN: number | null;
  mode: string;
  governingPadm_kN: number;
  averagePadm_kN: number;
  minimumPadm_kN: number;
  verdict: string;
  governingMethodId: string;
  layerCount: number;
  maxLayerDepth_m: number;
  warnings: string[];
  /** Spread relativo (avg-min)/avg */
  methodSpread?: number;
  /** DEC-09 — carga estrutural usual */
  nominal_kN?: number | null;
  nominalExceeded?: boolean;
}

export interface AssistBlockSnapshot {
  efficiencyUserProvided: boolean;
  groupCapacityIndicative: boolean;
  capacityOk: boolean | null;
  punchingOk: boolean | null;
  strutOk: boolean | null;
}

export interface AssistShallowSnapshot {
  kind: "footing" | "caisson" | "raft";
  Nd_kN: number;
  /** Capacidade ou Padm quando aplicável */
  capacity_kN?: number | null;
  qadm_kPa?: number | null;
  sigmaMax_kPa?: number | null;
  hasErrors: boolean;
  hasWarnings: boolean;
  rebarMessage?: string | null;
}

export interface AssistInput {
  foundationKind: "pile" | "pile_cap" | "footing" | "caisson" | "raft";
  pile?: AssistPileSnapshot | null;
  block?: AssistBlockSnapshot | null;
  shallow?: AssistShallowSnapshot | null;
  /** @deprecated use shallow */
  shallowVerdict?: "approved" | "not_ok" | "checks_error" | null;
}

const METHOD_LABEL: Record<string, string> = {
  aoki_velloso: "Aoki-Velloso",
  decourt_quaresma: "Décourt-Quaresma",
  teixeira: "Teixeira",
  average: "média",
  minimum: "mínimo",
  user_selected: "método selecionado",
};

/**
 * Analisa snapshot de resultados. Determinístico, sem rede, sem LLM.
 */
export function analyzeAssist(input: AssistInput): AssistFinding[] {
  const out: AssistFinding[] = [];

  out.push({
    id: "scope.ai",
    severity: "info",
    title: "Assistente (Fase 10)",
    message:
      "Sugestões heurísticas — não substituem o motor nem a ART. Qualquer alteração numérica só vale após você confirmar e o STARKX recalcular nos engines.",
  });

  if (input.pile) {
    analyzePile(input.pile, out, input.foundationKind);
  }
  if (input.block) {
    analyzeBlock(input.block, out);
  }
  if (input.shallow) {
    analyzeShallow(input.shallow, out);
  } else if (input.shallowVerdict === "not_ok" || input.shallowVerdict === "checks_error") {
    out.push({
      id: "shallow.not_ok",
      severity: "warning",
      title: "Fundação rasa / tubulão não atende",
      message:
        "Revise carga, σadm/FS ou geometria e dimensione de novo no motor correspondente. O assistente não inventa dimensões.",
    });
  }

  return out;
}

function analyzeShallow(s: AssistShallowSnapshot, out: AssistFinding[]): void {
  const label =
    s.kind === "footing" ? "sapata" : s.kind === "caisson" ? "tubulão" : "radier";

  out.push({
    id: "shallow.summary",
    severity: "info",
    title: `Resumo — ${label}`,
    message: `Nd = ${s.Nd_kN.toFixed(1)} kN${
      s.capacity_kN != null ? ` · capacidade/Padm ≈ ${s.capacity_kN.toFixed(1)} kN` : ""
    }${s.qadm_kPa != null ? ` · qadm ≈ ${s.qadm_kPa.toFixed(1)} kPa` : ""}.`,
  });

  if (s.hasErrors) {
    out.push({
      id: "shallow.errors",
      severity: "warning",
      title: "Verificações com erro",
      message:
        "Há checks com status de erro no motor. Ajuste parâmetros e dimensione novamente — o assistente não altera geometria sozinho.",
    });
  } else if (s.hasWarnings) {
    out.push({
      id: "shallow.warnings",
      severity: "tip",
      title: "Avisos do motor",
      message: "Há avisos (espessura, escopo MVP, etc.). Revise traces e disclaimers antes da ART.",
    });
  }

  if (s.sigmaMax_kPa != null && s.qadm_kPa != null && s.sigmaMax_kPa > s.qadm_kPa * 1.02) {
    out.push({
      id: "shallow.pressure",
      severity: "warning",
      title: "Tensão acima de qadm",
      message: `σmáx ≈ ${s.sigmaMax_kPa.toFixed(1)} kPa > qadm ≈ ${s.qadm_kPa.toFixed(1)} kPa. Aumente área ou revise σadm/FS no motor.`,
    });
  }

  if (s.capacity_kN != null && s.capacity_kN + 1e-6 < s.Nd_kN) {
    out.push({
      id: "shallow.capacity",
      severity: "warning",
      title: "Capacidade < Nd",
      message: `Padm/capacidade ${s.capacity_kN.toFixed(1)} kN < Nd ${s.Nd_kN.toFixed(1)} kN. Revise geometria ou parâmetros de solo no engine.`,
    });
  }

  if (s.rebarMessage) {
    out.push({
      id: "shallow.rebar",
      severity: "tip",
      title: "Armadura",
      message: s.rebarMessage,
    });
  }
}

function analyzePile(
  p: AssistPileSnapshot,
  out: AssistFinding[],
  foundationKind: AssistInput["foundationKind"],
): void {
  const gov =
    METHOD_LABEL[p.governingMethodId] ?? p.governingMethodId;
  const isGroup = foundationKind === "pile_cap";

  out.push({
    id: "pile.governante",
    severity: "info",
    title: "Método governante",
    message: `Padm governante = ${p.governingPadm_kN.toFixed(1)} kN (${gov}). Média ${p.averagePadm_kN.toFixed(1)} · mínimo ${p.minimumPadm_kN.toFixed(1)} kN. Modo «${p.mode}».`,
  });

  if (p.layerCount < 3) {
    out.push({
      id: "pile.layers.few",
      severity: "tip",
      title: "Sondagem curta",
      message:
        `O quê: só ${p.layerCount} camada(s) SPT. Por quê: semi-empíricos (Aoki/Décourt/Teixeira) perdem resolução com perfil curto. Como corrigir: complete o boletim metro a metro até abaixo da ponta prevista.`,
    });
  }

  if (p.maxLayerDepth_m + 1e-9 < p.tipDepth_m) {
    out.push({
      id: "pile.layers.short",
      severity: "tip",
      title: "Ponta abaixo da sondagem",
      message:
        `O quê: ponta em ${p.tipDepth_m} m, sondagem termina em ${p.maxLayerDepth_m} m. Por quê: o motor precisa de NSPT na cota de apoio. Como corrigir: estenda as camadas SPT ou reduza a cota de apoio para um metro existente no perfil.`,
    });
  }

  // Em bloco, a comparação N vs Padm_estaca é enganosa — o grupo/bloco já dimensiona n.
  if (
    !isGroup &&
    p.verdict === "not_ok" &&
    p.designLoad_kN != null &&
    p.designLoad_kN > 0
  ) {
    const deeper = Math.ceil(p.tipDepth_m) + 1;
    const wider = p.diameterCm >= 50 ? p.diameterCm + 10 : p.diameterCm + 5;
    out.push({
      id: "pile.capacity.fail",
      severity: "warning",
      title: "Capacidade insuficiente",
      message:
        `O quê: Padm ${p.governingPadm_kN.toFixed(1)} kN < carga solicitante ${p.designLoad_kN.toFixed(1)} kN. Por quê: a capacidade geotécnica governante não cobre o esforço do pilar. Como corrigir: o STARKX tenta aumentar o número de estacas automaticamente; se ainda falhar, aumente comprimento/diâmetro ou revise o solo.`,
      actions: [
        {
          id: "deeper",
          label: `Testar ponta L = ${deeper} m`,
          patch: { tipDepth_m: deeper },
        },
        {
          id: "wider",
          label: `Testar Ø = ${wider} cm`,
          patch: { diameterCm: wider },
        },
      ],
    });
  }

  if (!isGroup && p.verdict === "approved" && p.designLoad_kN != null) {
    const fs = p.governingPadm_kN / p.designLoad_kN;
    if (fs > 0 && fs < 1.15) {
      out.push({
        id: "pile.capacity.tight",
        severity: "tip",
        title: "Folga apertada",
        message:
          `O quê: Padm/N ≈ ${fs.toFixed(2)}. Por quê: pouca margem entre capacidade e solicitação. Como corrigir: confirme FS de projeto com o RT ou aumente geometria/n.`,
      });
    }
  }

  if (p.nominal_kN != null && p.nominalExceeded) {
    out.push({
      id: "pile.nominal.exceeded",
      severity: "tip",
      title: "Padm > carga estrutural usual",
      message:
        `O quê: Padm ${p.governingPadm_kN.toFixed(1)} kN > carga estrutural usual ${p.nominal_kN.toFixed(0)} kN. Por quê: alerta estrutural orientativo (DEC-09) — o geotécnico não é cortado. Como corrigir: revise armadura/seção com o RT; o Padm geotécnico permanece o do motor.`,
    });
  } else if (p.nominal_kN != null) {
    out.push({
      id: "pile.nominal.ok",
      severity: "info",
      title: "Carga estrutural usual",
      message: `Carga estrutural usual: ${p.nominal_kN.toFixed(0)} kN para este tipo/Ø. Padm governante ${p.governingPadm_kN.toFixed(1)} kN ≤ nominal.`,
    });
  }

  const spread =
    p.methodSpread ??
    (p.averagePadm_kN > 0
      ? (p.averagePadm_kN - p.minimumPadm_kN) / p.averagePadm_kN
      : 0);
  if (spread > 0.25) {
    out.push({
      id: "pile.methods.spread",
      severity: "tip",
      title: "Dispersão entre métodos",
      message:
        `O quê: diferença média×mínimo ~ ${(spread * 100).toFixed(0)} %. Por quê: métodos semi-empíricos divergem neste perfil. Como corrigir: inspecione os traces e confirme o critério governante (mínimo/média/método).`,
    });
  }

  for (const w of p.warnings.slice(0, 3)) {
    if (/DEC-09|carga estrutural usual/i.test(w)) continue;
    // NSPT abaixo / DEC-47 / η — tip (já conhecidos e ruidosos como warning)
    const soft =
      /2 m abaixo|~2 m abaixo|DEC-47|η\s*=|INDICATIVO/i.test(w);
    out.push({
      id: `pile.warn.${out.length}`,
      severity: soft ? "tip" : "warning",
      title: soft ? "Nota do motor" : "Aviso do motor",
      message: w,
    });
  }
}

function analyzeBlock(b: AssistBlockSnapshot, out: AssistFinding[]): void {
  if (b.groupCapacityIndicative || !b.efficiencyUserProvided) {
    out.push({
      id: "block.eta",
      severity: "tip",
      title: "η do grupo não informada",
      message:
        "O quê: Padm do grupo está só indicativo (η=1). Por quê: sem eficiência de grupo não há veredito de capacidade de projeto (DEC-17). Como corrigir: informe η na etapa Bloco ou use «Usar η Converse-Labarre», depois redesenhe o bloco.",
    });
  }
  if (b.capacityOk === false) {
    out.push({
      id: "block.capacity",
      severity: "warning",
      title: "Grupo insuficiente",
      message:
        "O quê: carga do bloco supera Padm_g com η informada. Por quê: capacidade do grupo < solicitação. Como corrigir: aumente n de estacas, comprimento/diâmetro (Padm) ou revise η.",
    });
  }
  if (b.punchingOk === false) {
    out.push({
      id: "block.punching",
      severity: "warning",
      title: "Punção da estaca no bloco",
      message:
        "O quê: punção não atende (bloco flexível). Por quê: altura útil insuficiente para a reação da estaca (NBR 6118 19.5). Como corrigir: aumente a altura até o bloco ficar rígido, h ≥ (a − ap)/3.",
    });
  }
  if (b.strutOk === false) {
    out.push({
      id: "block.strut",
      severity: "warning",
      title: "Bielas do bloco",
      message:
        "O quê: tensão nas bielas acima do limite de Blévot. Por quê: pilar pequeno, estaca pequena ou bielas muito abatidas. Como corrigir: aumente a altura do bloco (θ maior), a seção do pilar ou o diâmetro da estaca.",
    });
  }
}
