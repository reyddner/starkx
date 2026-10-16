import { describe, expect, it } from "vitest";
import { calculate } from "@engine/index";
import { designPileReinforcement } from "@structural/index";
import {
  buildMemorialDocument,
  memorialToMarkdown,
} from "@memorial/index";
import { flatStoreToGeotechnicalInput } from "@domain/adapters/from-flat-ui";
import { refInput, refExpected } from "../fixtures/reference";

/**
 * E2E lógico do caminho inauguração (DEC-32):
 * flat UI → geotécnico (exemplo) → estrutural → memorial (sem browser).
 */
describe("fluxo do exemplo (E2E lógico)", () => {
  it("Padm do oráculo + armadura + memorial com escopo estrutural", () => {
    const geoInput = flatStoreToGeotechnicalInput(
      {
        pileTypeId: 6,
        diameterCm: 30,
        tipDepth_m: 8,
        waterLevel_m: null,
        layers: refInput.layers,
        designLoad_kN: 150,
      },
      {
        mode: "engineering",
        governingRule: "minimum",
        aoki: { fs: 2, pctTip: 100, pctShaft: 100 },
        decourt: {},
        teixeira: { fs: 2, pctTip: 100, pctShaft: 100 },
      },
    );

    const geo = calculate(geoInput);
    expect(geo.atTip.governingPadm_kN).toBeCloseTo(refExpected.minimumPadm_kN, 6);
    expect(geo.verdict).toBe("approved");

    const structural = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 8,
      Nk_kN: 150,
      loadIsDesign: false,
    });
    expect(structural.detail).not.toBeNull();
    expect(structural.Nrd_kN).toBeGreaterThan(0);

    const md = memorialToMarkdown(
      buildMemorialDocument({
        generatedAtIso: "2026-09-10T12:00:00.000Z",
        softwareVersion: "0.1.0",
        project: {
          name: "Exemplo — estaca escavada Ø30 cm",
          code: "EX-01",
          client: "Demo",
          location: "BR",
        },
        pile: {
          typeLabel: "Escavada",
          diameter_cm: 30,
          tipDepth_m: 8,
        },
        site: { waterLevel_m: null },
        layers: refInput.layers.map((l) => ({
          depth_m: l.depth_m,
          nspt: l.nspt,
          soilLabel: `solo ${l.soilTypeId}`,
        })),
        designLoad_kN: 150,
        methods: {
          mode: "engineering",
          governingRule: "minimum",
          aokiFs: 2,
          aokiPctTip: 100,
          aokiPctShaft: 100,
          decourtAlphaPct: null,
          decourtBetaPct: null,
          teixeiraFs: 2,
          teixeiraPctTip: 100,
          teixeiraPctShaft: 100,
        },
        geotechnical: geo,
        structural,
      }),
    );

    expect(md).toContain(geo.atTip.governingPadm_kN.toFixed(2));
    expect(md).toContain(geo.atTip.averagePadm_kN.toFixed(2));
    expect(md).toMatch(/compressão centrada/i);
    expect(md).toMatch(/2ª ordem/i);
    expect(md).not.toMatch(/excel|planilha|compatibilidade/i);
  });
});
