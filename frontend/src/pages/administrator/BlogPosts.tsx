import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { adminApi, blogPostKeys, type BlogPost, type BlogPostInput } from "@/lib/adminApi";
import { useBlogPosts, useBlogCategories } from "@/hooks/useBlogPosts";
import { useAuth } from "@/features/auth/AuthProvider";

interface BlogPostFormState {
  title: string;
  description: string;
  author: string;
  date: string;
  readTime: string;
  categoryId: string;
  slug: string;
  tags: string;
  image: string;
  content: string;
}

const DEFAULT_FORM_STATE: BlogPostFormState = {
  title: "",
  description: "",
  author: "",
  date: "",
  readTime: "",
  categoryId: "",
  slug: "",
  tags: "",
  image: "",
  content: "",
};

const normalizeTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const getTodayDateValue = (): string => new Date().toISOString().slice(0, 10);

const formatDateForInput = (value: string | undefined): string => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
};

const buildInputPayload = (state: BlogPostFormState): BlogPostInput => {
  const categoryId = Number(state.categoryId);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error("Selecione uma categoria válida antes de salvar o artigo.");
  }

  const image = state.image.trim();
  const content = state.content.trim();

  return {
    title: state.title.trim(),
    description: state.description.trim(),
    author: state.author.trim(),
    date: state.date.trim(),
    readTime: state.readTime.trim(),
    categoryId,
    slug: state.slug.trim(),
    image: image.length > 0 ? image : undefined,
    content: content.length > 0 ? content : undefined,
    tags: normalizeTags(state.tags),
  };
};

const formatDisplayDate = (value: string): string => {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return value;
};

const BlogPosts = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: posts = [],
    isLoading,
    isError,
  } = useBlogPosts();
  const {
    data: categories = [],
    isLoading: areCategoriesLoading,
    isError: hasCategoriesError,
  } = useBlogCategories();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formState, setFormState] = useState<BlogPostFormState>(DEFAULT_FORM_STATE);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return Number.isFinite(dateB) && Number.isFinite(dateA) ? dateB - dateA : a.title.localeCompare(b.title);
      }),
    [posts],
  );

  type FormOverrides = Partial<BlogPostFormState> & { imageName?: string | null };

  const resetForm = useCallback((overrides?: FormOverrides) => {
    const { imageName, ...formOverrides } = overrides ?? {};
    const mergedState = { ...DEFAULT_FORM_STATE, ...formOverrides };

    setFormState(mergedState);

    const hasImage = mergedState.image.trim().length > 0;
    setImagePreview(hasImage ? mergedState.image : null);
    setSelectedImageName(hasImage ? imageName ?? "Imagem atual" : null);
  }, []);

  useEffect(() => {
    if (!isDialogOpen) {
      setEditingPost(null);
      resetForm();
      return;
    }

    if (editingPost) {
      resetForm({
        title: editingPost.title,
        description: editingPost.description,
        author: editingPost.author,
        date: formatDateForInput(editingPost.date),
        readTime: editingPost.readTime,
        categoryId: editingPost.categoryId ? String(editingPost.categoryId) : "",
        slug: editingPost.slug,
        tags: editingPost.tags.join(", "),
        image: editingPost.image ?? "",
        content: editingPost.content ?? "",
        imageName: editingPost.image ? "Imagem atual" : null,
      });
      return;
    }

    resetForm({
      author: user?.nome_completo ?? "",
      date: getTodayDateValue(),
    });
  }, [editingPost, isDialogOpen, resetForm, user?.nome_completo]);

  const handleImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setFormState((prev) => ({ ...prev, image: "" }));
      setImagePreview(null);
      setSelectedImageName(null);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        toast({
          title: "Falha ao carregar imagem",
          description: "Não foi possível ler o arquivo selecionado. Tente novamente com outra imagem.",
          variant: "destructive",
        });
        return;
      }

      setFormState((prev) => ({ ...prev, image: result }));
      setImagePreview(result);
      setSelectedImageName(file.name);
    };

    reader.onerror = () => {
      toast({
        title: "Falha ao carregar imagem",
        description: "Não foi possível ler o arquivo selecionado. Tente novamente.",
        variant: "destructive",
      });
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  }, [toast]);

  const handleRemoveImage = useCallback(() => {
    setFormState((prev) => ({ ...prev, image: "" }));
    setImagePreview(null);
    setSelectedImageName(null);
  }, []);

  const createPostMutation = useMutation({
    mutationFn: async (input: BlogPostInput) => adminApi.createPost(input),
    onSuccess: (created) => {
      toast({
        title: "Artigo publicado",
        description: `O artigo “${created.title}” foi criado com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: blogPostKeys.list() });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao publicar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: BlogPostInput }) => adminApi.updatePost(id, input),
    onSuccess: (updated) => {
      toast({
        title: "Artigo atualizado",
        description: `O artigo “${updated.title}” foi atualizado com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: blogPostKeys.list() });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: string) => adminApi.deletePost(id),
    onSuccess: () => {
      toast({
        title: "Artigo removido",
        description: "O artigo foi excluído do blog.",
      });
      queryClient.invalidateQueries({ queryKey: blogPostKeys.list() });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = buildInputPayload(formState);

      if (editingPost) {
        updatePostMutation.mutate({ id: editingPost.id, input: payload });
        return;
      }

      createPostMutation.mutate(payload);
    } catch (error) {
      toast({
        title: "Não foi possível preparar o artigo",
        description:
          error instanceof Error
            ? error.message
            : "Revise os dados informados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const isSubmitting = createPostMutation.isPending || updatePostMutation.isPending;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Gestão de blog</h1>
          <p className="text-muted-foreground">
            Centralize a criação, edição e publicação dos artigos do site institucional.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            setEditingPost(null);
            setIsDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden /> Novo artigo
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Artigos publicados</CardTitle>
          <CardDescription>Visualize o desempenho dos conteúdos e mantenha o blog sempre atualizado.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Carregando artigos...
            </div>
          ) : isError ? (
            <Alert variant="destructive" className="m-6">
              <AlertTitle>Não foi possível carregar o blog</AlertTitle>
              <AlertDescription>
                Tente novamente em alguns instantes. Se o problema persistir, verifique a conexão com a API administrativa.
              </AlertDescription>
            </Alert>
          ) : sortedPosts.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Pencil className="h-5 w-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Nenhum artigo cadastrado ainda</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Inicie a publicação de conteúdos clicando no botão “Novo artigo” para aumentar o alcance do seu site.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>Publicado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPosts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{post.title}</p>
                          <p className="text-sm text-muted-foreground">{post.description}</p>
                          <div className="flex flex-wrap gap-2 pt-2">
                            {post.tags.map((tag) => (
                              <Badge key={`${post.id}-${tag}`} variant="outline" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{post.category}</TableCell>
                      <TableCell className="whitespace-nowrap">{post.author}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDisplayDate(post.date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingPost(post);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                            <span className="sr-only">Editar artigo</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                                <span className="sr-only">Excluir artigo</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir este artigo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não poderá ser desfeita. O artigo será removido imediatamente do blog público.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePostMutation.mutate(post.id)}
                                  disabled={deletePostMutation.isPending}
                                >
                                  {deletePostMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                                  ) : null}
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingPost ? "Editar artigo" : "Novo artigo"}</DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para publicar um novo conteúdo ou atualizar um artigo existente.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formState.title}
                  onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  placeholder="Ex.: Como a IA transforma o atendimento jurídico"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formState.categoryId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, categoryId: value }))}
                  disabled={areCategoriesLoading || hasCategoriesError}
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue
                      placeholder={
                        areCategoriesLoading
                          ? "Carregando categorias..."
                          : hasCategoriesError
                            ? "Não foi possível carregar as categorias"
                            : "Selecione uma categoria"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasCategoriesError ? (
                  <p className="text-sm text-destructive">Não foi possível carregar as categorias.</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Autor</Label>
                <Input
                  id="author"
                  value={formState.author}
                  readOnly
                  placeholder="Nome do especialista"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data de publicação</Label>
                <Input
                  id="date"
                  type="date"
                  value={formState.date}
                  onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readTime">Tempo de leitura</Label>
                <Input
                  id="readTime"
                  value={formState.readTime}
                  onChange={(event) => setFormState((prev) => ({ ...prev, readTime: event.target.value }))}
                  required
                  placeholder="Ex.: 6 min"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formState.slug}
                  onChange={(event) => setFormState((prev) => ({ ...prev, slug: event.target.value }))}
                  required
                  placeholder="ex.: ia-transforma-atendimento-juridico"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Imagem destacada</Label>
                <Input id="image" type="file" accept="image/*" onChange={handleImageChange} />
                <p className="text-xs text-muted-foreground">
                  Faça upload de uma imagem em formato PNG, JPG ou WEBP para destacar o artigo.
                </p>
                {selectedImageName ? (
                  <p className="text-xs text-muted-foreground">Imagem selecionada: {selectedImageName}</p>
                ) : null}
                {imagePreview ? (
                  <div className="flex items-start gap-3">
                    <img
                      src={imagePreview}
                      alt="Pré-visualização da imagem destacada"
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage}>
                      Remover imagem
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (separe com vírgula)</Label>
                <Input
                  id="tags"
                  value={formState.tags}
                  onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="automação, crm, tecnologia"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição breve</Label>
              <Textarea
                id="description"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                required
                placeholder="Resumo do conteúdo exibido nas listagens."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo completo</Label>
              <Textarea
                id="content"
                value={formState.content}
                onChange={(event) => setFormState((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Insira os parágrafos do artigo separados por linhas em branco."
                rows={8}
              />
            </div>

            <DialogFooter className="gap-2 sm:space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {editingPost ? "Salvar alterações" : "Publicar artigo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogPosts;
