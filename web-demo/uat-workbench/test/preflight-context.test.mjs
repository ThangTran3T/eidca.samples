import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createOperatorService } from '../src/operator.mjs';
import { createEnvState } from '../src/env-state.mjs';
import { createStore } from '../src/store.mjs';

function setup(t, reply) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uatwb-context-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const envState=createEnvState({environments:{LOCAL:{tenant_id:'tenant',installation_binding:'binding',installation_environment:'sandbox'}}},createStore(dir,{protect:false}));
  const calls=[];
  const service=createOperatorService({envState,vault:{get:()=> 'controlled-test-token'},send:async(url,request)=>{
    calls.push({url,request});return {status:200,text:JSON.stringify(reply)};
  }});
  return {envState,service,calls};
}
test('intent diagnostics requires an existing canonical selector and never sends a signing command', async t=>{
  const reply={schemaVersion:'AgentOperatorPreflight/v1',overall:'NOT_CHECKED',configurationOverall:'PASS',context:{transactionId:'btx_existing'},signingActions:0};
  const s=setup(t,reply);
  assert.equal((await s.service.run('LOCAL','PREFLIGHT_INTENT')).refused,'EXISTING_CANONICAL_TRANSACTION_REQUIRED');
  assert.equal(s.calls.length,0);
  const original={status:'BLOCKED',overall:'BLOCKED_AUTHORITY',json:{historical:true}};
  s.envState.setPreflight('LOCAL',original);s.envState.update('LOCAL',{canonical_transaction_id:'btx_existing'});
  const result=await s.service.run('LOCAL','PREFLIGHT_INTENT');
  assert.equal(result.ok,true);assert.equal(s.calls.length,1);
  assert.equal(s.calls[0].request.method,'GET');assert.match(s.calls[0].url,/agent-preflight\?.*&transaction=btx_existing$/);
  assert.equal(s.calls[0].request.body,null);assert.deepEqual(s.envState.preflight('LOCAL'),original);
});
test('a response for another transaction fails the context check',async t=>{
  const s=setup(t,{schemaVersion:'AgentOperatorPreflight/v1',overall:'PASS',context:{transactionId:'btx_foreign'},signingActions:0});
  s.envState.update('LOCAL',{canonical_transaction_id:'btx_existing'});
  assert.equal((await s.service.run('LOCAL','PREFLIGHT_INTENT')).ok,false);
  assert.equal(s.envState.preflight('LOCAL'),null);
});
test('rendering preserves NOT_CHECKED and historical layers while exposing configuration and next steps',()=>{
  const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const chunk=source.slice(source.indexOf('function gatesTable('),source.indexOf('function deferredGateHelp('));
  const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const ctx=vm.createContext({esc,badge:status=>esc(status),fmtTime:x=>x});vm.runInContext(chunk,ctx);
  const gate={status:'NOT_CHECKED',code:'INTENT_TERMINAL_EVIDENCE_HISTORICAL',enforcement:'BEFORE_DISPATCH',layers:{certificate:{status:'NOT_CHECKED',code:'HISTORICAL_FACET_NOT_CURRENT_AUTHORITY',current:false,checkedAt:'2026-10-26T13:59:56Z'}}};
  const html=ctx.gatesTable({owners:{signing:{gates:{trust_revocation:gate}}}});
  assert.match(html,/NOT_CHECKED/);assert.match(html,/current=false/);assert.match(html,/bằng chứng lịch sử/);
  assert.match(html,/Điểm thực thi: BEFORE_DISPATCH/);assert.match(html,/2026-10-26T13:59:56Z/);
  const bad=ctx.gateEvidence({code:'<script>bad</script>',enforcement:'<img src=x onerror=bad>'},'signing','signing_use_authority');
  assert.doesNotMatch(bad,/<img|<script/);
});
