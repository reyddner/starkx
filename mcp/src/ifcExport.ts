/**
 * Monta um IFC4X3_ADD2 de fundações e sondagens: cada elemento é recalculado pelos motores STARKX
 * e o arquivo leva geometria, propriedades de cálculo (Pset_MC_STARKX) e quantidades (Qto_*).
 * Convenção: x,y em planta (m); z para cima; profundidades medidas a partir da cota do terreno.
 */
import type { z } from 'zod';
import { calculate, PILE_TYPES, SOIL_TYPES } from '../../calculation-engine/index';
import { designPileCap } from '../../block-engine/index';
import { designFooting } from '../../footing-engine/index';
import { designRaft } from '../../raft-engine/index';
import { designCaisson } from '../../caisson-engine/index';
import { computePileTakeoff } from '../../structural-engine/takeoff/pileTakeoff';
import { computeFootingTakeoff } from '../../structural-engine/takeoff/footingTakeoff';
import type { ElementTakeoff } from '../../structural-engine/takeoff/types';
import { IfcWriter, Ref, E, label, text, length, force, pressure, real, integer, bool, soilColour, CONCRETE, type Props } from './ifc';
import type * as s from './schemas';

type Input = z.output<typeof s.ifcExport>;
type Elemento = Input['elementos'][number];
type PileIn = z.output<typeof s.pile>;

export interface IfcExportSummary {
  ref: string; tipo: string; ifc: string; verificacao: 'ok' | 'não' | 'não verificada';
  topo_z_m: number; base_z_m: number; volume_concreto_m3: number; aco_kg: number | null; padm_kN: number | null;
}

const fckClass = (fck?: number) => fck ? `C${Math.round(fck)}` : null;
const statusOf = (checks: { status: string }[] | undefined, extraFail = false): IfcExportSummary['verificacao'] =>
  extraFail || checks?.some(c => c.status === 'error') ? 'não' : 'ok';
const errCount = (checks: { status: string }[] | undefined) => checks?.filter(c => c.status === 'error').length ?? 0;
const warnCount = (checks: { status: string }[] | undefined) => checks?.filter(c => c.status === 'warning').length ?? 0;

function pileCalcInput(a: PileIn) {
  const { diametro_cm, area_cm2, perimetro_cm, volume_base_litros, ...rest } = a;
  return { ...rest, diameterCm: diametro_cm, areaCm2: area_cm2, perimeterCm: perimetro_cm, enlargedBaseVolumeLiters: volume_base_litros };
}
function pileProps(p: PileIn, r: ReturnType<typeof calculate>): Props {
  const type = PILE_TYPES.find(t => t.id === p.pileTypeId)!;
  const byMethod = Object.fromEntries(r.atTip.methods.map(m => [`Padm_${m.methodId}_kN`, force(m.Padm_kN)]));
  return {
    TipoEstaca: label(type.name), TipoEstacaId: integer(type.id), Moldagem: label(type.molding === 'precast' ? 'pré-moldada' : 'moldada in loco'),
    Diametro_cm: real(p.diametro_cm), Comprimento_m: length(p.tipDepth_m), ProfundidadeTopo_m: length(p.pileTopDepth_m ?? 0),
    PadmGovernante_kN: force(r.atTip.governingPadm_kN), CriterioPadm: label(String(r.atTip.governingMethodId)),
    PadmMedia_kN: force(r.atTip.averagePadm_kN), PadmMinima_kN: force(r.atTip.minimumPadm_kN), ...byMethod,
    CargaProjeto_kN: p.designLoad_kN != null ? force(p.designLoad_kN) : null,
    Veredito: label(r.verdict), NivelAgua_m: p.waterLevel_m != null ? length(p.waterLevel_m) : null,
  };
}

export function buildFoundationIfc(a: Input, meta: { commit: string; version: string; disclaimer: string; fileName: string; timestamp: string }) {
  const w = new IfcWriter(`${a.projeto}|${a.codigo ?? ''}`);
  w.setupContextAndUnits();
  const avisos: string[] = [];
  const resumo: IfcExportSummary[] = [];

  const project = w.add('IFCPROJECT', [w.guid('project'), null, a.projeto, a.codigo ? `Código ${a.codigo}` : null, null, a.codigo ?? null, 'Pré-dimensionamento', [w.context], w.units]);
  const sitePl = w.localPlacement(null);
  const site = w.add('IFCSITE', [w.guid('site'), null, 'Terreno', null, null, sitePl, null, null, E('ELEMENT'), null, null, a.cota_terreno_m, null, null]);
  const bldPl = w.localPlacement(sitePl);
  const building = w.add('IFCBUILDING', [w.guid('building'), null, 'Edificação', null, null, bldPl, null, null, E('ELEMENT'), null, a.cota_terreno_m, null]);
  const stPl = w.localPlacement(bldPl, 0, 0, a.cota_terreno_m);
  const storey = w.add('IFCBUILDINGSTOREY', [w.guid('storey'), null, 'Fundação', 'Elementos de fundação STARKX', null, stPl, null, null, E('ELEMENT'), a.cota_terreno_m]);
  w.add('IFCRELAGGREGATES', [w.guid('agg-project'), null, null, null, project, [site]]);
  w.add('IFCRELAGGREGATES', [w.guid('agg-site'), null, null, null, site, [building]]);
  w.add('IFCRELAGGREGATES', [w.guid('agg-building'), null, null, null, building, [storey]]);

  const inStorey: Ref[] = [];
  const inSite: Ref[] = [];
  const concrete = (grade: string | null) => w.material(grade ? `Concreto ${grade}` : 'Concreto', 'concrete');
  const concStyle = w.style('Concreto', CONCRETE);
  const common = (obj: Ref, key: string, props: Props) =>
    w.pset('Pset_MC_STARKX', [obj], { ...props, MotorVersao: label(meta.version), MotorCommit: label(meta.commit.slice(0, 12)), Ressalva: text(meta.disclaimer) }, key);
  const concreteGeneral = (obj: Ref, key: string, fck?: number) => {
    const cls = fckClass(fck);
    if (cls) w.pset('Pset_ConcreteElementGeneral', [obj], { StrengthClass: label(cls) }, key);
  };
  const steelQto = (obj: Ref, key: string, t: ElementTakeoff | null | undefined) => {
    if (!t) return;
    w.qto('Qto_MC_Armadura', obj, { weight: { AcoLiquido: t.totalSteelWeight_kg, AcoComPerdas: t.totalSteelWithLosses_kg }, volume: { ConcretoMagro: t.leanConcreteVolume_m3 } }, key);
  };

  // Estaca: cilindro do topo (profundidade) até a ponta. Retorna o elemento e o volume.
  function pile(key: string, name: string, rel: Ref, x: number, y: number, topDepth: number, p: PileIn, r: ReturnType<typeof calculate>, desc: string | null) {
    const radius = p.diametro_cm / 200;
    const pl = w.localPlacement(rel, x, y, -topDepth);
    const type = PILE_TYPES.find(t => t.id === p.pileTypeId)!;
    const shape = w.shape([w.cylinder(radius, p.tipDepth_m)], 'SweptSolid', concStyle);
    const el = w.add('IFCPILE', [w.guid(`pile|${key}`), null, name, desc, type.name, pl, shape, name, E(type.molding === 'precast' ? 'DRIVEN' : 'BORED'), null]);
    const vol = Math.PI * radius * radius * p.tipDepth_m;
    w.qto('Qto_PileBaseQuantities', el, { length: { Length: p.tipDepth_m }, area: { CrossSectionArea: Math.PI * radius * radius, OuterSurfaceArea: 2 * Math.PI * radius * p.tipDepth_m }, volume: { GrossVolume: vol, NetVolume: vol } }, `pile|${key}`);
    common(el, `pile|${key}`, pileProps(p, r));
    w.assignMaterial(concrete(null), el);
    return { el, vol };
  }

  for (const e of a.elementos) {
    const key = `${e.tipo}|${e.ref}`;
    try {
      buildElement(e, key);
    } catch (err) {
      throw new Error(`Elemento ${e.ref} (${e.tipo}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function buildElement(e: Elemento, key: string) {
    const gl = a.cota_terreno_m;
    if (e.tipo === 'estaca') {
      const r = calculate(pileCalcInput(e.estaca));
      const top = e.estaca.pileTopDepth_m ?? 0;
      const { el, vol } = pile(key, e.ref, stPl, e.x_m, e.y_m, top, e.estaca, r, 'Estaca isolada');
      let aco: number | null = null;
      if (e.armadura) {
        const { perdas_pct, ...rest } = e.armadura;
        const t = computePileTakeoff({ ...rest, elementRef: e.ref, diameter_m: e.estaca.diametro_cm / 100, length_m: e.estaca.tipDepth_m, lossPercentage: perdas_pct });
        steelQto(el, key, t); aco = t.totalSteelWithLosses_kg;
      }
      inStorey.push(el);
      resumo.push({ ref: e.ref, tipo: 'estaca', ifc: 'IfcPile', verificacao: r.verdict === 'approved' ? 'ok' : r.verdict === 'not_ok' ? 'não' : 'não verificada', topo_z_m: gl - top, base_z_m: gl - top - e.estaca.tipDepth_m, volume_concreto_m3: vol, aco_kg: aco, padm_kN: r.atTip.governingPadm_kN });
      return;
    }
    if (e.tipo === 'bloco') {
      const rp = calculate(pileCalcInput(e.estaca));
      const blockIn = { ...e.bloco, diameter_m: e.estaca.diametro_cm / 100, pileTypeId: e.estaca.pileTypeId, singlePadm_kN: e.bloco.singlePadm_kN ?? rp.atTip.governingPadm_kN };
      const r = designPileCap(blockIn);
      const t = e.bloco.thickness_m;
      const capTop = e.profundidade_topo_m;
      const pileTop = capTop + t;
      if (e.estaca.pileTopDepth_m != null && Math.abs(e.estaca.pileTopDepth_m - pileTop) > 0.05)
        avisos.push(`${e.ref}: o cálculo da estaca usou topo a ${e.estaca.pileTopDepth_m} m, mas o fundo do bloco está a ${pileTop.toFixed(2)} m. Ajuste pileTopDepth_m ou profundidade_topo_m.`);
      const pl = w.localPlacement(stPl, e.x_m, e.y_m, -capTop, e.rotacao_graus);
      const shape = w.shape([w.box(r.cap.width_m, r.cap.length_m, t)], 'SweptSolid', concStyle);
      const cap = w.add('IFCFOOTING', [w.guid(`cap|${key}`), null, e.ref, `Bloco sobre ${r.pileCount} estaca(s)`, 'Bloco sobre estacas', pl, shape, e.ref, E('PILE_CAP')]);
      const capVol = r.cap.width_m * r.cap.length_m * t;
      w.qto('Qto_FootingBaseQuantities', cap, { length: { Length: r.cap.length_m, Width: r.cap.width_m, Height: t }, area: { CrossSectionArea: r.cap.area_m2 }, volume: { GrossVolume: capVol, NetVolume: capVol } }, `cap|${key}`);
      steelQto(cap, `cap|${key}`, r.takeoff);
      common(cap, `cap|${key}`, {
        NumeroEstacas: integer(r.pileCount), Espacamento_m: length(r.spacing_m), EspacamentoMinimo_m: length(r.spacingMin_m),
        PadmGrupo_kN: r.groupPadm_kN != null ? force(r.groupPadm_kN) : null, Eficiencia: real(r.efficiency), CapacidadeIndicativa: bool(r.groupCapacityIndicative),
        CargaGrupo_kN: e.bloco.groupLoad_kN != null ? force(e.bloco.groupLoad_kN) : null,
        VerificacoesErro: integer(errCount(r.checks)), VerificacoesAlerta: integer(warnCount(r.checks)),
      });
      concreteGeneral(cap, `cap|${key}`, e.bloco.fck_MPa);
      w.assignMaterial(concrete(fckClass(e.bloco.fck_MPa)), cap);
      // Estacas do bloco: posição local do motor (centrada no bloco), na mesma rotação.
      const piles: Ref[] = []; let pileVol = 0;
      for (const p of r.piles) {
        const made = pile(`${key}|${p.id}`, `${e.ref}-${p.label}`, pl, p.position.x_m, p.position.y_m, t, e.estaca, rp, `Estaca do bloco ${e.ref}`);
        piles.push(made.el); pileVol += made.vol;
      }
      w.add('IFCRELAGGREGATES', [w.guid(`agg|${key}`), null, 'Bloco e estacas', null, cap, piles]);
      inStorey.push(cap);
      resumo.push({ ref: e.ref, tipo: 'bloco', ifc: `IfcFooting PILE_CAP + ${r.pileCount} IfcPile`, verificacao: statusOf(r.checks, r.capacityOk === false), topo_z_m: gl - capTop, base_z_m: gl - pileTop - e.estaca.tipDepth_m, volume_concreto_m3: capVol + pileVol, aco_kg: r.takeoff?.totalSteelWithLosses_kg ?? null, padm_kN: r.groupPadm_kN });
      return;
    }
    if (e.tipo === 'sapata' || e.tipo === 'radier') {
      const isRaft = e.tipo === 'radier';
      const r = isRaft ? designRaft(e.radier) : designFooting(e.sapata);
      const base = e.profundidade_base_m;
      const topDepth = base - r.thickness_m;
      if (topDepth < -1e-9) avisos.push(`${e.ref}: espessura ${r.thickness_m} m maior que a profundidade da base ${base} m; topo acima do terreno.`);
      const pl = w.localPlacement(stPl, e.x_m, e.y_m, -topDepth, e.rotacao_graus);
      const shape = w.shape([w.box(r.B_m, r.L_m, r.thickness_m)], 'SweptSolid', concStyle);
      const fck = isRaft ? e.radier.fck_MPa : e.sapata.fck_MPa;
      const el = isRaft
        ? w.add('IFCSLAB', [w.guid(`raft|${key}`), null, e.ref, 'Radier', 'Radier', pl, shape, e.ref, E('BASESLAB')])
        : w.add('IFCFOOTING', [w.guid(`footing|${key}`), null, e.ref, 'Sapata isolada', 'Sapata', pl, shape, e.ref, E('PAD_FOOTING')]);
      const vol = r.B_m * r.L_m * r.thickness_m;
      w.qto(isRaft ? 'Qto_SlabBaseQuantities' : 'Qto_FootingBaseQuantities', el, { length: isRaft ? { Width: r.thickness_m } : { Length: r.L_m, Width: r.B_m, Height: r.thickness_m }, area: isRaft ? { GrossArea: r.B_m * r.L_m } : { CrossSectionArea: r.B_m * r.L_m }, volume: { GrossVolume: vol, NetVolume: vol } }, key);
      const t = !isRaft && r.rebar ? computeFootingTakeoff({ elementRef: e.ref, B_m: r.B_m, L_m: r.L_m, thickness_m: r.thickness_m, bar_mm: r.rebar.suggestBar_mm, spacing_cm: r.rebar.suggestSpacing_cm }) : null;
      steelQto(el, key, t);
      common(el, key, {
        Nk_kN: force(r.Nk_kN), Nd_kN: force(r.Nd_kN), B_m: length(r.B_m), L_m: length(r.L_m), Espessura_m: length(r.thickness_m),
        TensaoAdmissivel_kPa: pressure(r.qadm_kPa), TensaoMaxima_kPa: pressure(r.sigmaMax_kPa), TensaoMedia_kPa: pressure(r.sigmaAvg_kPa),
        Rigida: bool(r.rigid), ProfundidadeBase_m: length(base),
        BarraSugerida_mm: r.rebar ? real(r.rebar.suggestBar_mm) : null, EspacamentoSugerido_cm: r.rebar ? real(r.rebar.suggestSpacing_cm) : null,
        VerificacoesErro: integer(errCount(r.checks)), VerificacoesAlerta: integer(warnCount(r.checks)),
      });
      if (isRaft) avisos.push(`${e.ref}: radier sem esforços nem armadura de placa no motor (só área, tensões e espessura).`);
      concreteGeneral(el, key, fck);
      w.assignMaterial(concrete(fckClass(fck)), el);
      inStorey.push(el);
      resumo.push({ ref: e.ref, tipo: e.tipo, ifc: isRaft ? 'IfcSlab BASESLAB' : 'IfcFooting PAD_FOOTING', verificacao: statusOf(r.checks), topo_z_m: gl - topDepth, base_z_m: gl - base, volume_concreto_m3: vol, aco_kg: t?.totalSteelWithLosses_kg ?? null, padm_kN: null });
      return;
    }
    // Tubulão: fuste cilíndrico, base alargada (tronco de cone a 60°) e rodapé de 0,20 m.
    const r = designCaisson(e.tubulao);
    const rf = r.shaftDiameter_m / 2, rb = r.baseDiameter_m / 2;
    const top = e.profundidade_topo_m;
    const items: Ref[] = [];
    let vol: number;
    let tapered = false;
    if (rb > rf + 1e-6) {
      const footH = 0.20;
      const bellH = (rb - rf) * Math.tan(Math.PI / 3);
      const shaftL = r.length_m - bellH - footH;
      if (shaftL <= 0) throw new Error(`base alargada (${(bellH + footH).toFixed(2)} m) não cabe no comprimento ${r.length_m} m.`);
      items.push(w.cylinder(rf, shaftL), w.cone(rf, rb, bellH, -shaftL), w.cylinder(rb, footH, 0, 0, -shaftL - bellH));
      tapered = true;
      vol = Math.PI * rf * rf * shaftL + Math.PI * bellH / 3 * (rf * rf + rf * rb + rb * rb) + Math.PI * rb * rb * footH;
      avisos.push(`${e.ref}: base do tubulão desenhada com ângulo de 60° e rodapé de 0,20 m (convenção usual); conferir com o detalhamento.`);
    } else {
      items.push(w.cylinder(rf, r.length_m));
      vol = Math.PI * rf * rf * r.length_m;
    }
    const pl = w.localPlacement(stPl, e.x_m, e.y_m, -top);
    const shape = w.shape(items, tapered ? 'AdvancedSweptSolid' : 'SweptSolid', concStyle);
    const el = w.add('IFCCAISSONFOUNDATION', [w.guid(`caisson|${key}`), null, e.ref, 'Tubulão', 'Tubulão', pl, shape, e.ref, E('CAISSON')]);
    w.qto('Qto_CaissonFoundationBaseQuantities', el, { length: { Length: r.length_m }, volume: { GrossVolume: vol, NetVolume: vol } }, key);
    common(el, key, {
      DiametroFuste_m: length(r.shaftDiameter_m), DiametroBase_m: length(r.baseDiameter_m), Comprimento_m: length(r.length_m),
      Padm_kN: force(r.Padm_kN), PontaAdm_kN: force(r.Rp_adm_kN), FusteAdm_kN: force(r.Rl_adm_kN), Nd_kN: force(r.Nd_kN),
      TensaoAdmissivel_kPa: pressure(r.qadm_kPa), ModoFuste: label(r.shaftMode), Veredito: label(r.verdict),
      BarraSugerida_mm: r.rebar ? real(r.rebar.suggestBar_mm) : null, NumeroBarras: r.rebar ? integer(r.rebar.suggestCount) : null, ComprimentoArmadura_m: r.rebar ? length(r.rebar.Larm_min_m) : null,
      VerificacoesErro: integer(errCount(r.checks)), VerificacoesAlerta: integer(warnCount(r.checks)),
    });
    concreteGeneral(el, key, e.tubulao.fck_MPa);
    w.assignMaterial(concrete(fckClass(e.tubulao.fck_MPa)), el);
    inStorey.push(el);
    resumo.push({ ref: e.ref, tipo: 'tubulao', ifc: 'IfcCaissonFoundation', verificacao: r.verdict === 'approved' ? 'ok' : 'não', topo_z_m: gl - top, base_z_m: gl - top - r.length_m, volume_concreto_m3: vol, aco_kg: null, padm_kN: r.Padm_kN });
  }

  // Sondagens: IfcBorehole agregando um IfcGeotechnicalStratum por camada SPT (cilindros empilhados).
  const sondagens: { ref: string; camadas: number; profundidade_m: number }[] = [];
  for (const b of a.sondagens) {
    const key = `borehole|${b.ref}`;
    const collar = b.cota_boca_m ?? a.cota_terreno_m;
    const pl = w.localPlacement(sitePl, b.x_m, b.y_m, collar);
    const bh = w.add('IFCBOREHOLE', [w.guid(key), null, b.ref, 'Sondagem SPT', 'SPT', pl, null, b.ref]);
    const radius = b.diametro_visual_m / 2;
    const strata: Ref[] = [];
    let prev = 0;
    b.layers.forEach((l, i) => {
      const soil = SOIL_TYPES.find(s => s.id === l.soilTypeId)!;
      const h = l.depth_m - prev;
      const spl = w.localPlacement(pl, 0, 0, -prev);
      const shape = w.shape([w.cylinder(radius, h)], 'SweptSolid', w.style(soil.name, soilColour(soil.id)));
      const st = w.add('IFCGEOTECHNICALSTRATUM', [w.guid(`${key}|${i}`), null, `${b.ref} ${prev.toFixed(2)}–${l.depth_m.toFixed(2)} m`, soil.name, soil.name, spl, shape, String(i + 1), E('SOLID')]);
      w.pset('Pset_MC_SondagemSPT', [st], {
        NSPT: real(l.nspt), SoloId: integer(soil.id), Solo: label(soil.name),
        ProfundidadeTopo_m: length(prev), ProfundidadeBase_m: length(l.depth_m),
        AbaixoNivelAgua: b.waterLevel_m != null ? bool(l.depth_m > b.waterLevel_m) : null,
      }, `${key}|${i}`);
      w.assignMaterial(w.material(soil.name, 'soil'), st);
      strata.push(st);
      prev = l.depth_m;
    });
    w.add('IFCRELAGGREGATES', [w.guid(`agg|${key}`), null, 'Camadas', null, bh, strata]);
    w.pset('Pset_MC_STARKX', [bh], {
      NivelAgua_m: b.waterLevel_m != null ? length(b.waterLevel_m) : null, NivelAguaInformado: bool(b.waterLevel_m != null),
      CotaBoca_m: length(collar), ProfundidadeFinal_m: length(prev), NumeroCamadas: integer(b.layers.length),
      MotorCommit: label(meta.commit.slice(0, 12)), Ressalva: text(meta.disclaimer),
    }, key);
    if (b.waterLevel_m == null) avisos.push(`${b.ref}: nível d'água não informado.`);
    inSite.push(bh);
    sondagens.push({ ref: b.ref, camadas: b.layers.length, profundidade_m: prev });
  }

  if (inStorey.length) w.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', [w.guid('contain-storey'), null, null, null, inStorey, storey]);
  if (inSite.length) w.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', [w.guid('contain-site'), null, null, null, inSite, site]);
  w.flushMaterials();

  const content = w.toString(meta.fileName, meta.timestamp, `starkx-mcp ${meta.version}`);
  return { content, entidades: w.count, elementos: resumo, sondagens, avisos };
}
