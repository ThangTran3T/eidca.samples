import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useEditor } from '../stores/editor-store.js';
import { useDialogs } from '../stores/ui-store.js';
import { loadFonts } from '../services/font-service.js';
import { bootstrapLibrary } from '../features/templates/bootstrap.js';
import { Toolbar } from '../components/editor/Toolbar.jsx';
import { LeftSidebar } from '../components/editor/LeftSidebar.jsx';
import { Workspace } from '../components/editor/Workspace.jsx';
import { PropertiesPanel } from '../components/properties/PropertiesPanel.jsx';
import { StatusBar, Toasts } from '../components/editor/StatusBar.jsx';
import { ExportDialog } from '../components/editor/dialogs/ExportDialog.jsx';
import { ImportDialog } from '../components/editor/dialogs/ImportDialog.jsx';
import { RuntimeDataDialog, SaveTemplateDialog, ShortcutsDialog } from '../components/editor/dialogs/MiscDialogs.jsx';
import { TooltipProvider, Spinner, Button } from '../components/ui/index.jsx';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useT } from '../i18n/index.js';

function useBootstrap() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadFonts();
        const library = await bootstrapLibrary();
        if (!alive) return;
        useEditor.getState().setLibrary(library);
        setState({ status: 'ready' });
      } catch (err) {
        if (alive) setState({ status: 'error', error: err?.message ?? String(err) });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

function Dialogs() {
  const dialog = useDialogs((s) => s.dialog);
  const close = useDialogs((s) => s.close);
  const props = (name) => ({ open: dialog === name, onOpenChange: (o) => !o && close() });
  return (
    <>
      <ExportDialog {...props('export')} />
      <ImportDialog {...props('import')} />
      <RuntimeDataDialog {...props('runtime')} />
      <SaveTemplateDialog {...props('save')} />
      <ShortcutsDialog {...props('shortcuts')} />
    </>
  );
}

export function App() {
  const t = useT();
  const theme = useEditor((s) => s.theme);
  const locale = useEditor((s) => s.locale);
  const panels = useEditor((s) => s.panels);
  const boot = useBootstrap();
  useKeyboardShortcuts();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (boot.status === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--text-muted)]" data-testid="app-loading">
        <Spinner className="h-6 w-6 text-brand-600" />
        <div className="text-[13px]">{t('app.loading')}</div>
      </div>
    );
  }
  if (boot.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-8" data-testid="app-error">
        <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5" /> {t('app.loadError')}
          </div>
          <p className="text-[13px]">{boot.error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Tải lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col" data-testid="app">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          {panels.left && <LeftSidebar />}
          <main className="flex min-w-0 flex-1 flex-col" aria-label="Khung làm việc">
            <Workspace />
          </main>
          {panels.right && <PropertiesPanel />}
        </div>
        <StatusBar />
      </div>
      <Dialogs />
      <Toasts />
    </TooltipProvider>
  );
}
