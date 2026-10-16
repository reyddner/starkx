import type { MemorialInput, MemorialSection } from "../types";

export function buildGeneralDataSection(input: MemorialInput): MemorialSection {
  const g = input.generalData;
  const concreteCap = g?.concreteCap ?? g?.concreteCaps ?? "C30";
  const concretePile = g?.concretePile ?? g?.concretePiles ?? "C20";
  const steelGrades =
    g?.steelGrades?.join(" e ") ?? g?.steelGrade ?? "CA-50 e CA-60";
  const covTop = (g?.coverTop_cm ?? 5.0).toFixed(2);
  const covBot = (g?.coverBottom_cm ?? 5.0).toFixed(2);
  const covLat = (g?.coverLateral_cm ?? 8.0).toFixed(2);
  const covFront = (g?.coverFrontal_cm ?? 5.0).toFixed(2);
  const covStarter = (g?.coverStarter_cm ?? 5.0).toFixed(2);
  const aggMax = (g?.maxAggregateSize_mm ?? 30.0).toFixed(1);
  const leanThick = (g?.leanConcreteThickness_cm ?? 10.0).toFixed(1);

  const paragraphs: string[] = [
    `Concreto: ${concreteCap} (blocos / elementos gerais); ${concretePile} (estacas / infraestrutura profunda).`,
    `Aço estrutural: ${steelGrades}.`,
    `Tamanho máximo do agregado: ${aggMax} mm; Concreto magro de limpeza: ${leanThick} cm.`,
  ];

  if (g?.allowableSoilStressFundamental_MPa != null) {
    paragraphs.push(
      `Tensão admissível em combinações fundamentais: ${g.allowableSoilStressFundamental_MPa.toFixed(3)} MPa`,
    );
  }
  if (g?.allowableSoilStressAccidental_MPa != null) {
    paragraphs.push(
      `Tensão admissível em combinações acidentais: ${g.allowableSoilStressAccidental_MPa.toFixed(3)} MPa`,
    );
  }

  const standards = g?.standards ?? [
    "E.L.U. Concreto em fundações: ABNT NBR 6118:2023 (ELU)",
    "E.L.Util Fissuração. Concreto em fundações: ABNT NBR 6118:2023 (ELS-W)",
    "Projeto e execução de fundações: ABNT NBR 6122:2019",
    "Tensões sobre o terreno: Ações características / NBR 8681",
  ];

  paragraphs.push("Estados limites e normas regulamentadoras aplicáveis:");
  for (const std of standards) {
    paragraphs.push(`• ${std}`);
  }

  return {
    id: "dados_gerais",
    title: "1B. Dados gerais de projeto e normas (NBR 6118 / NBR 6122)",
    paragraphs,
    table: {
      headers: ["Parâmetro de Projeto", "Especificação Adotada"],
      rows: [
        ["Concreto estrutural (blocos / sapatas)", concreteCap],
        ["Concreto estacas / fuste", concretePile],
        ["Aço de armadura", steelGrades],
        ["Cobrimento nominal superior", `${covTop} cm`],
        ["Cobrimento nominal inferior", `${covBot} cm`],
        ["Cobrimento nominal lateral", `${covLat} cm`],
        ["Cobrimento nominal frontal", `${covFront} cm`],
        ["Cobrimento nominal arranques de pilares", `${covStarter} cm`],
        ["Tamanho máximo do agregado graúdo", `${aggMax} mm`],
        ["Espessura de concreto magro / limpeza", `${leanThick} cm`],
      ],
    },
  };
}
