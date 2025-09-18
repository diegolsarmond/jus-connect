import { useCallback, useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ProcessoCliente {
  id?: number;
  nome: string;
  cpf: string;
  papel: string;
}

interface Processo {
  id: number;
  numero: string;
  dataDistribuicao: string;
  status: string;
  tipo: string;
  cliente: ProcessoCliente;
  advogadoResponsavel: string;
  classeJudicial: string;
  assunto: string;
  jurisdicao: string;
  orgaoJulgador: string;
  movimentacoes: { data: string; descricao: string }[];
}

interface Uf {
  sigla: string;
  nome: string;
}

interface Municipio {
  id: number;
  nome: string;
}

interface ClienteResumo {
  id: number;
  nome: string;
  documento: string;
  tipo: string;
}

interface ApiCliente {
  id: number;
  nome?: string;
  documento?: string;
  tipo?: string;
}

interface ApiProcessoCliente {
  id: number;
  nome: string | null;
  documento: string | null;
  tipo: string | null;
}

interface ApiProcesso {
  id: number;
  cliente_id: number;
  numero: string;
  uf: string | null;
  municipio: string | null;
  orgao_julgador: string | null;
  tipo: string | null;
  status: string | null;
  classe_judicial: string | null;
  assunto: string | null;
  jurisdicao: string | null;
  advogado_responsavel: string | null;
  data_distribuicao: string | null;
  criado_em: string;
  atualizado_em: string;
  cliente?: ApiProcessoCliente | null;
}

type ProcessFormState = {
  numero: string;
  uf: string;
  municipio: string;
  orgaoJulgador: string;
  clienteId: string;
};

const formatProcessNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 20);
  const match = digits.match(/^(\d{0,7})(\d{0,2})(\d{0,4})(\d{0,1})(\d{0,2})(\d{0,4})$/);
  if (!match) return digits;
  const [, part1 = "", part2 = "", part3 = "", part4 = "", part5 = "", part6 = ""] = match;

  let formatted = part1;
  if (part2) formatted += `-${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `.${part4}`;
  if (part5) formatted += `.${part5}`;
  if (part6) formatted += `.${part6}`;
  return formatted;
};

const formatDateToPtBR = (value: string | null | undefined): string => {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return date.toLocaleDateString("pt-BR");
};

const normalizeClienteTipo = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

const resolveClientePapel = (tipo: string | null | undefined): string => {
  const normalized = normalizeClienteTipo(tipo);

  if (
    normalized.includes("JURIDICA") ||
    ["2", "J", "PJ"].includes(normalized)
  ) {
    return "Pessoa Jurídica";
  }

  if (
    normalized.includes("FISICA") ||
    ["1", "F", "PF"].includes(normalized)
  ) {
    return "Pessoa Física";
  }

  return "Parte";
};

const createEmptyProcessForm = (): ProcessFormState => ({
  numero: "",
  uf: "",
  municipio: "",
  orgaoJulgador: "",
  clienteId: "",
});

const mapApiProcessoToProcesso = (processo: ApiProcesso): Processo => {
  const clienteResumo = processo.cliente ?? null;
  const documento = clienteResumo?.documento ?? "";
  const jurisdicao =
    processo.jurisdicao ||
    [processo.municipio, processo.uf].filter(Boolean).join(" - ") ||
    "Não informado";

  return {
    id: processo.id,
    numero: processo.numero,
    dataDistribuicao:
      formatDateToPtBR(processo.data_distribuicao || processo.criado_em),
    status: processo.status?.trim() || "Não informado",
    tipo: processo.tipo?.trim() || "Não informado",
    cliente: {
      id: clienteResumo?.id ?? processo.cliente_id,
      nome: clienteResumo?.nome ?? "Cliente não informado",
      cpf: documento,
      papel: resolveClientePapel(clienteResumo?.tipo),
    },
    advogadoResponsavel:
      processo.advogado_responsavel?.trim() || "Não informado",
    classeJudicial: processo.classe_judicial?.trim() || "Não informada",
    assunto: processo.assunto?.trim() || "Não informado",
    jurisdicao,
    orgaoJulgador: processo.orgao_julgador?.trim() || "Não informado",
    movimentacoes: [],
  };
};

export default function Processos() {
  const { toast } = useToast();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processForm, setProcessForm] = useState<ProcessFormState>(
    createEmptyProcessForm,
  );
  const [ufs, setUfs] = useState<Uf[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipiosLoading, setMunicipiosLoading] = useState(false);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [processosLoading, setProcessosLoading] = useState(false);
  const [processosError, setProcessosError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingProcess, setCreatingProcess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchUfs = async () => {
      try {
        const res = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Uf[];
        if (!cancelled) setUfs(data);
      } catch (error) {
        console.error(error);
        if (!cancelled) setUfs([]);
      }
    };

    fetchUfs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchClientes = async () => {
      setClientesLoading(true);
      try {
        const res = await fetch(getApiUrl("clientes"), {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data: ApiCliente[] = Array.isArray(json)
          ? json
          : Array.isArray((json as { rows?: ApiCliente[] })?.rows)
            ? ((json as { rows: ApiCliente[] }).rows)
            : Array.isArray((json as { data?: { rows?: ApiCliente[] } })?.data?.rows)
              ? ((json as { data: { rows: ApiCliente[] } }).data.rows)
              : Array.isArray((json as { data?: ApiCliente[] })?.data)
                ? ((json as { data: ApiCliente[] }).data)
                : [];
        const mapped = data
          .filter((cliente) => typeof cliente.id === "number")
          .map((cliente) => ({
            id: cliente.id,
            nome: cliente.nome ?? "Sem nome",
            documento: cliente.documento ?? "",
            tipo:
              cliente.tipo === null || cliente.tipo === undefined
                ? ""
                : typeof cliente.tipo === "string"
                  ? cliente.tipo
                  : String(cliente.tipo),
          }));
        if (!cancelled) {
          setClientes(mapped);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setClientes([]);
        }
      } finally {
        if (!cancelled) {
          setClientesLoading(false);
        }
      }
    };

    fetchClientes();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadProcessos = useCallback(async () => {
    const res = await fetch(getApiUrl("processos"), {
      headers: { Accept: "application/json" },
    });

    let json: unknown = null;
    try {
      json = await res.json();
    } catch (error) {
      console.error("Não foi possível interpretar a resposta de processos", error);
    }

    if (!res.ok) {
      const message =
        json && typeof json === "object" &&
        "error" in json &&
        typeof (json as { error: unknown }).error === "string"
          ? (json as { error: string }).error
          : `Não foi possível carregar os processos (HTTP ${res.status})`;
      throw new Error(message);
    }

    const data: ApiProcesso[] = Array.isArray(json)
      ? (json as ApiProcesso[])
      : Array.isArray((json as { rows?: ApiProcesso[] })?.rows)
        ? ((json as { rows: ApiProcesso[] }).rows)
        : Array.isArray((json as { data?: { rows?: ApiProcesso[] } })?.data?.rows)
          ? ((json as { data: { rows: ApiProcesso[] } }).data.rows)
          : Array.isArray((json as { data?: ApiProcesso[] })?.data)
            ? ((json as { data: ApiProcesso[] }).data)
            : [];

    return data.map(mapApiProcessoToProcesso);
  }, []);

  useEffect(() => {
    let active = true;

    const fetchProcessos = async () => {
      setProcessosLoading(true);
      setProcessosError(null);
      try {
        const data = await loadProcessos();
        if (!active) return;
        setProcessos(data);
      } catch (error) {
        console.error(error);
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao carregar processos";
        setProcessos([]);
        setProcessosError(message);
        toast({
          title: "Erro ao carregar processos",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (active) {
          setProcessosLoading(false);
        }
      }
    };

    fetchProcessos();

    return () => {
      active = false;
    };
  }, [loadProcessos, toast]);

  useEffect(() => {
    if (
      processForm.clienteId &&
      !clientes.some((cliente) => String(cliente.id) === processForm.clienteId)
    ) {
      setProcessForm((prev) => ({ ...prev, clienteId: "" }));
    }
  }, [clientes, processForm.clienteId]);

  useEffect(() => {

    if (!processForm.uf) {
      setMunicipios([]);
      setMunicipiosLoading(false);
      return;
    }

    let cancelled = false;
    setMunicipiosLoading(true);

    const fetchMunicipios = async () => {
      try {
        const res = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${processForm.uf}/municipios?orderBy=nome`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Municipio[];
        if (!cancelled) setMunicipios(data);
      } catch (error) {
        console.error(error);
        if (!cancelled) setMunicipios([]);
      } finally {
        if (!cancelled) setMunicipiosLoading(false);
      }
    };

    fetchMunicipios();

    return () => {
      cancelled = true;
    };
  }, [processForm.uf]);

  const resetProcessForm = () => {
    setProcessForm(createEmptyProcessForm());
    setMunicipios([]);
    setMunicipiosLoading(false);
    setCreateError(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetProcessForm();
    } else {
      setCreateError(null);
    }
  };

  const handleProcessCreate = async () => {
    if (
      !processForm.numero ||
      !processForm.uf ||
      !processForm.municipio ||
      !processForm.orgaoJulgador ||
      !processForm.clienteId
    ) {
      return;
    }

    const selectedCliente = clientes.find(
      (cliente) => String(cliente.id) === processForm.clienteId,
    );

    if (!selectedCliente) {
      return;
    }

    setCreateError(null);
    setCreatingProcess(true);

    try {
      const res = await fetch(getApiUrl("processos"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          cliente_id: selectedCliente.id,
          numero: processForm.numero,
          uf: processForm.uf,
          municipio: processForm.municipio,
          orgao_julgador: processForm.orgaoJulgador,
          jurisdicao: `${processForm.municipio} - ${processForm.uf}`,
        }),
      });

      let json: unknown = null;
      try {
        json = await res.json();
      } catch (error) {
        console.error("Não foi possível interpretar a resposta de criação", error);
      }

      if (!res.ok) {
        const message =
          json && typeof json === "object" &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Não foi possível cadastrar o processo (HTTP ${res.status})`;
        throw new Error(message);
      }

      if (!json || typeof json !== "object") {
        throw new Error("Resposta inválida do servidor ao cadastrar o processo");
      }

      const mapped = mapApiProcessoToProcesso(json as ApiProcesso);
      setProcessos((prev) => [mapped, ...prev.filter((p) => p.id !== mapped.id)]);
      toast({ title: "Processo cadastrado com sucesso" });
      handleDialogOpenChange(false);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao cadastrar processo";
      setCreateError(message);
      toast({
        title: "Erro ao cadastrar processo",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreatingProcess(false);
    }
  };

  const isCreateDisabled =
    !processForm.numero ||
    !processForm.uf ||
    !processForm.municipio ||
    !processForm.orgaoJulgador ||
    !processForm.clienteId ||
    creatingProcess;


  const filteredProcessos = processos.filter((processo) => {
    const matchesStatus =
      statusFilter === "todos" || processo.status === statusFilter;
    const matchesTipo = tipoFilter === "todos" || processo.tipo === tipoFilter;
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      processo.numero?.toLowerCase().includes(search) ||
      processo.cliente?.nome?.toLowerCase().includes(search) ||
      processo.cliente?.cpf?.includes(search) ||
      processo.advogadoResponsavel?.toLowerCase().includes(search);

    return matchesStatus && matchesTipo && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Processos</h1>
          <p className="text-muted-foreground">
            Listagem de processos cadastrados
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>Cadastrar processo</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Pesquisar por número, cliente, CPF ou advogado"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:w-1/3"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="Em andamento">Em andamento</SelectItem>
            <SelectItem value="Arquivado">Arquivado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            <SelectItem value="Cível">Cível</SelectItem>
            <SelectItem value="Trabalhista">Trabalhista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {processosLoading ? (
        <p className="text-sm text-muted-foreground">Carregando processos...</p>
      ) : processosError ? (
        <p className="text-sm text-destructive">{processosError}</p>
      ) : filteredProcessos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum processo encontrado.
        </p>
      ) : (
        <Accordion type="single" collapsible className="w-full">
          {filteredProcessos.map((processo) => (
            <AccordionItem key={processo.id} value={String(processo.id)}>
              <AccordionTrigger>
                <div className="text-left">
                  <p className="font-medium">Processo {processo.numero}</p>
                  <p className="text-sm text-muted-foreground">
                    Distribuído em {processo.dataDistribuicao}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Cliente:</span> {processo.cliente.nome} ({processo.cliente.papel})
                    </div>
                    <div>
                      <span className="font-medium">Classe Judicial:</span> {processo.classeJudicial}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium">Assunto:</span> {processo.assunto}
                    </div>
                    <div>
                      <span className="font-medium">Jurisdição:</span> {processo.jurisdicao}
                    </div>
                    <div>
                      <span className="font-medium">Órgão Julgador:</span> {processo.orgaoJulgador}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Últimas Movimentações</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="py-1">Movimento</th>
                            <th className="py-1">Documento</th>
                          </tr>
                        </thead>
                        <tbody className="[&>tr:not(:last-child)]:border-b">
                          {processo.movimentacoes.length > 0 ? (
                            processo.movimentacoes.map((mov, index) => (
                              <tr key={index}>
                                <td className="py-1">
                                  {mov.data} - {mov.descricao}
                                </td>
                                <td className="py-1"></td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="py-2 text-muted-foreground" colSpan={2}>
                                Nenhuma movimentação registrada.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar processo</DialogTitle>
            <DialogDescription>
              Informe os dados básicos para registrar um novo processo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="process-client">Cliente</Label>
              <Select
                value={processForm.clienteId}
                onValueChange={(value) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    clienteId: value,
                  }))
                }
              >
                <SelectTrigger
                  id="process-client"
                  disabled={clientesLoading || clientes.length === 0}
                >
                  <SelectValue
                    placeholder={
                      clientesLoading
                        ? "Carregando clientes..."
                        : clientes.length > 0
                          ? "Selecione o cliente"
                          : "Nenhum cliente encontrado"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={String(cliente.id)}>
                      {cliente.nome}
                      {cliente.documento ? ` (${cliente.documento})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="process-uf">UF</Label>
              <Select
                value={processForm.uf}
                onValueChange={(value) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    uf: value,
                    municipio: "",
                  }))
                }
              >
                <SelectTrigger id="process-uf">
                  <SelectValue placeholder="Selecione a UF" />
                </SelectTrigger>
                <SelectContent>
                  {ufs.map((uf) => (
                    <SelectItem key={uf.sigla} value={uf.sigla}>
                      {uf.nome} ({uf.sigla})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="process-municipio">Município</Label>
              <Select
                value={processForm.municipio}
                onValueChange={(value) =>
                  setProcessForm((prev) => ({ ...prev, municipio: value }))
                }
              >
                <SelectTrigger
                  id="process-municipio"
                  disabled={!processForm.uf || municipiosLoading}
                >
                  <SelectValue
                    placeholder={
                      !processForm.uf
                        ? "Selecione a UF primeiro"
                        : municipiosLoading
                        ? "Carregando municípios..."
                        : municipios.length > 0
                        ? "Selecione o município"
                        : "Nenhum município encontrado"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {municipios.map((municipio) => (
                    <SelectItem key={municipio.id} value={municipio.nome}>
                      {municipio.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="process-orgao">Órgão Julgador</Label>
              <Input
                id="process-orgao"
                placeholder="Informe o órgão julgador"
                value={processForm.orgaoJulgador}
                onChange={(event) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    orgaoJulgador: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="process-number">Número do processo</Label>
              <Input
                id="process-number"
                placeholder="0000000-00.0000.0.00.0000"
                value={processForm.numero}
                onChange={(event) =>
                  setProcessForm((prev) => ({
                    ...prev,
                    numero: formatProcessNumber(event.target.value),
                  }))
                }
              />
            </div>
          </div>
          {createError ? (
            <p className="text-sm text-destructive">{createError}</p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleProcessCreate}
              disabled={isCreateDisabled}
            >
              {creatingProcess ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

