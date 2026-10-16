import { useState } from 'react';
import { LayoutTemplate, Shapes, Files } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/index.jsx';
import { TemplateLibrary } from '../templates/TemplateLibrary.jsx';
import { ElementsPanel } from '../templates/ElementsPanel.jsx';
import { PagesPanel } from '../templates/PagesPanel.jsx';
import { useT } from '../../i18n/index.js';

export function LeftSidebar() {
  const t = useT();
  const [tab, setTab] = useState('templates');
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)]" aria-label="Thư viện" data-testid="left-sidebar">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="templates" testId="tab-templates">
            <LayoutTemplate className="h-3.5 w-3.5" /> {t('sidebar.templates')}
          </TabsTrigger>
          <TabsTrigger value="elements" testId="tab-elements">
            <Shapes className="h-3.5 w-3.5" /> {t('sidebar.elements')}
          </TabsTrigger>
          <TabsTrigger value="pages" testId="tab-pages">
            <Files className="h-3.5 w-3.5" /> {t('sidebar.pages')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <TemplateLibrary />
        </TabsContent>
        <TabsContent value="elements" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <ElementsPanel />
        </TabsContent>
        <TabsContent value="pages" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <PagesPanel />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
