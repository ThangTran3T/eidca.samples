import { X509Certificate } from 'node:crypto';

export function derToPem(der) {
  const base64 = Buffer.from(der).toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
}

function dnValue(distinguishedName, attribute) {
  const lines = distinguishedName.split(/\n|,(?=[A-Z][A-Z0-9.]*=)/);
  const prefix = `${attribute}=`;
  return lines.find((line) => line.trim().startsWith(prefix))?.trim().slice(prefix.length) || null;
}

export function describeCertificate(der, validationTime = new Date()) {
  const certificate = new X509Certificate(Buffer.from(der));
  const validFrom = new Date(certificate.validFrom);
  const validTo = new Date(certificate.validTo);
  const publicKey = certificate.publicKey;

  return {
    subject_dn: certificate.subject,
    issuer_dn: certificate.issuer,
    common_name: dnValue(certificate.subject, 'CN'),
    organization: dnValue(certificate.subject, 'O'),
    issuer_common_name: dnValue(certificate.issuer, 'CN'),
    serial_number: certificate.serialNumber,
    valid_from: validFrom.toISOString(),
    valid_to: validTo.toISOString(),
    valid_at_check_time: validationTime >= validFrom && validationTime <= validTo,
    fingerprint_sha256: certificate.fingerprint256.replaceAll(':', '').toLowerCase(),
    public_key_type: publicKey.asymmetricKeyType || null,
    public_key_size: publicKey.asymmetricKeyDetails?.modulusLength || null,
    key_usage: certificate.keyUsage || [],
    is_ca: certificate.ca,
    trust_status: 'NOT_EVALUATED'
  };
}

export function safeDescribeCertificate(der, validationTime) {
  try {
    return describeCertificate(der, validationTime);
  } catch (error) {
    return {
      parse_error: error instanceof Error ? error.message : String(error),
      trust_status: 'NOT_EVALUATED'
    };
  }
}
