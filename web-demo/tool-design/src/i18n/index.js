/**
 * Minimal i18n: Vietnamese is the default and the fallback; English is
 * provided for the editor chrome. Engine messages (compliance explanations,
 * legal quotes) stay in Vietnamese because they cite Vietnamese law.
 * Add a locale by adding a dictionary with the same keys.
 */
import { useEditor } from '../stores/editor-store.js';
import vi from './vi.js';
import en from './en.js';

export const LOCALES = { vi: { label: 'Tiếng Việt', dict: vi }, en: { label: 'English', dict: en } };

export function translate(locale, key, vars) {
  const s = LOCALES[locale]?.dict[key] ?? vi[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)) : s;
}

export function useT() {
  const locale = useEditor((s) => s.locale);
  return (key, vars) => translate(locale, key, vars);
}
