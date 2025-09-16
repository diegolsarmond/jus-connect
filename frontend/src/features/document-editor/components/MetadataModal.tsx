import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { TemplateMetadata } from '@/types/templates';

export interface MetadataFormValues extends TemplateMetadata {
  title: string;
}

interface MetadataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues: MetadataFormValues;
  onConfirm: (values: MetadataFormValues) => void;
  isSaving?: boolean;
}

const TEMPLATE_TYPES = ['Documento', 'Petição', 'Contrato', 'Procuração', 'Relatório', 'Outro'];
const COMPLEXITY_OPTIONS: TemplateMetadata['complexity'][] = ['Baixa', 'Média', 'Alta'];
const VISIBILITY_OPTIONS: TemplateMetadata['visibility'][] = ['privado', 'equipe', 'publico'];

export function MetadataModal({ open, onOpenChange, defaultValues, onConfirm, isSaving }: MetadataModalProps) {
  const [values, setValues] = useState<MetadataFormValues>(defaultValues);

  useEffect(() => {
    if (open) {
      setValues(defaultValues);
    }
  }, [defaultValues, open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="metadata-description" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Salvar novo modelo</DialogTitle>
          <DialogDescription id="metadata-description">
            Preencha os metadados do modelo para facilitar a busca e o compartilhamento com o time.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="template-title">Título</Label>
            <Input
              id="template-title"
              value={values.title}
              onChange={event => setValues(prev => ({ ...prev, title: event.target.value }))}
              placeholder="Título do modelo"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-type">Tipo</Label>
              <Select
                value={values.type}
                onValueChange={value => setValues(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="template-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-area">Área</Label>
              <Input
                id="template-area"
                value={values.area}
                onChange={event => setValues(prev => ({ ...prev, area: event.target.value }))}
                placeholder="Ex.: Cível, Trabalhista, Tributário"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-complexity">Complexidade</Label>
              <Select
                value={values.complexity}
                onValueChange={value => setValues(prev => ({ ...prev, complexity: value as TemplateMetadata['complexity'] }))}
              >
                <SelectTrigger id="template-complexity">
                  <SelectValue placeholder="Complexidade" />
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-visibility">Visibilidade</Label>
              <Select
                value={values.visibility}
                onValueChange={value => setValues(prev => ({ ...prev, visibility: value as TemplateMetadata['visibility'] }))}
              >
                <SelectTrigger id="template-visibility">
                  <SelectValue placeholder="Visibilidade" />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(option => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option === 'publico' ? 'Público' : option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-4 rounded-md border p-4">
            <p className="text-sm font-medium">Ações automáticas</p>
            <div className="flex items-start gap-3">
              <Checkbox
                id="template-auto-client"
                checked={values.autoCreateClient}
                onCheckedChange={checked =>
                  setValues(prev => ({ ...prev, autoCreateClient: checked === true }))
                }
              />
              <Label htmlFor="template-auto-client" className="text-sm font-normal">
                Cadastrar cliente automaticamente ao utilizar o modelo
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="template-auto-process"
                checked={values.autoCreateProcess}
                onCheckedChange={checked =>
                  setValues(prev => ({ ...prev, autoCreateProcess: checked === true }))
                }
              />
              <Label htmlFor="template-auto-process" className="text-sm font-normal">
                Cadastrar processo automaticamente ao utilizar o modelo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar modelo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MetadataModal;
