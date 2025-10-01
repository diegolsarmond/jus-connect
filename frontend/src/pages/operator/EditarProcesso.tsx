import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { toast } from "@/components/ui/use-toast";
import { getApiUrl } from "@/lib/api";

const tipoOptionsBase = ["Cível", "Criminal"];
const participacaoOptions = ["Requerente", "Requerido", "Réu", "Autor"];
const areaOptionsBase = ["Trabalhista", "Previdencia", "Criminal", "Familia"];
const statusOptionsBase = ["Em andamento", "Encerrado"];

const formSchema = z.object({
  number: z.string().optional(),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  participacao: z.string().min(1, "Participação é obrigatória"),
  areaAtuacao: z.string().min(1, "Área de atuação é obrigatória"),
  nomeReu: z.string().optional(),
  documentoReu: z.string().optional(),
  enderecoReu: z.string().optional(),
  numeroReu: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  cep: z.string().optional(),
  valorCausa: z.string().optional(),
  descricaoFatos: z.string().optional(),
  pedidos: z.string().optional(),
  status: z.string().min(1, "Situação é obrigatória"),
});

interface ApiProcessoDetalhe {
  id?: number | string | null;
  cliente_id?: number | string | null;
  numero?: string | null;
  tipo?: string | null;
  status?: string | null;
  municipio?: string | null;
  uf?: string | null;
  orgao_julgador?: string | null;
  classe_judicial?: string | null;
  assunto?: string | null;
  jurisdicao?: string | null;
  advogado_responsavel?: string | null;
  data_distribuicao?: string | null;
  oportunidade_id?: number | string | null;
  cliente?: { nome?: string | null } | null;
  advogados?: Array<{ id?: number | string | null }> | null;
}

interface ProcessoDetalhe {
  id: number;
  clienteId: number;
  numero: string;
  tipo: string | null;
  status: string | null;
  municipio: string | null;
  uf: string | null;
  orgaoJulgador: string | null;
  classeJudicial: string | null;
  assunto: string | null;
  jurisdicao: string | null;
  advogadoResponsavel: string | null;
  dataDistribuicao: string | null;
  oportunidadeId: number | null;
  clienteNome: string | null;
  advogados: number[];
}

const defaultValues: z.infer<typeof formSchema> = {
  number: "",
  tipo: "Cível",
  participacao: "Requerente",
  areaAtuacao: "Trabalhista",
  nomeReu: "",
  documentoReu: "",
  enderecoReu: "",
  numeroReu: "",
  bairro: "",
  cidade: "",
  cep: "",
  valorCausa: "",
  descricaoFatos: "",
  pedidos: "",
  status: "Em andamento",
};

function parsePositiveInteger(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

const EditarProcesso = () => {
  const { processoId } = useParams<{ processoId: string }>();
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [processo, setProcesso] = useState<ProcessoDetalhe | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const tipoOptions = useMemo(() => {
    if (processo?.tipo && !tipoOptionsBase.includes(processo.tipo)) {
      return [processo.tipo, ...tipoOptionsBase];
    }
    return [...tipoOptionsBase];
  }, [processo?.tipo]);

  const areaOptions = useMemo(() => {
    if (processo?.classeJudicial && !areaOptionsBase.includes(processo.classeJudicial)) {
      return [processo.classeJudicial, ...areaOptionsBase];
    }
    return [...areaOptionsBase];
  }, [processo?.classeJudicial]);

  const statusOptions = useMemo(() => {
    if (processo?.status && !statusOptionsBase.includes(processo.status)) {
      return [processo.status, ...statusOptionsBase];
    }
    return [...statusOptionsBase];
  }, [processo?.status]);

  useEffect(() => {
    const carregarProcesso = async () => {
      if (!processoId) {
        setErroCarregamento("Processo não encontrado");
        setCarregando(false);
        return;
      }

      setCarregando(true);
      setErroCarregamento(null);

      try {
        const resposta = await fetch(getApiUrl(`processos/${processoId}`), {
          headers: { Accept: "application/json" },
        });

        if (!resposta.ok) {
          throw new Error(`Falha ao carregar processo (${resposta.status})`);
        }

        const json = (await resposta.json()) as ApiProcessoDetalhe;

        const id = parsePositiveInteger(json.id);
        const clienteId = parsePositiveInteger(json.cliente_id);

        if (!id || !clienteId) {
          throw new Error("Dados do processo inválidos");
        }

        const oportunidadeId = parsePositiveInteger(json.oportunidade_id);
        const advogados = Array.isArray(json.advogados)
          ? json.advogados
              .map((adv) => parsePositiveInteger(adv?.id ?? null))
              .filter((value): value is number => value !== null)
          : [];

        const processoDetalhe: ProcessoDetalhe = {
          id,
          clienteId,
          numero: typeof json.numero === "string" ? json.numero : "",
          tipo: typeof json.tipo === "string" ? json.tipo : null,
          status: typeof json.status === "string" ? json.status : null,
          municipio: typeof json.municipio === "string" ? json.municipio : null,
          uf: typeof json.uf === "string" ? json.uf : null,
          orgaoJulgador:
            typeof json.orgao_julgador === "string" ? json.orgao_julgador : null,
          classeJudicial:
            typeof json.classe_judicial === "string" ? json.classe_judicial : null,
          assunto: typeof json.assunto === "string" ? json.assunto : null,
          jurisdicao: typeof json.jurisdicao === "string" ? json.jurisdicao : null,
          advogadoResponsavel:
            typeof json.advogado_responsavel === "string"
              ? json.advogado_responsavel
              : null,
          dataDistribuicao:
            typeof json.data_distribuicao === "string" ? json.data_distribuicao : null,
          oportunidadeId: oportunidadeId ?? null,
          clienteNome:
            typeof json.cliente?.nome === "string" ? json.cliente?.nome : null,
          advogados,
        };

        const resolvedTipoOptions =
          processoDetalhe.tipo && !tipoOptionsBase.includes(processoDetalhe.tipo)
            ? [processoDetalhe.tipo, ...tipoOptionsBase]
            : [...tipoOptionsBase];

        const resolvedStatusOptions =
          processoDetalhe.status && !statusOptionsBase.includes(processoDetalhe.status)
            ? [processoDetalhe.status, ...statusOptionsBase]
            : [...statusOptionsBase];

        const resolvedAreaOptions =
          processoDetalhe.classeJudicial &&
          !areaOptionsBase.includes(processoDetalhe.classeJudicial)
            ? [processoDetalhe.classeJudicial, ...areaOptionsBase]
            : [...areaOptionsBase];

        const tipo =
          processoDetalhe.tipo && resolvedTipoOptions.includes(processoDetalhe.tipo)
            ? processoDetalhe.tipo
            : resolvedTipoOptions[0];

        const status =
          processoDetalhe.status && resolvedStatusOptions.includes(processoDetalhe.status)
            ? processoDetalhe.status
            : resolvedStatusOptions[0];

        const areaAtuacao =
          processoDetalhe.classeJudicial &&
          resolvedAreaOptions.includes(processoDetalhe.classeJudicial)
            ? processoDetalhe.classeJudicial
            : resolvedAreaOptions[0];

        form.reset({
          number: processoDetalhe.numero,
          tipo,
          participacao: "Requerente",
          areaAtuacao,
          nomeReu: processoDetalhe.advogadoResponsavel ?? "",
          documentoReu: "",
          enderecoReu: processoDetalhe.orgaoJulgador ?? "",
          numeroReu: "",
          bairro: processoDetalhe.jurisdicao ?? "",
          cidade: processoDetalhe.municipio ?? "",
          cep: "",
          valorCausa: "",
          descricaoFatos: processoDetalhe.assunto ?? "",
          pedidos: "",
          status,
        });

        setProcesso(processoDetalhe);
      } catch (error) {
        const mensagem =
          error instanceof Error ? error.message : "Erro ao carregar dados do processo";
        setErroCarregamento(mensagem);
        toast({ title: "Erro ao carregar processo", description: mensagem, variant: "destructive" });
      } finally {
        setCarregando(false);
      }
    };

    void carregarProcesso();
  }, [form, processoId]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!processoId || !processo) {
      toast({ title: "Processo não encontrado", variant: "destructive" });
      return;
    }

    const numero = values.number?.trim() || processo.numero.trim();
    const municipio = values.cidade?.trim() || processo.municipio?.trim() || "";
    const uf = processo.uf?.trim() || "";

    if (!numero || !municipio || !uf) {
      toast({
        title: "Campos obrigatórios ausentes",
        description: "Número, cidade e UF do processo são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);

    const toNullable = (valor?: string | null) => {
      if (!valor) {
        return null;
      }
      const texto = valor.trim();
      return texto.length > 0 ? texto : null;
    };

    const payload = {
      cliente_id: processo.clienteId,
      numero,
      uf,
      municipio,
      orgao_julgador: toNullable(values.enderecoReu) ?? processo.orgaoJulgador ?? null,
      tipo: values.tipo,
      status: values.status,
      classe_judicial: toNullable(values.areaAtuacao) ?? processo.classeJudicial ?? null,
      assunto: toNullable(values.descricaoFatos) ?? processo.assunto ?? null,
      jurisdicao: toNullable(values.bairro) ?? processo.jurisdicao ?? null,
      advogado_responsavel:
        toNullable(values.nomeReu) ?? processo.advogadoResponsavel ?? null,
      data_distribuicao: processo.dataDistribuicao ?? null,
      oportunidade_id: processo.oportunidadeId ?? null,
      advogados: processo.advogados,
    };

    try {
      const resposta = await fetch(getApiUrl(`processos/${processoId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resposta.ok) {
        throw new Error(`Falha ao salvar alterações (${resposta.status})`);
      }

      toast({ title: "Processo atualizado com sucesso" });
      navigate(`/processos/${processoId}`);
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Erro ao atualizar o processo";
      toast({ title: "Erro ao atualizar processo", description: mensagem, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">Carregando processo...</p>
      </div>
    );
  }

  if (erroCarregamento || !processo) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <p className="text-sm text-destructive">
          {erroCarregamento ?? "Não foi possível carregar o processo."}
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Editar Processo</h1>
        {processo.clienteNome ? (
          <p className="text-muted-foreground">Cliente: {processo.clienteNome}</p>
        ) : null}
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
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Processo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tipoOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
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
                name="participacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {participacaoOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
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
                name="areaAtuacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área de Atuação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a área" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {areaOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
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
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="0000-00.0000.0.00.0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nomeReu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo do Réu / Promovido</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentoReu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ do Réu / Promovido</FormLabel>
                    <FormControl>
                      <Input placeholder="Documento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoReu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço Completo do Réu</FormLabel>
                    <FormControl>
                      <Input placeholder="Endereço" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numeroReu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº / Apto do Réu</FormLabel>
                    <FormControl>
                      <Input placeholder="Número" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bairro"
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
                name="cidade"
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
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input placeholder="CEP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valorCausa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Causa / Pedido</FormLabel>
                    <FormControl>
                      <Input placeholder="Valor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricaoFatos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição dos fatos</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva os fatos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pedidos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quais são os seus pedidos na presente ação?</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Seus pedidos" {...field} />
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
                    <FormLabel>Situação do Processo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={salvando}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary-hover" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditarProcesso;
