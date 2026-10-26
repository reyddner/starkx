import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { example,pileInput,toolNames } from './fixtures.mjs';
const client=new Client({name:'starkx-smoke',version:'0.1.0'});
const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/server.mjs',import.meta.url))],stderr:'pipe'});
try {
  await client.connect(transport); // initialize + notifications/initialized reais
  const names=(await client.listTools()).tools.map(t=>t.name);
  assert.equal(names.length,toolNames.length);
  assert.deepEqual(names.sort(),[...toolNames].sort());
  for (const [name,args] of [['validar_sondagem',{layers:example.input.layers}],['calcular_estaca',pileInput(example)]]) {
    const r=await client.callTool({name,arguments:args}); assert.ok(!r.isError,JSON.stringify(r));
    const data=JSON.parse(r.content[0].text);
    if (name==='validar_sondagem') assert.equal(data.resultado.ok,true);
    else assert.ok(Math.abs(data.resultado.atTip.governingPadm_kN-example.expected.minimumPadm_kN)<1e-6);
  }
  const invalid=await client.callTool({name:'calcular_sapata',arguments:{}}); assert.equal(invalid.isError,true);
  const reinforcement=await client.callTool({name:'armadura_estaca',arguments:{pileTypeId:6,diameter_m:0.3,tipDepth_m:4,Nk_kN:100}});
  assert.ok(!reinforcement.isError,JSON.stringify(reinforcement));
  assert.ok(Math.abs(JSON.parse(reinforcement.content[0].text).resultado.As_min_cm2-2.827433388)<1e-6);
  const comparison=await client.callTool({name:'comparar_alternativas',arguments:{N_kN:150,layers:example.input.layers}});
  assert.ok(!comparison.isError,JSON.stringify(comparison));
  assert.equal(JSON.parse(comparison.content[0].text).resultado.tabela.length,6);
  console.log(`Smoke OK: initialize, tools/list (${names.length}), validar_sondagem, calcular_estaca, armadura_estaca, comparar_alternativas, erro legível.`);
} finally { await client.close(); await transport.close(); }
