import {
  aggregateProjectTakeoff,
  computeBlockTakeoff,
  computePileTakeoff,
  type ElementTakeoff,
  type ProjectTakeoffSummary,
} from "../../structural-engine/takeoff";
import type { MemorialInput, MemorialSection, MemorialTable } from "../types";

function resolveTakeoffs(input: MemorialInput): {
  elements: ElementTakeoff[];
  summary: ProjectTakeoffSummary;
} {
  if (input.elementTakeoffs && input.elementTakeoffs.length > 0) {
    const summary = input.takeoffSummary ?? aggregateProjectTakeoff(input.elementTakeoffs);
    return { elements: input.elementTakeoffs, summary };
  }

  const elements: ElementTakeoff[] = [];

  // Bloco
  if (input.block) {
    const b = input.block;
    const blockEl = computeBlockTakeoff({
      elementRef: `Bloco (${b.pileCount} estaca${b.pileCount > 1 ? "s" : ""})`,
      pileCount: b.pileCount,
      width_m: b.width_m,
      length_m: b.length_m,
      thickness_m: b.thickness_m,
      pileDiameter_m: input.pile?.diameter_cm ? input.pile.diameter_cm / 100 : 0.40,
    });
    elements.push(blockEl);
  }

  // Estaca(s)
  if (input.pile) {
    const p = input.pile;
    const pileRef = `ESTACA ${Math.round(p.diameter_cm)}cm`;
    const count = input.block ? input.block.pileCount : 1;
    const structDetail = input.structural?.detail;

    for (let i = 0; i < count; i++) {
      const el = computePileTakeoff({
        elementRef: count > 1 ? `${pileRef} (#${i + 1})` : pileRef,
        diameter_m: p.diameter_cm / 100,
        length_m: p.tipDepth_m,
        longitudinalCount: structDetail?.longitudinal.count ?? 8,
        longitudinalDia_mm: structDetail?.longitudinal.diameter_mm ?? 12.5,
        transverseDia_mm: structDetail?.transverse.diameter_mm ?? 8.0,
        transverseSpacing_m: structDetail?.transverse.spacing_m ?? 0.15,
        transverseKind: structDetail?.transverse.kind ?? "stirrup",
        cover_m: structDetail ? structDetail.cover_mm / 1000 : 0.05,
        cageLength_m: structDetail?.cageLength_m ?? p.tipDepth_m,
      });
      elements.push(el);
    }
  }

  const summary = aggregateProjectTakeoff(elements);
  return { elements, summary };
}

export function buildTakeoffSection(input: MemorialInput): MemorialSection {
  const { elements, summary } = resolveTakeoffs(input);

  const tables: MemorialTable[] = [];

  // Tabela 1: Relação de corte e dobra elemento a elemento
  const detailRows: string[][] = [];
  for (const el of elements) {
    for (const item of el.items) {
      detailRows.push([
        el.elementRef,
        item.name,
        `Ø${item.diameter_mm} (${item.steelGrade})`,
        `${item.count} × ${item.unitLength_m.toFixed(2)} m`,
        item.totalLength_m.toFixed(2),
        item.totalWeight_kg.toFixed(2),
        (item.totalWeight_kg * (1 + el.lossPercentage / 100)).toFixed(2),
      ]);
    }
  }

  if (detailRows.length > 0) {
    tables.push({
      title: "Medição de armadura por elemento (corte e dobra)",
      headers: [
        "Elemento",
        "Armadura",
        "Bitola",
        "Qtd × Comp.",
        "Total (m)",
        "Peso líq. (kg)",
        "Com perdas (10%)",
      ],
      rows: detailRows,
    });
  }

  // Tabela 2: Resumo consolidado de medição
  // Identifica quais diâmetros existem na obra
  const standardDias = [4.2, 5.0, 6.3, 8.0, 10.0, 12.5, 16.0, 20.0];
  const activeDias = standardDias.filter(
    (d) => (summary.ca60ByDiameter_kg[d] ?? 0) > 0 || (summary.ca50ByDiameter_kg[d] ?? 0) > 0,
  );
  if (activeDias.length === 0) activeDias.push(8.0, 10.0, 12.5);

  const summaryHeaders = [
    "Elemento",
    ...activeDias.map((d) => `Ø${d}`),
    "Total Aço (kg)",
    "Concreto (m³)",
    "Limpeza (m³)",
  ];

  const summaryRows: string[][] = [];
  for (const el of elements) {
    const row = [el.elementRef];
    for (const d of activeDias) {
      const w = el.byDiameter[d]?.weightWithLoss_kg;
      row.push(w != null && w > 0 ? w.toFixed(2) : "—");
    }
    row.push(el.totalSteelWithLosses_kg.toFixed(2));
    row.push(el.concreteVolume_m3.toFixed(2));
    row.push(el.leanConcreteVolume_m3.toFixed(2));
    summaryRows.push(row);
  }

  // Linha de Totais da obra
  const totalRow = ["TOTAIS DA OBRA"];
  for (const d of activeDias) {
    const tot = (summary.ca60ByDiameter_kg[d] ?? 0) + (summary.ca50ByDiameter_kg[d] ?? 0);
    totalRow.push(tot > 0 ? tot.toFixed(2) : "—");
  }
  totalRow.push(summary.totalSteel_kg.toFixed(2));

  let totConc = 0;
  for (const v of Object.values(summary.concreteByGrade_m3)) totConc += v;
  totalRow.push(totConc.toFixed(2));
  totalRow.push(summary.totalLeanConcrete_m3.toFixed(2));
  summaryRows.push(totalRow);

  tables.push({
    title: "Resumo geral de medição (incluídas perdas de 10% no aço)",
    headers: summaryHeaders,
    rows: summaryRows,
  });

  return {
    id: "medicao",
    title: "12A. Medição e quantitativos (Aço CA-50/CA-60 e Concreto)",
    paragraphs: [
      `Consumo total estimado de aço: ${summary.totalSteel_kg.toFixed(2)} kg (CA-50: ${summary.totalCA50_kg.toFixed(2)} kg; CA-60: ${summary.totalCA60_kg.toFixed(2)} kg, com ${summary.lossPercentage.toFixed(1)}% de perdas).`,
      `Volume total de concreto estrutural: ${totConc.toFixed(2)} m³; concreto magro de limpeza: ${summary.totalLeanConcrete_m3.toFixed(2)} m³.`,
    ],
    tables,
  };
}
