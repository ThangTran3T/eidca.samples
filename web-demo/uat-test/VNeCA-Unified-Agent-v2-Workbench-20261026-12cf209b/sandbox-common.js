// Postman Desktop has Buffer; crypto-js is the built-in legacy checksum module, no download.
// The workbench fails closed if checksum support is missing; this is not signature validation.
const WB_SHA = value => {
  const lib=require('crypto-js');
  return lib.SHA256(lib.enc.Base64.parse(Buffer.from(value).toString('base64'))).toString(lib.enc.Hex);
};
const WB = createWorkbench(x=>WB_SHA(Buffer.from(x,'utf8')),()=>Date.now(),()=>pm.variables.replaceIn('{{$guid}}'));
function wbContext(){
  const env=pm.environment;
  return {agentKind:env.get('agent_kind'),origin:env.get('agent_origin'),tenant:env.get('tenant_id'),binding:env.get('installation_binding'),environment:env.get('installation_environment'),callerRef:env.get('caller_vault_key'),runtimeRevision:env.get('running_revision')||'NOT_CHECKED',runtimeArtifact:env.get('agent_artifact_sha256')||'NOT_CHECKED'};
}
function wbRefuse(code){pm.execution.setNextRequest(null);pm.execution.skipRequest();throw new Error('NOT SENT: '+code);}
function wbSave(r){pm.environment.set('wb_sessions',JSON.stringify(r));}
function wbPrivateKey(s){return 'vneca-wb-session-'+s.id;}
function wbView(s,p){
  const view=WB.evidence(s);view.startKey=s.startKey;
  view.next=s.closed?'Evidence retained; STATUS/RESULT still allowed':s.pendingMutation?'STATUS first, or explicit exact mutation replay':s.last?.errorCode?s.last.recovery==='RETRY_SAME_REQUEST'?'Retry original request only after checking dependency/state':'Operator must resolve refusal; no automatic retry':s.state==='NEW'?'02 Lock intent':s.state==='LOCKED'?'03 START (after full Operator preflight)':s.state==='ACTION_REQUIRED'?'Read action; select current option index or complete real interaction':s.state==='PROCESSING'?'STATUS after poll delay':s.state==='COMPLETED'?'RESULT; independent verification and Operator cardinality':'Read evidence / original session';
  pm.environment.set('wb_selected_summary',JSON.stringify(view,null,2));
  if(p?.current?.action)pm.variables.set('wb_action_display',JSON.stringify({type:p.current.action.type,options:(p.current.action.options||[]).map((o,i)=>({index:i+1,label:o.label,method:o.method_code||''})),hostedApproval:p.current.action.interaction?{message:'Complete real approval in trusted UI; never paste OTP/PIN here'}:null},null,2));
  console.info('Workbench',s.caseId,s.runId,s.startKey,s.signingId||'NO_SIGNING_ID',s.state,view.next);
}
