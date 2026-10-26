import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument,PDFName,PDFDict } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { callTool,COMMIT } from '../dist/tools.mjs';
import { example,pileInput } from './fixtures.mjs';
await mkdir(resolve('test/saida'),{recursive:true});
const temp=prefix=>mkdtemp(resolve('test/saida',prefix));
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);
async function run(name,args) {
  const r=await callTool(name,args);assert.ok(!r.isError,r.content[0].text);
  const data=JSON.parse(r.content[0].text);assert.equal(data.motor_commit,COMMIT);return data.resultado;
}
// Upstream tests/unit/footing.test.ts: Nk=1000, qadm=200, A=5, Nd=1400.
const sapata={Nk_kN:1000,shape:'square',admMode:'user',sigmaAdm_kPa:200,gammaConcrete_kN_m3:0};
// Upstream tests/unit/block.test.ts: 2x2, Padm_g=720, N_i=172.625.
const bloco={rows:2,cols:2,spacing_m:1,diameter_m:0.3,edge_m:0.25,thickness_m:0.5,singlePadm_kN:200,groupLoad_kN:650,efficiency:0.9};
// Upstream tests/unit/takeoff.test.ts: 1x1x0.60 m, V=0.60, magro=0.10.
const qtyBlock={tipo:'bloco',pileCount:1,width_m:1,length_m:1,thickness_m:0.6};
const stamp={empresa:'Mont Cruz Engenharia',responsavel:'Engenheiro de teste',registro_CREA:'TESTE',obra:'Obra de teste',codigo:'MC-TESTE'};
function comparison(N_kN=1000) {
  const {layers,waterLevel_m,designLoad_kN,...estaca}=pileInput(example);
  const {Nk_kN,...shallow}=sapata;
  const {singlePadm_kN,groupLoad_kN,...blockConfig}=bloco;
  return {N_kN,layers,waterLevel_m,estaca,bloco:blockConfig,sapata:shallow,radier:{admMode:'user',sigmaAdm_kPa:150,gammaConcrete_kN_m3:0,aspectRatio:2},tubulao:{shaftDiameter_m:1.2,length_m:8,admMode:'user',sigmaAdm_kPa:400,unitFriction_kPa:0},concepcao:{preferredPileTypeId:6}};
}
test('armadura_estaca: structural.test.ts:6, Ø30, As_min=2.827433388 cm²',async()=>{
  const r=await run('armadura_estaca',{pileTypeId:6,diameter_m:0.3,tipDepth_m:4,Nk_kN:100,loadIsDesign:false});
  close(r.Ac_m2,0.07068583470577035);close(r.As_min_cm2,2.827433388);
  assert.ok(['ok','ok_min_connection'].includes(r.status));assert.ok(r.detail.longitudinal.count>=6);
  const metal=await run('armadura_estaca',{pileTypeId:4,diameter_m:0.3,tipDepth_m:4,Nk_kN:100});
  assert.equal(metal.status,'not_applicable');
});
test('comparar_alternativas: referências de estaca, sapata, radier, tubulão e bloco do STARKX',async()=>{
  const r=await run('comparar_alternativas',comparison());
  assert.equal(r.tabela.length,6);
  const row=tipo=>r.tabela.find(v=>v.tipo===tipo);
  close(row('estaca').calculo.atTip.governingPadm_kN,example.expected.minimumPadm_kN);
  close(row('sapata').calculo.area_m2,5,1e-4);close(row('sapata').calculo.Nd_kN,1400);
  close(row('radier').calculo.area_m2,1000/150,0.003);
  close(row('tubulao').calculo.Rp_adm_kN,452.3893421169302);
  close(row('tubulao').taxa_utilizacao,1000/452.3893421169302);
  close(row('bloco').calculo.groupPadm_kN,4*example.expected.minimumPadm_kN*0.9);
  assert.equal(row('bloco').calculo.pileLoads_kN.length,4);
  for(const tipo of ['sapata','radier']) close(row(tipo).calculo.Nk_kN,1000);
  assert.equal(row('concepcao').status,'calculada');
  close(row('concepcao').taxa_utilizacao,row('concepcao').calculo.recommended.utilization);
});
test('comparação: campos ausentes, momentos e eficiência não viram aprovação falsa',async()=>{
  const missing=await run('comparar_alternativas',{N_kN:150,layers:example.input.layers,sapata:{}});
  assert.ok(missing.tabela.every(row=>row.status==='não calculada'&&row.motivo&&row.verificacao==='não verificada'));
  const args=comparison(150);args.Mx_kNm=20;delete args.bloco.efficiency;
  const r=await run('comparar_alternativas',args);
  for(const tipo of ['estaca','tubulao']) assert.equal(r.tabela.find(row=>row.tipo===tipo).status,'não calculada');
  const block=r.tabela.find(row=>row.tipo==='bloco');
  assert.equal(block.calculo.capacityOk,null);assert.notEqual(block.verificacao,'ok');
  const conflict=await run('comparar_alternativas',{...comparison(),bloco:{...args.bloco,diameter_m:0.4}});
  assert.match(conflict.tabela.find(row=>row.tipo==='bloco').motivo,/Diâmetro/);
});
test('quantitativo de bloco: takeoff.test.ts:57, volumes e aço nativos',async()=>{
  const r=await run('quantitativo_fundacao',qtyBlock);
  assert.equal(r.elementKind,'pile_cap');close(r.concreteVolume_m3,0.60);close(r.leanConcreteVolume_m3,0.10);
  assert.equal(r.items.find(i=>i.name.includes('diagonal')).diameter_mm,4.2);
});
test('quantitativo de sapata: área 5 m² da footing.test.ts, malha e perdas pelo helper',async()=>{
  // Own adapter regression: 2 x 2.5 m preserves upstream area=5; h=0.5 gives 2.5 m³.
  const r=await run('quantitativo_fundacao',{tipo:'sapata',B_m:2,L_m:2.5,thickness_m:0.5,bar_mm:10,spacing_cm:15,perdas_pct:10});
  assert.equal(r.elementKind,'footing');close(r.concreteVolume_m3,2.5);assert.equal(r.items.length,2);
  close(r.items[0].weightKgPerMeter,0.617);assert.ok(r.totalSteelWithLosses_kg>r.totalSteelWeight_kg);
});
async function checkPdf(r,stampExpected=false) {
  const pdf=await PDFDocument.load(await readFile(r.caminho));assert.ok(pdf.getPageCount()>0);
  if(stampExpected) for(const page of pdf.getPages()) {
    const objects=page.node.Resources().lookup(PDFName.of('XObject'),PDFDict);
    assert.ok(objects.keys().length>=2,'original embutido + símbolo B em cada página');
  }
  return pdf;
}
test('memorial de sapata: área da footing.test.ts preservada, PDF com carimbo e sem sobrescrita',async()=>{
  const args={pasta:await temp('sapata-mem-'),sapata,carimbo:stamp};
  const r=await run('exportar_memorial',args);close(r.calculo.area_m2,5,1e-4);await checkPdf(r,true);
  assert.equal((await callTool('exportar_memorial',args)).isError,true);
  await run('exportar_memorial',{...args,sobrescrever:true});
});
test('memorial de bloco: construtor conjunto exige estaca real, capacidade deriva do perfil',async()=>{
  const r=await run('exportar_memorial',{pasta:await temp('bloco-mem-'),estaca:pileInput(example),bloco,carimbo:stamp});
  close(r.bloco.groupPadm_kN,4*example.expected.minimumPadm_kN*0.9);close(r.bloco.pileLoads_kN[0],172.625);
  await checkPdf(r,true);
  assert.equal((await callTool('exportar_memorial',{pasta:resolve('test/saida'),bloco})).isError,true);
});
test('desenhos de sapata/bloco: construtores e quantitativos reais, carimbo em todas as páginas',async()=>{
  for(const [tipo,input] of [['sapata',{...sapata,fck_MPa:25}],['bloco',bloco]]) {
    const r=await run('exportar_desenho',{pasta:await temp(`${tipo}-des-`),[tipo]:input,carimbo:stamp});
    const pdf=await checkPdf(r,true);assert.equal(pdf.getPageCount(),2);assert.equal(r.paginas,2);
    if(tipo==='sapata') close(r.calculo.area_m2,5,1e-4);else close(r.calculo.groupPadm_kN,720);
  }
  const invalid=await callTool('exportar_desenho',{pasta:resolve('test/saida'),sapata});
  assert.equal(invalid.isError,true);assert.match(invalid.content[0].text,/fck_MPa/);
});
test('exportar_resumo_xlsx: quantitativo de referência, identidade, imagem e sobrescrita explícita',async()=>{
  const args={pasta:await temp('xlsx-qty-'),nome:'resumo',quantitativo:qtyBlock};
  const r=await run('exportar_resumo_xlsx',args);const book=new ExcelJS.Workbook();await book.xlsx.readFile(r.caminho);
  const sheet=book.getWorksheet('Quantitativo');
  close(sheet.getCell('D8').value,0.6);close(sheet.getCell('E8').value,0.1);
  assert.equal(sheet.getCell('A3').font.name,'Garamond');assert.equal(sheet.getCell('A8').font.name,'Century Gothic');
  assert.equal(sheet.getCell('A7').fill.fgColor.argb,'FF7A5820');assert.equal(sheet.getCell('A8').fill.fgColor.argb,'FFF2EFE8');
  assert.equal(sheet.getCell('A8').font.color.argb,'FF2F2F30');assert.equal(sheet.getImages().length,1);
  assert.match(sheet.getCell('A4').value,new RegExp(COMMIT));
  const before=await readFile(r.caminho);assert.equal((await callTool('exportar_resumo_xlsx',args)).isError,true);
  assert.deepEqual(await readFile(r.caminho),before);
  await run('exportar_resumo_xlsx',{...args,sobrescrever:true});
});
test('exportar_resumo_xlsx: comparação conserva estado, razões numéricas e premissas',async()=>{
  const r=await run('exportar_resumo_xlsx',{pasta:await temp('xlsx-cmp-'),comparacao:comparison()});
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(r.caminho);
  const sheet=book.getWorksheet('Comparação');assert.equal(sheet.rowCount,13);
  close(sheet.getCell('E11').value,r.resumo.tabela.find(row=>row.tipo==='radier').taxa_utilizacao);
  assert.equal(book.getWorksheet('Premissas').getCell('B8').value,1000);
});
test('exportações recusam pasta externa, nome malicioso, mistura de variantes e cobrimento inválido',async()=>{
  for(const [name,args] of [
    ['exportar_resumo_xlsx',{pasta:resolve('..'),quantitativo:qtyBlock}],
    ['exportar_resumo_xlsx',{pasta:resolve('test/saida'),nome:'../fora',quantitativo:qtyBlock}],
    ['exportar_memorial',{pasta:resolve('test/saida'),sapata,estaca:pileInput(example)}],
    ['quantitativo_fundacao',{tipo:'sapata',B_m:1,L_m:1,thickness_m:0.3,bar_mm:10,spacing_cm:15,cover_m:1}],
    ['armadura_estaca',{pileTypeId:6,diameter_m:0.3,tipDepth_m:4,Nk_kN:100,cover_mm:200}],
  ]) assert.equal((await callTool(name,args)).isError,true,name);
});
