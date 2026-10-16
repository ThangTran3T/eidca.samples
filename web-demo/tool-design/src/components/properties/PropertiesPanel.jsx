import { useState } from 'react';
import { SlidersHorizontal, Scale, MousePointer2 } from 'lucide-react';
import { useEditor, selectSelectedSignature, selectSelectedElement } from '../../stores/editor-store.js';
import { Tabs, TabsList, TabsTrigger, TabsContent, EmptyState } from '../ui/index.jsx';
import { SignatureProperties } from './SignatureProperties.jsx';
import { ElementProperties } from './ElementProperties.jsx';
import { CompliancePanel, useCompliance, ComplianceBadge } from './CompliancePanel.jsx';
import { useT } from '../../i18n/index.js';

export function PropertiesPanel() {
  const t = useT();
  const sig = useEditor(selectSelectedSignature);
  const el = useEditor(selectSelectedElement);
  const [tab, setTab] = useState('props');
  const report = useCompliance(sig);

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--panel)]" aria-label={t('props.title')} data-testid="properties-panel">
      {!sig ? (
        <EmptyState icon={<MousePointer2 className="h-5 w-5" />} title={t('props.title')} testId="props-empty">
          {t('props.nothing')}
        </EmptyState>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="props" testId="tab-props">
              <SlidersHorizontal className="h-3.5 w-3.5" /> {t('props.title')}
            </TabsTrigger>
            <TabsTrigger value="compliance" testId="tab-compliance">
              <Scale className="h-3.5 w-3.5" /> {t('props.compliance')}
              <ComplianceBadge report={report} compact testId="tab-compliance-badge" />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="props" className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            {el ? <ElementProperties key={el.id} sig={sig} el={el} /> : <SignatureProperties key={sig.id} sig={sig} />}
          </TabsContent>
          <TabsContent value="compliance" className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <CompliancePanel sig={sig} />
          </TabsContent>
        </Tabs>
      )}
    </aside>
  );
}
