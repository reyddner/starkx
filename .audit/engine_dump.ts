// Extrai números do motor para o .audit/check.py conferir com cálculo independente.
// Rodado por: npx vite-node .audit/engine_dump.ts
import { calculate } from "../calculation-engine/index";
import { designFooting } from "../footing-engine/index";
import { designPileCap } from "../block-engine/index";
import { designPileReinforcement } from "../structural-engine/index";
import reference from "../tests/fixtures/reference-cases.json";

const piles = Object.fromEntries(
  reference.cases.map((c) => {
    const r = calculate(c.input as Parameters<typeof calculate>[0]);
    return [c.id, { methods: r.atTip.methods, governing: r.atTip.governingPadm_kN }];
  }),
);

const footing = designFooting({
  Nk_kN: 2000,
  shape: "square",
  admMode: "user",
  sigmaAdm_kPa: 500,
  gammaConcrete_kN_m3: 0,
  fck_MPa: 25,
  columnWidth_m: 0.3,
  columnDepth_m: 0.3,
});
const footingMoment = designFooting({
  Nk_kN: 1000,
  shape: "square",
  admMode: "user",
  sigmaAdm_kPa: 200,
  My_kNm: 200,
  gammaConcrete_kN_m3: 0,
});
const block = designPileCap({
  rows: 1,
  cols: 2,
  spacing_m: 1.2,
  diameter_m: 0.4,
  edge_m: 0.25,
  thickness_m: 0.8,
  groupLoad_kN: 1000,
  columnWidth_m: 0.3,
  columnDepth_m: 0.5,
  fck_MPa: 25,
  fyk_MPa: 500,
});
const pileRc = designPileReinforcement({ pileTypeId: 6, diameter_m: 0.4, tipDepth_m: 8, Nk_kN: 600 });

console.log(
  "@@JSON@@" +
    JSON.stringify({
      piles,
      footing: {
        B_m: footing.B_m,
        thickness_m: footing.thickness_m,
        AsB_cm2_per_m: footing.rebar?.AsB_cm2_per_m,
      },
      footingMoment: {
        B_m: footingMoment.B_m,
        sigmaMax_kPa: footingMoment.sigmaMax_kPa,
        qadm_kPa: footingMoment.qadm_kPa,
      },
      block: { Tx_kN: block.strutTie?.Tx_kN, thetaMin_deg: block.strutTie?.thetaMin_deg, ok: block.strutTie?.ok },
      pileRc: { Nrd_kN: pileRc.Nrd_kN, As_cm2: pileRc.detail?.longitudinal.As_cm2, Ac_m2: pileRc.Ac_m2 },
    }),
);
