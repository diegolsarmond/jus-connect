export interface VariableMenuItem {
  label: string;
  value: string;
  description?: string;
  children?: VariableMenuItem[];
}

export const variableMenuTree: VariableMenuItem[] = [
  {
    label: 'Cliente',
    value: 'cliente',
    children: [
      { label: 'Primeiro nome', value: 'cliente.primeiro_nome' },
      { label: 'Sobrenome', value: 'cliente.sobrenome' },
      { label: 'Nome completo', value: 'cliente.nome_completo' },
      {
        label: 'Endereço',
        value: 'cliente.endereco',
        children: [
          { label: 'Rua', value: 'cliente.endereco.rua' },
          { label: 'Número', value: 'cliente.endereco.numero' },
          { label: 'Bairro', value: 'cliente.endereco.bairro' },
          { label: 'Cidade', value: 'cliente.endereco.cidade' },
          { label: 'Estado', value: 'cliente.endereco.estado' },
          { label: 'CEP', value: 'cliente.endereco.cep' },
        ],
      },
      {
        label: 'Contato',
        value: 'cliente.contato',
        children: [
          { label: 'E-mail', value: 'cliente.contato.email' },
          { label: 'Telefone', value: 'cliente.contato.telefone' },
        ],
      },
      {
        label: 'Documento',
        value: 'cliente.documento',
        children: [
          { label: 'CPF', value: 'cliente.documento.cpf' },
          { label: 'RG', value: 'cliente.documento.rg' },
        ],
      },
    ],
  },
  {
    label: 'Processo',
    value: 'processo',
    children: [
      { label: 'Número', value: 'processo.numero' },
      { label: 'Tipo de ação', value: 'processo.tipo_acao' },
      { label: 'Vara', value: 'processo.vara' },
      { label: 'Fase atual', value: 'processo.fase_atual' },
      { label: 'Status', value: 'processo.status' },
      {
        label: 'Audiência',
        value: 'processo.audiencia',
        children: [
          { label: 'Data', value: 'processo.audiencia.data' },
          { label: 'Horário', value: 'processo.audiencia.horario' },
          { label: 'Local', value: 'processo.audiencia.local' },
        ],
      },
    ],
  },
  {
    label: 'Escritório',
    value: 'escritorio',
    children: [
      { label: 'Nome', value: 'escritorio.nome' },
      { label: 'Razão social', value: 'escritorio.razao_social' },
      { label: 'CNPJ', value: 'escritorio.cnpj' },
      {
        label: 'Endereço',
        value: 'escritorio.endereco',
        children: [
          { label: 'Rua', value: 'escritorio.endereco.rua' },
          { label: 'Número', value: 'escritorio.endereco.numero' },
          { label: 'Bairro', value: 'escritorio.endereco.bairro' },
          { label: 'Cidade', value: 'escritorio.endereco.cidade' },
          { label: 'Estado', value: 'escritorio.endereco.estado' },
        ],
      },
    ],
  },
  {
    label: 'Usuário',
    value: 'usuario',
    children: [
      { label: 'Nome completo', value: 'usuario.nome' },
      { label: 'Cargo', value: 'usuario.cargo' },
      { label: 'OAB', value: 'usuario.oab' },
      { label: 'E-mail', value: 'usuario.email' },
      { label: 'Telefone', value: 'usuario.telefone' },
    ],
  },
  {
    label: 'Data atual',
    value: 'sistema',
    children: [
      { label: 'Data (DD/MM/AAAA)', value: 'sistema.data_atual' },
      { label: 'Data por extenso', value: 'sistema.data_extenso' },
      { label: 'Hora atual', value: 'sistema.hora_atual' },
    ],
  },
];
