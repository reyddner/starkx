/**
 * Cargas estruturais usuais por tipo × diâmetro de estaca (consulta, ordem de grandeza de mercado).
 * Confirmar sempre com o executor/fabricante.
 * DEC-09: se Padm_governante > carga nominal (match tipo×Ø), emitir aviso — sem alterar Padm.
 */

export interface NominalLoadEntry {
  pileTypeId: number;
  diameterCm: number;
  nominal_kN: number;
}

/** Moldadas in loco, pré-moldadas circulares e madeira (kN). */
export const NOMINAL_LOAD_TABLE: NominalLoadEntry[] = [
  // 5 Strauss
  { pileTypeId: 5, diameterCm: 25, nominal_kN: 200 },
  { pileTypeId: 5, diameterCm: 32, nominal_kN: 300 },
  { pileTypeId: 5, diameterCm: 38, nominal_kN: 450 },
  { pileTypeId: 5, diameterCm: 42, nominal_kN: 550 },
  { pileTypeId: 5, diameterCm: 45, nominal_kN: 650 },
  // 6 Escavada
  { pileTypeId: 6, diameterCm: 25, nominal_kN: 200 },
  { pileTypeId: 6, diameterCm: 30, nominal_kN: 300 },
  { pileTypeId: 6, diameterCm: 35, nominal_kN: 400 },
  { pileTypeId: 6, diameterCm: 40, nominal_kN: 500 },
  { pileTypeId: 6, diameterCm: 45, nominal_kN: 650 },
  { pileTypeId: 6, diameterCm: 50, nominal_kN: 800 },
  // 7 Estacão
  { pileTypeId: 7, diameterCm: 60, nominal_kN: 1100 },
  { pileTypeId: 7, diameterCm: 80, nominal_kN: 2000 },
  { pileTypeId: 7, diameterCm: 100, nominal_kN: 3000 },
  { pileTypeId: 7, diameterCm: 120, nominal_kN: 4500 },
  { pileTypeId: 7, diameterCm: 140, nominal_kN: 6000 },
  { pileTypeId: 7, diameterCm: 160, nominal_kN: 8000 },
  { pileTypeId: 7, diameterCm: 180, nominal_kN: 10000 },
  { pileTypeId: 7, diameterCm: 200, nominal_kN: 12500 },
  // 8 Apiloada
  { pileTypeId: 8, diameterCm: 20, nominal_kN: 120 },
  { pileTypeId: 8, diameterCm: 25, nominal_kN: 200 },
  // 9 Franki
  { pileTypeId: 9, diameterCm: 35, nominal_kN: 600 },
  { pileTypeId: 9, diameterCm: 40, nominal_kN: 750 },
  { pileTypeId: 9, diameterCm: 45, nominal_kN: 950 },
  { pileTypeId: 9, diameterCm: 52, nominal_kN: 1300 },
  { pileTypeId: 9, diameterCm: 60, nominal_kN: 1700 },
  // 10 Raiz
  { pileTypeId: 10, diameterCm: 10, nominal_kN: 100 },
  { pileTypeId: 10, diameterCm: 12, nominal_kN: 100 },
  { pileTypeId: 10, diameterCm: 15, nominal_kN: 150 },
  { pileTypeId: 10, diameterCm: 20, nominal_kN: 250 },
  { pileTypeId: 10, diameterCm: 25, nominal_kN: 400 },
  { pileTypeId: 10, diameterCm: 31, nominal_kN: 600 },
  // 11 Hélice Contínua
  { pileTypeId: 11, diameterCm: 27.5, nominal_kN: 250 },
  { pileTypeId: 11, diameterCm: 35, nominal_kN: 400 },
  { pileTypeId: 11, diameterCm: 40, nominal_kN: 500 },
  { pileTypeId: 11, diameterCm: 50, nominal_kN: 800 },
  { pileTypeId: 11, diameterCm: 60, nominal_kN: 1100 },
  { pileTypeId: 11, diameterCm: 70, nominal_kN: 1550 },
  { pileTypeId: 11, diameterCm: 80, nominal_kN: 2000 },
  { pileTypeId: 11, diameterCm: 90, nominal_kN: 2550 },
  { pileTypeId: 11, diameterCm: 100, nominal_kN: 3150 },
  // 1 Vibrada Concreto
  { pileTypeId: 1, diameterCm: 22, nominal_kN: 300 },
  { pileTypeId: 1, diameterCm: 29, nominal_kN: 500 },
  { pileTypeId: 1, diameterCm: 33, nominal_kN: 700 },
  // 2 Centrifugada Concreto
  { pileTypeId: 2, diameterCm: 20, nominal_kN: 250 },
  { pileTypeId: 2, diameterCm: 23, nominal_kN: 300 },
  { pileTypeId: 2, diameterCm: 26, nominal_kN: 400 },
  { pileTypeId: 2, diameterCm: 33, nominal_kN: 600 },
  { pileTypeId: 2, diameterCm: 38, nominal_kN: 750 },
  { pileTypeId: 2, diameterCm: 42, nominal_kN: 900 },
  { pileTypeId: 2, diameterCm: 50, nominal_kN: 1300 },
  { pileTypeId: 2, diameterCm: 60, nominal_kN: 1700 },
  { pileTypeId: 2, diameterCm: 70, nominal_kN: 2300 },
  // 3 Madeira
  { pileTypeId: 3, diameterCm: 20, nominal_kN: 150 },
  { pileTypeId: 3, diameterCm: 25, nominal_kN: 200 },
  { pileTypeId: 3, diameterCm: 30, nominal_kN: 300 },
  { pileTypeId: 3, diameterCm: 35, nominal_kN: 400 },
  { pileTypeId: 3, diameterCm: 40, nominal_kN: 500 },
];

const MATCH_TOL_CM = 0.05;

export interface NominalLookup {
  nominal_kN: number;
  diameterCm: number;
  pileTypeId: number;
  source: string;
}

/**
 * Consulta carga nominal (kN) para tipo×diâmetro.
 * Metálica (id 4) e Ø sem linha na tabela → null (sem alerta falso).
 */
export function lookupNominalStructuralLoad_kN(
  pileTypeId: number,
  diameterCm: number,
): NominalLookup | null {
  if (pileTypeId === 4) return null;
  const hit = NOMINAL_LOAD_TABLE.find(
    (e) =>
      e.pileTypeId === pileTypeId &&
      Math.abs(e.diameterCm - diameterCm) <= MATCH_TOL_CM,
  );
  if (!hit) return null;
  return {
    nominal_kN: hit.nominal_kN,
    diameterCm: hit.diameterCm,
    pileTypeId: hit.pileTypeId,
    source: "Carga nominal de referência (consulta)",
  };
}

export interface NominalStructuralAssessment {
  nominal_kN: number;
  diameterCm: number;
  pileTypeId: number;
  source: string;
  governingPadm_kN: number;
  /** true se Padm_governante > carga nominal (DEC-09) */
  exceeded: boolean;
  message: string;
}

/**
 * Avalia alerta estrutural orientativo. Não altera Padm.
 */
export function assessNominalStructuralCapacity(opts: {
  pileTypeId: number;
  diameterCm: number;
  governingPadm_kN: number;
}): NominalStructuralAssessment | null {
  const hit = lookupNominalStructuralLoad_kN(opts.pileTypeId, opts.diameterCm);
  if (!hit) return null;
  const exceeded = opts.governingPadm_kN > hit.nominal_kN + 1e-9;
  const message = exceeded
    ? `Padm governante (${opts.governingPadm_kN.toFixed(1)} kN) > carga estrutural usual (${hit.nominal_kN.toFixed(0)} kN) para este tipo/Ø — revisar verificação estrutural (DEC-09). O Padm geotécnico não foi alterado.`
    : `Carga estrutural usual = ${hit.nominal_kN.toFixed(0)} kN (tipo/Ø). Padm governante ${opts.governingPadm_kN.toFixed(1)} kN ≤ nominal — sem alerta DEC-09.`;
  return {
    ...hit,
    governingPadm_kN: opts.governingPadm_kN,
    exceeded,
    message,
  };
}
