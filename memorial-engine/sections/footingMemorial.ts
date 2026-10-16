import type { MemorialDocument, MemorialInput, MemorialSection } from "../types";
import { buildGeneralDataSection } from "./generalDataSection";
import { buildLoadsSection } from "./loadsSection";
import { formatGeneratedAt } from "../formatDate";

const MVP_SHALLOW_DISCLAIMER =
  "ESCOPO: sem cálculo de recalque. Resultados de pré-dimensionamento — não substituem ART nem a análise do responsável técnico.";

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function buildFootingMemorial(input: MemorialInput): MemorialDocument {
  const f = input.footing!;
  const sections: MemorialSection[] = [
    {
      id: "identificacao",
      title: "1. Identificação do projeto",
      paragraphs: [
        `Projeto: ${input.project.name}`,
        `Código: ${input.project.code || "—"}`,
        `Cliente: ${input.project.client || "—"}`,
        `Local: ${input.project.location || "—"}`,
        `Documento gerado em: ${formatGeneratedAt(input.generatedAtIso)}`,
        `Software: STARKX ${input.softwareVersion}`,
        MVP_SHALLOW_DISCLAIMER,
      ],
    },
    buildGeneralDataSection(input),
    {
      id: "sapata",
      title: "2. Dados da sapata",
      paragraphs: [
        `Forma: ${f.shape === "square" ? "quadrada" : "retangular"}.`,
        `Modo de σadm: ${f.admMode === "user" ? "informado pelo usuário" : "capacidade Vesic (1975)"}.`,
        `Nd = ${fmt(f.Nd_kN, 2)} kN.`,
        `Dimensões: B = ${fmt(f.B_m, 2)} m; L = ${fmt(f.L_m, 2)} m; área = ${fmt(f.area_m2, 2)} m².`,
        `Espessura t = ${fmt(f.thickness_m, 2)} m.`,
        `qadm = ${fmt(f.qadm_kPa, 1)} kPa${f.qult_kPa != null ? `; qult = ${fmt(f.qult_kPa, 1)} kPa` : ""}.`,
        `Tensões: σméd = ${fmt(f.sigmaAvg_kPa, 1)} kPa; σmáx = ${fmt(f.sigmaMax_kPa, 1)} kPa.`,
        f.checksOk
          ? "Verificações geotécnicas/geométricas: OK (sem erros)."
          : "Há verificações com status de erro — revisar dimensões ou parâmetros.",
        ...(f.rebarMessage ? [`Armadura: ${f.rebarMessage}`] : []),
        ...(f.warnings.length ? [`Avisos: ${f.warnings.join("; ")}`] : []),
      ],
    },
    buildLoadsSection(input),
    {
      id: "metodologia",
      title: "3. Metodologia",
      paragraphs: [
        "Dimensionamento geotécnico de sapata isolada conforme footing-engine (DEC-15 / FOOTING_SPEC).",
        "Capacidade: σadm informado ou fatores Vesic (1975) com FS de capacidade.",
        "Estrutural: sapata rígida (h ≥ (B − bp)/3), flexão pelo método CEB-70, biela no contorno do pilar e punção quando flexível (NBR 6118).",
        MVP_SHALLOW_DISCLAIMER,
        "Os valores numéricos são os emitidos pelo footing-engine; o memorial não recalcula.",
      ],
    },
    {
      id: "conclusao",
      title: "4. Conclusão",
      paragraphs: [
        `Sapata ${fmt(f.B_m, 2)} × ${fmt(f.L_m, 2)} m para Nd = ${fmt(f.Nd_kN, 2)} kN (qadm = ${fmt(f.qadm_kPa, 1)} kPa).`,
        "Este documento é gerado automaticamente a partir dos motores determinísticos do STARKX e não substitui a análise e a responsabilidade do engenheiro responsável técnico.",
      ],
    },
    {
      id: "notas",
      title: "5. Notas e responsabilidade técnica",
      paragraphs: [
        "Parâmetros de solo (c′, φ′, γ, Df) e σadm devem ser conferidos pelo projetista.",
        "A emissão de ART/RRT e a assinatura profissional são de responsabilidade do usuário habilitado — o STARKX não as substitui.",
      ],
    },
  ];

  return {
    title: "Memorial de Cálculo — Sapata Isolada",
    subtitle: `${input.project.name} (${input.project.code || "s/ código"})`,
    sections,
  };
}
