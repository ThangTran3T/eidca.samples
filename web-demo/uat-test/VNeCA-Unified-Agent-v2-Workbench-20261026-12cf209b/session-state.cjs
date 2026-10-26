/* Pure session bookkeeping shared by the generated Postman scripts and controlled tests.
 * No authority, HTTP client, selection default, signing engine or exported private state. */
function createWorkbench(hash, now, uuid) {
  const clone = x => JSON.parse(JSON.stringify(x));
  const fail = code => { throw new Error(code); };
  const validId = x => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(x) && !['constructor','prototype','__proto__'].includes(x);
  const canonical = x => {
    if (x === null || typeof x === 'boolean' || typeof x === 'string') return JSON.stringify(x);
    if (typeof x === 'number' && Number.isSafeInteger(x)) return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
    if (!x || typeof x !== 'object' || Object.keys(x).some(k => ['__proto__','prototype','constructor'].includes(k))) return fail('UNSAFE_JSON');
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k)+':'+canonical(x[k])).join(',') + '}';
  };
  const methods = {CCCD_NFC:'prv_eidca_hash',VNEID:'prv_ca2_vneid',APP_CA_REMOTE_SIGNING:'prv_esign_ca2',USB_TOKEN:'prv_7a161b93-174e-48e5-92d7-ff6c6fe3bab7'};
  const contextHash = c => {const {runtimeRevision,runtimeArtifact,...scope}=c;return hash(canonical(scope));};
  function registry(raw) {
    const r = raw ? JSON.parse(raw) : {schemaVersion:'VNeCA-Postman-Sessions/v1',sessions:{}};
    canonical(r);
    if (r.schemaVersion!=='VNeCA-Postman-Sessions/v1' || !r.sessions || Array.isArray(r.sessions) || Object.keys(r.sessions).length>100) fail('INVALID_SESSION_REGISTRY');
    for (const [id,s] of Object.entries(r.sessions)) if (!/^[a-f0-9]{64}$/.test(id) || s.id!==id || !validId(s.caseId) || !validId(s.runId) || !s.context || !/^[a-f0-9]{64}$/.test(s.contextHash) || contextHash(s.context)!==s.contextHash || typeof s.startKey!=='string'||s.startKey.length<8 || s.startKey.length>256 || !Array.isArray(s.commands)||!Array.isArray(s.events)||s.commands.length>1000||s.events.length>1000||Object.keys(s.context).some(k=>!['agentKind','origin','tenant','binding','environment','callerRef','runtimeRevision','runtimeArtifact'].includes(k))) fail('INVALID_SESSION_RECORD');
    const fields='id context contextHash caseId runId startKey createdAt state closed signingId intentDigest commands events cryptographicVerification cardinality bodyDigest method requestedMethod format inputMode output signatureProfile inputDigest pendingMutation pendingCommand lastCommandRef last resultSummary closedAt'.split(' ');
    for(const s of Object.values(r.sessions)) {
      if(Object.keys(s).some(k=>!fields.includes(k)))fail('UNKNOWN_SESSION_FIELD');
      for(const cmd of s.commands)if(Object.keys(cmd).some(k=>!['command','ref','keyFingerprint','bodyDigest','replay','at'].includes(k)))fail('UNKNOWN_COMMAND_FIELD');
      for(const e of s.events)if(Object.keys(e).some(k=>!['at','command','requestNonce','responseRequestId','runtimeRevision','runtimeArtifact','http','status','errorCode','recovery','actionType','optionCount','negativeTest'].includes(k)))fail('UNKNOWN_EVENT_FIELD');
    }
    return r;
  }
  function selected(r,id,context) {
    const s = r.sessions[id];
    if (!s || s.id!==id || s.contextHash!==contextHash(context)) fail('SESSION_CONTEXT_MISMATCH');
    return s;
  }
  function init(r,context,caseId,runId,key) {
    if (!validId(caseId)||!validId(runId)||typeof key!=='string'||key.length<8||key.length>256) fail('INVALID_CASE_RUN_OR_KEY');
    if (!['LOCAL','SERVER'].includes(context.agentKind) || !['sandbox','production'].includes(context.environment) || !context.tenant || !context.binding || !context.callerRef) fail('INSTALLATION_CONTEXT_REQUIRED');
    const origins={LOCAL:'https://localhost:17889',SERVER:'http://127.0.0.1:29080'};
    if (context.origin!==origins[context.agentKind]) fail('WRONG_AGENT_ORIGIN');
    if (Object.values(r.sessions).some(s=>s.contextHash===contextHash(context)&&(s.startKey===key||s.caseId===caseId&&s.runId===runId))) fail('SESSION_ALREADY_EXISTS_SELECT_IT');
    const id=hash(canonical([context,caseId,runId,key]));
    r.sessions[id]={id,context:clone(context),contextHash:contextHash(context),caseId,runId,startKey:key,createdAt:new Date(now()).toISOString(),state:'NEW',closed:false,signingId:null,intentDigest:null,commands:[],events:[],cryptographicVerification:'NOT_CHECKED',cardinality:'NOT_CHECKED'};
    registry(JSON.stringify(r));return r.sessions[id];
  }
  function lock(s,body) {
    if (s.closed||s.state!=='NEW'||s.intentDigest) fail('INTENT_ALREADY_LOCKED');
    if (body.api_version!=='2.0'||body.command!=='START'||body.idempotency_key!==s.startKey) fail('INVALID_START');
    for(const key of ['flowId','flow_id','flow_revision','native_action_plan','binding_ref','environment','tenant_id']) if (key in body) fail('INTERNAL_FIELD_IN_CUSTOMER_START');
    if ('provider_id' in (body.selection||{})) fail('PROVIDER_IS_RESOLVED_BY_PLATFORM');
    const method=body.selection?.method_code;
    if(method&&method!=='AUTO'&&!methods[method])fail('UNKNOWN_METHOD');
    if(s.context.agentKind==='SERVER'&&['CCCD_NFC','USB_TOKEN'].includes(method))fail('UNSUPPORTED_SERVER_HARDWARE');
    if(body.selection?.ca_code&&method!=='APP_CA_REMOTE_SIGNING')fail('CA_SELECTION_ONLY_ESIGN');
    const {interaction,...intent}=body;
    s.intentDigest=hash(canonical(['agent-signing-intent/v2',intent]));
    s.bodyDigest=hash(JSON.stringify(body));s.method=method||'AUTO';s.requestedMethod=s.method;s.format=body.input.format;s.inputMode=body.input.mode;s.output=body.output;s.signatureProfile=body.signature_profile;s.state='LOCKED';
    return {schemaVersion:'VNeCA-Postman-Private/v1',sessionId:s.id,startRaw:JSON.stringify(body),commands:{},current:null,lastMutation:null};
  }
  function privateState(s,p) {
    if(!p||p.schemaVersion!=='VNeCA-Postman-Private/v1'||p.sessionId!==s.id||hash(p.startRaw)!==s.bodyDigest) fail('PRIVATE_SESSION_MISMATCH');
    const {interaction,...intent}=JSON.parse(p.startRaw);
    if(hash(canonical(['agent-signing-intent/v2',intent]))!==s.intentDigest)fail('LOCKED_INTENT_CHANGED');
  }
  function prepare(s,p,op,index,completion,replayOrdinal) {
    privateState(s,p);if(s.closed&&!['STATUS','RESULT'].includes(op))fail('SESSION_CLOSED_EVIDENCE_RETAINED');
    let body,ref;
    if (op==='START'||op==='RETRY_START') {body=JSON.parse(p.startRaw);ref='START';}
    else if (op==='RETRY_MUTATION') {ref=replayOrdinal?s.commands[replayOrdinal-1]?.ref:p.lastMutation;if(!ref||!p.commands[ref])fail('NO_ORIGINAL_MUTATION');body=JSON.parse(p.commands[ref].raw);}
    else if (op==='STATUS'||op==='RESULT') {if(!s.signingId)fail('NO_SIGNING_ID_RETRY_ORIGINAL_START_ONLY');body={api_version:'2.0',command:op,signing_id:s.signingId};ref=op;}
    else {
      const presentation=op==='CANCEL'&&p.readRecovery?.continuation?p.readRecovery:p.current;
      if(!s.signingId||!presentation?.continuation)fail('NO_CURRENT_CONTINUATION');
      if((s.pendingMutation||p.pendingMutation)&&op!=='CANCEL')fail('PENDING_MUTATION_READ_STATUS_OR_REPLAY_EXACT_REQUEST');
      const c=presentation.continuation;
      if(!Number.isFinite(Date.parse(c.expires_at))||Date.parse(c.expires_at)<=now())fail('CONTINUATION_EXPIRED_READ_ORIGINAL_SESSION');
      let reply,chosenMethod;
      if(op==='CANCEL')reply=null;
      else if(op==='INTERACTION') {
        if(p.current.action?.type!=='USER_AUTHORIZATION'||!p.current.action.interaction||!completion)fail('REAL_INTERACTION_COMPLETION_REQUIRED');
        if(completion!==p.current.action.interaction.completion_reference)fail('COMPLETION_NOT_CURRENT_SESSION');
        reply={type:'INTERACTION_COMPLETED',completion_reference:completion};
      } else {
        if(!['SELECT_METHOD','SELECT_CA','SELECT_CERTIFICATE','DEVICE_INTERACTION','APPROVAL_REQUIRED','USER_AUTHORIZATION'].includes(p.current.action?.type))fail('NO_SELECTABLE_CURRENT_ACTION');
        if(p.current.action.type==='SELECT_CA'&&s.method!=='APP_CA_REMOTE_SIGNING')fail('CA_SELECTION_ONLY_ESIGN');
        if(p.current.action.type==='USER_AUTHORIZATION'&&p.current.action.interaction)fail('COMPLETE_REAL_HOSTED_INTERACTION_FIRST');
        const options=p.current.action.options;
        if(!Number.isInteger(index)||index<1||!options||index>options.length)fail('EXPLICIT_CURRENT_OPTION_INDEX_REQUIRED');
        reply={type:'CHOICE',option_reference:options[index-1].reference};
        if(p.current.action.type==='SELECT_METHOD')chosenMethod=options[index-1].method_code;
      }
      const key='cmd-'+uuid();
      body={api_version:'2.0',command:op==='CANCEL'?'CANCEL':'CONTINUE',signing_id:s.signingId,idempotency_key:key,continuation_token:c.token,...(reply?{reply}:{})};
      ref=key;p.commands[ref]={raw:JSON.stringify(body),command:body.command,...(chosenMethod?{chosenMethod}:{})};p.lastMutation=ref;
    }
    const raw=ref==='START'?p.startRaw:p.commands[ref]?.raw||JSON.stringify(body);
    if(['CONTINUE','CANCEL'].includes(body.command)&&(!s.pendingMutation||s.pendingMutation===ref)){s.pendingMutation=ref;p.pendingMutation=ref;}
    s.pendingCommand=body.command;s.lastCommandRef=ref;
    s.commands.push({command:body.command,ref,keyFingerprint:body.idempotency_key?hash(body.idempotency_key):null,bodyDigest:hash(raw),replay:op.startsWith('RETRY'),at:new Date(now()).toISOString()});
    return {raw,ref,command:body.command};
  }
  function record(s,p,sent,reply,http,requestNonce) {
    privateState(s,p);
    if(!reply||reply.api_version!=='2.0'||!reply.request_id||!['ACTION_REQUIRED','PROCESSING','COMPLETED','CANCELLED','FAILED'].includes(reply.status))fail('INVALID_RESPONSE_ENVELOPE_STATE_NOT_CHANGED');
    if(s.signingId&&reply.signing_id&&reply.signing_id!==s.signingId)fail('CROSS_SESSION_RESPONSE');
    if(reply.action?.type==='SELECT_PROVIDER')fail('UNEXPECTED_PROVIDER_SELECTION_CONTRACT_REGRESSION');
    if(reply.status==='ACTION_REQUIRED'&&(!reply.continuation||!reply.action))fail('ACTION_WITHOUT_HANDLE');
    if(reply.status==='COMPLETED'&&!reply.result)fail('COMPLETED_WITHOUT_RESULT');
    if(reply.signing_id)s.signingId=reply.signing_id;
    const e={at:new Date(now()).toISOString(),command:sent.command,requestNonce,responseRequestId:reply.request_id,runtimeRevision:sent.runtimeRevision||'NOT_CHECKED',runtimeArtifact:sent.runtimeArtifact||'NOT_CHECKED',http,status:reply.status,errorCode:reply.error?.code||null,recovery:reply.error?.recovery||null,actionType:reply.action?.type||null,optionCount:reply.action?.options?.length||0,negativeTest:false};
    s.events.push(e);if(s.events.length>1000)fail('SESSION_EVIDENCE_LIMIT_EXPORT_AND_CLOSE');
    s.last=e;
    const oldAck=sent.ref==='START'&&p.lastMutation || ['CONTINUE','CANCEL'].includes(sent.command)&&sent.ref!==p.lastMutation;
    const terminalRegression=['COMPLETED','CANCELLED'].includes(s.state)&&reply.status!==s.state;
    if(reply.status==='COMPLETED') {
      const r=reply.result,summary={kind:r.kind,verification_scope:r.verification_scope,format:r.format||null,signature_profile:r.signature_profile,artifactDigest:r.artifact_digest||null,certificate_sha256:r.certificate_sha256||null,documentDigest:r.document_digest||null,signingInputDigest:r.signing_input?.digest||null};
      if(s.resultSummary&&canonical(s.resultSummary)!==canonical(summary))fail('COMMITTED_RESULT_CHANGED');s.resultSummary=summary;
    }
    if(reply.status!=='FAILED'&&!oldAck&&!terminalRegression) {
      s.state=reply.status;
      const chosen=p.commands[sent.ref];
      if(sent.command==='CONTINUE'&&chosen?.chosenMethod)s.method=chosen.chosenMethod;
      // Read projections intentionally offer CANCEL-only handles. They must not overwrite a
      // pending CONTINUE's original presentation/token or its exact replay body.
      const projection=clone({api_version:reply.api_version,status:reply.status,signing_id:reply.signing_id,request_id:reply.request_id,...(reply.action?{action:reply.action}:{}),...(reply.continuation?{continuation:reply.continuation}:{})});
      if(['START','CONTINUE','CANCEL'].includes(sent.command)||!p.current) p.current=projection;
      else p.readRecovery=projection;
      if(s.pendingMutation===sent.ref||['COMPLETED','CANCELLED'].includes(reply.status)){s.pendingMutation=null;p.pendingMutation=null;}
    }
    return e;
  }
  function close(s) {if(s.pendingMutation||s.pendingCommand&&s.state==='LOCKED')fail('UNCERTAIN_SESSION_RECONCILE_FIRST');s.closed=true;s.closedAt=new Date(now()).toISOString();}
  function evidence(s){return clone({schemaVersion:'VNeCA-Postman-Evidence/v1',caseId:s.caseId,runId:s.runId,sessionRef:s.id,context:s.context,methodRequested:s.requestedMethod||null,methodSelected:s.method||null,providerExpectedByRegistry:methods[s.method]||null,providerObserved:'NOT_CHECKED',caObserved:'NOT_CHECKED',canonicalTransaction:'OPERATOR_READ_REQUIRED',intentFingerprint:s.intentDigest,startKeyFingerprint:hash(s.startKey),inputDigest:s.inputDigest||null,signingId:s.signingId,createdAt:s.createdAt,state:s.state,closed:s.closed,commands:s.commands,events:s.events,resultSummary:s.resultSummary||null,cryptographicVerification:s.cryptographicVerification,cardinality:s.cardinality});}
  return {registry,selected,init,lock,privateState,prepare,record,close,evidence,canonical,contextHash,methods};
}
if(typeof module!=='undefined')module.exports={createWorkbench};
