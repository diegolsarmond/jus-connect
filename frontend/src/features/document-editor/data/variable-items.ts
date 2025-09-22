export interface VariableMenuItem {
  id?: string;
  label: string;
  value?: string;
  description?: string;
  children?: VariableMenuItem[];
  isSection?: boolean;
}

export const variableMenuTree: VariableMenuItem[] = [
  {
    id: 'cliente',
    label: 'Cliente',
    isSection: true,
    children: [
      { id: 'cliente.primeiro_nome', label: 'Primeiro nome', value: 'cliente.primeiro_nome' },
      { id: 'cliente.sobrenome', label: 'Sobrenome', value: 'cliente.sobrenome' },
      { id: 'cliente.nome_completo', label: 'Nome completo', value: 'cliente.nome_completo' },
      {
        id: 'cliente.endereco',
        label: 'Endereço',
        value: 'cliente.endereco',
        children: [
          { id: 'cliente.endereco.rua', label: 'Rua', value: 'cliente.endereco.rua' },
          { id: 'cliente.endereco.numero', label: 'Número', value: 'cliente.endereco.numero' },
          { id: 'cliente.endereco.bairro', label: 'Bairro', value: 'cliente.endereco.bairro' },
          { id: 'cliente.endereco.cidade', label: 'Cidade', value: 'cliente.endereco.cidade' },
          { id: 'cliente.endereco.estado', label: 'Estado', value: 'cliente.endereco.estado' },
          { id: 'cliente.endereco.cep', label: 'CEP', value: 'cliente.endereco.cep' },
        ],
      },
      {
        id: 'cliente.contato',
        label: 'Contato',
        value: 'cliente.contato',
        children: [
          { id: 'cliente.contato.email', label: 'E-mail', value: 'cliente.contato.email' },
          { id: 'cliente.contato.telefone', label: 'Telefone', value: 'cliente.contato.telefone' },
        ],
      },
      {
        id: 'cliente.documento',
        label: 'Documento',
        value: 'cliente.documento',
        children: [
          { id: 'cliente.documento.cpf', label: 'CPF', value: 'cliente.documento.cpf' },
          { id: 'cliente.documento.rg', label: 'RG', value: 'cliente.documento.rg' },
        ],
      },
      {
        id: 'cliente.atributos_personalizados',
        label: 'Atributos personalizados',
        children: [],
      },
    ],
  },
  {
    id: 'processo',
    label: 'Processo',
    isSection: true,
    children: [
      { id: 'processo.numero', label: 'Número', value: 'processo.numero' },
      { id: 'processo.tipo_acao', label: 'Tipo de ação', value: 'processo.tipo_acao' },
      { id: 'processo.vara', label: 'Vara', value: 'processo.vara' },
      { id: 'processo.fase_atual', label: 'Fase atual', value: 'processo.fase_atual' },
      { id: 'processo.status', label: 'Status', value: 'processo.status' },
      {
        id: 'processo.audiencia',
        label: 'Audiência',
        value: 'processo.audiencia',
        children: [
          { id: 'processo.audiencia.data', label: 'Data', value: 'processo.audiencia.data' },
          { id: 'processo.audiencia.horario', label: 'Horário', value: 'processo.audiencia.horario' },
          { id: 'processo.audiencia.local', label: 'Local', value: 'processo.audiencia.local' },
        ],
      },
    ],
  },
  {
    id: 'escritorio',
    label: 'Escritório',
    isSection: true,
    children: [
      { id: 'escritorio.nome', label: 'Nome', value: 'escritorio.nome' },
      { id: 'escritorio.razao_social', label: 'Razão social', value: 'escritorio.razao_social' },
      { id: 'escritorio.cnpj', label: 'CNPJ', value: 'escritorio.cnpj' },
      {
        id: 'escritorio.endereco',
        label: 'Endereço',
        value: 'escritorio.endereco',
        children: [
          { id: 'escritorio.endereco.rua', label: 'Rua', value: 'escritorio.endereco.rua' },
          { id: 'escritorio.endereco.numero', label: 'Número', value: 'escritorio.endereco.numero' },
          { id: 'escritorio.endereco.bairro', label: 'Bairro', value: 'escritorio.endereco.bairro' },
          { id: 'escritorio.endereco.cidade', label: 'Cidade', value: 'escritorio.endereco.cidade' },
          { id: 'escritorio.endereco.estado', label: 'Estado', value: 'escritorio.endereco.estado' },
        ],
      },
    ],
  },
  {
    id: 'usuario',
    label: 'Usuário',
    isSection: true,
    children: [
      { id: 'usuario.nome', label: 'Nome completo', value: 'usuario.nome' },
      { id: 'usuario.cargo', label: 'Cargo', value: 'usuario.cargo' },
      { id: 'usuario.oab', label: 'OAB', value: 'usuario.oab' },
      { id: 'usuario.email', label: 'E-mail', value: 'usuario.email' },
      { id: 'usuario.telefone', label: 'Telefone', value: 'usuario.telefone' },
    ],
  },
  {
    id: 'sistema',
    label: 'Data atual',
    isSection: true,
    children: [
      { id: 'sistema.data_atual', label: 'Data (DD/MM/AAAA)', value: 'sistema.data_atual' },
      { id: 'sistema.data_extenso', label: 'Data por extenso', value: 'sistema.data_extenso' },
      { id: 'sistema.hora_atual', label: 'Hora atual', value: 'sistema.hora_atual' },
    ],
  },
];
