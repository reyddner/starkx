import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { callTool } from '../dist/tools.mjs';
import { example, pileInput } from './fixtures.mjs';

// Mesmo Python que o servidor usa; validação e reimportação só rodam se ele tiver IfcOpenShell.
const PY = process.env.STARKX_IFC_PYTHON ?? 'python';
let hasPy = false;
try { execFileSync(PY,['-c','import ifcopenshell'],{stdio:'ignore'}); hasPy = true; } catch {}
await mkdir(resolve('test','saida'),{recursive:true});

async function run(name,input) {
  const r=await callTool(name,input);
  assert.ok(!r.isError,r.content[0].text);
  return JSON.parse(r.content[0].text);
}
const pile=pileInput(example);
const layers=example.input.layers;
const projeto={
  projeto:'Teste IFC STARKX', codigo:'MC·T01', cota_terreno_m:100,
  sondagens:[{ref:'SP-01',x_m:-3,y_m:-3,layers,waterLevel_m:2.5}],
  elementos:[
    {tipo:'estaca',ref:'E1',x_m:0,y_m:0,estaca:{...pile,designLoad_kN:300},armadura:{longitudinalCount:6,longitudinalDia_mm:12.5,transverseDia_mm:5,transverseSpacing_m:0.2}},
    {tipo:'bloco',ref:'B1',x_m:6,y_m:0,rotacao_graus:30,profundidade_topo_m:0.2,estaca:{...pile,pileTopDepth_m:1},bloco:{rows:2,cols:2,spacing_m:1,edge_m:0.25,thickness_m:0.6,groupLoad_kN:650,efficiency:0.9,fck_MPa:30}},
    {tipo:'sapata',ref:'S1',x_m:12,y_m:0,profundidade_base_m:1.5,sapata:{Nk_kN:1000,shape:'square',admMode:'user',sigmaAdm_kPa:200,gammaConcrete_kN_m3:0,fck_MPa:25}},
    {tipo:'radier',ref:'R1',x_m:0,y_m:12,profundidade_base_m:0.5,radier:{Nk_kN:5000,aspectRatio:2,admMode:'user',sigmaAdm_kPa:150,gammaConcrete_kN_m3:0}},
    {tipo:'tubulao',ref:'T1',x_m:12,y_m:12,tubulao:{Nk_kN:2000,loadIsDesign:true,shaftDiameter_m:0.8,baseDiameter_m:1.6,length_m:8,admMode:'user',sigmaAdm_kPa:400,unitFriction_kPa:0,fck_MPa:25}},
  ],
};

test('exportar_ifc: cinco tipos de fundação + sondagem; esquema válido e reimportação',async()=>{
  const pasta=await mkdtemp(join(resolve('test','saida'),'ifc-'));
  const out=await run('exportar_ifc',{...projeto,pasta,nome:'fundacao'});
  const r=out.resultado;
  assert.equal(r.esquema,'IFC4X3_ADD2');
  assert.equal(r.elementos.length,5);
  assert.deepEqual(r.elementos.map(e=>e.ifc.split(' ')[0]),['IfcPile','IfcFooting','IfcFooting','IfcSlab','IfcCaissonFoundation']);
  const e1=r.elementos[0];
  assert.equal(e1.topo_z_m,100); assert.ok(Math.abs(e1.base_z_m-(100-pile.tipDepth_m))<1e-9);
  assert.ok(e1.aco_kg>0); assert.ok(e1.padm_kN>0);
  assert.ok(out.avisos.some(a=>/B1/.test(a)),'aviso de topo da estaca incompatível com o fundo do bloco');
  const txt=await readFile(r.caminho,'utf8');
  assert.match(txt,/FILE_SCHEMA\(\('IFC4X3_ADD2'\)\)/);
  assert.match(txt,/IFCBOREHOLE\(/); assert.match(txt,/IFCGEOTECHNICALSTRATUM\(/);
  assert.ok(!/[^\x00-\x7f]/.test(txt),'STEP deve ser ASCII (acentos em \\X2\\)');
  // mesmo projeto -> mesmos GlobalIds
  const out2=await run('exportar_ifc',{...projeto,pasta,nome:'fundacao',sobrescrever:true});
  assert.equal((await readFile(out2.resultado.caminho,'utf8')).match(/IFCPILE\('([^']+)'/)[1],txt.match(/IFCPILE\('([^']+)'/)[1]);

  if(!hasPy) return;
  const v=JSON.parse(execFileSync(PY,['-I',resolve('scripts','ifc_tools.py'),'validar',r.caminho],{encoding:'utf8',maxBuffer:64e6}));
  assert.deepEqual(v.erros,[],v.erros.join('\n'));
  assert.deepEqual(v.falhas_geometria,[]);
  assert.equal(v.contagem.IfcPile,5); // 1 isolada + 4 do bloco
  assert.equal(v.contagem.IfcGeotechnicalStratum,layers.length);

  const imp=await run('importar_sondagem_ifc',{arquivo:r.caminho});
  const f=imp.resultado.furos[0];
  assert.equal(f.nome,'SP-01'); assert.equal(f.cota_boca_m,100); assert.equal(f.waterLevel_m,2.5);
  assert.deepEqual(f.layers.map(l=>[+l.depth_m.toFixed(3),l.nspt,l.soilTypeId]),layers.map(l=>[l.depth_m,l.nspt,l.soilTypeId]));
});

test('exportar_ifc: entrada vazia e referência repetida são recusadas',async()=>{
  const pasta=resolve('test','saida');
  for (const bad of [{pasta},{pasta,sondagens:[{ref:'A',layers},{ref:'A',layers}]}]) {
    const r=await callTool('exportar_ifc',bad);
    assert.ok(r.isError);
  }
});
