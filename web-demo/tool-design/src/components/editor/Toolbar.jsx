import {
  FileUp,
  FilePlus2,
  Save,
  FileInput,
  FileJson,
  ImageDown,
  FileCode2,
  FileSearch,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Scan,
  Moon,
  Sun,
  MoreHorizontal,
  Keyboard,
  Languages,
  Database,
  X,
  FileText,
  ChevronDown,
  LayoutTemplate,
  FileStack,
  Grid3x3,
  Ruler as RulerIcon,
  Magnet,
  Crosshair,
  PanelsTopLeft,
  Braces,
} from 'lucide-react';
import { useEditor, selectSelectedSignature, clampZoom } from '../../stores/editor-store.js';
import { useDialogs, openFilePicker } from '../../stores/ui-store.js';
import { Button, IconButton, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuLabel, Segmented, Tooltip } from '../ui/index.jsx';
import { openPdfFile, openSamplePdf, openBlankPdf } from '../../features/document/document-actions.js';
import { exportPng, exportSvg } from '../../features/export/export-actions.js';
import { SAMPLE_DOCS } from './Workspace.jsx';
import { useT, LOCALES } from '../../i18n/index.js';

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

function Divider() {
  return <div className="mx-1 h-6 w-px bg-[var(--border)]" />;
}

export function Toolbar() {
  const t = useT();
  const doc = useEditor((s) => s.doc);
  const zoom = useEditor((s) => s.zoom);
  const view = useEditor((s) => s.view);
  const theme = useEditor((s) => s.theme);
  const locale = useEditor((s) => s.locale);
  const displayMode = useEditor((s) => s.displayMode);
  const settings = useEditor((s) => s.settings);
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const sig = useEditor(selectSelectedSignature);
  const hasSigs = useEditor((s) => s.signatures.length > 0);
  const library = useEditor((s) => s.library);
  const open = useDialogs((s) => s.open);
  const st = useEditor.getState;

  const pickPdf = () => openFilePicker('application/pdf,.pdf', openPdfFile);
  const newTemplate = () => {
    const blank = library.find((x) => x.id === 'custom-blank');
    if (blank) st().addFromTemplate({ ...blank, name: 'Mẫu chữ ký mới' });
    st().setView('template');
  };

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--panel)] px-3" data-testid="toolbar">
      {/* brand + document */}
      <div className="mr-2 flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/40" aria-hidden="true">
          <svg viewBox="0 0 64 64" className="h-5 w-5">
            <path d="M10 44c6-14 10-22 14-22s2 14 6 14 6-10 10-10 4 6 6 6" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 52h40" stroke="#c7d2fe" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="whitespace-nowrap text-[13px] font-semibold tracking-tight">
            VNeCA <span className="font-normal text-[var(--text-muted)]">Signature Designer</span>
          </div>
          <div className="flex max-w-[220px] items-center gap-1 text-[11.5px] text-[var(--text-muted)]" data-testid="doc-name">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate" title={doc?.name}>
              {doc ? `${doc.name} · ${doc.pages.length} trang` : t('toolbar.untitled')}
            </span>
            {doc && (
              <button type="button" aria-label={t('toolbar.close')} className="rounded p-0.5 hover:bg-[var(--panel-2)]" onClick={() => st().closeDocument()}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      <Divider />

      {/* file actions */}
      <Menu>
        <Tooltip content={t('toolbar.new')}>
          <MenuTrigger asChild>
            <Button variant="ghost" size="sm" data-testid="menu-new">
              <FilePlus2 className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent>
          <MenuItem icon={<LayoutTemplate className="h-4 w-4" />} onSelect={newTemplate} testId="new-template">
            {t('toolbar.new')}
          </MenuItem>
          <MenuItem icon={<FilePlus2 className="h-4 w-4" />} onSelect={openBlankPdf}>
            {t('toolbar.blank')}
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>{t('toolbar.samples')}</MenuLabel>
          {SAMPLE_DOCS.map((d) => (
            <MenuItem key={d.file} icon={<FileText className="h-4 w-4" />} onSelect={() => openSamplePdf(d.file)} testId={`menu-sample-${d.file}`}>
              {d.title}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <Button variant="ghost" size="sm" onClick={pickPdf} data-testid="open-pdf">
        <FileUp className="h-4 w-4" /> {t('toolbar.openPdf')}
      </Button>
      <IconButton label={t('toolbar.saveTemplate')} shortcut="Ctrl+S" disabled={!sig} onClick={() => open('save')} data-testid="save-template">
        <Save className="h-4 w-4" />
      </IconButton>
      <Divider />
      <IconButton label={t('toolbar.importJson')} onClick={() => open('import')} data-testid="import-json">
        <FileInput className="h-4 w-4" />
      </IconButton>
      <Button variant="ghost" size="sm" disabled={!hasSigs} onClick={() => open('export')} data-testid="export-json">
        <FileJson className="h-4 w-4" /> {t('toolbar.exportJson')}
      </Button>
      <Menu>
        <Tooltip content={sig ? t('toolbar.exportPng') : 'Chọn một chữ ký để xuất PNG'}>
          <MenuTrigger asChild disabled={!sig}>
            <Button variant="ghost" size="sm" disabled={!sig} data-testid="export-png">
              <ImageDown className="h-4 w-4" /> PNG
            </Button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent>
          <MenuItem onSelect={() => exportPng(sig, { dpi: 300 })} testId="png-300">
            PNG 300 DPI — nền trong suốt
          </MenuItem>
          <MenuItem onSelect={() => exportPng(sig, { dpi: 600 })}>PNG 600 DPI — nền trong suốt</MenuItem>
          <MenuItem onSelect={() => exportPng(sig, { dpi: 300, transparent: false })}>PNG 300 DPI — nền trắng</MenuItem>
        </MenuContent>
      </Menu>
      <IconButton label={t('toolbar.exportSvg')} disabled={!sig} onClick={() => exportSvg(sig)} data-testid="export-svg">
        <FileCode2 className="h-4 w-4" />
      </IconButton>
      <Button variant={view === 'rendered' ? 'subtle' : 'ghost'} size="sm" disabled={!hasSigs} onClick={() => st().setView(view === 'rendered' ? 'placement' : 'rendered')} data-testid="preview-pdf">
        <FileSearch className="h-4 w-4" /> {t('toolbar.previewPdf')}
      </Button>
      <Divider />
      <IconButton label={t('toolbar.undo')} shortcut="Ctrl+Z" disabled={!canUndo} onClick={() => st().undo()} data-testid="undo">
        <Undo2 className="h-4 w-4" />
      </IconButton>
      <IconButton label={t('toolbar.redo')} shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => st().redo()} data-testid="redo">
        <Redo2 className="h-4 w-4" />
      </IconButton>

      <div className="flex-1" />

      {/* preview mode & data */}
      <Segmented
        label={t('view.label')}
        value={view}
        onChange={(v) => st().setView(v)}
        testId="view-mode"
        options={[
          { value: 'template', label: t('view.template'), icon: <LayoutTemplate className="h-3.5 w-3.5" /> },
          { value: 'placement', label: t('view.placement'), icon: <PanelsTopLeft className="h-3.5 w-3.5" /> },
          { value: 'rendered', label: t('view.rendered'), icon: <FileStack className="h-3.5 w-3.5" /> },
        ]}
      />
      <div className="ml-1 flex items-center">
        <Menu>
          <Tooltip content="Dữ liệu hiển thị trong mẫu">
            <MenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="display-mode" data-value={displayMode}>
                <Braces className="h-3.5 w-3.5" />
                {{ placeholder: t('mode.placeholder'), sample: t('mode.sample'), runtime: t('mode.runtime') }[displayMode]}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </MenuTrigger>
          </Tooltip>
          <MenuContent align="end">
            <MenuLabel>Dữ liệu hiển thị</MenuLabel>
            <MenuItem onSelect={() => st().setDisplayMode('placeholder')} testId="mode-placeholder">
              {displayMode === 'placeholder' ? '✓ ' : ''}
              {t('mode.placeholder')} — hiện {'{{signer.name}}'}…
            </MenuItem>
            <MenuItem onSelect={() => st().setDisplayMode('sample')} testId="mode-sample">
              {displayMode === 'sample' ? '✓ ' : ''}
              {t('mode.sample')} — dữ liệu đi kèm mẫu
            </MenuItem>
            <MenuItem onSelect={() => st().setDisplayMode('runtime')} testId="mode-runtime">
              {displayMode === 'runtime' ? '✓ ' : ''}
              {t('mode.runtime')} — dữ liệu bạn nhập
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Database className="h-4 w-4" />} onSelect={() => open('runtime')} testId="runtime-data">
              {t('toolbar.runtimeData')}…
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <Divider />

      {/* zoom & view */}
      <IconButton label={t('toolbar.zoomOut')} shortcut="Ctrl+−" onClick={() => st().setZoom(clampZoom(zoom / 1.2))} disabled={zoom <= 0.25} data-testid="zoom-out">
        <ZoomOut className="h-4 w-4" />
      </IconButton>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" className="h-7 w-14 rounded-md text-center text-[12px] font-medium tabular-nums hover:bg-[var(--panel-2)]" data-testid="zoom-value" aria-label="Mức phóng">
            {Math.round(zoom * 100)}%
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          {ZOOM_PRESETS.map((z) => (
            <MenuItem key={z} onSelect={() => st().setZoom(z)} testId={`zoom-${Math.round(z * 100)}`}>
              {Math.round(z * 100)}%
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={<Scan className="h-4 w-4" />} onSelect={() => window.dispatchEvent(new Event('vneca:fit-width'))}>
            {t('toolbar.fit')}
          </MenuItem>
        </MenuContent>
      </Menu>
      <IconButton label={t('toolbar.zoomIn')} shortcut="Ctrl+=" onClick={() => st().setZoom(clampZoom(zoom * 1.2))} disabled={zoom >= 4} data-testid="zoom-in">
        <ZoomIn className="h-4 w-4" />
      </IconButton>
      <IconButton label={t('toolbar.rotateLeft')} onClick={() => st().rotateView(-90)} data-testid="rotate-left">
        <RotateCcw className="h-4 w-4" />
      </IconButton>
      <IconButton label={t('toolbar.rotateRight')} onClick={() => st().rotateView(90)} data-testid="rotate-right">
        <RotateCw className="h-4 w-4" />
      </IconButton>
      <IconButton label={t('toolbar.resetView')} shortcut="Ctrl+0" onClick={() => st().resetView()} data-testid="reset-view">
        <Crosshair className="h-4 w-4" />
      </IconButton>
      <Divider />
      <IconButton label={t('toolbar.theme')} onClick={() => st().setTheme(theme === 'dark' ? 'light' : 'dark')} data-testid="toggle-theme">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </IconButton>
      <Menu>
        <Tooltip content={t('toolbar.more')}>
          <MenuTrigger asChild>
            <button type="button" aria-label={t('toolbar.more')} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--panel-2)]" data-testid="more-menu">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent align="end">
          <MenuLabel>Khung làm việc</MenuLabel>
          <MenuItem icon={<RulerIcon className="h-4 w-4" />} onSelect={() => st().updateSettings({ rulers: !settings.rulers })}>
            {settings.rulers ? '✓ ' : ''}Thước đo
          </MenuItem>
          <MenuItem icon={<Grid3x3 className="h-4 w-4" />} shortcut="G" onSelect={() => st().updateSettings({ grid: !settings.grid })}>
            {settings.grid ? '✓ ' : ''}Lưới ({settings.gridSize} pt)
          </MenuItem>
          <MenuItem icon={<Magnet className="h-4 w-4" />} onSelect={() => st().updateSettings({ snap: !settings.snap })}>
            {settings.snap ? '✓ ' : ''}Bắt dính (cạnh, tâm, lưới)
          </MenuItem>
          <MenuItem icon={<Crosshair className="h-4 w-4" />} onSelect={() => st().updateSettings({ guides: !settings.guides })}>
            {settings.guides ? '✓ ' : ''}Đường căn chỉnh
          </MenuItem>
          <MenuItem icon={<RulerIcon className="h-4 w-4" />} onSelect={() => st().updateSettings({ units: settings.units === 'mm' ? 'pt' : 'mm' })}>
            Đơn vị thước: {settings.units === 'mm' ? 'mm → pt' : 'pt → mm'}
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>{t('toolbar.language')}</MenuLabel>
          {Object.entries(LOCALES).map(([k, v]) => (
            <MenuItem key={k} icon={<Languages className="h-4 w-4" />} onSelect={() => st().setLocale(k)}>
              {locale === k ? '✓ ' : ''}
              {v.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={<Keyboard className="h-4 w-4" />} shortcut="?" onSelect={() => open('shortcuts')}>
            {t('toolbar.shortcuts')}
          </MenuItem>
        </MenuContent>
      </Menu>
    </header>
  );
}
