import type { MemorialDocument, MemorialInput } from "../types";
import { buildGeneralDataSection } from "./generalDataSection";
import { buildLoadsSection } from "./loadsSection";
import { formatGeneratedAt } from "../formatDate";

const MVP_SHALLOW_DISCLAIMER =
  "ESCOPO: sem cálculo de recalque. Resultados de pré-dimensionamento — não substituem ART nem a análise do responsável técnico.";

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function buildRaftMemorial(input: MemorialInput): MemorialDocument {
  const r = input.raft!;
  return {
    title: "Memorial de Cálculo — Radier",
    subtitle: `${input.project.name} (${input.project.code || "s/ código"})`,
    sections: [
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
        id: "radier",
        title: "2. Dados do radier",
        paragraphs: [
          `Nd = ${fmt(r.Nd_kN, 2)} kN.`,
          `Dimensões: B = ${fmt(r.B_m, 2)} m; L = ${fmt(r.L_m, 2)} m; área = ${fmt(r.area_m2, 2)} m².`,
          `Espessura t = ${fmt(r.thickness_m, 2)} m; qadm = ${fmt(r.qadm_kPa, 1)} kPa.`,
          `Tensões: σméd = ${fmt(r.sigmaAvg_kPa, 1)} kPa; σmáx = ${fmt(r.sigmaMax_kPa, 1)} kPa.`,
          r.checksOk
            ? "Verificações geotécnicas/geométricas: OK (sem erros)."
            : "Há verificações com status de erro — revisar dimensões ou parâmetros.",
          ...(r.rebarMessage ? [`Armadura: ${r.rebarMessage}`] : []),
          ...(r.warnings.length ? [`Avisos: ${r.warnings.join("; ")}`] : []),
        ],
      },
      buildLoadsSection(input),
      {
        id: "metodologia",
        title: "3. Metodologia",
        paragraphs: [
          "Dimensionamento geotécnico conforme raft-engine (DEC-16 / OTHER_FOUNDATIONS_SPEC).",
          "Área e tensões em serviço (σadm ou Vesic); espessura sugerida B/10. Esforços na placa exigem modelo de placa sobre base elástica (fora do escopo).",
          MVP_SHALLOW_DISCLAIMER,
          "Os valores numéricos são os emitidos pelo motor; o memorial não recalcula.",
        ],
      },
      {
        id: "conclusao",
        title: "4. Conclusão",
        paragraphs: [
          `Radier ${fmt(r.B_m, 2)} × ${fmt(r.L_m, 2)} m para Nd = ${fmt(r.Nd_kN, 2)} kN.`,
          "Este documento é gerado automaticamente a partir dos motores determinísticos do STARKX e não substitui a análise e a responsabilidade do engenheiro responsável técnico.",
        ],
      },
      {
        id: "notas",
        title: "5. Notas e responsabilidade técnica",
        paragraphs: [
          "Não inclui flexão, punção nem recalque diferencial — a cargo do projetista estrutural/geotécnico.",
          "A emissão de ART/RRT e a assinatura profissional são de responsabilidade do usuário habilitado — o STARKX não as substitui.",
        ],
      },
    ],
  };
}
