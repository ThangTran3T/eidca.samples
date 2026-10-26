import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import cp from 'node:child_process';
const mode=process.argv[2],args=process.argv.slice(3);
function protectedOutput(name,bytes){
 if(process.platform!=='win32'||!process.env.LOCALAPPDATA)throw Error('Windows protected user storage required');
 const directory=path.join(process.env.LOCALAPPDATA,'VNeCA','Postman','Workbench',crypto.randomUUID());fs.mkdirSync(directory,{recursive:true});
 const sid=cp.execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8'}).match(/S-1-5-[0-9-]+/)?.[0];if(!sid)throw Error('Current Windows SID unavailable');
 cp.execFileSync('icacls',[directory,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],{stdio:'ignore',windowsHide:true});
 const file=path.join(directory,name);fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});return file;
}
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
try{
 if(mode==='operator-access'){
  // Existing account file only. No identity/bootstrap/role/grant is created or modified.
  const file=JSON.parse(fs.readFileSync(args[0],'utf8').replace(/^\uFEFF/,'')),a=file.accounts?file.accounts.find(a=>a.username===args[1]):file;
  if(!a?.username||typeof a.password!=='string')throw Error('Existing protected operator account required');
  const response=await fetch('https://127.0.0.1:29443/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:a.username,password:a.password}),redirect:'error',signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok||!data.data?.access_token)throw Error('Real Auth login refused');
  const jwt=data.data.access_token;if(jwt.split('.').length!==3)throw Error('Unexpected real login token');
  const claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));if(claims.tenant_id||claims.imp||claims.exp*1000<=Date.now())throw Error('Current platform operator login required');
  const output=protectedOutput('operator-jwt.txt',jwt);console.log(JSON.stringify({status:'REAL_OPERATOR_LOGIN_STORED_AUTHORIZATION_STILL_ENFORCED_BY_API',output,vaultKey:'vneca-operator-jwt',expiresAt:new Date(claims.exp*1000).toISOString(),customerBearer:false,grantsIssued:0,starts:0}));
 }else if(mode==='input'){
  const [file,format,inputMode='FILE']=args;if(!['PDF','XML','BINARY'].includes(format)||!['FILE','HASH'].includes(inputMode))throw Error('Use input file PDF|XML|BINARY FILE|HASH');
  const bytes=fs.readFileSync(file),digest=crypto.createHash('sha256').update(bytes).digest('base64');
  if(inputMode==='HASH'&&format==='XML')throw Error('XML exact SignedInfo requires its actual SDK context; no invented canonical context');
  const input=inputMode==='FILE'?{mode:'FILE',format,file_name:path.basename(file),content_base64:bytes.toString('base64')}:{mode:'HASH',format:'CMS',digest_role:'DOCUMENT_DIGEST',digest:{algorithm:'SHA-256',value:digest},document_digest:{algorithm:'SHA-256',value:digest}};
  const output=protectedOutput('input.json',JSON.stringify(input));console.log(JSON.stringify({status:'INPUT_PREPARED_NO_HTTP',output,bytes:bytes.length,inputDigestBase64:digest,vaultKey:'vneca-private-input',starts:0}));
 }else if(mode==='installation-command'){
  const [configFile,keyFile]=args,c=JSON.parse(fs.readFileSync(configFile,'utf8').replace(/^\uFEFF/,''));
  const required=['commandId','tenantId','flowId','parentCredentialId','customerUserId','agentId','agentVersion','businessFlowRevision','businessFlowHash','providerFlowRevision','providerFlowHash','issuedAt','expiresAt'];
  if(required.some(k=>typeof c[k]!=='string'||!c[k])||Object.keys(c).some(k=>!required.includes(k)&&k!=='publicKeyPem'))throw Error('Exact real AgentInstallationProtocol.Command required; do not invent IDs');
  if(Date.parse(c.expiresAt)<=Date.now()||Date.parse(c.expiresAt)-Date.parse(c.issuedAt)>8*3600000)throw Error('Owner command window invalid');
  const key=crypto.createPrivateKey(fs.readFileSync(keyFile));c.publicKeyPem=crypto.createPublicKey(key).export({type:'spki',format:'pem'});
  const proofBase64=crypto.sign('sha256',Buffer.from('vneca-agent-installation-pop/v1\n'+canonical(c)),key).toString('base64');
  const output=protectedOutput('installation-request.json',JSON.stringify({command:c,proofBase64},null,2));console.log(JSON.stringify({status:'REAL_AUTHENTICATION_KEY_POP_PREPARED_NOT_PROVISIONED',output,commandId:c.commandId,tenant:c.tenantId,expiresAt:c.expiresAt,api:'POST /v1/admin/tenants/'+c.tenantId+'/agent-installations',grantsIssued:0,signingAuthority:false}));
 }else if(mode==='open-caller'){
  const [connectionFile,keyFile,expectedTenant,expectedAgent]=args,raw=JSON.parse(fs.readFileSync(connectionFile,'utf8').replace(/^\uFEFF/,'')),c=raw.data||raw;
  const key=crypto.createPrivateKey(fs.readFileSync(keyFile)),fingerprint=crypto.createHash('sha256').update(crypto.createPublicKey(key).export({type:'spki',format:'der'})).digest('hex');
  if(c.schemaVersion!=='AgentInstallationConnection/v1'||c.tenantId!==expectedTenant||c.agentId!==expectedAgent||c.keyId!=='ark_'+fingerprint.slice(0,60)||c.keyFingerprint!==fingerprint||Date.parse(c.grant.expiresAt)<=Date.now())throw Error('Exact current sealed managed connection required');
  const clear=crypto.privateDecrypt({key,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(c.sealedCallerCredential,'base64'));
  try{if(!/^agc_[a-f0-9]{64}$/.test(clear.toString()))throw Error('Invalid caller format');const output=protectedOutput('caller.txt',clear);console.log(JSON.stringify({status:'REAL_SEALED_CALLER_DECRYPTED_RUNTIME_AUTHORIZATION_NOT_CHECKED',output,grantId:c.grant.grantId,expiresAt:c.grant.expiresAt,vaultKey:'vneca-local-eidca-caller',grantsIssued:0,signingAuthority:false}));}finally{clear.fill(0);}
 }else throw Error('Modes: operator-access account.json [username] | input file PDF|XML|BINARY [FILE|HASH] | installation-command exact-command.json existing-authentication-key.pem | open-caller actual-connection.json existing-key.pem tenant agent');
}catch{console.error('PREPARATION_FAILED: input, current scope, protected storage, TLS or real workflow unavailable. No secret printed; no signing/provisioning request sent.');process.exitCode=1;}
