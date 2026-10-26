package dev.vneca.test.unified;

import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.cert.*;
import java.util.*;
import java.io.*;
import org.apache.pdfbox.pdfparser.PDFParser;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.interactive.form.PDSignatureField;
import org.bouncycastle.cms.*;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;
import org.bouncycastle.cert.X509CertificateHolder;

/** Offline independent verifier: PDFBox/BC/JDK, never imports the Agent implementation.
 * Arguments: PDF|CMS|XML artifact original-input selected-leaf trusted-roots intermediates CRLs.
 * Trust material is supplied explicitly by the operator; no trust store changes or network fetch. */
public final class VerifyResult {
    static final class StrictPdfParser extends PDFParser {StrictPdfParser(byte[] bytes)throws IOException{super(new RandomAccessReadBuffer(bytes));setLenient(false);}}
    static void require(boolean c,String m){FixtureFiles.require(c,m);}
    public static void main(String[] args){
        String stage="ARGUMENTS";
        try{
            require(args.length==7,"Expected format artifact original leaf roots intermediates CRLs");
            String kind=args[0];byte[] artifact=Files.readAllBytes(Path.of(args[1])),input=Files.readAllBytes(Path.of(args[2]));
            var factory=CertificateFactory.getInstance("X.509");
            X509Certificate leaf=(X509Certificate)factory.generateCertificate(new ByteArrayInputStream(Files.readAllBytes(Path.of(args[3]))));
            leaf.checkValidity();var roots=factory.generateCertificates(Files.newInputStream(Path.of(args[4])));var intermediates=factory.generateCertificates(Files.newInputStream(Path.of(args[5])));var crls=factory.generateCRLs(Files.newInputStream(Path.of(args[6])));require(!roots.isEmpty()&&!crls.isEmpty(),"Explicit roots and current CRLs required");
            stage="PKIX_FULL_CRL";System.setProperty("com.sun.security.enableCRLDP","false");Security.setProperty("ocsp.enable","false");
            var anchors=new HashSet<TrustAnchor>();for(var cert:roots)anchors.add(new TrustAnchor((X509Certificate)cert,null));
            var selector=new X509CertSelector();selector.setCertificate(leaf);var parameters=new PKIXBuilderParameters(anchors,selector);parameters.setRevocationEnabled(true);
            var all=new ArrayList<Object>();all.add(leaf);all.addAll(intermediates);all.addAll(crls);parameters.addCertStore(CertStore.getInstance("Collection",new CollectionCertStoreParameters(all)));
            var checker=(PKIXRevocationChecker)CertPathValidator.getInstance("PKIX").getRevocationChecker();checker.setOptions(Set.of(PKIXRevocationChecker.Option.PREFER_CRLS,PKIXRevocationChecker.Option.NO_FALLBACK));parameters.addCertPathChecker(checker);CertPathBuilder.getInstance("PKIX").build(parameters);
            String profile;
            if(kind.equals("PDF")){
                stage="PDF_CMS_BYTE_RANGE";PublicPdfVerification.verify(artifact,leaf);
                stage="PDF_STRICT_STRUCTURE";
                var parser=new StrictPdfParser(artifact);
                try(var doc=parser.parse()){
                    require(doc.getNumberOfPages()>0&&doc.getSignatureDictionaries().size()==1,"Single-signature PDF profile only");
                    var form=doc.getDocumentCatalog().getAcroForm();require(form!=null,"Reachable AcroForm required");int reachable=0;
                    for(var field:form.getFieldTree())if(field instanceof PDSignatureField signed&&signed.getSignature()!=null){reachable++;require(!signed.getWidgets().isEmpty(),"Signature widget required");}
                    require(reachable==1,"Exactly one reachable signature field");var sig=doc.getSignatureDictionaries().getFirst();int[] r=sig.getByteRange();
                    require(r.length==4&&r[0]==0&&r[1]>0&&r[2]>r[1]&&r[3]>0&&(long)r[2]+r[3]==artifact.length,"Full-revision ByteRange required");
                    require("ETSI.CAdES.detached".equals(sig.getSubFilter())&&sig.getFilter()!=null&&sig.getSignDate()!=null&&!sig.getCOSObject().containsKey(COSName.CERT),"PAdES-B-B dictionary constraints failed");
                    byte[] covered=new byte[r[1]+r[3]];System.arraycopy(artifact,0,covered,0,r[1]);System.arraycopy(artifact,r[2],covered,r[1],r[3]);require(Arrays.equals(covered,sig.getSignedContent(artifact)),"Parsed signed bytes mismatch");
                    // Source bytes differ structurally after PDF signing. An independent input/output
                    // text comparison is a content check only, not an authorization or byte-equality claim.
                    stage="PDF_SOURCE_COMPARISON";try(var original=new StrictPdfParser(input).parse()){require(doc.getNumberOfPages()==original.getNumberOfPages(),"Input/output page count differs");require(new org.apache.pdfbox.text.PDFTextStripper().getText(doc).equals(new org.apache.pdfbox.text.PDFTextStripper().getText(original)),"Input/output extracted text differs");}
                }
                profile="PASS_SINGLE_SIGNATURE_PADES_B_B_PROFILE_CHECKS";
            }else if(kind.equals("CMS")){
                var signed=new CMSSignedData(new CMSProcessableByteArray(input),artifact);require(signed.isDetachedSignature(),"Detached CMS profile required");var signers=signed.getSignerInfos().getSigners();require(signers.size()==1,"Exactly one CMS signer required");var signer=signers.iterator().next();var certs=signed.getCertificates().getMatches(signer.getSID());
                require(certs.size()==1&&Arrays.equals(((X509CertificateHolder)certs.iterator().next()).getEncoded(),leaf.getEncoded()),"CMS selected certificate mismatch");
                require(signer.verify(new JcaSimpleSignerInfoVerifierBuilder().build(leaf)),"Independent CMS signature or document digest invalid");profile="PASS_DETACHED_CMS";
            }else if(kind.equals("XML")){verifyXml(artifact,input,leaf);profile="PASS_ROOT_ENVELOPED_XMLDSIG_RSA_SHA256";}
            else throw new IllegalArgumentException("Unsupported format");
            System.out.println("{\"status\":\"PASS\",\"independentImplementation\":\"PDFBox3.0.8_BouncyCastle_JDK\",\"artifactSha256\":\""+hex(artifact)+"\",\"inputSha256\":\""+hex(input)+"\",\"certificateSha256\":\""+hex(leaf.getEncoded())+"\",\"profile\":\""+profile+"\",\"pkixFullCrl\":\"PASS\",\"signerOwnershipAndKeyUseAuthority\":\"NOT_EVALUATED\"}");
        }catch(Exception refused){System.err.println("{\"status\":\"FAIL\",\"code\":\"INDEPENDENT_VERIFICATION_REFUSED\",\"stage\":\""+stage+"\",\"exception\":\""+refused.getClass().getSimpleName()+"\"}");System.exit(1);}
    }
    static String hex(byte[] b)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));}
    static org.w3c.dom.Document xml(byte[] bytes)throws Exception{
        var f=javax.xml.parsers.DocumentBuilderFactory.newInstance();f.setNamespaceAware(true);f.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);f.setFeature("http://xml.org/sax/features/external-general-entities",false);f.setFeature("http://xml.org/sax/features/external-parameter-entities",false);f.setXIncludeAware(false);f.setExpandEntityReferences(false);f.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD,"");f.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");return f.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
    }
    static void verifyXml(byte[] bytes,byte[] original,X509Certificate leaf)throws Exception{
        var document=xml(bytes);var nodes=document.getElementsByTagNameNS(javax.xml.crypto.dsig.XMLSignature.XMLNS,"Signature");require(nodes.getLength()==1&&nodes.item(0).getParentNode()==document.getDocumentElement(),"One root-enveloped signature required");
        var context=new javax.xml.crypto.dsig.dom.DOMValidateContext(leaf.getPublicKey(),nodes.item(0));context.setProperty("org.jcp.xml.dsig.secureValidation",true);
        var signature=javax.xml.crypto.dsig.XMLSignatureFactory.getInstance("DOM").unmarshalXMLSignature(context);var info=signature.getSignedInfo();require(javax.xml.crypto.dsig.SignatureMethod.RSA_SHA256.equals(info.getSignatureMethod().getAlgorithm())&&info.getReferences().size()==1,"Exact SHA256 one-reference profile required");var reference=info.getReferences().getFirst();require("".equals(reference.getURI())&&javax.xml.crypto.dsig.DigestMethod.SHA256.equals(reference.getDigestMethod().getAlgorithm()),"No external or fragment references accepted");
        for(var transform:reference.getTransforms())require(Set.of(javax.xml.crypto.dsig.Transform.ENVELOPED,javax.xml.crypto.dsig.CanonicalizationMethod.INCLUSIVE).contains(transform.getAlgorithm()),"Unsupported transform");
        require(signature.validate(context),"XML signature/reference verification failed");nodes.item(0).getParentNode().removeChild(nodes.item(0));
        require(Arrays.equals(canonicalXml(document),canonicalXml(xml(original))),"Signed XML original root changed");
    }
    static byte[] canonicalXml(org.w3c.dom.Document doc)throws Exception{
        var out=new ByteArrayOutputStream();var t=javax.xml.transform.TransformerFactory.newInstance().newTransformer();t.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION,"yes");t.transform(new javax.xml.transform.dom.DOMSource(doc),new javax.xml.transform.stream.StreamResult(out));
        var method=javax.xml.crypto.dsig.TransformService.getInstance(javax.xml.crypto.dsig.CanonicalizationMethod.INCLUSIVE,"DOM");method.init((javax.xml.crypto.dsig.spec.TransformParameterSpec)null);var ctx=new javax.xml.crypto.dom.DOMCryptoContext(){};ctx.setProperty("org.jcp.xml.dsig.secureValidation",true);method.marshalParams(new javax.xml.crypto.dom.DOMStructure(doc.createElementNS(javax.xml.crypto.dsig.XMLSignature.XMLNS,"Transform")),ctx);var result=new ByteArrayOutputStream();method.transform(new javax.xml.crypto.OctetStreamData(new ByteArrayInputStream(out.toByteArray())),ctx,result);return result.toByteArray();
    }
}
