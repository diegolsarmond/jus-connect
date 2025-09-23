import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Save } from 'lucide-react';

interface SaveButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isDirty?: boolean;
  label?: string;
}

export function SaveButton({ onClick, disabled, isDirty, label }: SaveButtonProps) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <div
        aria-hidden={!isDirty}
        className={cn(
          'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow transition-opacity',
          isDirty ? 'opacity-100' : 'opacity-0'
        )}
      >
        Alterações não salvas
      </div>
      <Button
        type="button"
        size="lg"
        onClick={onClick}
        disabled={disabled}
        className="pointer-events-auto gap-2 shadow-lg"
      >
        <Save className="h-4 w-4" />
        {label ?? "Salvar novo modelo"}
      </Button>
    </div>
  );
}

export default SaveButton;
