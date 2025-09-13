/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
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
  promovido_nome: z.string().optional(),
  promovido_cpf_cnpj: z.string().optional(),
  promovido_telefone: z.string().optional(),
  promovido_endereco: z.string().optional(),
  promovido_relacao: z.string().optional(),
  valor_causa: z.string().optional(),
  valor_honorarios: z.string().optional(),
  percentual_honorarios: z.string().optional(),
  forma_pagamento: z.string().optional(),
  contingenciamento: z.string().optional(),
  anotacoes_gerais: z.string().optional(),
  fatos_fundamentos: z.string().optional(),
  documentos_anexados: z.any().optional(),
  observacoes_internas: z.string().optional(),
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

export default function NovaOportunidade() {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
  const navigate = useNavigate();

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
      promovido_nome: "",
      promovido_cpf_cnpj: "",
      promovido_telefone: "",
      promovido_endereco: "",
      promovido_relacao: "",
      valor_causa: "",
      valor_honorarios: "",
      percentual_honorarios: "",
      forma_pagamento: "",
      contingenciamento: "",
      anotacoes_gerais: "",
      fatos_fundamentos: "",
      documentos_anexados: undefined,
      observacoes_internas: "",
      criado_por: "Sistema",
      data_criacao: new Date().toISOString().split("T")[0],
      ultima_atualizacao: new Date().toISOString().split("T")[0],
    },
  });

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

  const faseValue = form.watch("fase");
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

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);
    toast({ title: "Oportunidade criada com sucesso" });
    navigate("/pipeline");
  };

  const handleSelectClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (client) {
      form.setValue("solicitante_cpf_cnpj", client.cpf_cnpj || "");
      form.setValue("solicitante_email", client.email || "");
      form.setValue("solicitante_telefone", client.telefone || "");
      form.setValue("cliente_tipo", client.tipo || "");
    }
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

                      <FormField
                        control={form.control}
                        name="autor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Autor</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reu"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Réu</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="terceiro_interessado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Terceiro Interessado</FormLabel>
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
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                handleSelectClient(value);
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
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
                  <AccordionTrigger>Dados do Promovido</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="promovido_nome"
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
                        name="promovido_cpf_cnpj"
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
                        name="promovido_telefone"
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
                        name="promovido_endereco"
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
                        name="promovido_relacao"
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
                              <Input type="number" {...field} />
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
                              <Input type="number" {...field} />
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
                              <Input type="number" {...field} />
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

                <AccordionItem value="detalhes">
                  <AccordionTrigger>Detalhes</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="anotacoes_gerais"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Anotações Gerais</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="fatos_fundamentos"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Fatos e Fundamentos</FormLabel>
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

                      <FormField
                        control={form.control}
                        name="observacoes_internas"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Observações Internas</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
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

