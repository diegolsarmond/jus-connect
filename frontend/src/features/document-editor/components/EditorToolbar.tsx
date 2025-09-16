import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
} from 'lucide-react';

export type ToolbarBlock = 'paragraph' | 'h1' | 'h2' | 'h3';
export type ToolbarAlignment = 'left' | 'center' | 'right' | 'justify';

export interface ToolbarState {
  block: ToolbarBlock;
  fontSize: string;
  align: ToolbarAlignment;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  orderedList: boolean;
  bulletList: boolean;
  blockquote: boolean;
  highlight: boolean;
}

interface EditorToolbarProps {
  state: ToolbarState;
  onBlockChange: (value: ToolbarBlock) => void;
  onFontSizeChange: (value: string) => void;
  onAlignmentChange: (value: ToolbarAlignment) => void;
  onCommand: (command: string, value?: string) => void;
  onHighlight: () => void;
  onInsertImage: () => void;
  onInsertTable: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const BLOCK_OPTIONS: { value: ToolbarBlock; label: string }[] = [
  { value: 'paragraph', label: 'Texto normal' },
  { value: 'h1', label: 'Título 1' },
  { value: 'h2', label: 'Título 2' },
  { value: 'h3', label: 'Título 3' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'default', label: 'Padrão' },
  { value: '2', label: '12 pt' },
  { value: '3', label: '14 pt' },
  { value: '4', label: '16 pt' },
  { value: '5', label: '18 pt' },
  { value: '6', label: '24 pt' },
  { value: '7', label: '32 pt' },
];

function ToolbarButton({
  label,
  isActive,
  onClick,
  children,
  disabled,
}: {
  label: string;
  isActive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={isActive ? 'secondary' : 'ghost'}
          aria-pressed={isActive}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar({
  state,
  onBlockChange,
  onFontSizeChange,
  onAlignmentChange,
  onCommand,
  onHighlight,
  onInsertImage,
  onInsertTable,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
      <Select value={state.block} onValueChange={value => onBlockChange(value as ToolbarBlock)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BLOCK_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={state.fontSize} onValueChange={onFontSizeChange}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Tamanho" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZE_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex flex-wrap items-center gap-1">
        <ToolbarButton label="Negrito" onClick={() => onCommand('bold')} isActive={state.bold}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Itálico" onClick={() => onCommand('italic')} isActive={state.italic}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Sublinhar" onClick={() => onCommand('underline')} isActive={state.underline}>
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Tachar" onClick={() => onCommand('strikeThrough')} isActive={state.strike}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Marcador" onClick={onHighlight} isActive={state.highlight}>
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex flex-wrap items-center gap-1">
        <ToolbarButton
          label="Alinhar à esquerda"
          onClick={() => onAlignmentChange('left')}
          isActive={state.align === 'left'}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Centralizar"
          onClick={() => onAlignmentChange('center')}
          isActive={state.align === 'center'}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Alinhar à direita"
          onClick={() => onAlignmentChange('right')}
          isActive={state.align === 'right'}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Justificar"
          onClick={() => onAlignmentChange('justify')}
          isActive={state.align === 'justify'}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex flex-wrap items-center gap-1">
        <ToolbarButton
          label="Lista não ordenada"
          onClick={() => onCommand('insertUnorderedList')}
          isActive={state.bulletList}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          onClick={() => onCommand('insertOrderedList')}
          isActive={state.orderedList}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Citação"
          onClick={() => onCommand('formatBlock', 'blockquote')}
          isActive={state.blockquote}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Linha" onClick={() => onCommand('insertHorizontalRule')}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex items-center gap-1">
        <ToolbarButton label="Inserir imagem" onClick={onInsertImage}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Inserir tabela" onClick={onInsertTable}>
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex items-center gap-1">
        <ToolbarButton label="Desfazer" onClick={onUndo}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Refazer" onClick={onRedo}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

export default EditorToolbar;
