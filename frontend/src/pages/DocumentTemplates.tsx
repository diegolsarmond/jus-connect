import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTemplates, deleteTemplate, createTemplate, Template } from '@/lib/templates';
import { Button } from '@/components/ui/button';
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
      <ul className="space-y-2">
        {templates?.map(t => (
          <li key={t.id} className="border rounded p-4 flex justify-between items-center">
            <span>{t.title}</span>
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/documentos/${t.id}`)}>Editar</Button>
              <Button variant="outline" size="sm" onClick={() => duplicateMut.mutate(t)}>Duplicar</Button>
              <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate(t.id)}>Excluir</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
