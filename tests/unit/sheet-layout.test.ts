import { beforeEach, describe, expect, it } from "vitest";
import { footingDesignBaseFrom, useProjectStore } from "../../apps/web/src/store/projectStore";
import { buildProjectOutputs } from "../../apps/web/src/store/buildProjectOutputs";
import { createColumn } from "../../apps/web/src/store/columns";
import { buildProjectDrawingBook, type DrawingProjectBook } from "../../drawing-engine";
import { estimateTextWidthMm } from "../../drawing-engine/core/textFit";
import { checkSheetLayout, loadFonts } from "../fixtures/sheetLayout";

type StoreState = ReturnType<typeof useProjectStore.getState>;

const LONG_TITLE = {
  projectName: "Edifício Residencial Exemplo de Nome Bem Comprido — Bloco A e Bloco B",
  projectCode: "STX-2026-001",
  client: "Construtora e Incorporadora de Nome Comprido Ltda",
  location: "Rua das Palmeiras, 1234 — Centro — Cidade Grande/UF",
  responsibleEngineer: "Eng. Fulano de Tal da Silva Sauro",
  engineerCrea: "CREA-XX 123456/D",
};

function book(): DrawingProjectBook {
  const s: StoreState = useProjectStore.getState();
  const out = buildProjectOutputs({
    ...LONG_TITLE,
    companyLogoBase64: null,
    foundationKind: s.foundationKind,
    columns: s.columns,
    activeColumnId: s.activeColumnId,
    diameterCm: s.diameterCm,
    tipDepth_m: s.tipDepth_m,
    blockRows: s.blockRows,
    blockCols: s.blockCols,
    blockSpacing_m: s.blockSpacing_m,
    blockEdge_m: s.blockEdge_m,
    blockThickness_m: s.blockThickness_m,
    blockEfficiency: s.blockEfficiency,
    blockEmbedment_m: s.blockEmbedment_m,
    padm_kN: s.result?.atTip.governingPadm_kN ?? null,
    blockResult: s.blockResult,
    structural: s.structural,
    footingResult: s.footingResult,
    footingDesignBase: footingDesignBaseFrom(s),
    fck_MPa: s.fck_MPa,
    fyk_MPa: s.fyk_MPa,
    pileTypeId: s.pileTypeId,
    loadIsDesign: s.loadIsDesign,
    cover_mm: s.cover_mm,
    designLoad_kN: s.designLoad_kN,
  });
  return buildProjectDrawingBook({ ...out.drawingInput, date: "16/10/2026" });
}

function expectCleanLayout(b: DrawingProjectBook) {
  const report: string[] = [];
  for (const sheet of b.sheets) {
    for (const issue of checkSheetLayout(sheet)) {
      report.push(`folha ${sheet.sheetNumber} (${sheet.elementRef}) ${issue.kind}: ${issue.detail}`);
    }
  }
  expect(report).toEqual([]);
}

function setColumns(loads: number[]) {
  const cols: ReturnType<typeof createColumn>[] = [];
  loads.forEach((N, i) => {
    cols.push(createColumn({ columnLabel: `P${String(i + 1).padStart(2, "0")}`, N_kN: N }, cols));
  });
  useProjectStore.setState({
    mode: "engineering",
    columns: cols,
    activeColumnId: cols[0]!.id,
    columnLoad: { ...useProjectStore.getState().columnLoad, N_kN: loads[0]!, columnLabel: "P01" },
    designLoad_kN: loads[0]!,
  });
}

describe("diagramação das pranchas (margem, sobreposição, altura de letra)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetBlankProject();
    useProjectStore.getState().loadReferenceExample();
  });

  it("larguras da tabela Helvetica conferem com as do PDF (sem kerning, ±2 %)", async () => {
    const f = await loadFonts();
    for (const t of ["RELAÇÃO DO AÇO", "Subtotal CA-50: 157.83 kg", "Bloco 12E (D30cm)", "Wm iI"]) {
      const plain = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
      for (const [bold, font] of [[false, f.regular], [true, f.bold]] as const) {
        const ref = font.widthOfTextAtSize(plain, 10);
        expect(Math.abs(estimateTextWidthMm(t, 10, bold) - ref) / ref).toBeLessThan(0.02);
      }
    }
  });

  it("estaca isolada (exemplo de referência)", async () => {
    useProjectStore.getState().runCalculation({ preserveStep: true });
    useProjectStore.getState().prepareDrawings();
    expectCleanLayout(book());
  });

  it("blocos de 1 a 12 estacas, vários pilares", async () => {
    setColumns([80, 900, 1800, 400]);
    useProjectStore.setState({ foundationKind: "pile_cap" });
    useProjectStore.getState().runCalculation({ preserveStep: true, skipArrangement: true });
    useProjectStore.getState().prepareDrawings();
    const b = book();
    expect(b.sheets.length).toBeGreaterThanOrEqual(5);
    expectCleanLayout(b);
  });

  it("sapatas com armadura (fck informado), vários pilares", async () => {
    setColumns([300, 1200, 2200]);
    useProjectStore.setState({ foundationKind: "footing", fck_MPa: 25 });
    useProjectStore.getState().runFootingDesign({ preserveStep: true });
    useProjectStore.getState().prepareDrawings();
    expectCleanLayout(book());
  });

  it("sapata sem fck (sem armadura calculada)", async () => {
    setColumns([1200]);
    useProjectStore.setState({ foundationKind: "footing", fck_MPa: null });
    useProjectStore.getState().runFootingDesign({ preserveStep: true });
    useProjectStore.getState().prepareDrawings();
    expectCleanLayout(book());
  });
});
