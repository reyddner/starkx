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

export function buildCaissonMemorial(input: MemorialInput): MemorialDocument {
  const c = input.caisson!;
  return {
    title: "Memorial de Cálculo — Tubulão",
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
        id: "tubulao",
        title: "2. Dados do tubulão",
        paragraphs: [
          `Fuste ∅ = ${fmt(c.shaftDiameter_m, 2)} m; base ∅ = ${fmt(c.baseDiameter_m, 2)} m; L = ${fmt(c.length_m, 2)} m.`,
          `Nd = ${fmt(c.Nd_kN, 2)} kN.`,
          `Rp adm = ${fmt(c.Rp_adm_kN, 2)} kN; Rl adm = ${fmt(c.Rl_adm_kN, 2)} kN; Padm = ${fmt(c.Padm_kN, 2)} kN.`,
          `Modo do fuste: ${
            c.shaftMode === "spt_aoki" ? "α·NSPT (Aoki / analogia escavada)" : "fs informado"
          }.`,
          `Veredito: ${c.verdict === "approved" ? "ATENDE" : "NÃO ATENDE"}.`,
          ...(c.rebarMessage ? [`Armadura: ${c.rebarMessage}`] : []),
          ...(c.warnings.length ? [`Avisos: ${c.warnings.join("; ")}`] : []),
        ],
      },
      buildLoadsSection(input),
      {
        id: "metodologia",
        title: "3. Metodologia",
        paragraphs: [
          "Capacidade geotécnica conforme caisson-engine (DEC-16 / DEC-22 / DEC-25 / OTHER_FOUNDATIONS_SPEC).",
          "Ponta: σadm informado ou Vesic circular; fuste: atrito unitário ou α·NSPT (Aoki).",
          "As,mín do fuste (ρ=0,4 %, analogia escavada) é orientação — não fecha N-M.",
          MVP_SHALLOW_DISCLAIMER,
          "Os valores numéricos são os emitidos pelo motor; o memorial não recalcula.",
        ],
      },
      {
        id: "conclusao",
        title: "4. Conclusão",
        paragraphs: [
          `Padm = ${fmt(c.Padm_kN, 2)} kN para Nd = ${fmt(c.Nd_kN, 2)} kN.`,
          "Este documento é gerado automaticamente a partir dos motores determinísticos do STARKX e não substitui a análise e a responsabilidade do engenheiro responsável técnico.",
        ],
      },
      {
        id: "notas",
        title: "5. Notas e responsabilidade técnica",
        paragraphs: [
          "Parâmetros de solo e fs lateral devem ser conferidos pelo projetista.",
          "A emissão de ART/RRT e a assinatura profissional são de responsabilidade do usuário habilitado — o STARKX não as substitui.",
        ],
      },
    ],
  };
}
