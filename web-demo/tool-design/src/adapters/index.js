/**
 * Signing-provider adapter registry. An adapter converts designer signatures
 * to/from a provider's placement format. Adding a provider = adding an entry;
 * the editor and export dialog discover adapters from here.
 *
 * interface SigningAdapter {
 *   id: string; label: string; description: string;
 *   fileName(docName): string;
 *   export(signatures, opts): { payload, warnings, perSignature };
 *   import(input, opts): { signatures, warnings, errors };
 *   serialize(payload, variant): string;  // variants: 'pretty' | 'compact' | 'multipart'
 * }
 */
import { exportLegacy, importLegacy, ADAPTER_ID } from './vneca/legacy-adapter.js';

export const vnecaLegacyAdapter = {
  id: ADAPTER_ID,
  label: 'VNeCA — sign_props (legacy)',
  description: 'Mảng sign_props dùng cho Local Agent /api/sign-document và Server Agent (xem docs/api-reference.md).',
  fileName: (docName) => `${(docName || 'tai-lieu').replace(/\.pdf$/i, '')}.sign_props.json`,
  export: exportLegacy,
  import: importLegacy,
  serialize(payload, variant = 'pretty') {
    if (variant === 'compact') return JSON.stringify(payload);
    // multipart form field: the array is sent as a JSON *string* (docs/api-reference.md §sign_props)
    if (variant === 'multipart') return JSON.stringify(JSON.stringify(payload));
    return JSON.stringify(payload, null, 2);
  },
};

export const ADAPTERS = { [vnecaLegacyAdapter.id]: vnecaLegacyAdapter };

export function getAdapter(id) {
  const a = ADAPTERS[id];
  if (!a) throw new Error(`Không có adapter "${id}"`);
  return a;
}
