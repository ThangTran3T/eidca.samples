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

test('configuration PASS permits an intent while preserving all unchecked action authority',async t=>{
  const reply={schemaVersion:'AgentOperatorPreflight/v1',overall:'NOT_CHECKED',configurationOverall:'PASS',signingActions:0,
    owners:{signing:{gates:{signing_use_authority:{status:'NOT_CHECKED',code:'SELECTED_CERTIFICATE_AND_INTENT_REQUIRED'}}}}};
  const s=setup(t,reply),result=await s.service.run('LOCAL','PREFLIGHT');
  assert.equal(result.ok,true);assert.equal(result.preflightStatus,'PASS');
  const actual=s.envState.preflight('LOCAL');
  assert.equal(actual.status,'PASS');assert.equal(actual.configurationOverall,'PASS');assert.equal(actual.overall,'NOT_CHECKED');
  assert.deepEqual(actual.json,reply);assert.equal(s.calls.length,1);assert.equal(s.calls[0].request.method,'GET');
});

test('a failed configuration cannot inherit a PASS from an unrelated overall field',async t=>{
  const s=setup(t,{schemaVersion:'AgentOperatorPreflight/v1',overall:'PASS',configurationOverall:'BLOCKED_AUTHORITY',signingActions:0});
  assert.equal((await s.service.run('LOCAL','PREFLIGHT')).preflightStatus,'BLOCKED');
  assert.equal(s.envState.preflight('LOCAL').configurationOverall,'BLOCKED_AUTHORITY');
});

test('legacy owner responses without configuration diagnostics remain blocked when unchecked',async t=>{
  const s=setup(t,{schemaVersion:'AgentOperatorPreflight/v1',overall:'NOT_CHECKED',signingActions:0});
  assert.equal((await s.service.run('LOCAL','PREFLIGHT')).preflightStatus,'BLOCKED');
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

test('send warning uses the exact current Provider preflight, never the historical eIDCA package origin',()=>{
  const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const chunk=source.slice(source.indexOf('function checkedCallerExpiry('),source.indexOf('function pageVault('));
  const ctx=vm.createContext({URL,esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')});vm.runInContext(chunk,ctx);
  const st={vars:{tenant_id:'tenant',installation_binding:'esign',installation_environment:'production',caller_grant_id:'grant',authentication_key_id:'key',profile_revision:'profile'},preflight:{json:{tenantId:'tenant',binding:'esign',environment:'production',owners:{tenant:{tenantId:'tenant',binding:'esign',environment:'production',metadata:{caller:{grantId:'grant',expiresAt:'2026-10-27T06:20:00Z'},authenticationKey:{keyId:'key'},profile:{revision:'profile'}}},provider:{tenantId:'tenant',environment:'production',metadata:{providerId:'prv_esign_ca2'},gates:{provider_credential_scope:{layers:{configuration:{planEnvironment:'production',apiEnvironment:'production',apiOrigin:'https://esign2.neac.gov.vn'}}}}}}}}};
  const html=ctx.checkedProviderRouteNote(st);
  assert.match(html,/https:\/\/esign2\.neac\.gov\.vn/);assert.match(html,/prv_esign_ca2/);assert.doesNotMatch(html,/api-sandbox\.jth\.vn/);
  const stale=structuredClone(st);stale.preflight.json.binding='old-eidca';assert.doesNotMatch(ctx.checkedProviderRouteNote(stale),/https:\/\//);
  const foreign=structuredClone(st);foreign.preflight.json.owners.provider.tenantId='other';assert.doesNotMatch(ctx.checkedProviderRouteNote(foreign),/https:\/\//);
  const invalid=structuredClone(st);invalid.preflight.json.owners.provider.gates.provider_credential_scope.layers.configuration.apiOrigin='https://secret@example.invalid';assert.doesNotMatch(ctx.checkedProviderRouteNote(invalid),/secret|example\.invalid/);
});
