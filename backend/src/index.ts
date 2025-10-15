import './utils/loadEnv';
import express, { Request, Response, Router } from 'express';
import { AddressInfo } from 'net';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import routesRegistry from './routes/registry';
import usuarioRoutes from './routes/usuarioRoutes';
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

const saveRawBody = (req: Request & { rawBody?: string }, _res: Response, buffer: Buffer) => {
  if (buffer?.length) {
    req.rawBody = buffer.toString('utf-8');
  }
};

const largePayloadJson = express.json({ limit: '50mb', verify: saveRawBody });

app.use('/api/support/:id/messages', largePayloadJson);
app.use('/api/clientes/:clienteId/documentos', largePayloadJson);

app.use(
  express.json({
    limit: '1mb',
    verify: saveRawBody,
  })
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV === 'test') {
  app.post('/__test__/echo', (req, res) => {
    res.json({ body: req.body ?? null });
  });

  app.post('/api/support/:id/messages', (req, res, next) => {
    if (req.headers['x-test-bypass'] === 'true') {
      const serialized = JSON.stringify(req.body ?? null);
      res.json({ size: Buffer.byteLength(serialized, 'utf8') });
      return;
    }

    next();
  });

  app.post('/api/clientes/:clienteId/documentos', (req, res, next) => {
    if (req.headers['x-test-bypass'] === 'true') {
      const serialized = JSON.stringify(req.body ?? null);
      res.json({ size: Buffer.byteLength(serialized, 'utf8') });
      return;
    }

    next();
  });
}

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

const defaultAllowedOriginsEnv = process.env.CORS_DEFAULT_ORIGINS || '';
const defaultAllowedOrigins = defaultAllowedOriginsEnv
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!defaultAllowedOrigins.length) {
  defaultAllowedOrigins.push('http://localhost:5173');
}

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

let usuariosModuleGuard: ReturnType<typeof authorizeModules> | null = null;

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

  return moduleGuard;
};

for (const { modules, router, public: isPublic } of routesRegistry) {
  if (isPublic) {
    app.use('/api', router);
    continue;
  }

  if (modules) {
    const moduleGuard = registerModuleRoutes(modules, router);

    if (router === usuarioRoutes) {
      usuariosModuleGuard = moduleGuard;
    }

    continue;
  }

  protectedApiRouter.use(router);
}
app.use('/api', protectedApiRouter);

const legacyUsuariosRouter = express.Router();
legacyUsuariosRouter.use(authenticateRequest);

if (usuariosModuleGuard) {
  legacyUsuariosRouter.use(usuariosModuleGuard);
} else {
  legacyUsuariosRouter.use(authorizeModules('configuracoes-usuarios'));
}

legacyUsuariosRouter.use(usuarioRoutes);

app.use('/api/v1', legacyUsuariosRouter);

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

if (process.env.NODE_ENV !== 'test') {
  void startServer();
}

export { app };
