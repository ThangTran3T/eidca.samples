import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
if(!process.argv[2]||!process.argv[3])throw Error('Usage: node Save-AgentResult.mjs <Postman-response.json> <new-output-file>');
const input=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
if(fs.statSync(input).size>120*1024*1024)throw Error('Response exceeds the public inline result bound');
const raw=fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'');const reply=JSON.parse(raw),result=reply.result;
if(reply.api_version!=='2.0'||reply.status!=='COMPLETED'||!result)throw Error('No completed accepted result; do not create output bytes');
if(result.kind==='SIGNING_MATERIAL'){
 if(path.extname(output).toLowerCase()!=='.json')throw Error('SIGNING_MATERIAL must remain JSON; it is not an assembled PDF or CMS artifact');
 fs.writeFileSync(output,JSON.stringify(reply,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'MATERIAL_SAVED_NOT_A_DOCUMENT',output}));
}else{
 if(result.kind!=='ARTIFACT'||result.verification_scope!=='ARTIFACT'||result.artifact_digest?.algorithm!=='SHA-256'||typeof result.content_base64!=='string')throw Error('Invalid artifact result');
 const bytes=Buffer.from(result.content_base64,'base64'),digest=crypto.createHash('sha256').update(bytes).digest();
 if(bytes.toString('base64')!==result.content_base64||digest.toString('base64')!==result.artifact_digest.value)throw Error('Artifact encoding or SHA256 mismatch; no output written');
 if(result.format==='PDF'&&(result.signature_profile!=='PADES_B_B'||!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||path.extname(output).toLowerCase()!=='.pdf'))throw Error('PDF artifact/profile/extension mismatch');
 fs.writeFileSync(output,bytes,{flag:'wx'});console.log(JSON.stringify({status:'ARTIFACT_SAVED_DIGEST_MATCHES',output,bytes:bytes.length,sha256:digest.toString('hex'),cryptographicVerification:'NOT_PERFORMED_BY_THIS_HELPER'}));
}
