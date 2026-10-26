import { z } from 'zod';
import { calculate, PILE_TYPES, SOIL_TYPES, type CalculationInput } from '../../calculation-engine/index';
import { previewFromLayers } from '../../assist-engine/importBorehole';
import { suggestFoundationKind } from '../../assist-engine/foundationSuggest';
import { designPileGroup } from '../../pile-group-engine/index';
import { designPileCap } from '../../block-engine/index';
import { designFooting } from '../../footing-engine/index';
import { designRaft } from '../../raft-engine/index';
import { designCaisson } from '../../caisson-engine/index';
import { optimizePileSolution } from '../../conception-engine/index';
import { computePileTakeoff } from '../../structural-engine/takeoff/pileTakeoff';
import { computeFootingTakeoff } from '../../structural-engine/takeoff/footingTakeoff';
import { computeBlockTakeoff } from '../../structural-engine/takeoff/blockTakeoff';
import type { ElementTakeoff } from '../../structural-engine/takeoff/types';
import { designPileReinforcement } from '../../structural-engine/design';
import { saveExport, stampPdf, fontBytes, workbookBytes, type ExportTable } from './exports';
import { buildMemorialDocument } from '../../memorial-engine/buildMemorial';
import { memorialToPdf } from '../../memorial-engine/toPdf';
import { buildProjectDrawingBook } from '../../drawing-engine/sheets/buildProjectDrawingBook';
import { exportProjectBookToPdf } from '../../drawing-engine/export/pdfExport';
import * as s from './schemas';
import { buildFoundationIfc } from './ifcExport';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';
import { access } from 'node:fs/promises';

declare const __STARKX_COMMIT__: string | undefined;
// Hash do repositório STARKX no momento do build (os motores são os do próprio repositório).
export const COMMIT = typeof __STARKX_COMMIT__ === 'string' ? __STARKX_COMMIT__ : 'desconhecido';
export const DISCLAIMER = 'Pré-dimensionamento. Conferir e validar por engenheiro responsável antes de assinar.';
const VERSION = '0.1.0';
const catalog = {
  'calculation-engine': { metodos: ['Aoki-Velloso (1975)', 'Décourt-Quaresma (1978/1996)', 'Teixeira (1996)'], normas: [], fonte: 'calculation-engine/catalogs.ts; index.ts' },
  'assist-engine': { metodos: ['Validação de importação SPT', 'Sugestão heurística DEC-54/55/56'], normas: [], fonte: 'assist-engine/importBorehole.ts; foundationSuggest.ts' },
  'pile-group-engine': { metodos: ['Estática rígida N/n ± Mx.y/Σy² ± My.x/Σx²'], normas: [], fonte: 'pile-group-engine/index.ts:54' },
  'block-engine': { metodos: ['Bielas e tirantes', 'Punção', 'Eficiência Converse-Labarre'], normas: ['NBR 6122', 'NBR 6118'], fonte: 'block-engine/design.ts; strutTie.ts; punching.ts; efficiency.ts' },
  'footing-engine': { metodos: ['Tensão admissível informada', 'Vesic (1975)', 'CEB-70', 'Punção'], normas: ['NBR 6122', 'NBR 6118'], fonte: 'footing-engine/design.ts; bearing.ts' },
  'raft-engine': { metodos: ['Área/tensões via footing-engine', 'Espessura preliminar; sem esforços na placa'], normas: ['NBR 6122', 'NBR 6118'], fonte: 'raft-engine/design.ts' },
  'caisson-engine': { metodos: ['Tensão admissível informada', 'Vesic (1975)', 'Atrito unitário informado ou Aoki por SPT'], normas: ['NBR 6122', 'NBR 6118'], fonte: 'caisson-engine/design.ts; shaft-spt.ts' },
  'conception-engine': { metodos: ['Interpretação do perfil', 'Otimização de estacas e grupos'], normas: [], fonte: 'conception-engine/index.ts' },
  'structural-engine': { metodos: ['Armadura de estaca', 'Quantitativos de estaca, sapata e bloco'], normas: ['NBR 7480', 'NBR 6118'], fonte: 'structural-engine/design.ts; takeoff/' },
  'memorial-engine': { metodos: ['Memorial PDF de estaca, sapata e conjunto estaca/bloco'], normas: [], fonte: 'memorial-engine/buildMemorial.ts; toPdf.ts' },
  'drawing-engine': { metodos: ['Caderno PDF de estaca, sapata e bloco'], normas: [], fonte: 'drawing-engine/sheets/buildProjectDrawingBook.ts; export/pdfExport.ts' },
  domain: { metodos: ['Tipos e adaptadores internos'], normas: [], fonte: 'domain/index.ts; adapters/' },
};
type Engine = keyof typeof catalog;
function collect(value: unknown, key: string): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(v => collect(v,key));
  return Object.entries(value).flatMap(([k,v]) => k === key && typeof v === 'string' ? [v] : k === key && Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : collect(v,key));
}
function finiteResult(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Motor retornou número não finito; revise os dados e os limites documentados.');
  if (value && typeof value === 'object') Object.values(value).forEach(finiteResult);
}
function envelope(motores: Engine[], resultado: unknown, avisos: string[] = []) {
  finiteResult(resultado);
  const referencias = [...new Set(collect(resultado, 'reference'))];
  const checks = collect(resultado, 'message');
  const warnings = [...new Set([...avisos, ...collect(resultado,'warnings')])];
  return { motor_versao: VERSION, motor_commit: COMMIT, motores, normas: [...new Set([...motores.flatMap(m => catalog[m].normas), ...referencias.filter(r => /NBR/.test(r))])], referencias, avisos: warnings, ressalva: DISCLAIMER, resultado, mensagens_motor: checks };
}
export function pileInput(a: z.output<typeof s.pile>): CalculationInput {
  const { diametro_cm, area_cm2, perimetro_cm, volume_base_litros, ...rest } = a;
  return { ...rest, diameterCm: diametro_cm, areaCm2: area_cm2, perimeterCm: perimetro_cm, enlargedBaseVolumeLiters: volume_base_litros };
}
function takeoff(a:z.output<typeof s.takeoff>):ElementTakeoff {
  const {perdas_pct,...rest}=a;
  if (rest.tipo==='sapata') return computeFootingTakeoff({...rest,lossPercentage:perdas_pct});
  if (rest.tipo==='bloco') return computeBlockTakeoff({...rest,lossPercentage:perdas_pct});
  return computePileTakeoff({...rest,lossPercentage:perdas_pct});
}
function footingTakeoff(r:ReturnType<typeof designFooting>) {
  return r.rebar ? computeFootingTakeoff({B_m:r.B_m,L_m:r.L_m,thickness_m:r.thickness_m,bar_mm:r.rebar.suggestBar_mm,spacing_cm:r.rebar.suggestSpacing_cm}) : null;
}
type ComparisonRow={tipo:string;status:'calculada'|'não calculada';dimensoes:unknown;verificacao:'ok'|'não'|'não verificada';taxa_utilizacao:number|null;criterio_taxa:string|null;quantitativo:unknown;motivo:string|null;calculo:unknown};
const comparisonEngines:Engine[]=['calculation-engine','block-engine','footing-engine','raft-engine','caisson-engine','conception-engine','structural-engine'];
// Display-only ratios of native demand/resistance values; no sizing formulas.
const ratio=(d:number,c:number)=>c>0?d/c:null;
function compareAlternatives(a:z.output<typeof s.comparison>) {
  const tabela:ComparisonRow[]=[];
  let pileResult:ReturnType<typeof calculate>|undefined;
  const shared={Nk_kN:a.N_kN,Mx_kNm:a.Mx_kNm,My_kNm:a.My_kNm,loadIsDesign:false};
  const moments=a.Mx_kNm!==0||a.My_kNm!==0;
  function alternative(tipo:string,config:unknown,run:()=>Omit<ComparisonRow,'tipo'|'status'>) {
    try {
      if(config===undefined) throw new Error('Parâmetros desta alternativa não informados.');
      const row=run();finiteResult(row);tabela.push({tipo,status:'calculada',...row});
    } catch(e) {
      const motivo=e instanceof z.ZodError ? e.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ') : e instanceof Error?e.message:String(e);
      tabela.push({tipo,status:'não calculada',dimensoes:null,verificacao:'não verificada',taxa_utilizacao:null,criterio_taxa:null,quantitativo:null,motivo,calculo:null});
    }
  }
  alternative('estaca',a.estaca,()=>{
    const input=s.pile.parse({...a.estaca,layers:a.layers,waterLevel_m:a.waterLevel_m,designLoad_kN:a.N_kN});
    const r=calculate(pileInput(input));pileResult=r;
    if(moments) throw new Error('Motor de capacidade axial de estaca não verifica os momentos informados; usar bloco/concepção.');
    return {dimensoes:{diametro_cm:input.diametro_cm,comprimento_m:input.tipDepth_m,topo_m:input.pileTopDepth_m??0},verificacao:r.verdict==='approved'?'ok':r.verdict==='not_ok'?'não':'não verificada',taxa_utilizacao:ratio(a.N_kN,r.atTip.governingPadm_kN),criterio_taxa:'N / Padm governante (axial)',quantitativo:null,motivo:'Quantitativo indisponível sem detalhamento da armadura.',calculo:r};
  });
  alternative('bloco',a.bloco,()=>{
    if(!pileResult) throw new Error('Informe geometria/tipo de estaca para obter Padm na mesma sondagem.');
    if(a.bloco?.pileTypeId!=null&&a.bloco.pileTypeId!==a.estaca?.pileTypeId) throw new Error('Tipo de estaca do bloco deve coincidir com a estaca calculada.');
    const input=s.block.parse({...a.bloco,diameter_m:a.bloco?.diameter_m??(a.estaca?.diametro_cm===undefined?undefined:a.estaca.diametro_cm/100),pileTypeId:a.estaca?.pileTypeId,groupLoad_kN:a.N_kN,Mx_kNm:a.Mx_kNm,My_kNm:a.My_kNm,loadIsDesign:false,singlePadm_kN:pileResult.atTip.governingPadm_kN});
    if(input.diameter_m!==a.estaca!.diametro_cm!/100) throw new Error('Diâmetro do bloco deve coincidir com a estaca calculada.');
    const r=designPileCap(input), check=r.checks.find(c=>c.id==='capacity');
    return {dimensoes:r.cap,verificacao:r.checks.some(c=>c.status==='error')||r.capacityOk===false?'não':r.capacityOk===null?'não verificada':'ok',taxa_utilizacao:check?.value!==undefined&&check.limit!==undefined?ratio(check.value,check.limit):null,criterio_taxa:'(N + peso próprio nativo) / Padm do grupo; consultar reações individuais',quantitativo:r.takeoff??null,motivo:r.groupCapacityIndicative?'Eficiência não informada: capacidade indicativa.':null,calculo:r};
  });
  for(const tipo of ['sapata','radier'] as const) alternative(tipo,a[tipo],()=>{
    const r=tipo==='sapata'?designFooting(s.footing.parse({...a.sapata,...shared})):designRaft(s.raft.parse({...a.radier,...shared}));
    return {dimensoes:{B_m:r.B_m,L_m:r.L_m,thickness_m:r.thickness_m},verificacao:r.checks.some(c=>c.status==='error')?'não':'ok',taxa_utilizacao:ratio(r.sigmaMax_kPa,r.qadm_kPa),criterio_taxa:'sigmaMax / qadm (geotecnia)',quantitativo:tipo==='sapata'?footingTakeoff(r):null,motivo:tipo==='radier'?'Sem esforços/armadura de placa no motor.':!r.rebar?'Sem quantitativo de aço: informar fck_MPa para dimensionamento estrutural.':null,calculo:r};
  });
  alternative('tubulao',a.tubulao,()=>{
    if(moments) throw new Error('Motor de tubulão não verifica os momentos informados.');
    const r=designCaisson(s.caisson.parse({...a.tubulao,Nk_kN:a.N_kN,loadIsDesign:false,sptLayers:a.layers}));
    const capacity=r.checks.find(c=>c.id==='capacity');
    return {dimensoes:{shaftDiameter_m:r.shaftDiameter_m,baseDiameter_m:r.baseDiameter_m,length_m:r.length_m},verificacao:r.verdict==='approved'?'ok':'não',taxa_utilizacao:capacity?.limit!==undefined&&capacity.value!==undefined?ratio(capacity.limit,capacity.value):null,criterio_taxa:'Nk / Padm conforme verificação nativa do tubulão',quantitativo:null,motivo:'Sem quantitativo integrado no motor de tubulão.',calculo:r};
  });
  alternative('concepcao',a.concepcao,()=>{
    const input=s.conception.parse({...a.concepcao,N_kN:a.N_kN,Mx_kNm:a.Mx_kNm,My_kNm:a.My_kNm,layers:a.layers,waterLevel_m:a.waterLevel_m});
    const {fixedDiameter_cm,...rest}=input;
    const r=optimizePileSolution({...rest,fixedDiameterCm:fixedDiameter_cm}),c=r.recommended;
    if(!c) throw new Error(r.summary||'Motor não encontrou concepção viável.');
    return {dimensoes:{diametro_cm:c.diameterCm,comprimento_m:c.tipDepth_m,rows:c.rows,cols:c.cols,nPiles:c.nPiles},verificacao:c.ok?'ok':'não',taxa_utilizacao:c.utilization,criterio_taxa:'utilization nativa da concepção',quantitativo:{pileConcrete_m3:c.pileConcrete_m3,totalLength_m:c.totalLength_m},motivo:'Concepção heurística; volume de estacas é proxy nativo, sem aço/bloco.',calculo:r};
  });
  return {carga_caracteristica_kN:a.N_kN,Mx_kNm:a.Mx_kNm,My_kNm:a.My_kNm,sondagem:a.layers,tabela};
}
const IFC_PYTHON = process.env.STARKX_IFC_PYTHON ?? 'python';
function runIfcPython(args:string[]):Promise<unknown> {
  const script=fileURLToPath(new URL('../scripts/ifc_tools.py',import.meta.url));
  return new Promise((ok,fail)=>execFile(IFC_PYTHON,['-I',script,...args],{maxBuffer:64*1024*1024,timeout:180000,windowsHide:true,encoding:'utf8'},(err,stdout,stderr)=>{
    if(err) return fail(new Error(`Python/IfcOpenShell falhou (${IFC_PYTHON}): ${(stderr||err.message).trim().split('\n').slice(-3).join(' | ')}`));
    try { ok(JSON.parse(stdout)); } catch { fail(new Error('Saída do leitor IFC não é JSON.')); }
  }));
}
const fold=(t:string)=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,' ').trim();
const soilByName=(name:string|null|undefined)=>{
  if(!name) return null;
  const f=fold(name);
  // nome mais longo primeiro: "argila siltosa" antes de "argila"
  return [...SOIL_TYPES].sort((x,y)=>y.name.length-x.name.length).find(s=>f===fold(s.name)||f.startsWith(`${fold(s.name)} `)||f.includes(fold(s.name)))??null;
};
type RawStratum={nome:string|null;descricao:string|null;tag:string|null;topo_m:number;base_m:number;props:Record<string,unknown>;material:string|null};
type RawBorehole={nome:string|null;guid:string;x_m:number;y_m:number;cota_boca_m:number;props:Record<string,unknown>;camadas:RawStratum[]};
function numProp(props:Record<string,unknown>,re:RegExp){
  for(const [k,v] of Object.entries(props)) if(re.test(k)&&typeof v==='number'&&Number.isFinite(v)) return v;
  return null;
}
function boreholesFromIfc(raw:unknown):[unknown,string[]] {
  const data=raw as {esquema:string;furos:RawBorehole[]};
  const avisos:string[]=[];
  if(!data.furos.length) avisos.push('Nenhum IfcBorehole no arquivo.');
  const furos=data.furos.map(f=>{
    const camadas=f.camadas.map(c=>{
      const nspt=numProp(c.props,/(^|[._ ])n_?spt$|^nspt$|spt/i);
      const idProp=numProp(c.props,/soloid|soiltypeid/i);
      const soil=idProp!=null?SOIL_TYPES.find(s=>s.id===idProp)??null:soilByName(c.material)??soilByName(c.descricao)??soilByName(c.nome);
      return {nome:c.nome,topo_m:c.topo_m,base_m:c.base_m,espessura_m:+(c.base_m-c.topo_m).toFixed(4),nspt,soilTypeId:soil?.id??null,solo:soil?.name??null,origem_solo:idProp!=null?'Pset':soil?'nome da camada/material':null};
    });
    const faltando=camadas.filter(c=>c.nspt==null||c.soilTypeId==null).map(c=>c.nome??'?');
    const nivel=numProp(f.props,/nivelagua|waterlevel|groundwater/i);
    let layers=null, validacao=null;
    if(camadas.length&&!faltando.length) {
      layers=camadas.map(c=>({depth_m:c.base_m,nspt:c.nspt!,soilTypeId:c.soilTypeId!}));
      validacao=previewFromLayers(layers,nivel,'json');
    } else if(camadas.length) avisos.push(`${f.nome??f.guid}: ${faltando.length} camada(s) sem NSPT ou tipo de solo reconhecido; complete antes de calcular (${faltando.slice(0,5).join(', ')}${faltando.length>5?'…':''}).`);
    if(camadas.some(c=>c.espessura_m>1.05)) avisos.push(`${f.nome??f.guid}: há camadas com mais de 1 m; o motor de estacas espera o boletim metro a metro.`);
    return {nome:f.nome,guid:f.guid,x_m:f.x_m,y_m:f.y_m,cota_boca_m:f.cota_boca_m,waterLevel_m:nivel,camadas,layers,validacao};
  });
  return [{esquema:data.esquema,furos},avisos];
}
type Tool = { name: string; description: string; inputSchema: {type:'object'; [key:string]:unknown}; run: (args: unknown) => Promise<unknown> };
function define<T extends z.ZodType>(name: string, description: string, schema: T, run: (input: z.output<T>) => unknown|Promise<unknown>): Tool {
  return { name, description, inputSchema: {...z.toJSONSchema(schema, {io:'input'}),type:'object'}, run: async args => run(schema.parse(args)) };
}
export const tools: Tool[] = [
  define('validar_sondagem','Valida camadas SPT: profundidade em m, NSPT adimensional, soilTypeId do catálogo e nível d’água em m. Retorna erros e avisos.',s.borehole,a => {
    const r = previewFromLayers(a.layers,a.waterLevel_m ?? null,'json');
    return envelope(['assist-engine'],{...r, erros:r.errors}, a.waterLevel_m == null ? ['Nível d’água não informado.'] : []);
  }),
  define('calcular_estaca','Calcula Aoki-Velloso, Décourt-Quaresma e Teixeira conforme aplicabilidade. diametro_cm; tipDepth_m é comprimento a partir do topo, pileTopDepth_m é profundidade do topo; forças kN. Retorna métodos, fatores nos traces e resistência adotada.',s.pile,a => envelope(['calculation-engine'],calculate(pileInput(a)))),
  define('calcular_grupo_estacas','Distribui cargas em grupo retangular rígido: dimensões m, forças kN, momentos kNm; efficiency é adimensional ou null (capacidade indicativa).',s.group,a => {
    const r = designPileGroup(a);
    return envelope(['pile-group-engine'],r, [...(a.efficiency == null ? ['Eficiência não informada; capacidade do grupo sem veredito de projeto.'] : []), ...(!r.ok ? [r.message] : [])]);
  }),
  define('calcular_bloco','Dimensiona bloco retangular sobre estacas: dimensões m, cargas kN, momentos kNm, fck/fyk MPa. Retorna verificações, armaduras e quantitativo do motor.',s.block,a => envelope(['block-engine'],designPileCap(a))),
  define('calcular_sapata','Dimensiona sapata: Nk_kN, momentos kNm, dimensões m, tensões kPa, concreto/aço MPa. admMode=user exige sigmaAdm_kPa; bearing exige soil.',s.footing,a => envelope(['footing-engine'],designFooting(a))),
  define('calcular_radier','Pré-dimensiona área e tensões do radier retangular (m, kN, kPa); sem cálculo dos esforços da placa.',s.raft,a => envelope(['raft-engine'],designRaft(a),['O motor não analisa esforços nem armadura da placa do radier.'])),
  define('calcular_tubulao','Calcula tubulão: diâmetros/comprimento m, Nk_kN, tensões/atrito kPa, fck MPa; ponta por tensão informada ou Vesic e fuste informado ou SPT Aoki.',s.caisson,a => envelope(['caisson-engine'],designCaisson(a))),
  define('sugerir_concepcao','Sugere tipo de fundação com assist-engine e otimiza estacas/grupos com conception-engine a partir da carga kN e sondagem em m. sigmaAdm_kPa é hipótese de triagem; sugestão heurística.',s.conception,a => {
    const {fixedDiameter_cm,sigmaAdm_kPa,...rest}=a;
    const concepcao = optimizePileSolution({...rest,fixedDiameterCm:fixedDiameter_cm});
    const tipo = suggestFoundationKind({columns:[{id:'P1',columnLabel:'P1',N_kN:a.N_kN,Mx_kNm:a.Mx_kNm ?? 0,My_kNm:a.My_kNm ?? 0}],loadIsDesign:false,sigmaAdm_kPa,layers:a.layers,waterLevel_m:a.waterLevel_m});
    return envelope(['conception-engine','assist-engine'],{tipo,concepcao},['Sugestão heurística; tensão admissível de triagem não substitui investigação geotécnica.',...tipo.soil.notes]);
  }),
  define('quantitativo_fundacao','Quantitativo nativo: tipo estaca (padrão), sapata ou bloco. Geometria m; barras mm, espaçamento de sapata/bloco cm, de estaca m; perdas_pct %. Geometria/armadura de entrada devem vir do dimensionamento.',s.takeoff,a => envelope(['structural-engine'],takeoff(a))),
  define('armadura_estaca','Armadura pelo structural-engine, sem fórmulas adicionais. Nk_kN, Mk_kNm e Vk_kN característicos salvo loadIsDesign; diâmetro/comprimento m, cobrimento mm, fck/fyk MPa. Retorna aplicabilidade, verificações e quantitativo.',s.reinforcement,a=>envelope(['structural-engine'],designPileReinforcement(a))),
  define('comparar_alternativas','Mesma carga característica N_kN, momentos kNm e sondagem layers para estaca, bloco, sapata, radier, tubulão e concepção. Configurações opcionais por tipo; sem dados suficientes retorna não calculada e motivo. Tensões rasas exigem dado explícito; sem correlação SPT inventada.',s.comparison,a=>envelope(comparisonEngines,compareAlternatives(a),['Taxas são razões de valores nativos, com critério por linha; não substituem todas as verificações.', 'Tensão/solo das fundações rasas devem ser informados; sondagem é compartilhada onde o motor aceita SPT.'])),
  define('exportar_memorial','Memorial PDF nativo de estaca, sapata ou conjunto estaca/bloco (bloco exige também estaca). pasta absoluta no MCP; carimbo opcional com empresa, responsavel, registro_CREA, obra, codigo. Sobrescrita só com sobrescrever:true.',s.memorial,async a => {
    if ('sapata' in a) {
      const result=designFooting(a.sapata);
      const doc=buildMemorialDocument({generatedAtIso:new Date().toISOString(),project:{name:a.projeto,code:a.carimbo?.codigo??'',client:'',location:''},site:{waterLevel_m:null},layers:[],designLoad_kN:result.Nd_kN,geotechnical:null,structural:null,softwareVersion:`MCP ${VERSION}; motor ${COMMIT}`,footing:{...result,shape:a.sapata.shape,admMode:a.sapata.admMode,checksOk:!result.checks.some(c=>c.status==='error'),rebarMessage:result.rebar?.message}});
      doc.sections.push({id:'mcp-ressalva',title:'Validação técnica',paragraphs:[DISCLAIMER]});
      return envelope(['memorial-engine','footing-engine'],{...await saveExport(a.pasta,a.nome,'pdf',await stampPdf(await memorialToPdf(doc,{fontBytes:await fontBytes()}),a.carimbo),a.sobrescrever),calculo:result});
    }
    const input = pileInput(a.estaca);
    const result = calculate(input);
    const alphaPct = result.traces.find(t=>t.stepId==='decourt.alpha_beta')?.substitutions.alphaPct;
    if (input.methods?.includes('decourt_quaresma')!==false && typeof alphaPct !== 'number') throw new Error('Motor não forneceu rastreio do fator α de Décourt para o memorial.');
    const blockResult=a.bloco?designPileCap({...a.bloco,singlePadm_kN:result.atTip.governingPadm_kN}):undefined;
    if(a.bloco && (a.bloco.diameter_m!==input.diameterCm/100 || (a.bloco.pileTypeId!=null&&a.bloco.pileTypeId!==input.pileTypeId))) throw new Error('Bloco e estaca devem ter o mesmo diâmetro/tipo.');
    const doc = buildMemorialDocument({
      generatedAtIso:new Date().toISOString(), project:{name:a.projeto,code:a.carimbo?.codigo??'',client:'',location:''},
      pile:{typeLabel:PILE_TYPES.find(p=>p.id===input.pileTypeId)!.name,diameter_cm:input.diameterCm,tipDepth_m:input.tipDepth_m,pileTopDepth_m:input.pileTopDepth_m,sptTipDepth_m:(input.pileTopDepth_m??0)+input.tipDepth_m},
      site:{waterLevel_m:input.waterLevel_m??null},layers:input.layers.map(l=>({depth_m:l.depth_m,nspt:l.nspt,soilLabel:SOIL_TYPES.find(t=>t.id===l.soilTypeId)!.name})),
      designLoad_kN:input.designLoad_kN??null,geotechnical:result,structural:null,softwareVersion:`MCP ${VERSION}; motor ${COMMIT}`,
      block:blockResult&&a.bloco?{...blockResult,rows:a.bloco.rows,cols:a.bloco.cols,edge_m:a.bloco.edge_m,thickness_m:blockResult.cap.thickness_m,width_m:blockResult.cap.width_m,length_m:blockResult.cap.length_m,punchingMessage:blockResult.punching?.message,strutTieMessage:blockResult.strutTie?.message,rebarMessage:blockResult.rebar?.message}:undefined,
      elementTakeoffs:blockResult?.takeoff?[blockResult.takeoff]:undefined,
      loadsTable:a.bloco?[{element:'Bloco',N_kN:a.bloco.groupLoad_kN??undefined,Mx_kNm:a.bloco.Mx_kNm??undefined,My_kNm:a.bloco.My_kNm??undefined}]:undefined,
      methods:{mode:result.mode,governingRule:input.governingRule??'minimum',selectedMethod:input.selectedMethod??null,
        aokiFs:input.aoki?.fs??2,aokiPctTip:input.aoki?.pctTip??100,aokiPctShaft:input.aoki?.pctShaft??100,
        decourtAlphaPct:typeof alphaPct==='number'?alphaPct:null,decourtBetaPct:input.decourt?.betaPct??null,
        teixeiraFs:input.teixeira?.fs??2,teixeiraPctTip:input.teixeira?.pctTip??100,teixeiraPctShaft:input.teixeira?.pctShaft??100},
    });
    doc.sections.push({id:'mcp-ressalva',title:'Validação técnica',paragraphs:[DISCLAIMER]});
    const saved=await saveExport(a.pasta,a.nome,'pdf',await stampPdf(await memorialToPdf(doc,{fontBytes:await fontBytes()}),a.carimbo),a.sobrescrever);
    return envelope(blockResult?['memorial-engine','calculation-engine','block-engine']:['memorial-engine','calculation-engine'],{...saved,calculo:result,...(blockResult?{bloco:blockResult}:{})});
  }),
  define('exportar_desenho','Caderno PDF pelos construtores existentes: geometria de estaca ou entrada sapata/bloco com cálculo nativo. Dimensões m; carimbo opcional e sobrescrever:false por padrão. Motor não oferece DXF.',s.drawing,async a => {
    const drawingInput:Parameters<typeof buildProjectDrawingBook>[0]={projectName:a.projeto,generalNotes:[DISCLAIMER,`Motor ${VERSION}; commit ${COMMIT}`]};
    let result:ReturnType<typeof designFooting>|ReturnType<typeof designPileCap>|null=null;
    if('sapata' in a) {
      const r=designFooting(a.sapata),q=footingTakeoff(r);result=r;
      if(!q) throw new Error('Desenho de sapata exige fck_MPa e armadura calculada; sem isso o construtor usa barras de exemplo.');
      drawingInput.footings=[{result:r,takeoff:q,ref:a.referencia,pierWidth_m:a.sapata.columnWidth_m??undefined,pierLength_m:a.sapata.columnDepth_m??undefined}];
    } else if('bloco' in a) {
      const r=designPileCap(a.bloco);result=r;
      if(!r.takeoff||!r.rebar) throw new Error('Desenho de bloco exige carga groupLoad_kN para armadura/quantitativo calculados.');
      drawingInput.blocks=[{result:r,takeoff:r.takeoff,pileDiameter_m:a.bloco.diameter_m,pileShaftLength_m:a.pileShaftLength_m,ref:a.referencia,pierWidth_m:a.bloco.columnWidth_m??undefined,pierLength_m:a.bloco.columnDepth_m??undefined}];
    } else drawingInput.piles=[{diameter_m:a.diameter_m,length_m:a.length_m,pileCount:a.pileCount,ref:a.referencia}];
    const book=buildProjectDrawingBook(drawingInput);
    const motores:Engine[]=['drawing-engine',...('sapata' in a?['footing-engine' as const]:'bloco' in a?['block-engine' as const]:[])];
    return envelope(motores,{...await saveExport(a.pasta,a.nome,'pdf',await stampPdf(await exportProjectBookToPdf(book),a.carimbo),a.sobrescrever),paginas:book.sheets.length,...(result?{calculo:result}:{})},result?[]:['Desenho geométrico de estaca; armadura não dimensionada nesta ferramenta.']);
  }),
  define('exportar_resumo_xlsx','Exporta quantitativo ou comparação recalculados pelos motores em ExcelJS local, identidade Mont Cruz e rastreabilidade. Informe quantitativo (entrada de quantitativo_fundacao) OU comparacao (entrada de comparar_alternativas), pasta e nome. Sobrescrita só com sobrescrever:true.',s.spreadsheet,async a=>{
    let tables:ExportTable[], resultado:unknown, motores:Engine[];
    if('quantitativo' in a) {
      const r=takeoff(a.quantitativo);resultado=r;motores=['structural-engine'];
      tables=[{nome:'Quantitativo',colunas:['Elemento','Tipo','Concreto','Volume (m³)','Magro (m³)','Aço líquido (kg)','Aço com perdas (kg)','Perdas (%)'],linhas:[[r.elementRef,r.elementKind,r.concreteGrade,r.concreteVolume_m3,r.leanConcreteVolume_m3,r.totalSteelWeight_kg,r.totalSteelWithLosses_kg,r.lossPercentage]]},
      {nome:'Corte de aço',colunas:['Posição','Aço','Diâmetro (mm)','Quantidade','Compr. unitário (m)','Compr. total (m)','Massa (kg)'],linhas:r.items.map(i=>[i.name,i.steelGrade,i.diameter_mm,i.count,i.unitLength_m,i.totalLength_m,i.totalWeight_kg])}];
    } else {
      const r=compareAlternatives(a.comparacao);resultado=r;motores=comparisonEngines;
      tables=[{nome:'Comparação',colunas:['Tipo','Estado','Dimensões (unidades nas chaves)','Verificação','Taxa (adimensional)','Critério da taxa','Quantitativo (unidades nas chaves)','Motivo / limite'],linhas:r.tabela.map(row=>{
        const q=row.quantitativo;
        const summary=q&&typeof q==='object'&&'concreteVolume_m3' in q?{concreto_m3:q.concreteVolume_m3,magro_m3:'leanConcreteVolume_m3' in q?q.leanConcreteVolume_m3:null,aco_com_perdas_kg:'totalSteelWithLosses_kg' in q?q.totalSteelWithLosses_kg:null}:q;
        return [row.tipo,row.status,row.dimensoes?JSON.stringify(row.dimensoes):null,row.verificacao,row.taxa_utilizacao,row.criterio_taxa,summary?JSON.stringify(summary):null,row.motivo];
      })},
      {nome:'Premissas',colunas:['Parâmetro','Valor / unidade'],linhas:[['Carga característica (kN)',a.comparacao.N_kN],['Mx (kNm)',a.comparacao.Mx_kNm],['My (kNm)',a.comparacao.My_kNm],['Água (m)',a.comparacao.waterLevel_m??'Não informada'],...a.comparacao.layers.map(l=>['Camada (profundidade m / NSPT / soilTypeId)',`${l.depth_m} / ${l.nspt} / ${l.soilTypeId}`] satisfies (string|number|null)[])]}];
    }
    finiteResult(resultado);
    return envelope(motores,{...await saveExport(a.pasta,a.nome,'xlsx',await workbookBytes(a.projeto,tables,COMMIT,DISCLAIMER),a.sobrescrever),resumo:resultado});
  }),
  define('exportar_ifc','Grava IFC4X3_ADD2 (abre no Bonsai, FreeCAD, Open BIM Studio) com fundações recalculadas pelos motores e sondagens SPT. elementos: estaca (IfcPile), bloco sobre estacas (IfcFooting PILE_CAP + IfcPile), sapata (IfcFooting PAD_FOOTING), radier (IfcSlab BASESLAB), tubulão (IfcCaissonFoundation); cada um com x_m/y_m em planta, profundidades em m abaixo de cota_terreno_m e a mesma entrada da ferramenta de cálculo correspondente. sondagens: IfcBorehole + um IfcGeotechnicalStratum por camada, com NSPT e solo em Pset. Propriedades em Pset_MC_STARKX, quantidades em Qto_*; GlobalIds estáveis por projeto+ref (reexportar atualiza o mesmo modelo).',s.ifcExport,async a=>{
    const fileName=`${a.nome}.ifc`;
    const r=buildFoundationIfc(a,{commit:COMMIT,version:VERSION,disclaimer:DISCLAIMER,fileName,timestamp:new Date().toISOString().slice(0,19)});
    const saved=await saveExport(a.pasta,a.nome,'ifc',new TextEncoder().encode(r.content),a.sobrescrever);
    const motores=[...new Set(a.elementos.flatMap(e=>e.tipo==='estaca'?['calculation-engine','structural-engine']:e.tipo==='bloco'?['calculation-engine','block-engine']:e.tipo==='sapata'?['footing-engine','structural-engine']:e.tipo==='radier'?['raft-engine']:['caisson-engine'])),...(a.sondagens.length?['assist-engine']:[])] as Engine[];
    return envelope(motores,{...saved,esquema:'IFC4X3_ADD2',entidades:r.entidades,elementos:r.elementos,sondagens:r.sondagens},r.avisos);
  }),
  define('importar_sondagem_ifc','Lê sondagens de um arquivo IFC4X3 (IfcBorehole com IfcGeotechnicalStratum, de qualquer origem: STARKX, IfcBorehole, Bonsai) e devolve as camadas no formato STARKX. Profundidades em m a partir da boca do furo. NSPT e soilTypeId vêm do Pset_MC_SondagemSPT ou de propriedades com NSPT/SPT no nome; tipo de solo também pelo nome da camada. Nada é inventado: camadas sem NSPT ou solo ficam marcadas e layers só é devolvido quando o perfil está completo. Exige Python com IfcOpenShell (defina STARKX_IFC_PYTHON; padrão: python do PATH).',s.ifcImport,async a=>{
    if(!isAbsolute(a.arquivo)) throw new Error('Informe caminho absoluto do arquivo .ifc.');
    await access(a.arquivo);
    const raw=await runIfcPython(['ler_sondagem',a.arquivo]);
    return envelope(['assist-engine'],...boreholesFromIfc(raw));
  }),
  define('listar_metodos','Lista motores, métodos e normas citadas no código (edição quando explicitada), versão/commit e catálogos soilTypeId/pileTypeId.',s.empty,() => envelope(Object.keys(catalog) as Engine[],{motores:catalog,solos:SOIL_TYPES,estacas:PILE_TYPES},['As referências reproduzem o motor e não certificam conformidade normativa integral.'])),
];
export async function callTool(name: string, args: unknown) {
  try {
    const tool=tools.find(t=>t.name===name);
    if (!tool) throw new Error(`Ferramenta desconhecida: ${name}.`);
    const output=await tool.run(args);
    return {content:[{type:'text' as const,text:JSON.stringify(output)}]};
  } catch (error) {
    const message=error instanceof z.ZodError ? error.issues.map(i=>`${i.path.join('.') || 'entrada'}: ${i.message}`).join('; ') : error instanceof Error ? error.message : String(error);
    return {isError:true,content:[{type:'text' as const,text:`Erro na ferramenta ${name}: ${message}`}]};
  }
}
