/**
 * Embedding entry point (e.g. inside VNeCA CMS). The whole editor renders
 * into the given element; integration happens through this small API rather
 * than through globals, so hosts stay decoupled from internals.
 *
 *   const designer = mount(el, { theme: 'light', locale: 'vi' });
 *   await designer.openPdf(bytes, 'van-ban.pdf');
 *   const { payload, warnings } = designer.exportVnecaSignProps();
 *   designer.unmount();
 */
import { StrictMode, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app/App.jsx';
import { useEditor } from './stores/editor-store.js';
import { openPdf } from './services/pdf-service.js';
import { buildLegacyExport } from './features/export/export-actions.js';
import { exportDesignerDocument } from './features/export/designer-io.js';

export function mount(element, { theme, locale } = {}) {
  if (!element) throw new Error('mount(): element is required');
  const st = useEditor.getState();
  if (theme) st.setTheme(theme);
  if (locale) st.setLocale(locale);
  const root = createRoot(element);
  root.render(createElement(StrictMode, null, createElement(App)));
  return {
    async openPdf(bytes, name = 'tai-lieu.pdf') {
      const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const { doc, pages } = await openPdf(data);
      useEditor.getState().setDocument({ name, bytes: data, pdf: doc, pages });
    },
    exportVnecaSignProps: (opts) => buildLegacyExport(opts),
    exportDesignerJson: () => {
      const s = useEditor.getState();
      return exportDesignerDocument({ documentName: s.doc?.name ?? '', pages: s.doc?.pages ?? [], signatures: s.signatures });
    },
    subscribe: (fn) => useEditor.subscribe((s, prev) => s.signatures !== prev.signatures && fn(s.signatures)),
    unmount: () => root.unmount(),
  };
}
