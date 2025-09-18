export interface Process {
  id: number;
  number?: string;
  status: string;
  tipo?: string;
  participacao?: string;
  areaAtuacao?: string;
  nomeReu?: string;
  documentoReu?: string;
  enderecoReu?: string;
  numeroReu?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  valorCausa?: string;
  descricaoFatos?: string;
  pedidos?: string;
  distributionDate?: string;
  subject?: string;
  responsibleLawyer?: string;
  lastMovement?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  type: string;
  document: string;
  address: string;
  area: string;
  status: string;
  lastContact: string;
  processes: Process[];
}
