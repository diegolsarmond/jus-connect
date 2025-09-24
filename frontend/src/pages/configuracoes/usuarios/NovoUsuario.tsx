import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

const existingEmails = [
  "joao.silva@escritorio.com.br",
  "maria.santos@escritorio.com.br",
];

const formSchema = z.object({
  name: z.string().min(1, "Nome completo é obrigatório"),
  email: z
    .string()
    .email("Email inválido")
    .refine((email) => !existingEmails.includes(email), "Email já cadastrado"),
  perfilId: z.string().min(1, "Perfil é obrigatório"),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type ApiPerfil = {
  id: number;
  nome: string;
};

export default function NovoUsuario() {
  const navigate = useNavigate();
  const [perfis, setPerfis] = useState<ApiPerfil[]>([]);
  const { user } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      perfilId: "",
      phone: "",
    },
  });

  useEffect(() => {
    const extractArray = <T,>(value: unknown): T[] => {
      if (Array.isArray(value)) {
        return value as T[];
      }
      if (Array.isArray((value as { rows?: unknown })?.rows)) {
        return (value as { rows: T[] }).rows;
      }
      if (Array.isArray((value as { data?: unknown })?.data)) {
        return (value as { data: T[] }).data;
      }
      if (Array.isArray((value as { data?: { rows?: unknown } })?.data?.rows)) {
        return (value as { data: { rows: T[] } }).data.rows;
      }
      return [];
    };

    const fetchOptions = async () => {
      try {
        const perfisRes = await fetch(joinUrl(apiUrl, "/api/perfis"), {
          headers: { Accept: "application/json" },
        });

        if (!perfisRes.ok) {
          throw new Error("Não foi possível carregar os perfis");
        }

        const perfisJson = await perfisRes.json();

        setPerfis(extractArray<ApiPerfil>(perfisJson));
      } catch (error) {
        console.error("Erro ao carregar opções:", error);
        toast({ title: "Erro ao carregar dados", variant: "destructive" });
      }
    };

    fetchOptions();
  }, []);

  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      return;
    }

    const perfilId = Number(data.perfilId);
    const empresaId = user.empresa_id ?? null;

    const payload = {
      nome_completo: data.name,
      cpf: null,
      email: data.email,
      perfil: Number.isNaN(perfilId) ? null : perfilId,
      empresa: empresaId,
      oab: null,
      status: true,
      telefone: data.phone || null,
      ultimo_login: null,
      observacoes: null,
    };

    try {
      const url = joinUrl(apiUrl, "/api/usuarios");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Erro ao criar usuário");
      }
      toast({
        title: "Usuário criado",
        description: `Uma senha provisória será enviada automaticamente por e-mail para ${data.email}.`,
      });
      navigate("/configuracoes/usuarios");
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      toast({ title: "Erro ao criar usuário", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Novo Usuário</h1>
          <p className="text-muted-foreground">Cadastre um novo usuário</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        A senha provisória será gerada automaticamente e enviada por e-mail ao usuário
        após o cadastro.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="perfilId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {perfis.map((perfil) => (
                          <SelectItem key={perfil.id} value={String(perfil.id)}>
                            {perfil.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
