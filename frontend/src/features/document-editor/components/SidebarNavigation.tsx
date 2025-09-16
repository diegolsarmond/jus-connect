import { Fragment } from 'react';
import { ChevronLeft, ChevronRight, FileText, Info, ListTree } from 'lucide-react';
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
}

const NAV_ITEMS = [
  { id: 'editor', label: 'Editor', icon: FileText },
  { id: 'metadata', label: 'Metadados', icon: Info },
  { id: 'placeholders', label: 'Campos', icon: ListTree },
];

function VariableTree({ items, depth, onSelect }: { items: VariableMenuItem[]; depth?: number; onSelect?: (item: VariableMenuItem) => void }) {
  return (
    <ul className="space-y-1">
      {items.map(item => {
        const IconWrapper = (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 px-2 py-1 text-left text-sm"
            onClick={() => onSelect?.(item)}
            disabled={!onSelect}
          >
            <span className="font-medium">{item.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{`{{${item.value}}}`}</span>
          </Button>
        );

        return (
          <li key={`${item.value}-${depth ?? 0}`} style={{ marginLeft: depth ? depth * 12 : 0 }}>
            {onSelect ? IconWrapper : <span className="text-sm">{item.label}</span>}
            {item.children && item.children.length > 0 && (
              <VariableTree items={item.children} depth={(depth ?? 0) + 1} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SidebarNavigation({ collapsed, onToggle, activeSection, onSelectSection, onInsertVariable, className }: SidebarNavigationProps) {
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
            <VariableTree items={variableMenuTree} depth={0} onSelect={onInsertVariable} />
          </ScrollArea>
        </div>
      )}
    </aside>
  );
}

export default SidebarNavigation;
