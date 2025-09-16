import { ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { VariableMenuItem } from '../data/variable-items';
import { variableMenuTree } from '../data/variable-items';

type InsertMenuProps = {
  onSelect: (item: VariableMenuItem) => void;
  disabled?: boolean;
};

function RenderMenuItems({ items, onSelect }: { items: VariableMenuItem[]; onSelect: (item: VariableMenuItem) => void }) {
  return (
    <>
      {items.map(item => {
        if (item.children && item.children.length > 0) {
          return (
            <DropdownMenuSub key={item.value}>
              <DropdownMenuSubTrigger className="flex items-center justify-between gap-2">
                <span>{item.label}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 overflow-y-auto" alignOffset={-4}>
                <RenderMenuItems items={item.children} onSelect={onSelect} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        }

        return (
          <DropdownMenuItem key={item.value} onSelect={() => onSelect(item)}>
            <div className="flex flex-col">
              <span>{item.label}</span>
              <span className="text-xs text-muted-foreground">{`{{${item.value}}}`}</span>
            </div>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

export function InsertMenu({ onSelect, disabled }: InsertMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button type="button" variant="outline" className="gap-2" aria-haspopup="menu">
          <ListPlus className="h-4 w-4" />
          Inserir
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56" sideOffset={8}>
        <RenderMenuItems items={variableMenuTree} onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default InsertMenu;
