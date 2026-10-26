import { z } from 'zod';
import { PILE_TYPES } from '../../calculation-engine/catalogs';
z.config(z.locales.pt());

const n = () => z.number().finite();
const pos = () => n().positive();
const nonneg = () => n().nonnegative();
const txt = () => z.string().trim().min(1).max(200);
export const method = z.enum(['aoki_velloso', 'decourt_quaresma', 'teixeira']);
export const pileId = z.number().int().refine(v => PILE_TYPES.some(p => p.id === v), 'Tipo de estaca fora do catálogo.');
export const layer = z.strictObject({ depth_m: pos(), nspt: nonneg(), soilTypeId: z.number().int().min(1).max(15), excludeFromShaftFriction: z.boolean().optional() });
export const layers = z.array(layer).min(1).max(500).refine(a => a.every((v,i) => i === 0 || v.depth_m > a[i-1].depth_m), 'Profundidades devem ser estritamente crescentes (m).');
const water = nonneg().nullable().optional();
const pct = () => nonneg().max(100);
const factors = {
  aoki: z.strictObject({ fs: pos().optional(), pctTip: pct().optional(), pctShaft: pct().optional() }).optional(),
  decourt: z.strictObject({ alphaPct: nonneg().optional(), betaPct: nonneg().optional() }).optional(),
  teixeira: z.strictObject({ fs: pos().optional(), pctTip: pct().optional(), pctShaft: pct().optional() }).optional(),
};
export const pile = z.strictObject({
  pileTypeId: pileId, diametro_cm: pos(), tipDepth_m: pos(), pileTopDepth_m: nonneg().optional(),
  area_cm2: pos().optional(), perimetro_cm: pos().optional(), volume_base_litros: pos().optional(),
  layers, waterLevel_m: water, designLoad_kN: nonneg().nullable().optional(), mode: z.literal('engineering').optional(),
  governingRule: z.enum(['minimum', 'average', 'user_selected']).optional(), selectedMethod: method.optional(),
  methods: z.array(method).min(1).max(3).optional(), ...factors,
}).superRefine((a,c) => {
  if ((a.pileTopDepth_m ?? 0) + a.tipDepth_m > a.layers.at(-1)!.depth_m) c.addIssue({code:'custom',path:['tipDepth_m'],message:'Ponta fora da sondagem (topo + comprimento).'});
  if (a.governingRule === 'user_selected' && (!a.selectedMethod || (a.methods && !a.methods.includes(a.selectedMethod)))) c.addIssue({code:'custom',path:['selectedMethod'],message:'Informe método selecionado entre os métodos habilitados.'});
});
export const borehole = z.strictObject({ layers: z.array(z.strictObject({ depth_m: n(), nspt: n(), soilTypeId: n().int() })).max(500), waterLevel_m: water });
const grid = { rows: z.number().int().min(1).max(16), cols: z.number().int().min(1).max(16), spacing_m: pos(), diameter_m: pos() };
export const group = z.strictObject({ ...grid, N_kN: nonneg(), Mx_kNm: n(), My_kNm: n(), singlePadm_kN: pos(), efficiency: pos().max(1).nullable(), pileTypeId: pileId.nullable().optional(), loadIsDesign: z.boolean().optional(), capThickness_m: pos().nullable().optional(), capEdge_m: nonneg().nullable().optional() });
export const block = z.strictObject({
  ...grid, spacing_m: pos().nullable().optional(), edge_m: nonneg(), thickness_m: pos(),
  singlePadm_kN: pos().nullable().optional(), groupLoad_kN: nonneg().nullable().optional(),
  Mx_kNm: n().nullable().optional(), My_kNm: n().nullable().optional(), loadIsDesign: z.boolean().optional(),
  columnWidth_m: pos().nullable().optional(), columnDepth_m: pos().nullable().optional(),
  pileTypeId: pileId.nullable().optional(), efficiency: pos().max(1).nullable().optional(), fck_MPa: pos().optional(), fyk_MPa: pos().optional(),
  minSpacingFactor: pos().optional(), minSpacingAbsolute_m: pos().optional(), minEdge_m: nonneg().optional(), minThicknessFactorOnD: pos().optional(), minThicknessAbsolute_m: pos().optional(),
});
const soil = z.strictObject({ c_kPa: nonneg(), phi_deg: nonneg().max(45), gamma_kN_m3: pos(), embedment_m: nonneg(), fsBearing: pos() });
const shallow = {
  Nk_kN: pos(), loadIsDesign: z.boolean().optional(), gammaF: pos().optional(), Mx_kNm: n().optional(), My_kNm: n().optional(),
  aspectRatio: pos().min(1).optional(), admMode: z.enum(['user','bearing']), sigmaAdm_kPa: pos().nullable().optional(), soil: soil.nullable().optional(),
  thickness_m: pos().nullable().optional(), gammaConcrete_kN_m3: nonneg().optional(), fck_MPa: pos().optional(), fyk_MPa: pos().optional(),
  columnWidth_m: pos().nullable().optional(), columnDepth_m: pos().nullable().optional(),
};
function admCheck(a: { admMode: string; sigmaAdm_kPa?: number|null; soil?: unknown }, c: z.RefinementCtx) {
  if (a.admMode === 'user' && a.sigmaAdm_kPa == null) c.addIssue({code:'custom',path:['sigmaAdm_kPa'],message:'Informe tensão admissível em kPa no modo user.'});
  if (a.admMode === 'bearing' && !a.soil) c.addIssue({code:'custom',path:['soil'],message:'Informe parâmetros do solo no modo bearing.'});
}
export const footing = z.strictObject({...shallow, shape: z.enum(['square','rectangular'])}).superRefine(admCheck);
export const raft = z.strictObject(shallow).superRefine(admCheck);
export const caisson = z.strictObject({
  Nk_kN: pos(), loadIsDesign: z.boolean().optional(), gammaF: pos().optional(), shaftDiameter_m: pos(), baseDiameter_m: pos().nullable().optional(), length_m: pos(),
  admMode: z.enum(['user','bearing']), sigmaAdm_kPa: pos().nullable().optional(),
  soil: z.strictObject({c_kPa: nonneg(),phi_deg: nonneg().max(45),gamma_kN_m3:pos(),fsTip:pos()}).nullable().optional(),
  shaftMode: z.enum(['user','spt_aoki']).optional(), unitFriction_kPa: nonneg().optional(), shaftFS: pos().optional(), sptLayers: layers.nullable().optional(), fck_MPa: pos().optional(),
}).superRefine((a,c) => { admCheck(a,c); if (a.shaftMode === 'spt_aoki' && !a.sptLayers) c.addIssue({code:'custom',path:['sptLayers'],message:'Informe camadas SPT para atrito Aoki.'}); if (a.baseDiameter_m && a.baseDiameter_m < a.shaftDiameter_m) c.addIssue({code:'custom',path:['baseDiameter_m'],message:'Base deve ser maior ou igual ao fuste.'}); });
export const conception = z.strictObject({
  layers, N_kN: pos(), Mx_kNm: n().optional(), My_kNm: n().optional(), preferredPileTypeId: pileId,
  searchCategory: z.boolean().optional(), waterLevel_m: water, fixedDiameter_cm: pos().optional(),
  pileTopDepth_m: nonneg().optional(), pileTopDepthCap_m: nonneg().optional(),
  governingRule: z.enum(['minimum','average']).optional(), preferShallowIfViable: z.boolean().optional(), softShallowHint: z.boolean().optional(),
  sigmaAdm_kPa: pos().default(150),
});
const pileTakeoff = z.strictObject({
  tipo: z.literal('estaca').optional(),
  elementRef: txt().optional(), diameter_m: pos(), length_m: pos(), longitudinalCount: z.number().int().min(1).max(1000),
  longitudinalDia_mm: pos(), transverseDia_mm: pos(), transverseSpacing_m: pos().min(0.01), transverseKind: z.enum(['stirrup','spiral']).optional(),
  cover_m: nonneg().optional(), cageLength_m: pos().optional(), anchorageLength_m: nonneg().optional(), concreteGrade: txt().optional(), perdas_pct: nonneg().max(100).optional(),
}).superRefine((a,c) => { if ((a.cover_m ?? 0.05)*2 >= a.diameter_m) c.addIssue({code:'custom',path:['cover_m'],message:'Cobrimento deve deixar seção interna positiva.'}); });
const takeoffOptions = { elementRef: txt().optional(), cover_m: nonneg().optional(), concreteGrade: txt().optional(), perdas_pct: nonneg().max(100).optional() };
const footingTakeoff = z.strictObject({tipo:z.literal('sapata'), B_m:pos(), L_m:pos(), thickness_m:pos(), bar_mm:pos(), spacing_cm:pos(), ...takeoffOptions}).superRefine((a,c)=>{
  if ((a.cover_m??0.05)*2 >= Math.min(a.B_m,a.L_m,a.thickness_m)) c.addIssue({code:'custom',path:['cover_m'],message:'Cobrimento incompatível com as dimensões da sapata.'});
});
const tie = z.strictObject({bar_mm:pos(),count:z.number().int().min(1).max(10000)});
const blockTakeoff = z.strictObject({tipo:z.literal('bloco'),pileCount:z.number().int().min(1).max(256),width_m:pos(),length_m:pos(),thickness_m:pos(),pileDiameter_m:pos().optional(),leanConcreteThickness_m:nonneg().optional(),suggestedBar_mm:pos().optional(),suggestedSpacing_cm:pos().optional(),tieX:tie.optional(),tieY:tie.optional(),...takeoffOptions}).superRefine((a,c)=>{
  if ((a.cover_m??0.05)*2 >= Math.min(a.width_m,a.length_m,a.thickness_m)) c.addIssue({code:'custom',path:['cover_m'],message:'Cobrimento incompatível com as dimensões do bloco.'});
});
export const takeoff = z.union([pileTakeoff,footingTakeoff,blockTakeoff]);
export const reinforcement = z.strictObject({pileTypeId:pileId,diameter_m:pos(),tipDepth_m:pos(),Nk_kN:nonneg(),loadIsDesign:z.boolean().optional(),fck_MPa:pos().optional(),fyk_MPa:pos().optional(),cover_mm:nonneg().optional(),transverseKind:z.enum(['stirrup','spiral']).optional(),Mk_kNm:nonneg().optional(),Vk_kN:nonneg().optional()}).superRefine((a,c)=>{
  if ((a.cover_mm??50)*2 >= a.diameter_m*1000) c.addIssue({code:'custom',path:['cover_mm'],message:'Cobrimento deve deixar seção interna positiva.'});
});
// Common characteristic loads and the same borehole are injected by the adapter.
const sharedLoad = {Nk_kN:true,loadIsDesign:true,Mx_kNm:true,My_kNm:true} as const;
export const comparison = z.strictObject({
  N_kN:pos(), Mx_kNm:n().default(0), My_kNm:n().default(0), layers, waterLevel_m:water,
  estaca:z.strictObject(pile.shape).omit({layers:true,waterLevel_m:true,designLoad_kN:true}).partial().optional(),
  bloco:block.omit({groupLoad_kN:true,loadIsDesign:true,Mx_kNm:true,My_kNm:true,singlePadm_kN:true}).partial().optional(),
  sapata:z.strictObject(footing.shape).omit(sharedLoad).partial().optional(),
  radier:z.strictObject(raft.shape).omit(sharedLoad).partial().optional(),
  tubulao:z.strictObject(caisson.shape).omit({Nk_kN:true,loadIsDesign:true,sptLayers:true}).partial().optional(),
  concepcao:z.strictObject(conception.shape).omit({N_kN:true,Mx_kNm:true,My_kNm:true,layers:true,waterLevel_m:true}).partial().optional(),
});
export const carimbo = z.strictObject({empresa:txt(),responsavel:txt(),registro_CREA:txt(),obra:txt(),codigo:txt()});
export const exportFields = { pasta: z.string().trim().min(1).max(4096), nome: z.string().regex(/^[\p{L}\p{N}_-]{1,80}$/u,'Nome deve conter apenas letras, números, hífen ou sublinhado.').default('fundacao'), projeto: txt().default('Projeto de fundações'), sobrescrever:z.boolean().default(false) };
const pdfFields = {...exportFields,carimbo:carimbo.optional()};
export const memorial = z.union([
  z.strictObject({...pdfFields,estaca:pile,bloco:block.optional()}),
  z.strictObject({...pdfFields,sapata:footing}),
]);
const drawingFields = {...pdfFields,referencia:txt().default('E1')};
export const drawing = z.union([
  z.strictObject({...drawingFields,diameter_m:pos(),length_m:pos(),pileCount:z.number().int().min(1).max(256).default(1)}),
  z.strictObject({...drawingFields,sapata:footing}),
  z.strictObject({...drawingFields,bloco:block,pileShaftLength_m:pos().optional()}),
]);
export const spreadsheet = z.union([
  z.strictObject({...exportFields,quantitativo:takeoff}),
  z.strictObject({...exportFields,comparacao:comparison}),
]);
export const empty = z.strictObject({});

// ---- IFC4X3: fundações e sondagens ----
const placed = { ref: z.string().trim().min(1).max(60), x_m: n().default(0), y_m: n().default(0) };
const rotation = n().min(-360).max(360).default(0);
const pileArmadura = z.strictObject({
  longitudinalCount: z.number().int().min(1).max(1000), longitudinalDia_mm: pos(), transverseDia_mm: pos(), transverseSpacing_m: pos().min(0.01),
  transverseKind: z.enum(['stirrup','spiral']).optional(), cover_m: nonneg().optional(), cageLength_m: pos().optional(), anchorageLength_m: nonneg().optional(),
  concreteGrade: txt().optional(), perdas_pct: nonneg().max(100).optional(),
});
export const ifcElement = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('estaca'), ...placed, estaca: pile, armadura: pileArmadura.optional() }),
  z.strictObject({ tipo: z.literal('bloco'), ...placed, rotacao_graus: rotation, profundidade_topo_m: nonneg().default(0), estaca: pile, bloco: block.omit({ diameter_m: true, pileTypeId: true }) }),
  z.strictObject({ tipo: z.literal('sapata'), ...placed, rotacao_graus: rotation, profundidade_base_m: pos(), sapata: footing }),
  z.strictObject({ tipo: z.literal('radier'), ...placed, rotacao_graus: rotation, profundidade_base_m: pos(), radier: raft }),
  z.strictObject({ tipo: z.literal('tubulao'), ...placed, profundidade_topo_m: nonneg().default(0), tubulao: caisson }),
]);
export const ifcBorehole = z.strictObject({ ...placed, cota_boca_m: n().optional(), layers, waterLevel_m: water, diametro_visual_m: pos().max(5).default(0.3) });
export const ifcExport = z.strictObject({
  ...exportFields, codigo: txt().optional(), cota_terreno_m: n().default(0),
  sondagens: z.array(ifcBorehole).max(100).default([]),
  elementos: z.array(ifcElement).max(500).default([]),
}).superRefine((a, c) => {
  if (!a.sondagens.length && !a.elementos.length) c.addIssue({ code: 'custom', path: ['elementos'], message: 'Informe ao menos um elemento ou uma sondagem.' });
  const seen = new Set<string>();
  for (const r of [...a.elementos.map(e => e.ref), ...a.sondagens.map(b => b.ref)]) {
    if (seen.has(r)) c.addIssue({ code: 'custom', path: ['ref'], message: `Referência repetida: ${r}.` });
    seen.add(r);
  }
});
export const ifcImport = z.strictObject({
  arquivo: z.string().trim().min(1).max(4096).refine(p => /\.ifc$/i.test(p), 'Informe um arquivo .ifc.'),
});
