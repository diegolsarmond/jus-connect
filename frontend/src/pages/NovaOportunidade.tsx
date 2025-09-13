import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";

const formSchema = z.object({
  partes: z.string().min(1, "Parte é obrigatória"),
  responsavel: z.string().min(1, "Responsável é obrigatório"),
  anotacoes: z.string().optional(),
  anotacoesGerais: z.string().optional(),
  grupoAcao: z.string().min(1, "Grupo de ação é obrigatório"),
  tipoAcao: z.string().min(1, "Tipo de ação é obrigatório"),
  fase: z.string().min(1, "Fase é obrigatória"),
  etapa: z.string().min(1, "Etapa é obrigatória"),
  numeroProcesso: z.string().optional(),
  numeroProtocolo: z.string().optional(),
  processoOriginario: z.string().optional(),
  identificacaoPasta: z.string().optional(),
  pastaCaso: z.string().optional(),
  dataRequerimento: z.string().optional(),
  expectativaValor: z.string().optional(),
  valorHonorarios: z.string().optional(),
  percentualHonorarios: z.string().optional(),
  contingenciamento: z.boolean().default(false),
});

interface Option {
  id: string;
  name: string;
}

export default function NovaOportunidade() {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
  const navigate = useNavigate();

  const [clients, setClients] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [tipos, setTipos] = useState<Option[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchJson = async (url: string): Promise<unknown[]> => {
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error();
          const data = await res.json();
          return Array.isArray(data)
            ? data
            : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data?.data?.rows)
            ? data.data.rows
            : Array.isArray(data?.data)
            ? data.data
            : [];
        };
        const clientsData = await fetchJson(`${apiUrl}/api/clientes`);
        setClients(
          clientsData.map((c) => {
            const item = c as { id: number | string; nome: string };
            return { id: String(item.id), name: item.nome };
          })
        );
        const usersData = await fetchJson(`${apiUrl}/api/usuarios`);
        setUsers(
          usersData.map((u) => {
            const item = u as { id: number | string; nome_completo: string };
            return { id: String(item.id), name: item.nome_completo };
          })
        );
        const tiposData = await fetchJson(`${apiUrl}/api/tipo-processos`);
        setTipos(
          tiposData.map((t) => {
            const item = t as { id: number | string; nome: string };
            return { id: String(item.id), name: item.nome };
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [apiUrl]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      partes: "",
      responsavel: "",
      anotacoes: "",
      anotacoesGerais: "",
      grupoAcao: "",
      tipoAcao: "",
      fase: "",
      etapa: "",
      numeroProcesso: "",
      numeroProtocolo: "",
      processoOriginario: "",
      identificacaoPasta: "",
      pastaCaso: "",
      dataRequerimento: "",
      expectativaValor: "",
      valorHonorarios: "",
      percentualHonorarios: "",
      contingenciamento: false,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);
    toast({ title: "Oportunidade criada com sucesso" });
    navigate("/pipeline");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nova Oportunidade</h1>
          <p className="text-muted-foreground">Crie uma nova oportunidade</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="partes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adicionar partes envolvidas</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
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
                name="responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
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
                name="grupoAcao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grupo de ação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="grupo1">Grupo 1</SelectItem>
                        <SelectItem value="grupo2">Grupo 2</SelectItem>
                        <SelectItem value="grupo3">Grupo 3</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipoAcao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de ação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tipos.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
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
                name="fase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fase</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fase1">Fase 1</SelectItem>
                        <SelectItem value="fase2">Fase 2</SelectItem>
                        <SelectItem value="fase3">Fase 3</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="etapa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Etapa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="etapa1">Etapa 1</SelectItem>
                        <SelectItem value="etapa2">Etapa 2</SelectItem>
                        <SelectItem value="etapa3">Etapa 3</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numeroProcesso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do processo CNJ</FormLabel>
                    <FormControl>
                      <Input placeholder="9999999-99.9999.9.99.9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numeroProtocolo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do protocolo/requerimento</FormLabel>
                    <FormControl>
                      <Input placeholder="123456789-0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="processoOriginario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Processo originário</FormLabel>
                    <FormControl>
                      <Input placeholder="9999999-99.9999.9.99.9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="identificacaoPasta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identificação da pasta</FormLabel>
                    <FormControl>
                      <Input placeholder="Identificação da pasta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pastaCaso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pasta/Caso</FormLabel>
                    <FormControl>
                      <Input placeholder="Pasta/Caso" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataRequerimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do requerimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expectativaValor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expectativa/Valor da causa</FormLabel>
                    <FormControl>
                      <Input placeholder="999.999,99" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valorHonorarios"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor dos honorários</FormLabel>
                    <FormControl>
                      <Input placeholder="999.999,99" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="percentualHonorarios"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Percentual de honorários (%)</FormLabel>
                    <FormControl>
                      <Input placeholder="99%" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contingenciamento"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Contingenciamento</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="anotacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anotações, tags, fatos e fundamentos</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="anotacoesGerais"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anotações gerais</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="bg-primary hover:bg-primary-hover">
                Criar novo processo
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

