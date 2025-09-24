import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";
import { getApiBaseUrl } from "@/lib/api";

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

interface ApiSupplier {
  id: number;
  nome: string;
  tipo: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  datacadastro: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  document: z.string().min(1, "CPF/CNPJ é obrigatório"),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  type: z.enum(["pf", "pj"]),
});

export default function EditarFornecedor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ufs, setUfs] = useState<{ sigla: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      document: "",
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      type: "pf",
    },
  });

  const formatDocument = (value: string, type: "pf" | "pj") => {
    const digits = value.replace(/\D/g, "");
    if (type === "pj") {
      return digits
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    }
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  };

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((res) => res.json())
      .then((data) => setUfs(data));
  }, []);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const url = joinUrl(apiUrl, `/api/fornecedores/${id}`);
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          throw new Error("Failed to fetch supplier");
        }
        const json: ApiSupplier = await response.json();
        const type: "pf" | "pj" =
          String(json.tipo) === "2" || ["J", "PJ"].includes(String(json.tipo).toUpperCase())
            ? "pj"
            : "pf";
        form.reset({
          name: json.nome,
          email: json.email ?? "",
          phone: json.telefone ? formatPhone(json.telefone) : "",
          document: json.documento ? formatDocument(json.documento, type) : "",
          cep: json.cep ?? "",
          street: json.rua ?? "",
          number: json.numero ?? "",
          complement: json.complemento ?? "",
          neighborhood: json.bairro ?? "",
          city: json.cidade ?? "",
          state: json.uf ?? "",
          type,
        });
      } catch (error) {
        console.error("Erro ao buscar fornecedor:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSupplier();
    }
  }, [id, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = joinUrl(apiUrl, `/api/fornecedores/${id}`);
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: values.name,
          tipo: values.type === "pj" ? "2" : "1",
          documento: values.document.replace(/\D/g, ""),
          email: values.email || null,
          telefone: values.phone ? values.phone.replace(/\D/g, "") : null,
          cep: values.cep || null,
          rua: values.street || null,
          numero: values.number || null,
          complemento: values.complement || null,
          bairro: values.neighborhood || null,
          cidade: values.city || null,
          uf: values.state || null,
          ativo: true,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to update supplier");
      }
      toast({ title: "Fornecedor atualizado com sucesso" });
      navigate(`/fornecedores/${id}`);
    } catch (error) {
      console.error("Erro ao atualizar fornecedor:", error);
      toast({ title: "Erro ao atualizar fornecedor", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Editar Fornecedor</h1>
          <p className="text-muted-foreground">Atualize as informações do fornecedor</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Física</SelectItem>
                      <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo ou razão social" {...field} />
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(11) 99999-9999"
                        {...field}
                        onChange={(event) => field.onChange(formatPhone(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{form.watch("type") === "pj" ? "CNPJ" : "CPF"}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          form.watch("type") === "pj" ? "00.000.000/0000-00" : "000.000.000-00"
                        }
                        {...field}
                        onChange={(event) =>
                          field.onChange(formatDocument(event.target.value, form.watch("type")))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000-000"
                        {...field}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/\D/g, "");
                          const masked = raw.replace(/(\d{5})(\d)/, "$1-$2").slice(0, 9);
                          field.onChange(masked);
                          if (raw.length === 8) {
                            fetch(`https://viacep.com.br/ws/${raw}/json/`)
                              .then((res) => res.json())
                              .then((data) => {
                                form.setValue("street", data.logradouro || "");
                                form.setValue("neighborhood", data.bairro || "");
                                form.setValue("city", data.localidade || "");
                                form.setValue("state", data.uf || "");
                              })
                              .catch((error) => console.error("Erro ao buscar CEP:", error));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rua</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="Número" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="complement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input placeholder="Apartamento, bloco, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="neighborhood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Bairro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Cidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ufs.map((uf) => (
                          <SelectItem key={uf.sigla} value={uf.sigla}>
                            {uf.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/fornecedores/${id}`)}>
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
