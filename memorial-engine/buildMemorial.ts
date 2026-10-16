import type { MemorialDocument, MemorialInput, MemorialSection } from "./types";
import { buildGeneralDataSection } from "./sections/generalDataSection";
import { buildLoadsSection } from "./sections/loadsSection";
import { buildTakeoffSection } from "./sections/takeoffSection";
import { buildFootingMemorial } from "./sections/footingMemorial";
import { buildCaissonMemorial } from "./sections/caissonMemorial";
import { buildRaftMemorial } from "./sections/raftMemorial";
import { formatGeneratedAt } from "./formatDate";

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function methodLabel(id: string): string {
  if (id === "aoki" || id === "aoki_velloso") return "Aoki-Velloso";
  if (id === "decourt" || id === "decourt_quaresma") return "Décourt-Quaresma";
  if (id === "teixeira") return "Teixeira";
  if (id === "average") return "Média dos métodos";
  if (id === "minimum") return "Mínimo dos métodos";
  return id;
}

function verdictLabel(v: string): string {
  if (v === "approved") return "ATENDE";
  if (v === "not_ok") return "NÃO ATENDE";
  return "não aplicável (sem carga de referência)";
}

function modeLabel(mode: string): string {
  void mode;
  return "fórmulas publicadas (Aoki-Velloso 1975; Décourt-Quaresma 1978/1996; Teixeira 1996)";
}

function governingLabel(rule: string, selectedMethod?: string | null): string {
  if (rule === "average") return "média dos métodos";
  if (rule === "minimum") return "mínimo dos métodos";
  if (rule === "user_selected") {
    return `método selecionado pelo usuário (${methodLabel(selectedMethod ?? "—")})`;
  }
  return rule;
}

const PILE_SCOPE_CHECKLIST = [
  "ESCOPO DO DOCUMENTO (projeto vs MVP):",
  "• Capacidade geotécnica Aoki-Velloso / Décourt-Quaresma / Teixeira pelas fórmulas publicadas, com traces — validada contra cálculo independente.",
  "• Grupo rígido N/Mx/My e Padm do grupo com η informada — uso de projeto; sem η, Padm_g é apenas INDICATIVO.",
  "• Armadura de estaca: compressão centrada ou flexo-compressão por integração da seção e cortante pelo Modelo I (NBR 6118); sem efeitos de 2ª ordem.",
  "• Bloco rígido por bielas e tirantes (Blévot; NBR 6118 22.7); bloco flexível verificado à punção — o cálculo como placa fica com o projetista.",
  "• Recalque, atrito negativo (força/down-drag), NA→Padm e LLM/OCR — fora de escopo.",
  "• Com pilar, o produto usa bloco de coroamento (1E+); não apoia o pilar diretamente no fuste.",
  "Este memorial não substitui ART/RRT nem a análise do engenheiro responsável técnico.",
  "STARKX — software livre (AGPL-3.0). Resultados de pré-dimensionamento: conferência e responsabilidade técnica do engenheiro habilitado.",
];

export function buildMemorialDocument(input: MemorialInput): MemorialDocument {
  if (input.footing) {
    return buildFootingMemorial(input);
  }
  if (input.caisson) {
    return buildCaissonMemorial(input);
  }
  if (input.raft) {
    return buildRaftMemorial(input);
  }

  if (!input.pile || !input.methods) {
    throw new Error(
      "Memorial de estaca exige pile + methods (STX-MEM-001: rasas não devem serializar blob de estaca).",
    );
  }
  const pile = input.pile;
  const methods = input.methods;
  const sections: MemorialSection[] = [];

  // 1. Identificação
  sections.push({
    id: "identificacao",
    title: "1. Identificação do projeto",
    paragraphs: [
      `Projeto: ${input.project.name}`,
      `Código: ${input.project.code || "—"}`,
      `Cliente: ${input.project.client || "—"}`,
      `Local: ${input.project.location || "—"}`,
      `Documento gerado em: ${formatGeneratedAt(input.generatedAtIso)}`,
      `Software: STARKX ${input.softwareVersion}`,
      `MODO DE CÁLCULO: ${modeLabel(methods.mode)}.`,
      "STARKX — software livre (AGPL-3.0). Resultados de pré-dimensionamento: conferência e responsabilidade técnica do engenheiro habilitado.",
    ],
  });

  // 1A. Escopo
  sections.push({
    id: "escopo",
    title: "1A. Escopo — o que é cálculo de projeto vs MVP",
    paragraphs: [...PILE_SCOPE_CHECKLIST],
  });

  // 1B. Dados gerais
  sections.push(buildGeneralDataSection(input));

  // 2. Dados do local
  sections.push({
    id: "local",
    title: "2. Dados do local",
    paragraphs: [
      `Nível d'água: ${
        input.site.waterLevel_m == null
          ? "não informado"
          : `${fmt(input.site.waterLevel_m, 2)} m`
      }`,
    ],
  });

  // 3. Dados da estaca
  sections.push({
    id: "estaca",
    title: "3. Dados da estaca",
    paragraphs: [
      `Tipo: ${pile.typeLabel}`,
      `Diâmetro: ${fmt(pile.diameter_cm, 1)} cm`,
      `Comprimento L (a partir do topo): ${fmt(pile.tipDepth_m, 2)} m`,
      ...(pile.pileTopDepth_m != null && pile.pileTopDepth_m > 1e-9
        ? [
            `Topo da estaca abaixo da cota 0: ${fmt(pile.pileTopDepth_m, 2)} m`,
            `Cota de ponta no SPT: ${fmt(pile.sptTipDepth_m ?? pile.tipDepth_m + (pile.pileTopDepth_m ?? 0), 2)} m`,
          ]
        : [`Cota de ponta no SPT: ${fmt(pile.sptTipDepth_m ?? pile.tipDepth_m, 2)} m`]),
      ...(pile.area_cm2 != null
        ? [`Área da seção (informada): ${fmt(pile.area_cm2, 2)} cm²`]
        : []),
      ...(pile.perimeter_cm != null
        ? [`Perímetro (informado): ${fmt(pile.perimeter_cm, 2)} cm`]
        : []),
      ...(input.geotechnical
        ? [
            `Área adotada no cálculo: ${fmt(input.geotechnical.geometry.area_m2 * 1e4, 2)} cm² (${fmt(input.geotechnical.geometry.area_m2, 6)} m²)`,
            `Perímetro adotado no cálculo: ${fmt(input.geotechnical.geometry.perimeter_m * 100, 2)} cm (${fmt(input.geotechnical.geometry.perimeter_m, 4)} m)`,
          ]
        : ["Cálculo geotécnico ainda não executado."]),
    ],
  });

  // 4. Dados geotécnicos
  sections.push({
    id: "geotecnia",
    title: "4. Dados geotécnicos (resumo)",
    paragraphs: [
      `Número de camadas SPT: ${input.layers.length}`,
      `Carga de projeto / solicitação de referência: ${
        input.designLoad_kN == null ? "não informada" : `${fmt(input.designLoad_kN, 2)} kN`
      }`,
    ],
  });

  // 4B. Descrição de cargas
  sections.push(buildLoadsSection(input));

  // 5. Sondagem
  sections.push({
    id: "sondagem",
    title: "5. Sondagem",
    paragraphs: ["Perfil SPT adotado (valores por metro):"],
    table: {
      headers: ["Profundidade (m)", "NSPT", "Solo"],
      rows: input.layers.map((l) => [
        fmt(l.depth_m, 2),
        String(l.nspt),
        l.soilLabel,
      ]),
    },
  });

  // 6. Metodologia
  const m = methods;
  sections.push({
    id: "metodologia",
    title: "6. Metodologia adotada",
    paragraphs: [
      "Capacidade de carga estimada por métodos semi-empíricos baseados em SPT (Aoki-Velloso, Décourt-Quaresma e Teixeira), conforme implementação do STARKX.",
      `Modo de cálculo: ${modeLabel(m.mode)}.`,
      `Critério governante: ${governingLabel(m.governingRule, m.selectedMethod)}.`,
      "Os valores numéricos deste memorial são os emitidos pelo calculation-engine; não há reinterpretação no gerador do memorial.",
    ],
  });

  // 7. Parâmetros
  sections.push({
    id: "parametros",
    title: "7. Parâmetros adotados",
    paragraphs: [
      `Aoki-Velloso — FS: ${fmt(m.aokiFs, 2)}; % ponta: ${fmt(m.aokiPctTip, 1)}; % fuste: ${fmt(m.aokiPctShaft, 1)}`,
      `Décourt-Quaresma — α%: ${m.decourtAlphaPct == null ? "automático (catálogo)" : fmt(m.decourtAlphaPct, 1)}; β%: ${m.decourtBetaPct == null ? "automático (catálogo)" : fmt(m.decourtBetaPct, 1)}`,
      `Teixeira — FS: ${fmt(m.teixeiraFs, 2)}; % ponta: ${fmt(m.teixeiraPctTip, 1)}; % fuste: ${fmt(m.teixeiraPctShaft, 1)}`,
    ],
  });

  // 8. Cálculos
  if (!input.geotechnical) {
    sections.push({
      id: "calculos",
      title: "8. Cálculos",
      paragraphs: [
        "Cálculo geotécnico não disponível. Execute o motor antes de emitir o memorial.",
      ],
    });
  } else {
    const tip = input.geotechnical.atTip;
    const sptTip = pile.sptTipDepth_m ?? pile.tipDepth_m + (pile.pileTopDepth_m ?? 0);
    const tipRow =
      input.geotechnical.profile.find((p) => Math.abs(p.depth_m - sptTip) < 1e-6) ??
      input.geotechnical.profile.at(-1);
    sections.push({
      id: "calculos",
      title: "8. Cálculos (resumo na ponta)",
      paragraphs: [
        `Comprimento L: ${fmt(pile.tipDepth_m, 2)} m · cota de ponta no SPT: ${fmt(sptTip, 2)} m.`,
        tipRow
          ? `SPT pré-processado na ponta — P=${fmt(tipRow.spt.P, 0)}, Q=${fmt(tipRow.spt.Q, 0)}, R=${fmt(tipRow.spt.R, 0)}, S=${fmt(tipRow.spt.S, 0)}, T=${fmt(tipRow.spt.T, 0)}, U=${fmt(tipRow.spt.U, 0)}.`
          : "Camada exatamente na ponta não encontrada no perfil interpolado.",
        "Detalhamento linha a linha dos métodos está disponível nos traços do motor (auditoria).",
        `Quantidade de traços registrados: ${input.geotechnical.traces.length}.`,
      ],
    });

    sections.push({
      id: "comparacao",
      title: "9. Comparação entre métodos",
      paragraphs: ["Capacidade admissível estimada na ponta por método:"],
      table: {
        headers: ["Método", "Rp (kN)", "Rl acum. (kN)", "Rult (kN)", "Padm (kN)"],
        rows: tip.methods.map((x) => [
          methodLabel(x.methodId),
          fmt(x.Rp_kN, 2),
          fmt(x.Rl_acum_kN, 2),
          fmt(x.Rult_kN, 2),
          fmt(x.Padm_kN, 2),
        ]),
      },
    });

    const verifParas: string[] = [
      `Padm (média): ${fmt(tip.averagePadm_kN, 2)} kN`,
      `Padm (mínimo): ${fmt(tip.minimumPadm_kN, 2)} kN`,
      `Padm governante (${methodLabel(String(tip.governingMethodId))}): ${fmt(tip.governingPadm_kN, 2)} kN`,
    ];
    if (input.designLoad_kN != null) {
      const fs =
        tip.governingPadm_kN > 0
          ? tip.governingPadm_kN / input.designLoad_kN
          : null;
      verifParas.push(
        `Solicitação de referência: ${fmt(input.designLoad_kN, 2)} kN`,
        `Verificação: ${verdictLabel(input.geotechnical.verdict)}${
          fs == null ? "" : ` (Padm/N ≈ ${fmt(fs, 2)})`
        }`,
      );
    } else {
      verifParas.push("Carga de projeto não informada — verificação de atendimento omitida.");
    }

    sections.push({
      id: "verificacoes",
      title: "10. Verificações",
      paragraphs: verifParas,
    });

    sections.push({
      id: "resultado",
      title: "11. Resultado final (geotécnico)",
      paragraphs: [
        `Adota-se Padm = ${fmt(tip.governingPadm_kN, 2)} kN conforme critério governante «${m.governingRule}».`,
        ...(input.geotechnical.nominalStructural
          ? [
              `Carga estrutural usual (consulta DEC-09): ${fmt(input.geotechnical.nominalStructural.nominal_kN, 0)} kN para o tipo/Ø informados.${
                input.geotechnical.nominalStructural.exceeded
                  ? " ALERTA: Padm governante supera a carga nominal — revisar estrutural; Padm geotécnico não foi alterado."
                  : " Padm ≤ nominal — sem alerta estrutural do catálogo."
              }`,
            ]
          : [
              "Carga estrutural usual: sem correspondência tipo×diâmetro no catálogo (ou estaca metálica por perfil) — consulta DEC-09 não aplicável.",
            ]),
        ...(input.geotechnical.warnings.length
          ? [`Avisos do motor: ${input.geotechnical.warnings.join("; ")}`]
          : ["Sem avisos do motor geotécnico."]),
      ],
    });
  }

  // 11A. Bloco sobre estacas (todos os pilares quando columnBlocks presente)
  if (input.columnBlocks && input.columnBlocks.length > 0) {
    const rows = input.columnBlocks.map((b) => [
      b.columnLabel,
      `${b.N_kN.toFixed(0)}`,
      `${b.rows}×${b.cols}`,
      `${b.pileCount}`,
      `${fmt(b.width_m, 2)}×${fmt(b.length_m, 2)}×${fmt(b.thickness_m, 2)}`,
      b.groupPadm_kN == null ? "—" : fmt(b.groupPadm_kN, 1),
      b.groupCapacityIndicative ? "indicativo" : b.capacityOk == null ? "—" : b.capacityOk ? "OK" : "NÃO",
    ]);
    sections.push({
      id: "bloco",
      title: `11A. Blocos sobre estacas (${input.columnBlocks.length} pilar(es))`,
      paragraphs: [
        "Cada pilar com carga recebe bloco de coroamento (mesmo 1E). Não se apoia o pilar diretamente no fuste.",
        `Total de estacas no projeto: ${input.columnBlocks.reduce((s, b) => s + b.pileCount, 0)}.`,
        ...input.columnBlocks.flatMap((b) =>
          b.warnings.length ? [`${b.columnLabel}: ${b.warnings.join("; ")}`] : [],
        ),
      ],
      table: {
        title: "Resumo por pilar",
        headers: ["Pilar", "N (kN)", "Grade", "n", "Bloco L×B×t (m)", "Padm_g (kN)", "Veredito"],
        rows,
      },
    });
  } else if (input.block) {
    const b = input.block;
    const padmLabel = b.groupCapacityIndicative
      ? `Padm do grupo INDICATIVO (n × Padm × η=1, soma simples): ${
          b.groupPadm_kN == null ? "—" : `${fmt(b.groupPadm_kN, 2)} kN`
        }. NÃO usar como veredito de projeto (DEC-17).`
      : `Padm do grupo (n × Padm × η=${fmt(b.efficiency, 2)} informada pelo usuário): ${
          b.groupPadm_kN == null ? "—" : `${fmt(b.groupPadm_kN, 2)} kN`
        }.`;
    sections.push({
      id: "bloco",
      title: "11A. Bloco sobre estacas",
      paragraphs: [
        `Layout: ${b.rows} × ${b.cols} = ${b.pileCount} estacas; espaçamento s = ${fmt(b.spacing_m, 3)} m.`,
        `Bloco: ${fmt(b.width_m, 2)} × ${fmt(b.length_m, 2)} m; beiral = ${fmt(b.edge_m, 2)} m; espessura t = ${fmt(b.thickness_m, 2)} m; embutimento estaca = ${fmt(b.embedment_m ?? 0.1, 2)} m (DEC-54).`,
        padmLabel,
        b.groupCapacityIndicative
          ? "Verificação carga × Padm grupo: não aplicável como aprovação — η não informada."
          : b.capacityOk == null
            ? "Verificação carga do bloco × Padm grupo: não aplicável (sem carga ou sem Padm)."
            : b.capacityOk
              ? "Carga do bloco (com peso próprio) ≤ Padm do grupo (com η informada)."
              : "Carga do bloco > Padm do grupo (com η do usuário).",
        ...(b.strutTieMessage
          ? [`Bielas e tirantes (Blévot; NBR 6118 22.7): ${b.strutTieMessage}`]
          : []),
        ...(b.punchingMessage ? [`Bloco flexível — ${b.punchingMessage}`] : []),
        ...(b.rebarMessage ? [`Armadura: ${b.rebarMessage}`] : []),
        ...(b.warnings.length ? [`Avisos: ${b.warnings.join("; ")}`] : []),
      ],
    });
  }

  // 12. Armadura
  if (input.structural) {
    const s = input.structural;
    const d = s.detail;
    const nmMode = s.nm?.mode === "nm";
    const paras = [
      `Status: ${s.status}. ${s.message}`,
      nmMode
        ? "ESCOPO ESTRUTURAL: flexo-compressão por integração da seção (NBR 6118 17.2, Md = max(Msd, M1d,mín)) e cortante pelo Modelo I (17.4.2.2). Sem efeitos de 2ª ordem."
        : "ESCOPO ESTRUTURAL: compressão centrada (sem M/V informados): Nrd = 0,85·fcd·Ac + As·σs(2‰). Sem efeitos de 2ª ordem.",
      `Nd = ${fmt(s.Nd_kN, 2)} kN; Nrd = ${fmt(s.Nrd_kN, 2)} kN; σ = ${fmt(s.sigma_MPa, 3)} MPa.`,
      `As,min = ${fmt(s.As_min_cm2, 2)} cm²; As,calc = ${fmt(s.As_calc_cm2, 2)} cm²; As,nec = ${fmt(s.As_nec_cm2, 2)} cm²; As,máx = ${fmt(s.As_max_cm2, 2)} cm²; As,ef = ${fmt(s.As_ef_cm2, 2)} cm².`,
    ];
    if (nmMode && s.nm) {
      paras.push(
        `Msd = ${fmt(s.nm.Msd_kNm, 2)} kN·m; Md = ${fmt(s.nm.Md_kNm, 2)} kN·m; MRd = ${fmt(s.nm.MRd_kNm, 2)} kN·m; e = ${fmt(s.nm.e_m * 100, 1)} cm.`,
        `Vsd = ${fmt(s.nm.Vsd_kN, 2)} kN; VRd2 = ${fmt(s.nm.VRd2_kN, 2)} kN; Vc = ${fmt(s.nm.Vc_kN, 2)} kN; Asw/s = ${fmt(s.nm.AswPerS_cm2_m, 2)} cm²/m.`,
      );
    }
    if (d) {
      paras.push(
        `Detalhamento: ${d.detailText}`,
        `Longitudinal: ${d.longitudinal.count} φ ${d.longitudinal.diameter_mm} mm (${fmt(d.longitudinal.As_cm2, 2)} cm²).`,
        `Transversal: ${d.transverse.kind === "spiral" ? "espiral" : "estribo"} φ ${d.transverse.diameter_mm} mm c/ ${fmt(d.transverse.spacing_m * 100, 0)} cm.`,
        `Cobrimento = ${fmt(d.cover_mm, 0)} mm; comprimento da gaiola = ${fmt(d.cageLength_m, 2)} m.`,
      );
    }
    paras.push(`Quantidade de traços estruturais: ${s.traces.length}.`);
    sections.push({
      id: "armadura",
      title: nmMode
        ? "12. Armadura (NBR 6122 / NBR 6118 — flexo-compressão e cortante)"
        : "12. Armadura (NBR 6122 / NBR 6118 — compressão centrada; sem N-M)",
      paragraphs: paras,
    });
  } else {
    sections.push({
      id: "armadura",
      title: "12. Armadura",
      paragraphs: [
        "Dimensionamento estrutural não executado neste memorial (opcional).",
      ],
    });
  }

  // 12A. Medição e quantitativos
  sections.push(buildTakeoffSection(input));

  // 13. Conclusão
  const conclusion: string[] = [];
  if (input.geotechnical) {
    conclusion.push(
      `Para a estaca ${pile.typeLabel} ∅${fmt(pile.diameter_cm, 1)} cm com L=${fmt(pile.tipDepth_m, 2)} m (ponta SPT @ ${fmt(pile.sptTipDepth_m ?? pile.tipDepth_m, 2)} m), a capacidade admissível governante é ${fmt(input.geotechnical.atTip.governingPadm_kN, 2)} kN.`,
    );
    if (input.designLoad_kN != null) {
      conclusion.push(
        input.geotechnical.verdict === "approved"
          ? "A solicitação de referência é atendida pelo Padm governante, nas hipóteses deste memorial."
          : input.geotechnical.verdict === "not_ok"
            ? "A solicitação de referência NÃO é atendida pelo Padm governante; revisar geometria, profundidade ou método."
            : "Verificação de atendimento não aplicável.",
      );
    }
  } else {
    conclusion.push("Memorial incompleto: ausente resultado geotécnico.");
  }
  conclusion.push(
    "Este documento é gerado automaticamente a partir dos motores determinísticos do STARKX e não substitui a análise e a responsabilidade do engenheiro responsável técnico.",
  );

  sections.push({
    id: "conclusao",
    title: "13. Conclusão",
    paragraphs: conclusion,
  });

  // 14. Notas e responsabilidade técnica
  sections.push({
    id: "notas",
    title: "14. Notas e responsabilidade técnica",
    paragraphs: [
      "Os métodos semi-empíricos são estimativas; a validação em campo (provas de carga) permanece recomendada conforme boas práticas e NBR 6122.",
      "Parâmetros de solo e tipo de estaca devem ser conferidos pelo projetista.",
      "A emissão de ART/RRT e a assinatura profissional são de responsabilidade do usuário habilitado — o STARKX não as substitui.",
      ...PILE_SCOPE_CHECKLIST,
    ],
  });

  return {
    title: "Memorial de Cálculo — Capacidade de Carga de Estaca",
    subtitle: `${input.project.name} (${input.project.code || "s/ código"})`,
    sections,
  };
}

export function memorialToMarkdown(doc: MemorialDocument): string {
  const lines: string[] = [`# ${doc.title}`, "", `**${doc.subtitle}**`, ""];
  for (const s of doc.sections) {
    lines.push(`## ${s.title}`, "");
    for (const p of s.paragraphs) lines.push(p, "");

    const renderMdTable = (t: { title?: string; headers: string[]; rows: string[][] }) => {
      if (t.title) lines.push(`### ${t.title}`, "");
      lines.push(`| ${t.headers.join(" | ")} |`);
      lines.push(`| ${t.headers.map(() => "---").join(" | ")} |`);
      for (const row of t.rows) {
        lines.push(`| ${row.join(" | ")} |`);
      }
      lines.push("");
    };

    if (s.table) {
      renderMdTable(s.table);
    }
    if (s.tables) {
      for (const t of s.tables) {
        renderMdTable(t);
      }
    }
  }
  return lines.join("\n");
}

export function memorialToHtml(doc: MemorialDocument): string {
  const esc = (t: string) =>
    t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const parts: string[] = [
    `<article class="memorial">`,
    `<header><h1>${esc(doc.title)}</h1><p class="subtitle">${esc(doc.subtitle)}</p></header>`,
  ];
  for (const s of doc.sections) {
    parts.push(`<section id="${esc(s.id)}"><h2>${esc(s.title)}</h2>`);
    for (const p of s.paragraphs) parts.push(`<p>${esc(p)}</p>`);

    const renderHtmlTable = (t: { title?: string; headers: string[]; rows: string[][] }) => {
      if (t.title) parts.push(`<h3>${esc(t.title)}</h3>`);
      parts.push("<table><thead><tr>");
      for (const h of t.headers) parts.push(`<th>${esc(h)}</th>`);
      parts.push("</tr></thead><tbody>");
      for (const row of t.rows) {
        parts.push("<tr>");
        for (const c of row) parts.push(`<td>${esc(c)}</td>`);
        parts.push("</tr>");
      }
      parts.push("</tbody></table>");
    };

    if (s.table) {
      renderHtmlTable(s.table);
    }
    if (s.tables) {
      for (const t of s.tables) {
        renderHtmlTable(t);
      }
    }
    parts.push("</section>");
  }
  parts.push("</article>");
  return parts.join("\n");
}
