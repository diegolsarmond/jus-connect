import './utils/loadEnv';
import express, { Request, Router } from 'express';
import { AddressInfo } from 'net';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import areaAtuacaoRoutes from './routes/areaAtuacaoRoutes';
import tipoEventoRoutes from './routes/tipoEventoRoutes';
import tipoProcessoRoutes from './routes/tipoProcessoRoutes';
import tipoEnvolvimentoRoutes from './routes/tipoEnvolvimentoRoutes';
import escritorioRoutes from './routes/escritorioRoutes';
import perfilRoutes from './routes/perfilRoutes';
import planoRoutes, { publicPlanoRoutes } from './routes/planoRoutes';
import planPaymentRoutes from './routes/planPaymentRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import situacaoClienteRoutes from './routes/situacaoClienteRoutes';
import categoriaRoutes from './routes/categoriaRoutes';
import situacaoProcessoRoutes from './routes/situacaoProcessoRoutes';
import situacaoPropostaRoutes from './routes/situacaoPropostaRoutes';
import etiquetaRoutes from './routes/etiquetaRoutes';
import sistemaCnjRoutes from './routes/sistemaCnjRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import empresaRoutes from './routes/empresaRoutes';
import clienteRoutes from './routes/clienteRoutes';
import fornecedorRoutes from './routes/fornecedorRoutes';
import agendaRoutes from './routes/agendaRoutes';
import templateRoutes from './routes/templateRoutes';
import tagRoutes from './routes/tagRoutes';
import documentRoutes from './routes/documentRoutes';
import blogPostRoutes, { publicBlogPostRoutes } from './routes/blogPostRoutes';
import financialRoutes from './routes/financialRoutes';
import processoRoutes from './routes/processoRoutes';
import consultaPublicaRoutes from './routes/consultaPublicaRoutes';
import fluxoTrabalhoRoutes from './routes/fluxoTrabalhoRoutes';
import uploadRoutes from './routes/uploadRoutes';
import oportunidadeRoutes from './routes/oportunidadeRoutes';
import oportunidadeDocumentoRoutes from './routes/oportunidadeDocumentoRoutes';
import tarefaRoutes from './routes/tarefaRoutes';
import tarefaResponsavelRoutes from './routes/tarefaResponsavelRoutes';
import tipoDocumentoRoutes from './routes/tipoDocumentoRoutes';
import clienteDocumentoRoutes from './routes/clienteDocumentoRoutes';
import clienteAtributoRoutes from './routes/clienteAtributoRoutes';
import supportRoutes from './routes/supportRoutes';
import notificationRoutes from './routes/notificationRoutes';
import intimacaoRoutes from './routes/intimacaoRoutes';
import integrationApiKeyRoutes from './routes/integrationApiKeyRoutes';
import chatRoutes from './routes/chatRoutes';
import userProfileRoutes from './routes/userProfileRoutes';
import wahaWebhookRoutes from './routes/wahaWebhookRoutes';
import asaasWebhookRoutes from './routes/asaasWebhookRoutes';
import authRoutes from './routes/authRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerOptions from './swagger';
import cronJobs from './services/cronJobs';
import { bootstrapOabMonitoradas } from './services/oabMonitorService';
import { bootstrapIntimacaoOabMonitoradas } from './services/intimacaoOabMonitorService';
import { ensureChatSchema } from './services/chatSchema';
import { ensureProcessSyncSchema } from './services/processSyncSchema';
import { ensureSupportSchema } from './services/supportSchema';
import { authenticateRequest } from './middlewares/authMiddleware';
import { authorizeModules } from './middlewares/moduleAuthorization';
import { getAuthSecret } from './constants/auth';
import {
  getFileStorageDriver,
  getLocalStorageRoot,
  getPublicUploadsBasePath,
  isPublicFileAccessEnabled,
} from './services/fileStorageService';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const ensureCriticalConfig = () => {
  try {
    getAuthSecret();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'AUTH_TOKEN_SECRET (ou JWT_SECRET/TOKEN_SECRET) não foi definido.';

    console.error(`Falha ao iniciar o servidor: ${message}`);
    process.exit(1);
  }
};

ensureCriticalConfig();

app.use(
  express.json({
    limit: '50mb',
    verify: (req: Request & { rawBody?: string }, _res, buffer) => {
      if (buffer?.length) {
        req.rawBody = buffer.toString('utf-8');
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const registerStaticUploadHandler = () => {
  if (getFileStorageDriver() !== 'local') {
    return;
  }

  const uploadsRoot = getLocalStorageRoot();

  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }

  const publicBase = getPublicUploadsBasePath();

  if (!isPublicFileAccessEnabled()) {
    return;
  }

  if (!publicBase.startsWith('/')) {
    return;
  }

  const mountPath = publicBase.replace(/\/+$/, '') || '/uploads';
  app.use(mountPath, express.static(uploadsRoot));
};

registerStaticUploadHandler();

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:4200',
  'https://jusconnec.quantumtecnologia.com.br',
  'https://quantumtecnologia.com.br',
];

const additionalAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...additionalAllowedOrigins,
]);

const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true';

/**
 * Middleware de CORS
 */
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  if (origin && (allowAllOrigins || allowedOrigins.has(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin'); // boa prática p/ caches
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, access-token, x-authorization-id, x-client-id, id-account'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Rotas
const protectedApiRouter = express.Router();
protectedApiRouter.use(authenticateRequest);

type RouterLayer = {
  match?: (path: string) => boolean;
  name?: string;
  handle?: Router;
};

const createRouterPathMatcher = (router: Router) => {
  const visitedRouters = new Set<Router>();
  const matchers: Array<(path: string) => boolean> = [];

  const collectMatchers = (target: Router) => {
    if (visitedRouters.has(target)) {
      return;
    }

    visitedRouters.add(target);

    const stack = (target as unknown as { stack?: RouterLayer[] }).stack;
    if (!Array.isArray(stack)) {
      return;
    }

    for (const layer of stack) {
      if (typeof layer?.match === 'function') {
        matchers.push(layer.match.bind(layer));
      }

      if (layer?.name === 'router' && layer.handle) {
        collectMatchers(layer.handle);
      }
    }
  };

  collectMatchers(router);

  if (matchers.length === 0) {
    return () => true;
  }

  return (path: string) =>
    matchers.some((match) => {
      try {
        return match(path);
      } catch (error) {
        console.warn('Falha ao avaliar rota protegida', error);
        return false;
      }
    });
};

const registerModuleRoutes = (modules: string | string[], router: Router) => {
  const matchesPath = createRouterPathMatcher(router);
  const moduleGuard = authorizeModules(modules);

  protectedApiRouter.use((req, res, next) => {
    const path = typeof req.path === 'string' ? req.path : req.url ?? '';

    if (!matchesPath(path)) {
      next();
      return;
    }

    moduleGuard(req, res, next);
  });

  protectedApiRouter.use(router);
};

registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-area-atuacao'],
  areaAtuacaoRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-tipo-evento'],
  tipoEventoRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-tipo-processo'],
  tipoProcessoRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-tipo-envolvimento'],
  tipoEnvolvimentoRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-tipos-documento'],
  tipoDocumentoRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-escritorios'],
  escritorioRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-perfis'],
  perfilRoutes
);
registerModuleRoutes(['configuracoes', 'dashboard'], planoRoutes);
registerModuleRoutes(['configuracoes', 'dashboard'], subscriptionRoutes);
registerModuleRoutes('meu-plano', planPaymentRoutes);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-situacao-processo'],
  situacaoProcessoRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-situacao-cliente'],
  situacaoClienteRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-situacao-proposta'],
  situacaoPropostaRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-etiquetas'],
  etiquetaRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-categorias'],
  categoriaRoutes
);
registerModuleRoutes(
  ['configuracoes-parametros', 'configuracoes-parametros-sistemas-cnj'],
  sistemaCnjRoutes
);
registerModuleRoutes(['configuracoes', 'dashboard'], empresaRoutes);
registerModuleRoutes('configuracoes-usuarios', usuarioRoutes);
registerModuleRoutes(['clientes', 'dashboard'], clienteRoutes);
registerModuleRoutes('fornecedores', fornecedorRoutes);
registerModuleRoutes(['clientes', 'dashboard'], clienteAtributoRoutes);
registerModuleRoutes('agenda', agendaRoutes);
registerModuleRoutes('documentos', templateRoutes);
registerModuleRoutes('documentos', tagRoutes);
registerModuleRoutes('documentos', documentRoutes);
registerModuleRoutes(['configuracoes', 'configuracoes-conteudo-blog'], blogPostRoutes);
registerModuleRoutes(['financeiro', 'dashboard'], financialRoutes);
registerModuleRoutes(['processos', 'dashboard'], processoRoutes);
registerModuleRoutes(['consulta-publica', 'processos'], consultaPublicaRoutes);
registerModuleRoutes('pipeline', fluxoTrabalhoRoutes);
registerModuleRoutes('documentos', uploadRoutes);
registerModuleRoutes('pipeline', oportunidadeRoutes);
registerModuleRoutes('pipeline', oportunidadeDocumentoRoutes);
registerModuleRoutes('tarefas', tarefaRoutes);
registerModuleRoutes('tarefas', tarefaResponsavelRoutes);
registerModuleRoutes(['clientes', 'documentos'], clienteDocumentoRoutes);
registerModuleRoutes('suporte', supportRoutes);
registerModuleRoutes('intimacoes', intimacaoRoutes);
registerModuleRoutes('configuracoes-integracoes', integrationApiKeyRoutes);
registerModuleRoutes('conversas', chatRoutes);
protectedApiRouter.use(notificationRoutes);
protectedApiRouter.use(userProfileRoutes);
app.use('/api', wahaWebhookRoutes);
app.use('/api', asaasWebhookRoutes);
app.use('/api', publicBlogPostRoutes);
app.use('/api', publicPlanoRoutes);
app.use('/api', authRoutes);
app.use('/api', protectedApiRouter);
app.use('/api/v1', authenticateRequest, usuarioRoutes);

// Swagger
const specs = swaggerJsdoc(swaggerOptions);

const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    url: '/api-docs/swagger.json',
  },
};

app.get('/api-docs/swagger.json', (_req, res) => {
  res.json(specs);
});

app.use(
  '/api-docs',
  swaggerUi.serveFiles(undefined, swaggerUiOptions),
  swaggerUi.setup(undefined, swaggerUiOptions)
);

// Static frontend (when available)
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = existsSync(frontendIndexPath);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));
}

/**
 * @swagger
 * /:
 *   get:
 *     summary: Verifica o status do backend
 *     responses:
 *       200:
 *         description: Backend up and running
 */
if (!hasFrontendBuild) {
  app.get('/', (_req, res) => {
    res.send('Backend up and running');
  });
} else {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/api-docs')) {
      return next();
    }

    res.sendFile(frontendIndexPath);
  });
}

async function startServer() {
  try {
    await Promise.all([
      ensureChatSchema(),
      ensureSupportSchema(),
      ensureProcessSyncSchema(),
      bootstrapOabMonitoradas(),
      bootstrapIntimacaoOabMonitoradas(),
    ]);
  } catch (error) {
    console.error('Failed to initialize application storage schema', error);
    process.exit(1);
  }

  cronJobs.startProjudiSyncJob();
  cronJobs.startAsaasChargeSyncJob();

  const server = app.listen(port, () => {
    const actualPort = (server.address() as AddressInfo).port;
    console.log(`Server listening on port ${actualPort}`);
  });
}

void startServer();
