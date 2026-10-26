import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { callTool, tools, COMMIT, DISCLAIMER } from '../dist/tools.mjs';
import { cases, example, pileInput, toolNames } from './fixtures.mjs';
await mkdir(resolve('test','saida'),{recursive:true});

async function run(name,input={}) {
  const r=await callTool(name,input);
  assert.ok(!r.isError,r.content[0].text);
  const data=JSON.parse(r.content[0].text);
  assert.equal(data.motor_commit,COMMIT); assert.equal(data.ressalva,DISCLAIMER);
  assert.ok(Array.isArray(data.avisos)); assert.ok(Array.isArray(data.normas));
  return data.resultado;
}
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);
test('listar_metodos: motores/catálogos existentes e ferramentas previstas',async()=>{
  assert.deepEqual(tools.map(t=>t.name).sort(),[...toolNames].sort());
  const r=await run('listar_metodos'); assert.equal(Object.keys(r.motores).length,12);
  assert.equal(r.solos.length,15); assert.equal(r.estacas.length,11);
});
test('validar_sondagem: perfil de fixtures/reference-cases.json e duplicidade',async()=>{
  const r=await run('validar_sondagem',{layers:example.input.layers,waterLevel_m:null});
  assert.equal(r.ok,true); assert.equal(r.layers.length,12); assert.deepEqual(r.erros,[]);
  const bad=await run('validar_sondagem',{layers:[example.input.layers[0],example.input.layers[0]]});
  assert.equal(bad.ok,false); assert.ok(bad.erros.length>0);
});
test('calcular_estaca: todos os casos do oráculo STARKX (reference-cases.json)',async()=>{
  for (const c of cases) {
    const r=await run('calcular_estaca',pileInput(c));
    for (const m of r.atTip.methods) for (const key of ['Rp_kN','Rl_acum_kN','Rult_kN','Padm_kN']) close(m[key],c.expected.methods[m.methodId][key]);
    close(r.atTip.governingPadm_kN,c.expected.minimumPadm_kN);
  }
});
test('calcular_grupo_estacas: flow-restructure.test.ts, 1 estaca Nmax=200 kN',async()=>{
  const r=await run('calcular_grupo_estacas',{rows:1,cols:1,spacing_m:1,diameter_m:0.3,N_kN:200,Mx_kNm:0,My_kNm:0,singlePadm_kN:250,efficiency:1});
  close(r.maxPileLoad_kN,200); assert.equal(r.ok,true);
});
test('calcular_bloco: block.test.ts, 2x2 com eficiência=0,9',async()=>{
  const r=await run('calcular_bloco',{rows:2,cols:2,spacing_m:1,diameter_m:0.3,edge_m:0.25,thickness_m:0.5,singlePadm_kN:200,groupLoad_kN:650,efficiency:0.9});
  close(r.groupPadm_kN,720); close(r.pileLoads_kN[0],172.625); assert.equal(r.capacityOk,true); assert.ok(r.takeoff);
});
test('calcular_sapata: footing.test.ts, área=5 m², Nd=1400 kN',async()=>{
  const r=await run('calcular_sapata',{Nk_kN:1000,shape:'square',admMode:'user',sigmaAdm_kPa:200,gammaConcrete_kN_m3:0});
  close(r.area_m2,5,1e-4); close(r.Nd_kN,1400);
});
test('calcular_radier: other-foundations.test.ts, 5000 kN/150 kPa',async()=>{
  const r=await run('calcular_radier',{Nk_kN:5000,aspectRatio:2,admMode:'user',sigmaAdm_kPa:150,gammaConcrete_kN_m3:0});
  assert.equal(r.kind,'raft'); close(r.area_m2,5000/150,0.003); close(r.L_m/r.B_m,2,0.01);
});
test('calcular_tubulao: other-foundations.test.ts, ponta 452,389 kN',async()=>{
  const r=await run('calcular_tubulao',{Nk_kN:2000,loadIsDesign:true,shaftDiameter_m:1.2,length_m:8,admMode:'user',sigmaAdm_kPa:400,unitFriction_kPa:0});
  close(r.Rp_adm_kN,452.3893421169302); assert.equal(r.Rl_adm_kN,0); close(r.Padm_kN,r.Rp_adm_kN);
});
test('sugerir_concepcao: conception-engine.test.ts, perfil referência N=150 kN',async()=>{
  const r=await run('sugerir_concepcao',{layers:example.input.layers,N_kN:150,preferredPileTypeId:6,waterLevel_m:null});
  assert.ok(r.concepcao.evaluatedCount>0); assert.equal(r.concepcao.recommended.ok,true); assert.ok(r.tipo.suggestedKind);
});
test('quantitativo_fundacao: takeoff.test.ts, estaca 50 cm x 6,50 m',async()=>{
  const r=await run('quantitativo_fundacao',{diameter_m:0.5,length_m:6.5,longitudinalCount:8,longitudinalDia_mm:12.5,transverseDia_mm:8,transverseSpacing_m:0.15,cover_m:0.05,concreteGrade:'C20'});
  close(r.concreteVolume_m3,1.28,0.005); assert.equal(r.items.find(i=>i.name.includes('vertical')).count,8);
});
test('exportar_memorial: memorial.test.ts + referência do app; PDF real e não sobrescrita',async()=>{
  const dir=await mkdtemp(resolve('test','saida','memorial-'));
  const r=await run('exportar_memorial',{pasta:dir,nome:'memorial',projeto:'Exemplo',estaca:pileInput(example)});
  const bytes=await readFile(r.caminho); assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const pdf=await PDFDocument.load(bytes); assert.ok(pdf.getPageCount()>0);
  close(r.calculo.atTip.governingPadm_kN,example.expected.minimumPadm_kN);
  const duplicate=await callTool('exportar_memorial',{pasta:dir,nome:'memorial',estaca:pileInput(example)}); assert.equal(duplicate.isError,true);
});
test('exportar_desenho: geometria Ø30 cm x 8 m da referência do app em PDF',async()=>{
  const dir=await mkdtemp(resolve('test','saida','desenho-'));
  const r=await run('exportar_desenho',{pasta:dir,diameter_m:0.3,length_m:8});
  const pdf=await PDFDocument.load(await readFile(r.caminho)); assert.equal(pdf.getPageCount(),r.paginas); assert.ok(r.paginas>0);
});
test('entradas inválidas: tipos, unidades, condicionais e campos desconhecidos',async()=>{
  for (const [name,input] of [
    ['calcular_estaca',{...pileInput(example),diametro_cm:-1}],
    ['calcular_estaca',{...pileInput(example),tipDepth_m:500}],
    ['calcular_estaca',{...pileInput(example),governingRule:'user_selected'}],
    ['calcular_sapata',{Nk_kN:1000,shape:'square',admMode:'user'}],
    ['calcular_tubulao',{Nk_kN:100,shaftDiameter_m:1,length_m:5,admMode:'bearing'}],
    ['validar_sondagem',{layers:[],waterLevel_m:-1}],
    ['listar_metodos',{campo_inexistente:true}],
  ]) { const r=await callTool(name,input); assert.equal(r.isError,true,`${name}: deveria recusar`); assert.match(r.content[0].text,/Erro/); }
});
