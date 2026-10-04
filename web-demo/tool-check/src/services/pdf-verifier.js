import { webcrypto } from 'node:crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { safeDescribeCertificate } from './certificate-utils.js';
import { toArrayBuffer } from './file-utils.js';
import { errorMessage } from '../errors.js';

pkijs.setEngine(
  'nodeEngine',
  webcrypto,
  new pkijs.CryptoEngine({ name: 'nodeEngine', crypto: webcrypto, subtle: webcrypto.subtle })
);

const SIGNED_DATA_OID = '1.2.840.113549.1.7.2';
const SIGNING_TIME_OID = '1.2.840.113549.1.9.5';
const TIMESTAMP_TOKEN_OID = '1.2.840.113549.1.9.16.2.14';
const OID_NAMES = {
  '1.3.14.3.2.26': 'SHA-1',
  '2.16.840.1.101.3.4.2.1': 'SHA-256',
  '2.16.840.1.101.3.4.2.2': 'SHA-384',
  '2.16.840.1.101.3.4.2.3': 'SHA-512',
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.113549.1.1.5': 'SHA1withRSA',
  '1.2.840.113549.1.1.11': 'SHA256withRSA',
  '1.2.840.113549.1.1.12': 'SHA384withRSA',
  '1.2.840.113549.1.1.13': 'SHA512withRSA',
  '1.2.840.10045.4.3.2': 'ECDSAwithSHA256',
  '1.2.840.10045.4.3.3': 'ECDSAwithSHA384',
  '1.2.840.10045.4.3.4': 'ECDSAwithSHA512'
};

function algorithm(oid) {
  return oid ? { oid, name: OID_NAMES[oid] || 'UNKNOWN' } : null;
}

function readDerLength(buffer) {
  if (buffer.length < 2) throw new Error('CMS value is too short.');
  const firstLength = buffer[1];
  if ((firstLength & 0x80) === 0) return 2 + firstLength;

  const byteCount = firstLength & 0x7f;
  if (byteCount === 0 || byteCount > 6 || buffer.length < 2 + byteCount) {
    throw new Error('CMS DER length is invalid or unsupported.');
  }
  let contentLength = 0;
  for (let index = 0; index < byteCount; index += 1) {
    contentLength = contentLength * 256 + buffer[2 + index];
  }
  return 2 + byteCount + contentLength;
}

function trimCmsPadding(buffer) {
  const length = readDerLength(buffer);
  if (!Number.isSafeInteger(length) || length > buffer.length) {
    throw new Error('CMS DER object is truncated.');
  }
  return buffer.subarray(0, length);
}

function extractCmsFromGap(buffer, gapStart, gapEnd) {
  const gap = buffer.subarray(gapStart, gapEnd);
  const open = gap.indexOf(0x3c);
  const close = gap.lastIndexOf(0x3e);
  let contents = gap;

  // ByteRange implementations differ on whether the '<' and '>' delimiters
  // themselves are excluded. Support both valid layouts.
  if (open >= 0) contents = contents.subarray(open + 1);
  if (close >= 0) {
    const relativeClose = contents.lastIndexOf(0x3e);
    if (relativeClose >= 0) contents = contents.subarray(0, relativeClose);
  }

  const hex = contents.toString('latin1').replace(/\s+/g, '');
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error('PDF signature /Contents is not valid hexadecimal data.');
  }
  return trimCmsPadding(Buffer.from(hex, 'hex'));
}

function extractPdfSignatures(buffer) {
  const text = buffer.toString('latin1');
  const pattern = /\/ByteRange\s*\[\s*(\d+)\s*[ ,]+\s*(\d+)\s*[ ,]+\s*(\d+)\s*[ ,]+\s*(\d+)\s*\]/g;
  const signatures = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const byteRange = match.slice(1, 5).map(Number);
    const [firstStart, firstLength, secondStart, secondLength] = byteRange;
    const firstEnd = firstStart + firstLength;
    const revisionEnd = secondStart + secondLength;
    const validRange = byteRange.every(Number.isSafeInteger)
      && firstStart === 0
      && firstLength >= 0
      && secondStart > firstEnd
      && secondLength >= 0
      && revisionEnd <= buffer.length;
    const nearbyDictionary = text.slice(Math.max(0, match.index - 2048), Math.min(text.length, match.index + 2048));
    const subFilter = nearbyDictionary.match(/\/SubFilter\s*\/([^\s/>]+)/)?.[1] || null;

    if (!validRange) {
      signatures.push({
        byteRange,
        revisionEnd,
        subFilter,
        extractionError: 'PDF ByteRange is invalid or outside the file.'
      });
      continue;
    }

    try {
      const cms = extractCmsFromGap(buffer, firstEnd, secondStart);
      const signedBytes = Buffer.concat([
        buffer.subarray(firstStart, firstEnd),
        buffer.subarray(secondStart, revisionEnd)
      ]);
      signatures.push({ byteRange, revisionEnd, subFilter, cms, signedBytes });
    } catch (error) {
      signatures.push({ byteRange, revisionEnd, subFilter, extractionError: errorMessage(error) });
    }
  }

  return signatures;
}

function attributeDate(attributes, oid) {
  const attribute = attributes?.attributes?.find((item) => item.type === oid);
  const value = attribute?.values?.[0];
  if (!value) return null;
  try {
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value.valueBlock?.value || '');
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

function pkijsCertificateToDer(certificate) {
  return Buffer.from(certificate.toSchema(true).toBER(false));
}

async function verifyCms(cmsBuffer, signedBytes) {
  const parsed = asn1js.fromBER(toArrayBuffer(cmsBuffer));
  if (parsed.offset === -1) throw new Error('Cannot decode CMS/PKCS#7 ASN.1 data.');

  const contentInfo = new pkijs.ContentInfo({ schema: parsed.result });
  if (contentInfo.contentType !== SIGNED_DATA_OID) {
    throw new Error(`CMS content type '${contentInfo.contentType}' is not SignedData.`);
  }

  const signedData = new pkijs.SignedData({ schema: contentInfo.content });
  const embeddedCertificates = (signedData.certificates || [])
    .filter((certificate) => certificate instanceof pkijs.Certificate)
    .map(pkijsCertificateToDer);
  const signers = [];

  for (let index = 0; index < signedData.signerInfos.length; index += 1) {
    const signerInfo = signedData.signerInfos[index];
    let result;
    let verifyError = null;
    try {
      result = await signedData.verify({
        signer: index,
        data: toArrayBuffer(signedBytes),
        checkChain: false,
        extendedMode: true
      });
    } catch (error) {
      verifyError = errorMessage(error);
    }

    const signerCertificate = result?.signerCertificate instanceof pkijs.Certificate
      ? pkijsCertificateToDer(result.signerCertificate)
      : embeddedCertificates[index] || embeddedCertificates[0];
    const signingTime = attributeDate(signerInfo.signedAttrs, SIGNING_TIME_OID);
    const timestampPresent = Boolean(
      signerInfo.unsignedAttrs?.attributes?.some((attribute) => attribute.type === TIMESTAMP_TOKEN_OID)
    );

    const valid = result?.signatureVerified === true;
    signers.push({
      index: index + 1,
      valid,
      message: result?.message || verifyError || (valid
        ? 'CMS signer signature is valid.'
        : 'CMS signature verification failed.'),
      signing_time: signingTime,
      digest_algorithm: algorithm(signerInfo.digestAlgorithm?.algorithmId),
      signature_algorithm: algorithm(signerInfo.signatureAlgorithm?.algorithmId),
      certificate: signerCertificate ? safeDescribeCertificate(signerCertificate) : null,
      timestamp: {
        present: timestampPresent,
        valid: null,
        status: timestampPresent ? 'NOT_EVALUATED' : 'NOT_PRESENT'
      }
    });
  }

  return {
    valid: signers.length > 0 && signers.every((signer) => signer.valid),
    content_type: contentInfo.contentType,
    signer_count: signers.length,
    certificate_count: embeddedCertificates.length,
    signers
  };
}

async function verifyPdfSignature(entry, bufferLength, index) {
  const base = {
    index,
    byte_range: entry.byteRange,
    signed_revision_length: entry.revisionEnd,
    covers_current_file: entry.revisionEnd === bufferLength,
    trailing_bytes: Math.max(0, bufferLength - entry.revisionEnd),
    sub_filter: entry.subFilter
  };

  if (entry.extractionError) {
    return {
      ...base,
      valid: false,
      error_code: 'PDF_SIGNATURE_EXTRACTION_FAILED',
      message: entry.extractionError,
      cms: null,
      warnings: []
    };
  }

  try {
    const cms = await verifyCms(entry.cms, entry.signedBytes);
    const warnings = ['Certificate chain trust, OCSP, CRL and timestamp validity were not evaluated.'];
    if (!base.covers_current_file) {
      warnings.push('A later PDF incremental revision exists after this signature.');
    }
    if (cms.signers.some((signer) => signer.certificate?.valid_at_check_time === false)) {
      warnings.push('At least one signing certificate is not valid at the current check time.');
    }
    return {
      ...base,
      valid: cms.valid,
      error_code: cms.valid ? null : 'PDF_CMS_SIGNATURE_INVALID',
      message: cms.valid ? 'PDF ByteRange and CMS signature are valid.' : 'PDF CMS signature is invalid.',
      cms,
      warnings
    };
  } catch (error) {
    return {
      ...base,
      valid: false,
      error_code: 'PDF_CMS_VERIFICATION_FAILED',
      message: errorMessage(error),
      cms: null,
      warnings: []
    };
  }
}

export async function verifyPdf(buffer) {
  const extracted = extractPdfSignatures(buffer);
  if (extracted.length === 0) {
    return {
      format: 'PDF',
      status: 'UNSIGNED',
      valid: false,
      integrity_valid: false,
      signature_count: 0,
      signatures: [],
      warnings: ['No PDF signature ByteRange was found.']
    };
  }

  const signatures = await Promise.all(
    extracted.map((entry, index) => verifyPdfSignature(entry, buffer.length, index + 1))
  );
  const latest = signatures.reduce((current, signature) =>
    !current || signature.signed_revision_length > current.signed_revision_length ? signature : current, null);
  const integrityValid = Boolean(latest?.valid && latest.covers_current_file);
  const allSignaturesValid = signatures.every((signature) => signature.valid);
  const certificateWarning = signatures.some((signature) =>
    signature.cms?.signers.some((signer) => signer.certificate?.valid_at_check_time === false));

  return {
    format: 'PDF',
    status: integrityValid ? (certificateWarning ? 'VALID_WITH_WARNINGS' : 'VALID') : 'INVALID',
    valid: integrityValid,
    integrity_valid: integrityValid,
    all_signatures_valid: allSignaturesValid,
    signature_count: signatures.length,
    signatures,
    warnings: ['Certificate chain trust, OCSP, CRL and timestamp validity are not evaluated.']
  };
}
