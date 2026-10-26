package dev.vneca.test.unified;

import static dev.vneca.test.unified.FixtureFiles.require;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.regex.Pattern;
import org.bouncycastle.asn1.ASN1InputStream;
import org.bouncycastle.asn1.ASN1Primitive;
import org.bouncycastle.asn1.ASN1OctetString;
import org.bouncycastle.asn1.cms.CMSAttributes;
import org.bouncycastle.asn1.cms.ContentInfo;
import org.bouncycastle.asn1.cms.SignedData;
import org.bouncycastle.asn1.ess.SigningCertificateV2;
import org.bouncycastle.asn1.pkcs.PKCSObjectIdentifiers;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cms.*;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;

/** Independent implementation: verifies the actual customer-returned PDF/CMS with BouncyCastle,
 * not the Agent's assembly/verifier or a success flag. Trust is separately exercised by R18. */
final class PublicPdfVerification {
    static Map<String,Object> verify(byte[] pdf,X509Certificate selected)throws Exception {
        String raw=new String(pdf,StandardCharsets.ISO_8859_1);
        var ranges=Pattern.compile("/ByteRange\\s*\\[\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*]").matcher(raw);
        int[] range=null;int count=0;
        while(ranges.find()){count++;range=new int[]{Integer.parseInt(ranges.group(1)),Integer.parseInt(ranges.group(2)),Integer.parseInt(ranges.group(3)),Integer.parseInt(ranges.group(4))};}
        require(count==1&&range!=null&&range[0]==0&&range[1]>0&&range[2]>range[1]&&range[3]>0&&(long)range[2]+range[3]==pdf.length,"Exact PDF ByteRange required");
        String contents=raw.substring(range[1],range[2]);
        require(contents.matches("<[0-9a-fA-F]+>"),"Exact excluded Contents required");
        byte[] padded=HexFormat.of().parseHex(contents.substring(1,contents.length()-1)),cms;
        try(var asn=new ASN1InputStream(padded)){cms=asn.readObject().getEncoded();}
        for(int n=cms.length;n<padded.length;n++)require(padded[n]==0,"Unexpected nonzero CMS padding");
        require(Arrays.equals(ASN1Primitive.fromByteArray(cms).getEncoded("DER"),cms),"Canonical DER CMS required");
        var structure=SignedData.getInstance(ContentInfo.getInstance(ASN1Primitive.fromByteArray(cms)).getContent());
        require(structure.getEncapContentInfo().getContent()==null&&PKCSObjectIdentifiers.data.equals(structure.getEncapContentInfo().getContentType()),"Detached id-data required");
        byte[] covered=new byte[range[1]+range[3]];System.arraycopy(pdf,0,covered,0,range[1]);System.arraycopy(pdf,range[2],covered,range[1],range[3]);
        require(valid(covered,cms,selected),"Independent CMS signature/digest/selected certificate failed");
        covered[0]^=1;
        require(!valid(covered,cms,selected),"Tampered public artifact incorrectly verified");
        return Map.of("implementation","BouncyCastle CMS verifier (independent from Node assembly)","exactCertificate",true,"signatureAndByteRangeDigest",true,"coveredByteTamperRejected",true,"selectedEssCertIdV2AndDetachedDer",true);
    }
    /** Necessary baseline-B dictionary checks for this harness's single-signature PDF.
     * Not a general PDF parser, accreditation or a full third-party standards validation report. */
    static Map<String,Object> baselineBChecks(byte[] pdf){
        String raw=new String(pdf,StandardCharsets.ISO_8859_1);var sub=Pattern.compile("/SubFilter\\s*/([A-Za-z0-9.]+)").matcher(raw);
        String actual=null;int count=0;while(sub.find()){count++;actual=sub.group(1);}
        boolean exact=count==1&&"ETSI.CAdES.detached".equals(actual);
        boolean claimedTime=Pattern.compile("/M\\s*\\(D:[0-9]{14}(?:Z|[+-][0-9]{2}'[0-9]{2}')?\\)").matcher(raw).find();
        boolean filter=Pattern.compile("/Filter\\s*/Adobe.PPKLite\\b").matcher(raw).find();
        boolean noCertEntry=!Pattern.compile("/Cert\\b").matcher(raw).find();
        return Map.of("standard","ETSI EN 319 142-1 V1.2.1 table1 and 6.3(l)","expectedSubFilter","ETSI.CAdES.detached","actualSubFilter",actual==null?"ABSENT":actual,
                "subFilterPass",exact,"claimedSigningTimePresent",claimedTime,"filterPresent",filter,"forbiddenCertEntryAbsent",noCertEntry,
                "status",exact&&claimedTime&&filter&&noCertEntry?"PASS_NECESSARY_DICTIONARY_CHECKS_ONLY":"FAIL");
    }
    private static boolean valid(byte[] covered,byte[] cms,X509Certificate selected)throws Exception {
        try {
            var signed=new CMSSignedData(new CMSProcessableByteArray(covered),cms);
            var signers=signed.getSignerInfos().getSigners();if(signers.size()!=1)return false;
            var signer=signers.iterator().next();var certificates=signed.getCertificates().getMatches(signer.getSID());
            if(certificates.size()!=1||!Arrays.equals(((X509CertificateHolder)certificates.iterator().next()).getEncoded(),selected.getEncoded())||!"2.16.840.1.101.3.4.2.1".equals(signer.getDigestAlgOID()))return false;
            var attributes=signer.getSignedAttributes();
            if(attributes==null||attributes.getAll(CMSAttributes.contentType).size()!=1||attributes.getAll(CMSAttributes.messageDigest).size()!=1
                    ||attributes.getAll(PKCSObjectIdentifiers.id_aa_signingCertificateV2).size()!=1||attributes.get(CMSAttributes.signingTime)!=null)return false;
            if(!PKCSObjectIdentifiers.data.equals(attributes.get(CMSAttributes.contentType).getAttrValues().getObjectAt(0)))return false;
            if(!Arrays.equals(java.security.MessageDigest.getInstance("SHA-256").digest(covered),ASN1OctetString.getInstance(attributes.get(CMSAttributes.messageDigest).getAttrValues().getObjectAt(0)).getOctets()))return false;
            var ess=SigningCertificateV2.getInstance(attributes.get(PKCSObjectIdentifiers.id_aa_signingCertificateV2).getAttrValues().getObjectAt(0)).getCerts();
            if(ess.length!=1||!"2.16.840.1.101.3.4.2.1".equals(ess[0].getHashAlgorithm().getAlgorithm().getId())||!Arrays.equals(ess[0].getCertHash(),java.security.MessageDigest.getInstance("SHA-256").digest(selected.getEncoded())))return false;
            return signer.verify(new JcaSimpleSignerInfoVerifierBuilder().build(selected));
        }catch(CMSException invalid){return false;}
    }
}
