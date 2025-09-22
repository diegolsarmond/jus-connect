import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Info, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { VariableMenuItem } from '../data/variable-items';
import { variableMenuTree } from '../data/variable-items';

interface SidebarNavigationProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onInsertVariable?: (item: VariableMenuItem) => void;
  className?: string;
  items?: VariableMenuItem[];
}

const NAV_ITEMS = [
  { id: 'editor', label: 'Editor', icon: FileText },
  { id: 'metadata', label: 'Metadados', icon: Info },
  { id: 'placeholders', label: 'Campos', icon: ListTree },
];

function VariableTree({
  items,
  depth = 0,
  onSelect,
}: {
  items: VariableMenuItem[];
  depth?: number;
  onSelect?: (item: VariableMenuItem) => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item, index) => {
        const key = item.id ?? item.value ?? `${item.label}-${index}`;
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isSelectable = Boolean(onSelect && item.value);
        const paddingLeft = depth > 0 ? depth * 12 : 0;

        return (
          <li key={key}>
            {isSelectable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 px-2 py-1 text-left text-sm"
                style={{ paddingLeft }}
                onClick={() => onSelect?.(item)}
              >
                <span className="font-medium">{item.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{`{{${item.value}}}`}</span>
              </Button>
            ) : (
              <div
                className={cn(
                  'px-2 py-1 text-sm',
                  hasChildren ? 'font-medium text-muted-foreground' : 'text-xs text-muted-foreground'
                )}
                style={{ paddingLeft }}
              >
                {item.label}
              </div>
            )}
            {hasChildren && (
              <VariableTree items={item.children!} depth={depth + 1} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SidebarNavigation({
  collapsed,
  onToggle,
  activeSection,
  onSelectSection,
  onInsertVariable,
  className,
  items,
}: SidebarNavigationProps) {
  const menuItems = items ?? variableMenuTree;
  const sectionIds = useMemo(
    () =>
      menuItems
        .filter(item => item.isSection)
        .map(item => item.id ?? item.value ?? item.label),
    [menuItems]
  );

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sectionIds.forEach(id => {
      initial[id] = true;
    });
    return initial;
  });

  useEffect(() => {
    setExpandedSections(prev => {
      const next = { ...prev };
      let changed = false;

      sectionIds.forEach(id => {
        if (!(id in next)) {
          next[id] = true;
          changed = true;
        }
      });

      Object.keys(next).forEach(key => {
        if (!sectionIds.includes(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [sectionIds]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <div className="flex items-center justify-between px-2 py-3">
        {!collapsed && <p className="text-sm font-semibold">Biblioteca</p>}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="space-y-1 px-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const button = (
            <Button
              key={item.id}
              type="button"
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 px-2 py-2 text-left text-sm',
                collapsed && 'justify-center'
              )}
              onClick={() => onSelectSection(item.id)}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {!collapsed && <span>{item.label}</span>}
            </Button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return <Fragment key={item.id}>{button}</Fragment>;
        })}
      </nav>
      {!collapsed && (
        <div className="mt-6 flex-1 px-3 pb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos disponíveis</h3>
          <ScrollArea className="mt-3 h-[calc(100vh-260px)] pr-2">
            <div className="space-y-3">
              {menuItems.map((section, index) => {
                const sectionId = section.id ?? section.value ?? `${section.label}-${index}`;
                const isExpanded = expandedSections[sectionId];
                return (
                  <div key={sectionId} className="rounded-md border border-border/60">
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionId)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold"
                    >
                      <span>{section.label}</span>
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform', isExpanded ? 'rotate-0' : '-rotate-90')}
                        aria-hidden
                      />
                    </button>
                    {isExpanded && section.children && section.children.length > 0 && (
                      <div className="border-t border-border/60 px-1 py-2">
                        <VariableTree items={section.children} depth={1} onSelect={onInsertVariable} />
                      </div>
                    )}
                    {isExpanded && (!section.children || section.children.length === 0) && (
                      <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        Nenhum campo disponível.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </aside>
  );
}

export default SidebarNavigation;
