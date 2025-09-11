import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function Processos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");

  const processos: Processo[] = [
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

  const filteredProcessos = processos.filter((processo) => {
    const matchesStatus = !statusFilter || processo.status === statusFilter;
    const matchesTipo = !tipoFilter || processo.tipo === tipoFilter;
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Processos</h1>
        <p className="text-muted-foreground">
          Listagem de processos cadastrados
        </p>
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
            <SelectItem value="">Todos os Status</SelectItem>
            <SelectItem value="Em andamento">Em andamento</SelectItem>
            <SelectItem value="Arquivado">Arquivado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os Tipos</SelectItem>
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
    </div>
  );
}

