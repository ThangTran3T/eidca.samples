import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import { derToPem, safeDescribeCertificate } from './certificate-utils.js';
import { errorMessage } from '../errors.js';

const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
const INCLUSIVE_C14N_ALGORITHMS = [
  'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  'http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments'
];

function dedupeNamespaceDeclarations(canonicalXml) {
  return canonicalXml.replace(/<[^!?][^>]*>/g, (tag) => {
    const seen = new Set();
    return tag.replace(/\s+(xmlns(?::[A-Za-z_][\w.-]*)?)="[^"]*"/g, (attribute, name) => {
      if (seen.has(name)) return '';
      seen.add(name);
      return attribute;
    });
  });
}

function installInclusiveC14nCompatibility(verifier) {
  for (const algorithm of INCLUSIVE_C14N_ALGORITHMS) {
    const BaseCanonicalizer = verifier.CanonicalizationAlgorithms[algorithm];
    if (!BaseCanonicalizer) continue;

    verifier.CanonicalizationAlgorithms[algorithm] = class extends BaseCanonicalizer {
      process(node, options) {
        // xml-crypto can emit an inherited default namespace twice when .NET
        // materializes that same namespace directly on SignedInfo. Canonical XML
        // permits a single declaration, so normalize only duplicate declarations.
        return dedupeNamespaceDeclarations(super.process(node, options));
      }
    };
  }
}

function elementsByTagNameNs(node, namespace, localName) {
  return Array.from(node.getElementsByTagNameNS(namespace, localName));
}

function firstText(node, namespace, localName) {
  return elementsByTagNameNs(node, namespace, localName)[0]?.textContent?.trim() || null;
}

function firstAttribute(node, namespace, localName, attribute) {
  return elementsByTagNameNs(node, namespace, localName)[0]?.getAttribute(attribute) || null;
}

function parseXml(xml) {
  const issues = [];
  const parser = new DOMParser({
    onError: (level, message) => issues.push({ level, message })
  });
  const document = parser.parseFromString(xml, 'application/xml');
  const fatal = issues.find((issue) => issue.level === 'error' || issue.level.toLowerCase().includes('fatal'));
  if (!document.documentElement || fatal) {
    throw new Error(fatal?.message || 'XML document has no root element.');
  }
  return { document, issues };
}

function describeReferences(signatureNode, document) {
  return elementsByTagNameNs(signatureNode, XMLDSIG_NS, 'Reference').map((reference) => {
    const uri = reference.getAttribute('URI') || '';
    const transforms = elementsByTagNameNs(reference, XMLDSIG_NS, 'Transform')
      .map((transform) => transform.getAttribute('Algorithm'))
      .filter(Boolean);
    let targetCount = null;
    let target = null;

    if (uri === '') {
      targetCount = document.documentElement ? 1 : 0;
      target = document.documentElement?.nodeName || null;
    } else if (uri.startsWith('#')) {
      const id = uri.slice(1);
      const matches = Array.from(document.getElementsByTagName('*')).filter((element) =>
        ['Id', 'ID', 'id'].some((name) => element.getAttribute(name) === id));
      targetCount = matches.length;
      target = matches.length === 1 ? matches[0].nodeName : null;
    }

    return {
      uri,
      digest_method: firstAttribute(reference, XMLDSIG_NS, 'DigestMethod', 'Algorithm'),
      digest_value: firstText(reference, XMLDSIG_NS, 'DigestValue'),
      transforms,
      target,
      target_count: targetCount,
      external_reference: uri !== '' && !uri.startsWith('#')
    };
  });
}

function parseSigningTime(signatureNode) {
  const nodes = Array.from(signatureNode.getElementsByTagName('*'));
  const value = nodes.find((node) => node.localName === 'SigningTime')?.textContent?.trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function verifyOneSignature(xml, document, signatureNode, index) {
  const certificates = elementsByTagNameNs(signatureNode, XMLDSIG_NS, 'X509Certificate')
    .map((node) => node.textContent?.replace(/\s+/g, '') || '')
    .filter(Boolean)
    .map((value) => Buffer.from(value, 'base64'));
  const references = describeReferences(signatureNode, document);
  const signingTime = parseSigningTime(signatureNode);
  const warnings = [];

  if (references.some((reference) => reference.external_reference)) {
    warnings.push('Signature contains an external reference; remote content is not resolved.');
  }
  if (references.some((reference) => reference.target_count !== null && reference.target_count !== 1)) {
    warnings.push('At least one same-document reference does not resolve to exactly one element.');
  }
  if (certificates.length === 0) {
    return {
      index,
      valid: false,
      error_code: 'CERTIFICATE_NOT_FOUND',
      message: 'Signature does not contain an X509Certificate.',
      signing_time: signingTime,
      signature_method: firstAttribute(signatureNode, XMLDSIG_NS, 'SignatureMethod', 'Algorithm'),
      canonicalization_method: firstAttribute(signatureNode, XMLDSIG_NS, 'CanonicalizationMethod', 'Algorithm'),
      references,
      certificates: [],
      warnings
    };
  }

  let valid = false;
  let message = 'XML signature is invalid.';
  try {
    const verifier = new SignedXml({
      publicCert: derToPem(certificates[0]),
      getCertFromKeyInfo: () => null
    });
    installInclusiveC14nCompatibility(verifier);
    verifier.loadSignature(signatureNode);
    valid = verifier.checkSignature(xml);
    message = valid ? 'XML signature and referenced digests are valid.' : 'XML signature or referenced digest is invalid.';
  } catch (error) {
    message = errorMessage(error);
  }

  const certificateDetails = certificates.map((certificate) => safeDescribeCertificate(certificate));
  if (certificateDetails.some((certificate) => certificate.valid_at_check_time === false)) {
    warnings.push('At least one signing certificate is not valid at the current check time.');
  }
  warnings.push('Certificate chain trust and revocation status were not evaluated.');

  return {
    index,
    valid,
    error_code: valid ? null : 'XML_SIGNATURE_INVALID',
    message,
    signing_time: signingTime,
    signature_method: firstAttribute(signatureNode, XMLDSIG_NS, 'SignatureMethod', 'Algorithm'),
    canonicalization_method: firstAttribute(signatureNode, XMLDSIG_NS, 'CanonicalizationMethod', 'Algorithm'),
    references,
    certificates: certificateDetails,
    warnings
  };
}

export async function verifyXml(buffer) {
  const xml = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const { document, issues } = parseXml(xml);
  const signatureNodes = elementsByTagNameNs(document, XMLDSIG_NS, 'Signature');

  if (signatureNodes.length === 0) {
    return {
      format: 'XML',
      status: 'UNSIGNED',
      valid: false,
      integrity_valid: false,
      signature_count: 0,
      signatures: [],
      warnings: ['No XMLDSig Signature element was found.'],
      parser_warnings: issues
    };
  }

  const signatures = signatureNodes.map((node, index) => verifyOneSignature(xml, document, node, index + 1));
  const valid = signatures.every((signature) => signature.valid);
  const hasCertificateWarning = signatures.some((signature) =>
    signature.certificates.some((certificate) => certificate.valid_at_check_time === false));

  return {
    format: 'XML',
    status: valid ? (hasCertificateWarning ? 'VALID_WITH_WARNINGS' : 'VALID') : 'INVALID',
    valid,
    integrity_valid: valid,
    signature_count: signatures.length,
    signatures,
    warnings: ['Certificate chain trust, OCSP and CRL checks are not performed.'],
    parser_warnings: issues
  };
}
