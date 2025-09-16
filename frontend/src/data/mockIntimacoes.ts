export type IntimacaoMensal = {
  mes: string;
  enviadas: number;
  cumpridas: number;
  emAndamento: number;
  pendentes: number;
  prazoMedio: number;
};

export type IntimacaoStatusDistribuicao = {
  status: string;
  value: number;
};

export type IntimacaoTipoDistribuicao = {
  tipo: string;
  value: number;
};

export type ModeloIntimacao = {
  id: string;
  titulo: string;
  descricao: string;
  juizResponsavel: string;
  ultimaAtualizacao: string;
  status: "Ativo" | "Em revisão" | "Arquivado";
  area: string;
  prazoResposta: string;
  tags: string[];
};

export const intimacoesMensais: IntimacaoMensal[] = [
  { mes: "Jan", enviadas: 42, cumpridas: 28, emAndamento: 6, pendentes: 8, prazoMedio: 4.5 },
  { mes: "Fev", enviadas: 55, cumpridas: 36, emAndamento: 9, pendentes: 10, prazoMedio: 3.9 },
  { mes: "Mar", enviadas: 48, cumpridas: 35, emAndamento: 6, pendentes: 7, prazoMedio: 3.6 },
  { mes: "Abr", enviadas: 62, cumpridas: 44, emAndamento: 9, pendentes: 9, prazoMedio: 3.2 },
  { mes: "Mai", enviadas: 58, cumpridas: 41, emAndamento: 9, pendentes: 8, prazoMedio: 3.1 },
  { mes: "Jun", enviadas: 64, cumpridas: 47, emAndamento: 10, pendentes: 7, prazoMedio: 2.8 },
];

const totalCumpridas = intimacoesMensais.reduce((total, item) => total + item.cumpridas, 0);
const totalEmAndamento = intimacoesMensais.reduce((total, item) => total + item.emAndamento, 0);
const totalPendentes = intimacoesMensais.reduce((total, item) => total + item.pendentes, 0);

export const intimacoesPorStatus: IntimacaoStatusDistribuicao[] = [
  { status: "Cumpridas", value: totalCumpridas },
  { status: "Em andamento", value: totalEmAndamento },
  { status: "Pendentes", value: totalPendentes },
];

export const intimacoesPorTipo: IntimacaoTipoDistribuicao[] = [
  { tipo: "Audiências", value: 32 },
  { tipo: "Cumprimento de sentença", value: 21 },
  { tipo: "Despachos", value: 18 },
  { tipo: "Ofícios", value: 15 },
  { tipo: "Andamentos internos", value: 14 },
];

export const modelosIntimacao: ModeloIntimacao[] = [
  {
    id: "AUD-001",
    titulo: "Intimação para Audiência de Instrução",
    descricao: "Notifica as partes para audiência de instrução e julgamento com indicação de documentos necessários.",
    juizResponsavel: "Dra. Ana Paula Mendes",
    ultimaAtualizacao: "12 Mar 2024",
    status: "Ativo",
    area: "Cível",
    prazoResposta: "Resposta em até 5 dias úteis",
    tags: ["Audiência", "Procedimento ordinário"],
  },
  {
    id: "CUM-017",
    titulo: "Intimação para Cumprimento de Sentença",
    descricao: "Comunica a parte executada sobre o prazo para cumprimento de obrigação determinada na sentença.",
    juizResponsavel: "Dr. Felipe Moura",
    ultimaAtualizacao: "04 Abr 2024",
    status: "Ativo",
    area: "Execução",
    prazoResposta: "Prazo de 15 dias",
    tags: ["Execução", "Cumprimento"],
  },
  {
    id: "DES-203",
    titulo: "Intimação de Despacho Inicial",
    descricao: "Informa às partes sobre despacho inicial e solicita manifestação quanto a documentos faltantes.",
    juizResponsavel: "Dra. Camila Figueiredo",
    ultimaAtualizacao: "22 Mai 2024",
    status: "Em revisão",
    area: "Cível",
    prazoResposta: "Manifestação em 48 horas",
    tags: ["Despacho", "Documentação"],
  },
  {
    id: "OFI-112",
    titulo: "Intimação de Ofício para Órgão Público",
    descricao: "Solicita informações complementares ao órgão público responsável pelo cumprimento da decisão.",
    juizResponsavel: "Dr. Renato Albuquerque",
    ultimaAtualizacao: "30 Abr 2024",
    status: "Ativo",
    area: "Administrativo",
    prazoResposta: "Retorno em até 10 dias",
    tags: ["Ofício", "Comunicação externa"],
  },
  {
    id: "AND-089",
    titulo: "Intimação de Andamento Interno",
    descricao: "Comunica equipe interna sobre nova movimentação processual e necessidade de atualização em sistema.",
    juizResponsavel: "Dra. Helena Duarte",
    ultimaAtualizacao: "08 Jun 2024",
    status: "Ativo",
    area: "Gestão processual",
    prazoResposta: "Atualização imediata",
    tags: ["Andamento", "Equipe interna"],
  },
  {
    id: "AUD-034",
    titulo: "Intimação para Audiência de Conciliação",
    descricao: "Convoca as partes para audiência de conciliação com sugestão de documentos a serem apresentados.",
    juizResponsavel: "Dr. Marcelo Ribeiro",
    ultimaAtualizacao: "18 Jun 2024",
    status: "Arquivado",
    area: "Cível",
    prazoResposta: "Confirmação em até 3 dias",
    tags: ["Audiência", "Conciliação"],
  },
];
