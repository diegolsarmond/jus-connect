import { Router } from 'express';
import areaAtuacaoRoutes from './areaAtuacaoRoutes';
import tipoEventoRoutes from './tipoEventoRoutes';
import tipoProcessoRoutes from './tipoProcessoRoutes';
import tipoEnvolvimentoRoutes from './tipoEnvolvimentoRoutes';
import escritorioRoutes from './escritorioRoutes';
import perfilRoutes from './perfilRoutes';
import planoRoutes, { publicPlanoRoutes } from './planoRoutes';
import planPaymentRoutes from './planPaymentRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import situacaoClienteRoutes from './situacaoClienteRoutes';
import categoriaRoutes from './categoriaRoutes';
import situacaoProcessoRoutes from './situacaoProcessoRoutes';
import situacaoPropostaRoutes from './situacaoPropostaRoutes';
import etiquetaRoutes from './etiquetaRoutes';
import sistemaCnjRoutes from './sistemaCnjRoutes';
import usuarioRoutes from './usuarioRoutes';
import empresaRoutes from './empresaRoutes';
import clienteRoutes from './clienteRoutes';
import fornecedorRoutes from './fornecedorRoutes';
import agendaRoutes from './agendaRoutes';
import templateRoutes from './templateRoutes';
import tagRoutes from './tagRoutes';
import documentRoutes from './documentRoutes';
import blogPostRoutes, { publicBlogPostRoutes } from './blogPostRoutes';
import financialRoutes from './financialRoutes';
import processoRoutes from './processoRoutes';
import consultaPublicaRoutes from './consultaPublicaRoutes';
import fluxoTrabalhoRoutes from './fluxoTrabalhoRoutes';
import uploadRoutes from './uploadRoutes';
import oportunidadeRoutes from './oportunidadeRoutes';
import oportunidadeDocumentoRoutes from './oportunidadeDocumentoRoutes';
import tarefaRoutes from './tarefaRoutes';
import tarefaResponsavelRoutes from './tarefaResponsavelRoutes';
import tipoDocumentoRoutes from './tipoDocumentoRoutes';
import clienteDocumentoRoutes from './clienteDocumentoRoutes';
import clienteAtributoRoutes from './clienteAtributoRoutes';
import supportRoutes from './supportRoutes';
import notificationRoutes from './notificationRoutes';
import intimacaoRoutes from './intimacaoRoutes';
import integrationApiKeyRoutes from './integrationApiKeyRoutes';
import webhookRoutes from './webhookRoutes';
import chatRoutes from './chatRoutes';
import userProfileRoutes from './userProfileRoutes';
import wahaWebhookRoutes from './wahaWebhookRoutes';
import asaasWebhookRoutes from './asaasWebhookRoutes';
import authRoutes from './authRoutes';
import publicSubscriptionRoutes from './publicSubscriptionRoutes';

type RouteRegistryEntry = {
  modules: string | string[] | null;
  router: Router;
  public?: boolean;
};

const routesRegistry: RouteRegistryEntry[] = [
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-area-atuacao'],
    router: areaAtuacaoRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-tipo-evento'],
    router: tipoEventoRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-tipo-processo'],
    router: tipoProcessoRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-tipo-envolvimento'],
    router: tipoEnvolvimentoRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-tipos-documento'],
    router: tipoDocumentoRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-escritorios'],
    router: escritorioRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-perfis'],
    router: perfilRoutes,
  },
  {
    modules: ['configuracoes', 'dashboard'],
    router: planoRoutes,
  },
  {
    modules: ['configuracoes', 'dashboard'],
    router: subscriptionRoutes,
  },
  {
    modules: 'meu-plano',
    router: planPaymentRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-situacao-processo'],
    router: situacaoProcessoRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-situacao-cliente'],
    router: situacaoClienteRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-situacao-proposta'],
    router: situacaoPropostaRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-etiquetas'],
    router: etiquetaRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-categorias'],
    router: categoriaRoutes,
  },
  {
    modules: ['configuracoes-parametros', 'configuracoes-parametros-sistemas-cnj'],
    router: sistemaCnjRoutes,
  },
  {
    modules: ['configuracoes', 'dashboard'],
    router: empresaRoutes,
  },
  {
    modules: 'configuracoes-usuarios',
    router: usuarioRoutes,
  },
  {
    modules: ['clientes', 'dashboard'],
    router: clienteRoutes,
  },
  {
    modules: 'fornecedores',
    router: fornecedorRoutes,
  },
  {
    modules: ['clientes', 'dashboard'],
    router: clienteAtributoRoutes,
  },
  {
    modules: 'agenda',
    router: agendaRoutes,
  },
  {
    modules: 'documentos',
    router: templateRoutes,
  },
  {
    modules: 'documentos',
    router: tagRoutes,
  },
  {
    modules: 'documentos',
    router: documentRoutes,
  },
  {
    modules: ['configuracoes', 'configuracoes-conteudo-blog'],
    router: blogPostRoutes,
  },
  {
    modules: ['financeiro', 'dashboard'],
    router: financialRoutes,
  },
  {
    modules: ['processos', 'dashboard'],
    router: processoRoutes,
  },
  {
    modules: ['consulta-publica', 'processos'],
    router: consultaPublicaRoutes,
  },
  {
    modules: 'pipeline',
    router: fluxoTrabalhoRoutes,
  },
  {
    modules: 'documentos',
    router: uploadRoutes,
  },
  {
    modules: 'pipeline',
    router: oportunidadeRoutes,
  },
  {
    modules: 'pipeline',
    router: oportunidadeDocumentoRoutes,
  },
  {
    modules: 'tarefas',
    router: tarefaRoutes,
  },
  {
    modules: 'tarefas',
    router: tarefaResponsavelRoutes,
  },
  {
    modules: ['clientes', 'documentos'],
    router: clienteDocumentoRoutes,
  },
  {
    modules: 'suporte',
    router: supportRoutes,
  },
  {
    modules: 'intimacoes',
    router: intimacaoRoutes,
  },
  {
    modules: 'configuracoes-integracoes',
    router: integrationApiKeyRoutes,
  },
  {
    modules: 'configuracoes-integracoes',
    router: webhookRoutes,
  },
  {
    modules: 'conversas',
    router: chatRoutes,
  },
  {
    modules: null,
    router: notificationRoutes,
  },
  {
    modules: null,
    router: userProfileRoutes,
  },
  {
    modules: null,
    router: wahaWebhookRoutes,
    public: true,
  },
  {
    modules: null,
    router: asaasWebhookRoutes,
    public: true,
  },
  {
    modules: null,
    router: publicBlogPostRoutes,
    public: true,
  },
  {
    modules: null,
    router: publicPlanoRoutes,
    public: true,
  },
  {
    modules: null,
    router: authRoutes,
    public: true,
  },
  {
    modules: null,
    router: publicSubscriptionRoutes,
    public: true,
  },
];

export default routesRegistry;
