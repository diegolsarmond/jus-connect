import { useEffect, useState } from "react";
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

interface Processo {
  numero: string;
  dataDistribuicao: string;
  status: string;
  tipo: string;
  cliente: { nome: string; cpf: string; papel: string };
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

type ProcessFormState = {
  numero: string;
  uf: string;
  municipio: string;
  orgaoJulgador: string;
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

const initialProcessos: Processo[] = [
  {
    numero: "5152182-10.2019.8.13.0024",
    dataDistribuicao: "16/10/2019",
    status: "Arquivado",
    tipo: "Cível",
    cliente: {
      nome: "Diego Leonardo da Silva Armond",
      papel: "Autor",
      cpf: "123.456.789-00",
    },
    advogadoResponsavel: "Sergio Aguilar Silva",
    classeJudicial:
      "[CÍVEL] CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA (12078)",
    assunto:
      "DIREITO CIVIL (899) - Obrigações (7681) - Inadimplemento (7691) - Perdas e Danos (7698) DIREITO CIVIL (899) - Responsabilidade Civil (10431) - Indenização por Dano Moral (10433) - Direito de Imagem (10437) DIREITO ADMINISTRATIVO E OUTRAS MATÉRIAS DE DIREITO PÚBLICO (9985) - Responsabilidade da Administração (9991) - Indenização por Dano Moral (9992)",
    jurisdicao: "Belo Horizonte - Juizado Especial",
    orgaoJulgador:
      "3ª Unidade Jurisdicional da Fazenda Pública do Juizado Especial 43º JD Belo Horizonte",
    movimentacoes: [
      {
        data: "13/10/2022 17:02:21",
        descricao: "Arquivado Definitivamente",
      },
      {
        data: "13/10/2022 16:58:37",
        descricao: "Juntada de Petição de manifestação",
      },
      {
        data: "06/10/2022 19:09:45",
        descricao:
          "Decorrido prazo de ESTADO DE MINAS GERAIS em 04/10/2022 23:59.",
      },
      {
        data: "06/10/2022 19:09:44",
        descricao:
          "Decorrido prazo de DIEGO LEONARDO DA SILVA ARMOND em 05/10/2022 23:59.",
      },
      {
        data: "06/10/2022 19:09:44",
        descricao:
          "Decorrido prazo de SERGIO AGUILAR SILVA em 05/10/2022 23:59.",
      },
    ],
  },
];

export default function Processos() {
  const [processos, setProcessos] = useState<Processo[]>(initialProcessos);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processForm, setProcessForm] = useState<ProcessFormState>({
    numero: "",
    uf: "",
    municipio: "",
    orgaoJulgador: "",
  });
  const [ufs, setUfs] = useState<Uf[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipiosLoading, setMunicipiosLoading] = useState(false);

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
    setProcessForm({ numero: "", uf: "", municipio: "", orgaoJulgador: "" });
    setMunicipios([]);
    setMunicipiosLoading(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetProcessForm();
    }
  };

  const handleProcessCreate = () => {
    if (
      !processForm.numero ||
      !processForm.uf ||
      !processForm.municipio ||
      !processForm.orgaoJulgador
    ) {
      return;
    }

    const newProcess: Processo = {
      numero: processForm.numero,
      dataDistribuicao: new Date().toLocaleDateString("pt-BR"),
      status: "Em andamento",
      tipo: "Cível",
      cliente: {
        nome: "Cliente não informado",
        papel: "Parte",
        cpf: "",
      },
      advogadoResponsavel: "Não informado",
      classeJudicial: "Não informada",
      assunto: "Não informado",
      jurisdicao: `${processForm.municipio} - ${processForm.uf}`,
      orgaoJulgador: processForm.orgaoJulgador,
      movimentacoes: [],
    };

    setProcessos((prev) => [...prev, newProcess]);
    handleDialogOpenChange(false);
  };

  const isCreateDisabled =
    !processForm.numero ||
    !processForm.uf ||
    !processForm.municipio ||
    !processForm.orgaoJulgador;

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

      {filteredProcessos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum processo encontrado.
        </p>
      ) : (
        <Accordion type="single" collapsible className="w-full">
          {filteredProcessos.map((processo) => (
            <AccordionItem key={processo.numero} value={processo.numero}>
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
                          {processo.movimentacoes.map((mov, index) => (
                            <tr key={index}>
                              <td className="py-1">
                                {mov.data} - {mov.descricao}
                              </td>
                              <td className="py-1"></td>
                            </tr>
                          ))}
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleProcessCreate}
              disabled={isCreateDisabled}
            >
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

