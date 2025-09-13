import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTemplates, deleteTemplate, createTemplate, Template } from '@/lib/templates';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';

export default function DocumentTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] })
  });
  const duplicateMut = useMutation({
    mutationFn: (tpl: Template) => createTemplate({ title: tpl.title + ' (cópia)', content: tpl.content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] })
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Templates</h1>
        <Button onClick={() => navigate('/documentos/novo')}>Novo Template</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">ID</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="hidden md:table-cell">Prévia</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates?.map(t => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.id}</TableCell>
              <TableCell>{t.title}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {t.content.slice(0, 60)}{t.content.length > 60 ? '...' : ''}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/documentos/${t.id}`)}>Editar</Button>
                <Button variant="outline" size="sm" onClick={() => duplicateMut.mutate(t)}>Duplicar</Button>
                <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate(t.id)}>Excluir</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
