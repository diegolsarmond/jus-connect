/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/components/ui/use-toast";

const formSchema = z.object({
  tipo_processo: z.string().min(1, "Tipo de Processo é obrigatório"),
  area_atuacao: z.string().optional(),
  responsavel_interno: z.string().optional(),
  numero_processo_cnj: z.string().optional(),
  numero_protocolo: z.string().optional(),
  vara_ou_orgao: z.string().optional(),
  comarca: z.string().optional(),
  autor: z.string().optional(),
  reu: z.string().optional(),
  terceiro_interessado: z.string().optional(),
  fase: z.string().optional(),
  etapa: z.string().optional(),
  prazo_proximo: z.string().optional(),
  status: z.string().optional(),
  solicitante_nome: z.string().optional(),
  solicitante_cpf_cnpj: z.string().optional(),
  solicitante_email: z.string().optional(),
  solicitante_telefone: z.string().optional(),
  cliente_tipo: z.string().optional(),
  envolvidos: z
    .array(
      z.object({
        nome: z.string().optional(),
        cpf_cnpj: z.string().optional(),
        telefone: z.string().optional(),
        endereco: z.string().optional(),
        relacao: z.string().optional(),
      }),
    )
    .optional(),
  valor_causa: z.string().optional(),
  valor_honorarios: z.string().optional(),
  percentual_honorarios: z.string().optional(),
  forma_pagamento: z.string().optional(),
  parcelas: z.string().optional(),
  contingenciamento: z.string().optional(),
  detalhes: z.string().optional(),
  documentos_anexados: z.any().optional(),
  criado_por: z.string().optional(),
  data_criacao: z.string().optional(),
  ultima_atualizacao: z.string().optional(),
});

interface Option {
  id: string;
  name: string;
}

interface ClientOption extends Option {
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  tipo?: string;
}

export default function EditarOportunidade() {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [tipos, setTipos] = useState<Option[]>([]);
  const [areas, setAreas] = useState<Option[]>([]);
  const [fluxos, setFluxos] = useState<Option[]>([]);
  const [etapas, setEtapas] = useState<Option[]>([]);
  const [situacoes, setSituacoes] = useState<Option[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_processo: "",
      area_atuacao: "",
      responsavel_interno: "",
      numero_processo_cnj: "",
      numero_protocolo: "",
      vara_ou_orgao: "",
      comarca: "",
      autor: "",
      reu: "",
      terceiro_interessado: "",
      fase: "",
      etapa: "",
      prazo_proximo: "",
      status: "",
      solicitante_nome: "",
      solicitante_cpf_cnpj: "",
      solicitante_email: "",
      solicitante_telefone: "",
      cliente_tipo: "",
      envolvidos: [
        { nome: "", cpf_cnpj: "", telefone: "", endereco: "", relacao: "" },
      ],
      valor_causa: "",
      valor_honorarios: "",
      percentual_honorarios: "",
      forma_pagamento: "",
      parcelas: "",
      contingenciamento: "",
      detalhes: "",
      documentos_anexados: undefined,
      criado_por: "Sistema",
      data_criacao: new Date().toISOString().split("T")[0],
      ultima_atualizacao: new Date().toISOString().split("T")[0],
    },
  });

  const {
    fields: envolvidosFields,
    append: addEnvolvido,
    remove: removeEnvolvido,
  } = useFieldArray({ control: form.control, name: "envolvidos" });

  const fetchJson = async (url: string): Promise<unknown[]> => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.rows)
      ? (data as any).rows
      : Array.isArray((data as any)?.data?.rows)
      ? (data as any).data.rows
      : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const clientsData = await fetchJson(`${apiUrl}/api/clientes`);
        setClients(
          clientsData.map((c) => {
            const item = c as any;
            return {
              id: String(item.id),
              name: item.nome,
              cpf_cnpj: item.documento,
              email: item.email,
              telefone: item.telefone,
              tipo:
                item.tipo === 1 || item.tipo === "1"
                  ? "Pessoa Física"
                  : item.tipo === 2 || item.tipo === "2"
                  ? "Pessoa Jurídica"
                  : undefined,
            } as ClientOption;
          })
        );

        const usersData = await fetchJson(`${apiUrl}/api/usuarios`);
        setUsers(
          usersData.map((u) => {
            const item = u as any;
            return { id: String(item.id), name: item.nome_completo } as Option;
          })
        );

        const tiposData = await fetchJson(`${apiUrl}/api/tipo-processos`);
        setTipos(
          tiposData.map((t) => {
            const item = t as any;
            return { id: String(item.id), name: item.nome } as Option;
          })
        );

        const areasData = await fetchJson(`${apiUrl}/api/areas`);
        setAreas(
          areasData.map((a) => {
            const item = a as any;
            return { id: String(item.id), name: item.nome } as Option;
          })
        );

        const fluxosData = await fetchJson(`${apiUrl}/api/fluxos-trabalho`);
        setFluxos(
          fluxosData.map((f) => {
            const item = f as any;
            return { id: String(item.id), name: item.nome } as Option;
          })
        );

        const situacoesData = await fetchJson(`${apiUrl}/api/situacoes-processo`);
        setSituacoes(
          situacoesData.map((s) => {
            const item = s as any;
            return { id: String(item.id), name: item.nome } as Option;
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [apiUrl]);

  useEffect(() => {
    const fetchOportunidade = async () => {
      if (!id) return;
      try {
        const res = await fetch(`${apiUrl}/api/oportunidades/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        form.reset({
          tipo_processo: data.tipo_processo_id ? String(data.tipo_processo_id) : "",
          area_atuacao: data.area_atuacao_id ? String(data.area_atuacao_id) : "",
          responsavel_interno: data.responsavel_id ? String(data.responsavel_id) : "",
          numero_processo_cnj: data.numero_processo_cnj || "",
          numero_protocolo: data.numero_protocolo || "",
          vara_ou_orgao: data.vara_ou_orgao || "",
          comarca: data.comarca || "",
          autor: data.autor || "",
          reu: data.reu || "",
          terceiro_interessado: data.terceiro_interessado || "",
          fase: data.fase_id ? String(data.fase_id) : "",
          etapa: data.etapa_id ? String(data.etapa_id) : "",
          prazo_proximo: data.prazo_proximo ? data.prazo_proximo.substring(0, 10) : "",
          status: data.status_id ? String(data.status_id) : "",
          solicitante_nome: data.solicitante_nome || "",
          solicitante_cpf_cnpj: data.solicitante_cpf_cnpj || "",
          solicitante_email: data.solicitante_email || "",
          solicitante_telefone: data.solicitante_telefone || "",
          cliente_tipo: data.cliente_tipo || "",
          envolvidos:
            data.envolvidos && data.envolvidos.length > 0
              ? data.envolvidos.map((env: any) => ({
                  nome: env.nome || "",
                  cpf_cnpj: env.cpf_cnpj || env.documento || "",
                  telefone: env.telefone || "",
                  endereco: env.endereco || "",
                  relacao: env.relacao || "",
                }))
              : [{ nome: "", cpf_cnpj: "", telefone: "", endereco: "", relacao: "" }],
          valor_causa: data.valor_causa ? String(data.valor_causa) : "",
          valor_honorarios: data.valor_honorarios ? String(data.valor_honorarios) : "",
          percentual_honorarios: data.percentual_honorarios
            ? String(data.percentual_honorarios)
            : "",
          forma_pagamento: data.forma_pagamento || "",
          parcelas: data.parcelas ? String(data.parcelas) : "",
          contingenciamento: data.contingenciamento || "",
          detalhes: data.detalhes || "",
          documentos_anexados: undefined,
          criado_por: data.criado_por || "",
          data_criacao: data.data_criacao ? data.data_criacao.substring(0, 10) : "",
          ultima_atualizacao: data.ultima_atualizacao
            ? data.ultima_atualizacao.substring(0, 10)
            : "",
        });

        if (data.solicitante_id) {
          try {
            const resCliente = await fetch(
              `${apiUrl}/api/clientes/${data.solicitante_id}`
            );
            if (resCliente.ok) {
              const cliente = await resCliente.json();
              form.setValue("solicitante_nome", cliente.nome || "");
              form.setValue("solicitante_cpf_cnpj", cliente.documento || "");
              form.setValue("solicitante_email", cliente.email || "");
              form.setValue("solicitante_telefone", cliente.telefone || "");
              form.setValue(
                "cliente_tipo",
                cliente.tipo === 1 || cliente.tipo === "1"
                  ? "Pessoa Física"
                  : cliente.tipo === 2 || cliente.tipo === "2"
                  ? "Pessoa Jurídica"
                  : ""
              );
            }
          } catch (err) {
            console.error(err);
          }
        }
      } catch (e) {
        console.error(e);
        toast({ title: "Erro ao carregar oportunidade", variant: "destructive" });
      }
    };
    fetchOportunidade();
  }, [id, apiUrl, form]);

  const faseValue = form.watch("fase");
  const formaPagamento = form.watch("forma_pagamento");
  useEffect(() => {
    if (!faseValue) return;
    const loadEtapas = async () => {
      try {
        const data = await fetchJson(`${apiUrl}/api/etiquetas/fluxos-trabalho/${faseValue}`);
        setEtapas(
          data.map((e) => {
            const item = e as any;
            return { id: String(item.id), name: item.nome } as Option;
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    loadEtapas();
  }, [faseValue, apiUrl]);

  const parseCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits ? Number(digits) / 100 : null;
  };

  const parsePercent = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits ? Number(digits) : null;
  };

  const valorCausaWatch = form.watch("valor_causa");
  const valorHonorariosWatch = form.watch("valor_honorarios");
  useEffect(() => {
    const vc = parseCurrency(valorCausaWatch || "");
    const vh = parseCurrency(valorHonorariosWatch || "");
    if (vc && vc > 0 && vh !== null) {
      const percent = Math.round((vh / vc) * 100);
      form.setValue("percentual_honorarios", `${percent}%`);
    }
  }, [valorCausaWatch, valorHonorariosWatch, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const payload = {
        tipo_processo_id: Number(values.tipo_processo),
        area_atuacao_id: values.area_atuacao ? Number(values.area_atuacao) : null,
        responsavel_id: values.responsavel_interno
          ? Number(values.responsavel_interno)
          : null,
        numero_processo_cnj: values.numero_processo_cnj || null,
        numero_protocolo: values.numero_protocolo || null,
        vara_ou_orgao: values.vara_ou_orgao || null,
        comarca: values.comarca || null,
        fase_id: values.fase ? Number(values.fase) : null,
        etapa_id: values.etapa ? Number(values.etapa) : null,
        prazo_proximo: values.prazo_proximo || null,
        status_id: values.status ? Number(values.status) : null,
        solicitante_id: null,
        valor_causa: parseCurrency(values.valor_causa || ""),
        valor_honorarios: parseCurrency(values.valor_honorarios || ""),
        percentual_honorarios: parsePercent(values.percentual_honorarios || ""),
        forma_pagamento: values.forma_pagamento || null,
        parcelas: values.parcelas ? Number(values.parcelas) : null,
        contingenciamento: values.contingenciamento || null,
        detalhes: values.detalhes || null,
        documentos_anexados: null,
        criado_por: null,
        envolvidos:
          values.envolvidos?.filter(
            (e) =>
              e.nome || e.cpf_cnpj || e.telefone || e.endereco || e.relacao
          ) || [],
      };

      const res = await fetch(`${apiUrl}/api/oportunidades/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      toast({ title: "Oportunidade atualizada com sucesso" });
      navigate(`/pipeline/oportunidade/${id}`);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao atualizar oportunidade", variant: "destructive" });
    }
  };

  const handleSelectClient = (name: string) => {
    const client = clients.find((c) => c.name === name);
    if (client) {
      form.setValue("solicitante_cpf_cnpj", client.cpf_cnpj || "");
      form.setValue("solicitante_email", client.email || "");
      form.setValue("solicitante_telefone", client.telefone || "");
      form.setValue("cliente_tipo", client.tipo || "");
    }
  };

  const formatCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const number = Number(digits) / 100;
    return number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatPercent = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits ? `${digits}%` : "";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Editar Oportunidade</h1>
          <p className="text-muted-foreground">Atualize os dados da oportunidade</p>
        </div>
        <Button
          variant="outline"
          type="button"
          onClick={() => navigate(`/pipeline/oportunidade/${id}`)}
        >
          Cancelar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="dados-processo">
                  <AccordionTrigger>Dados do Processo</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="tipo_processo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Processo</FormLabel>
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
                        name="area_atuacao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Área de Atuação</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {areas.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name}
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
                        name="responsavel_interno"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Responsável</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
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
                        name="numero_processo_cnj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número do Processo (CNJ)</FormLabel>
                            <FormControl>
                              <Input placeholder="0000000-00.0000.0.00.0000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="numero_protocolo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número do Protocolo/Requerimento</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vara_ou_orgao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vara/Órgão</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="comarca"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Comarca</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="fluxo-processo">
                  <AccordionTrigger>Fluxo do Processo</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                {fluxos.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.name}
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
                                {etapas.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.name}
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
                        name="prazo_proximo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Próximo Prazo</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {situacoes.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dados-solicitante">
                  <AccordionTrigger>Dados do Solicitante</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="solicitante_nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input
                                list="solicitante-options"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  handleSelectClient(e.target.value);
                                }}
                              />
                            </FormControl>
                            <datalist id="solicitante-options">
                              {clients.map((c) => (
                                <option key={c.id} value={c.name} />
                              ))}
                            </datalist>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="solicitante_cpf_cnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF/CNPJ</FormLabel>
                            <FormControl>
                              <Input disabled {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="solicitante_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input disabled {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="solicitante_telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input disabled {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="cliente_tipo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Cliente</FormLabel>
                            <FormControl>
                              <Input disabled {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dados-promovido">
                  <AccordionTrigger>Dados dos Envolvidos</AccordionTrigger>
                  <AccordionContent>
                    {envolvidosFields.map((item, index) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 mb-4 rounded-md"
                      >
                        <FormField
                          control={form.control}
                          name={`envolvidos.${index}.nome`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`envolvidos.${index}.cpf_cnpj`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPF/CNPJ</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`envolvidos.${index}.telefone`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telefone</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`envolvidos.${index}.endereco`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Endereço</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`envolvidos.${index}.relacao`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Relação com o processo</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Réu">Réu</SelectItem>
                                  <SelectItem value="Reclamante">Reclamante</SelectItem>
                                  <SelectItem value="Exequente">Exequente</SelectItem>
                                  <SelectItem value="Outro">Outro</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex md:col-span-2 justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => removeEnvolvido(index)}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      onClick={() =>
                        addEnvolvido({
                          nome: "",
                          cpf_cnpj: "",
                          telefone: "",
                          endereco: "",
                          relacao: "",
                        })
                      }
                    >
                      Adicionar Envolvido
                    </Button>
                  </AccordionContent>
                </AccordionItem>

               

                <AccordionItem value="detalhes">
                  <AccordionTrigger>Detalhes</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="detalhes"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Detalhes</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="documentos_anexados"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Documentos Anexados</FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                multiple
                                onChange={(e) => field.onChange(e.target.files)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="honorarios">
                  <AccordionTrigger>Honorários</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="valor_causa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expectativa / Valor da Causa</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value}
                                onChange={(e) => field.onChange(formatCurrency(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="valor_honorarios"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor dos Honorários</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value}
                                onChange={(e) => field.onChange(formatCurrency(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="percentual_honorarios"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Percentual de Honorários</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="w-24"
                                value={field.value}
                                onChange={(e) => field.onChange(formatPercent(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="forma_pagamento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Forma de Pagamento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="À vista">À vista</SelectItem>
                                <SelectItem value="Parcelado">Parcelado</SelectItem>
                                <SelectItem value="Sucumbência">Sucumbência</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {formaPagamento === "Parcelado" && (
                        <FormField
                          control={form.control}
                          name="parcelas"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número de Parcelas</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {[...Array(12)].map((_, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>
                                      {i + 1}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="contingenciamento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contingenciamento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Provável / Chance Alta">
                                  Provável / Chance Alta
                                </SelectItem>
                                <SelectItem value="Possível / Talvez">
                                  Possível / Talvez
                                </SelectItem>
                                <SelectItem value="Remota / Difícil">
                                  Remota / Difícil
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="metadados">
                  <AccordionTrigger>Metadados</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="criado_por"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Criado por</FormLabel>
                            <FormControl>
                              <Input disabled {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="data_criacao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de Criação</FormLabel>
                            <FormControl>
                              <Input type="date" disabled {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ultima_atualizacao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Última Atualização</FormLabel>
                            <FormControl>
                              <Input type="date" disabled {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="pt-4">
                <Button type="submit" className="bg-primary hover:bg-primary-hover">
                  Criar novo processo
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

