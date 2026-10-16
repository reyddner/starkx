import type { MemorialInput, MemorialSection } from "../types";

export function buildLoadsSection(input: MemorialInput): MemorialSection {
  const rows: string[][] = [];

  if (input.loadsTable && input.loadsTable.length > 0) {
    for (const l of input.loadsTable) {
      const ref = l.element ?? l.ref ?? "P-1";
      const axial = l.N_kN ?? l.axial_kN ?? 0;
      const mx = l.Mx_kNm ?? l.momentX_kNm ?? 0;
      const my = l.My_kNm ?? l.momentY_kNm ?? 0;
      const vx = l.Vx_kN ?? l.shearX_kN ?? 0;
      const vy = l.Vy_kN ?? l.shearY_kN ?? 0;
      const mt = l.Mt_kNm ?? l.torsion_kNm ?? 0;

      rows.push([
        ref,
        axial.toFixed(2),
        mx.toFixed(2),
        my.toFixed(2),
        vx.toFixed(2),
        vy.toFixed(2),
        mt.toFixed(2),
      ]);
    }
  } else {
    const axial = input.designLoad_kN ?? 0;
    const nm = input.structural?.nm;
    const mx = nm?.mode === "nm" ? nm.Msd_kNm : 0;
    const vx = nm?.mode === "nm" ? nm.Vsd_kN : 0;
    const ref = input.project.code || input.project.name || "P-1";

    rows.push([
      ref,
      axial.toFixed(2),
      mx.toFixed(2),
      "0.00",
      vx.toFixed(2),
      "0.00",
      "0.00",
    ]);
  }

  return {
    id: "descricao_cargas",
    title: "4B. Descrição de cargas (Ações atuantes)",
    paragraphs: [
      "Esforços axiais, momentos fletores e cortantes atuantes:",
    ],
    table: {
      headers: [
        "Elemento",
        "Axial N (kN)",
        "Mx (kN·m)",
        "My (kN·m)",
        "Vx (kN)",
        "Vy (kN)",
        "Mt (kN·m)",
      ],
      rows,
    },
  };
}
