(async()=>{
  pm.execution.setNextRequest(null);
  if(!['INIT','SELECT','LOCK','VIEW','EXPORT','CLOSE','NEGATIVE_CHANGED_START','START','RETRY_START','CHOICE','INTERACTION','CANCEL','RETRY_MUTATION','STATUS','RESULT'].includes(WB_OP))wbRefuse('UNKNOWN_WORKBENCH_OPERATION');
  const c=wbContext(),origin={LOCAL:'https://localhost:17889',SERVER:'http://127.0.0.1:29080'}[c.agentKind];
  if(origin!==c.origin)wbRefuse('WRONG_AGENT_ORIGIN');
  if(!['{{agent_origin}}/api/sign-document',origin+'/api/sign-document'].includes(pm.request.url.toString()))wbRefuse('WRONG_CUSTOMER_ENDPOINT');
  if(pm.request.headers.has('Origin')||pm.request.headers.all().some(h=>/^Sec-Fetch-/i.test(h.key)))wbRefuse('POSTMAN_NATIVE_HTTP_REQUIRED');
  pm.variables.set('agent_origin',origin);
  const env=pm.environment,r=WB.registry(env.get('wb_sessions'));
  if(WB_OP==='INIT'){
    const s=WB.init(r,c,env.get('case_id'),env.get('run_id'),env.get('new_start_key')||'start-'+pm.variables.replaceIn('{{$guid}}'));
    wbSave(r);env.set('selected_session',s.id);wbView(s);pm.execution.skipRequest();return;
  }
  if(WB_OP==='SELECT'){
    let id=env.get('select_session_id');
    if(!id){const matches=Object.values(r.sessions).filter(s=>s.caseId===env.get('case_id')&&s.runId===env.get('run_id')&&s.contextHash===WB.contextHash(c));if(matches.length!==1)wbRefuse('SELECT_EXACT_EXISTING_SESSION');id=matches[0].id;}
    const s=WB.selected(r,id,c);env.set('selected_session',s.id);wbView(s);pm.execution.skipRequest();return;
  }
  const s=WB.selected(r,env.get('selected_session'),c);
  const folderMethod=typeof WB_METHOD!=='undefined'?WB_METHOD:null;
  if(folderMethod&&s.requestedMethod&&s.requestedMethod!==folderMethod)wbRefuse('FOLDER_METHOD_DOES_NOT_MATCH_SELECTED_SESSION');
  const key=wbPrivateKey(s);
  if(WB_OP==='LOCK'){
    const inputKey=env.get('input_vault_key'),input=inputKey?JSON.parse(await pm.vault.get(inputKey)):JSON.parse(env.get('sample_input_json'));
    const identity=JSON.parse(await pm.vault.get(env.get('identity_vault_key')));
    const method=folderMethod||env.get('method_code');
    const body={api_version:'2.0',command:'START',idempotency_key:s.startKey,input,signature_profile:env.get('signature_profile'),output:env.get('output_kind'),identity,selection:{...(method&&method!=='AUTO'?{method_code:method}:{}),strategy:'ASK_IF_AMBIGUOUS',use_saved_preference:false},interaction:{mode:c.agentKind==='LOCAL'?'SDK_UI':'HEADLESS',wait_timeout_ms:1000}};
    if(env.get('certificate_reference'))body.selection.certificate_reference=env.get('certificate_reference');
    __wire.validateRequest(JSON.stringify(body));
    const p=WB.lock(s,body);s.inputDigest=body.input.mode==='FILE'?{algorithm:'SHA-256',hex:WB_SHA(Buffer.from(body.input.content_base64,'base64'))}:body.input.document_digest;await pm.vault.set(key,JSON.stringify(p));wbSave(r);wbView(s,p);pm.execution.skipRequest();return;
  }
  const p=JSON.parse(await pm.vault.get(key));WB.privateState(s,p);
  if(['VIEW','EXPORT','CLOSE'].includes(WB_OP)){
    if(WB_OP==='CLOSE'){if(p.pendingMutation&&!['COMPLETED','CANCELLED'].includes(s.state))wbRefuse('PRIVATE_PENDING_MUTATION_RECONCILE_FIRST');WB.close(s);wbSave(r);}
    if(WB_OP==='EXPORT')env.set('wb_export_redacted',JSON.stringify(WB.evidence(s),null,2));
    wbView(s,p);pm.execution.skipRequest();return;
  }
  if(WB_OP==='NEGATIVE_CHANGED_START'){
    wbRefuse('HARNESS_CASE_ONLY_NO_LIVE_FAULT_INJECTION');
  }
  const mutation=['START','RETRY_START','CHOICE','INTERACTION','CANCEL','RETRY_MUTATION','NEGATIVE_CHANGED_START'].includes(WB_OP);
  if(mutation){
    const expected=s.id.slice(0,12)+':'+WB_OP;
    if(env.get('send_once')!==expected)wbRefuse('MANUAL_SEND_ONCE_REQUIRED '+expected);
    env.unset('send_once');
    if(WB_OP==='START'&&env.get('operator_preflight_status')==='NOT_CHECKED')wbRefuse('OPERATOR_PREFLIGHT_REQUIRED_SEE_MATRIX');
    if(WB_OP==='START'&&env.get('operator_preflight_status')!=='PASS')console.info('Known preflight blockers: this manual START is diagnosis only; any refusal stays FAILED, never signing PASS.');
    if(WB_OP==='INTERACTION'&&env.get('interaction_completed')!=='YES')wbRefuse('COMPLETE_REAL_APPROVAL_FIRST');
    if(WB_OP==='INTERACTION')env.unset('interaction_completed');
  }
  if(!mutation&&p.current?.continuation?.poll_after_ms&&s.last?.at&&Date.now()-Date.parse(s.last.at)<p.current.continuation.poll_after_ms)wbRefuse('WAIT_SERVER_POLL_DELAY');
  const sent=WB.prepare(s,p,WB_OP==='NEGATIVE_CHANGED_START'?'RETRY_START':WB_OP,Number(env.get('selected_option_index')),WB_OP==='INTERACTION'?p.current?.action?.interaction?.completion_reference:undefined,Number(env.get('replay_command_ordinal'))||undefined);
  if(WB_OP==='NEGATIVE_CHANGED_START'){const body=JSON.parse(sent.raw);body.output=body.output==='ARTIFACT'?'SIGNING_MATERIAL':'ARTIFACT';sent.raw=JSON.stringify(body);}
  __wire.validateRequest(sent.raw);
  const bearer=await pm.vault.get(c.callerRef);if(!/^agc_[0-9a-f]{64}$/.test(bearer||''))wbRefuse('CURRENT_AGENT_CALLER_ACCESS_REQUIRED_NOT_ADMIN_OR_BROWSER_TOKEN');
  const nonce=pm.variables.replaceIn('{{$guid}}');
  pm.request.headers.upsert({key:'Authorization',value:'Bearer '+bearer});pm.request.headers.upsert({key:'X-VNeCA-Request-Id',value:nonce});
  pm.request.body.update(sent.raw);pm.variables.set('wb_sent',JSON.stringify({...sent,raw:undefined,sessionId:s.id,nonce,runtimeRevision:c.runtimeRevision,runtimeArtifact:c.runtimeArtifact}));
  // Persist exact command before HTTP. A transport failure cannot manufacture a fresh key/body.
  await pm.vault.set(key,JSON.stringify(p));wbSave(r);wbView(s,p);
})().catch(e=>wbRefuse(/^[A-Z0-9_ :.-]+$/.test(e.message)?e.message:'PRIVATE_VAULT_OR_SESSION_VALIDATION_FAILED'));
