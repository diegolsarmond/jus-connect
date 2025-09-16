import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTemplate,
  createTemplate,
  updateTemplate,
  fetchTags,
  generateWithAI,
  generateDocument,
  type Template
} from '@/lib/templates';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import FontSelector from '@/components/FontSelector';

export default function TemplateEditor() {
  const { id } = useParams();
  const isNew = id === 'novo';
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('<p></p>');
  const editorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useQuery({
    queryKey: ['template', id],
    queryFn: () => getTemplate(Number(id)),
    enabled: !isNew,
    onSuccess: tpl => {
      setTitle(tpl.title);
      setContent(tpl.content);
    }
  });

  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: fetchTags });

  const saveMut = useMutation<Template>({
    mutationFn: () =>
      isNew
        ? createTemplate({ title, content })
        : updateTemplate(Number(id), { title, content }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      if (isNew) {
        navigate(`/documentos/editor/${saved.id}`);
      } else {
        navigate('/documentos');
      }
    }
  });

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.dataTransfer.getData('text/plain');
    insertAtCaret(text);
    setContent(editorRef.current?.innerHTML || '');
  }

  function insertAtCaret(text: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    setContent(editorRef.current?.innerHTML || '');
  }

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  function handleGenerateAI() {
    if (isNew) return;
    generateWithAI(Number(id)).then(t => setContent(t));
  }

  async function handlePreview() {
    const regex = /{{\s*([\w.]+)\s*}}/g;
    const vars = Array.from(new Set(Array.from(content.matchAll(regex)).map(m => m[1])));
    const values: Record<string, string> = {};
    for (const v of vars) {
      const val = window.prompt(`Valor para ${v}`) || '';
      values[v] = val;
    }
    const html = await generateDocument(isNew ? 0 : Number(id), values);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <input className="border p-2 w-full" placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
      <div className="flex gap-4 justify-center">
        <div className="w-64 border rounded p-2 space-y-2" onDragOver={e => e.preventDefault()}>
          <h2 className="font-bold">Tags</h2>
          {tags?.map(tag => (
            <div
              key={tag.id}
              draggable
              onDragStart={e => e.dataTransfer.setData('text/plain', `{{${tag.key}}}`)}
              className="cursor-move p-1 border rounded"
            >
              {tag.label}
            </div>
          ))}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2 flex-wrap justify-center">
            <FontSelector onChange={f => exec('fontName', f)} />
            <Button variant="outline" size="sm" onClick={() => exec('bold')}><b>B</b></Button>
            <Button variant="outline" size="sm" onClick={() => exec('italic')}><i>I</i></Button>
            <Button variant="outline" size="sm" onClick={() => exec('underline')}><u>U</u></Button>
            <Button variant="outline" size="sm" onClick={() => exec('strikeThrough')}><s>S</s></Button>
            <Button variant="outline" size="sm" onClick={() => exec('insertOrderedList')}>OL</Button>
            <Button variant="outline" size="sm" onClick={() => exec('insertUnorderedList')}>UL</Button>
            <Button variant="outline" size="sm" onClick={() => exec('justifyLeft')}>Left</Button>
            <Button variant="outline" size="sm" onClick={() => exec('justifyCenter')}>Center</Button>
            <Button variant="outline" size="sm" onClick={() => exec('justifyRight')}>Right</Button>
            <Button variant="outline" size="sm" onClick={() => exec('justifyFull')}>Justify</Button>
            <Button variant="outline" size="sm" onClick={() => exec('undo')}>Undo</Button>
            <Button variant="outline" size="sm" onClick={() => exec('redo')}>Redo</Button>
            <Button variant="outline" size="sm" onClick={() => exec('formatBlock', 'H1')}>H1</Button>
            <Button variant="outline" size="sm" onClick={() => exec('formatBlock', 'H2')}>H2</Button>
          </div>
          <div
            className="border rounded bg-white mx-auto shadow"
            style={{ width: '210mm', minHeight: '297mm', direction: 'ltr' }}
            contentEditable
            ref={editorRef}
            onDrop={handleDrop}
            onInput={e => setContent((e.target as HTMLDivElement).innerHTML)}
          />
        </div>
      </div>
      <div className="space-x-2 flex justify-center">
        <Button onClick={() => saveMut.mutate()}>Salvar template</Button>
        <Button variant="outline" onClick={handleGenerateAI}>Gerar texto com IA</Button>
        <Button variant="outline" onClick={handlePreview}>Preview / Preencher</Button>
      </div>
    </div>
  );
}
