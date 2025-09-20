/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/components/ui/use-toast";
import { getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";

const formSchema = z.object({
  tipo_processo: z.string().min(1, "Tipo de Processo é obrigatório"),
  area_atuacao: z.string().optional(),
  responsavel_interno: z.string().optional(),
  processo_distribuido: z.string().optional(),
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
  solicitante_id: z.string().optional(),
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
  qtde_parcelas: z.string().optional(),
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

const extractDigits = (value: string): string => value.replace(/\D/g, "");

const formatCpfCnpj = (value: string): string => {
  const digits = extractDigits(value).slice(0, 14);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  if (digits.length <= 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const formatPhone = (value: string): string => {
  const digits = extractDigits(value).slice(0, 11);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 2) {
    return digits;
  }

  const ddd = digits.slice(0, 2);
  const remainder = digits.slice(2);

  if (remainder.length <= 4) {
    return `(${ddd}) ${remainder}`;
  }

  if (digits.length === 11) {
    return `(${ddd}) ${remainder.slice(0, 5)}-${remainder.slice(5)}`;
  }

  return `(${ddd}) ${remainder.slice(0, 4)}-${remainder.slice(4)}`;
};

const parseSituacaoOptions = (data: unknown[]): Option[] => {
  const byId = new Map<string, Option>();

  data.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const id = record["id"];
    if (id === null || id === undefined) return;

    const ativo = record["ativo"];
    if (ativo !== undefined && ativo !== null && ativo !== true) return;

    const rawLabel = record["nome"] ?? record["name"];
    const label =
      typeof rawLabel === "string" && rawLabel.trim().length > 0
        ? rawLabel.trim()
        : String(id);

    byId.set(String(id), { id: String(id), name: label });
  });

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );
};

export default function NovaOportunidade() {
  const apiUrl = getApiBaseUrl();
  const navigate = useNavigate();
  const { user } = useAuth();

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
      processo_distribuido: "",
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
      solicitante_id: "",
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
      qtde_parcelas: "",
      contingenciamento: "",
      detalhes: "",
      documentos_anexados: undefined,
      criado_por: "",
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
              cpf_cnpj: extractDigits(item.documento ?? ""),
              email: item.email,
              telefone: extractDigits(item.telefone ?? ""),
              tipo:
                item.tipo === 1 || item.tipo === "1"
                  ? "Pessoa Física"
                  : item.tipo === 2 || item.tipo === "2"
                  ? "Pessoa Jurídica"
                  : undefined,
            } as ClientOption;
          })
        );

        const usersData = await fetchJson(`${apiUrl}/api/usuarios/empresa`);
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

        const situacoesData = await fetchJson(`${apiUrl}/api/situacao-propostas`);
        setSituacoes(parseSituacaoOptions(situacoesData));

      } catch (e) {
        console.error(e);
        setSituacoes([]);
      }
    };
    fetchData();
  }, [apiUrl]);

  const faseValue = form.watch("fase");
  const formaPagamento = form.watch("forma_pagamento");
  const processoDistribuido = form.watch("processo_distribuido");
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

  useEffect(() => {
    if (processoDistribuido === "sim") return;

    const fieldsToClear: Array<
      | "numero_protocolo"
      | "vara_ou_orgao"
      | "comarca"
    > = ["numero_protocolo", "vara_ou_orgao", "comarca"];

    fieldsToClear.forEach((fieldName) => {
      if (form.getValues(fieldName)) {
        form.setValue(fieldName, "");
      }
    });
  }, [processoDistribuido, form]);

  useEffect(() => {
    if (typeof user?.id === "number") {
      form.setValue("criado_por", String(user.id), {
        shouldDirty: false,
        shouldTouch: false,
      });
    } else {
      form.setValue("criado_por", "", {

        shouldDirty: false,
        shouldTouch: false,
      });
    }
  }, [user, form]);

  const parseOptionalInteger = (value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    const normalized = Math.trunc(parsed);
    return normalized > 0 ? normalized : null;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const isProcessoDistribuido = values.processo_distribuido === "sim";
      const solicitanteIdRaw = values.solicitante_id?.trim();
      const solicitanteId =
        solicitanteIdRaw && !Number.isNaN(Number(solicitanteIdRaw))
          ? Number(solicitanteIdRaw)
          : null;

      const envolvidosLimpos =
        values.envolvidos?.map((envolvido) => {
          const nome = envolvido.nome?.trim() || "";
          const cpfCnpjDigits = extractDigits(envolvido.cpf_cnpj || "");
          const telefoneDigits = extractDigits(envolvido.telefone || "");
          const endereco = envolvido.endereco?.trim() || "";
          const relacao = envolvido.relacao || "";

          return {
            nome,
            cpf_cnpj: cpfCnpjDigits,
            telefone: telefoneDigits,
            endereco,
            relacao,
          };
        }) || [];

      const envolvidosFiltrados = envolvidosLimpos.filter(
        (envolvido) =>
          envolvido.nome ||
          envolvido.cpf_cnpj ||
          envolvido.telefone ||
          envolvido.endereco ||
          envolvido.relacao
      );

      const payload = {
        tipo_processo_id: Number(values.tipo_processo),
        area_atuacao_id: values.area_atuacao ? Number(values.area_atuacao) : null,
        responsavel_id: values.responsavel_interno
          ? Number(values.responsavel_interno)
          : null,
        numero_protocolo: isProcessoDistribuido
          ? values.numero_protocolo || null
          : null,
        vara_ou_orgao: isProcessoDistribuido ? values.vara_ou_orgao || null : null,
        comarca: isProcessoDistribuido ? values.comarca || null : null,
        fase_id: values.fase ? Number(values.fase) : null,
        etapa_id: values.etapa ? Number(values.etapa) : null,
        prazo_proximo: values.prazo_proximo || null,
        status_id: values.status ? Number(values.status) : null,
        solicitante_id: solicitanteId,
        valor_causa: parseCurrency(values.valor_causa || ""),
        valor_honorarios: parseCurrency(values.valor_honorarios || ""),
        percentual_honorarios: parsePercent(values.percentual_honorarios || ""),
        forma_pagamento: values.forma_pagamento || null,
          qtde_parcelas: values.qtde_parcelas ? Number(values.qtde_parcelas) : null,
        contingenciamento: values.contingenciamento || null,
        detalhes: values.detalhes || null,
        documentos_anexados: null,
        criado_por:
          typeof user?.id === "number"
            ? user.id
            : parseOptionalInteger(values.criado_por),
        envolvidos: envolvidosFiltrados,
      };

      const res = await fetch(`${apiUrl}/api/oportunidades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      toast({ title: "Oportunidade criada com sucesso" });
      navigate("/pipeline");
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao criar oportunidade", variant: "destructive" });
    }
  };

  const handleSelectClient = (name: string) => {
    const normalizedName = name.trim();
    const client = clients.find((c) => c.name === normalizedName);
    if (client) {
      form.setValue("solicitante_id", client.id, {
        shouldDirty: true,
        shouldTouch: true,
      });
      form.setValue("solicitante_cpf_cnpj", extractDigits(client.cpf_cnpj || ""));
      form.setValue("solicitante_email", client.email || "");
      form.setValue("solicitante_telefone", extractDigits(client.telefone || ""));
      form.setValue("cliente_tipo", client.tipo || "");
      form.setValue("solicitante_nome", client.name, {
        shouldDirty: true,
        shouldTouch: true,
      });
    } else {
      form.setValue("solicitante_id", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      if (normalizedName.length === 0) {
        form.setValue("solicitante_nome", "", {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
      form.setValue("solicitante_cpf_cnpj", "");
      form.setValue("solicitante_email", "");
      form.setValue("solicitante_telefone", "");
      form.setValue("cliente_tipo", "");
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
          <h1 className="text-3xl font-bold text-foreground">Nova Oportunidade</h1>
          <p className="text-muted-foreground">Crie uma nova oportunidade</p>
        </div>
        <Button variant="outline" type="button" onClick={() => navigate("/pipeline")}>Cancelar</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="fluxo-processo">
                  <AccordionTrigger>DADOS DA PROPOSTA</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fluxo de Trabalho</FormLabel>
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
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Situação da Proposta</FormLabel>
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
                  <AccordionTrigger>CLIENTE SOLICITANTE</AccordionTrigger>
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
                              <Input
                                name={field.name}
                                value={formatCpfCnpj(field.value || "")}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                disabled
                                readOnly
                              />
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
                              <Input
                                name={field.name}
                                value={formatPhone(field.value || "")}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                disabled
                                readOnly
                              />
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

                <AccordionItem value="honorarios">
                  <AccordionTrigger>HONORÁRIOS</AccordionTrigger>
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

                      <FormField
                        control={form.control}
                        name="prazo_proximo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data da Cobrança</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {formaPagamento === "Parcelado" && (
                        <FormField
                          control={form.control}
                            name="qtde_parcelas"
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

                
                <AccordionItem value="dados-processo">
                  <AccordionTrigger>DADOS DO PROCESSO</AccordionTrigger>
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
                        name="processo_distribuido"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Processo já foi distribuído?</FormLabel>
                            <FormControl>
                              <RadioGroup
                                className="flex flex-col sm:flex-row gap-4"
                                onValueChange={field.onChange}
                                value={field.value || ""}
                              >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem
                                      value="sim"
                                      id="processo-distribuido-sim"
                                    />
                                  </FormControl>
                                  <FormLabel
                                    className="font-normal"
                                    htmlFor="processo-distribuido-sim"
                                  >
                                    Sim
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem
                                      value="nao"
                                      id="processo-distribuido-nao"
                                    />
                                  </FormControl>
                                  <FormLabel
                                    className="font-normal"
                                    htmlFor="processo-distribuido-nao"
                                  >
                                    Não
                                  </FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {processoDistribuido === "sim" && (
                        <>
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
                        </>
                      )}

                </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dados-promovido">
                  <AccordionTrigger>ENVOLVIDOS COM O PROCESSO</AccordionTrigger>
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
                                <Input
                                  name={field.name}
                                  value={formatCpfCnpj(field.value || "")}
                                  onChange={(event) =>
                                    field.onChange(
                                      extractDigits(event.target.value)
                                    )
                                  }
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  inputMode="numeric"
                                />
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
                                <Input
                                  name={field.name}
                                  value={formatPhone(field.value || "")}
                                  onChange={(event) =>
                                    field.onChange(
                                      extractDigits(event.target.value)
                                    )
                                  }
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  inputMode="tel"
                                />
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
                                  <SelectItem value="Autor">Autor</SelectItem>
                                  <SelectItem value="Promovente">Promovente</SelectItem>
                                  <SelectItem value="Promovido">Promovido</SelectItem>
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
                  <AccordionTrigger>DETALHES</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="detalhes"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Descreva as Informações do Processo</FormLabel>
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

                <AccordionItem value="metadados">
                  <AccordionTrigger>SISTEMA</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="criado_por"
                        render={({ field }) => {
                          const createdByName = user?.nome_completo?.trim() ?? "";

                          return (
                            <FormItem>
                              <FormLabel>Criado por</FormLabel>
                              <input
                                type="hidden"
                                name={field.name}
                                value={field.value ?? ""}
                                onBlur={field.onBlur}
                                onChange={field.onChange}
                                ref={field.ref}
                              />
                              <FormControl>
                                <Input disabled value={createdByName} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
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
