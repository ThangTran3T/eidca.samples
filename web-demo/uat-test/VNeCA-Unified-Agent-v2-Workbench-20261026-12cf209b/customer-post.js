(async()=>{
  pm.execution.setNextRequest(null);
  const c=wbContext(),r=WB.registry(pm.environment.get('wb_sessions')),sent=JSON.parse(pm.variables.get('wb_sent')||'null');
  if(!sent)throw Error('No original request state');
  const s=WB.selected(r,sent.sessionId,c),p=JSON.parse(await pm.vault.get(wbPrivateKey(s)));
  const reply=__wire.validateResponse(pm.response.text());
  const expected=reply.status==='FAILED'?__wireTypes.publicErrorHttpStatus[reply.error.code]:reply.status==='PROCESSING'?202:200;
  pm.test('HTTP/envelope match contract; this is not signing/crypto PASS',()=>pm.expect(pm.response.code).to.eql(expected));
  if(pm.response.code!==expected)throw Error('Response HTTP mismatch');
  if(reply.result){
    const x=reply.result;
    if(x.kind!==s.output||x.signature_profile!==s.signatureProfile)throw Error('Result differs from locked output/profile');
    if(x.kind==='ARTIFACT'&&Buffer.from(WB_SHA(Buffer.from(x.content_base64,'base64')),'hex').toString('base64')!==x.artifact_digest.value)throw Error('Returned bytes do not match artifact digest');
    if(x.kind==='SIGNING_MATERIAL'&&Buffer.from(WB_SHA(Buffer.from(x.signing_input.content_base64,'base64')),'hex').toString('base64')!==x.signing_input.digest.value)throw Error('Signing input digest mismatch');
  }
  WB.record(s,p,sent,reply,pm.response.code,sent.nonce);
  await pm.vault.set(wbPrivateKey(s),JSON.stringify(p));wbSave(r);wbView(s,p);
  pm.test('Current response is recorded; business status remains explicit',()=>pm.expect(s.last.status).to.eql(reply.status));
  pm.test('Business command has no refusal (schema PASS is separate)',()=>pm.expect(reply.status).not.to.eql('FAILED'));
  pm.visualizer.set('<h3>{{caseId}} / {{runId}}</h3><p>Key: {{key}}</p><p>Session: {{signingId}}</p><p>{{state}} — {{next}}</p><pre>{{options}}</pre><p>Crypto: NOT_CHECKED. Cardinality: NOT_CHECKED.</p>',{caseId:s.caseId,runId:s.runId,key:s.startKey,signingId:s.signingId||'Not admitted',state:s.state,next:JSON.parse(pm.environment.get('wb_selected_summary')).next,options:pm.variables.get('wb_action_display')||'No current options'});
})().catch(()=>{pm.test('Session update failed; retain original request and use recovery',()=>{throw Error('Contract/Vault/session/digest check failed. Original session retained. No new START.');});});
