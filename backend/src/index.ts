import express from 'express';
import { AddressInfo } from 'net';
import path from 'path';
import { existsSync } from 'fs';
import areaAtuacaoRoutes from './routes/areaAtuacaoRoutes';
import tipoEventoRoutes from './routes/tipoEventoRoutes';
import tipoProcessoRoutes from './routes/tipoProcessoRoutes';
import escritorioRoutes from './routes/escritorioRoutes';
import perfilRoutes from './routes/perfilRoutes';
import planoRoutes from './routes/planoRoutes';
import situacaoClienteRoutes from './routes/situacaoClienteRoutes';
import situacaoProcessoRoutes from './routes/situacaoProcessoRoutes';
import situacaoPropostaRoutes from './routes/situacaoPropostaRoutes';
import etiquetaRoutes from './routes/etiquetaRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import empresaRoutes from './routes/empresaRoutes';
import clienteRoutes from './routes/clienteRoutes';
import agendaRoutes from './routes/agendaRoutes';
import templateRoutes from './routes/templateRoutes';
import tagRoutes from './routes/tagRoutes';
import documentRoutes from './routes/documentRoutes';
import financialRoutes from './routes/financialRoutes';
import processoRoutes from './routes/processoRoutes';
import fluxoTrabalhoRoutes from './routes/fluxoTrabalhoRoutes';
import uploadRoutes from './routes/uploadRoutes';
import oportunidadeRoutes from './routes/oportunidadeRoutes';
import tarefaRoutes from './routes/tarefaRoutes';
import tarefaResponsavelRoutes from './routes/tarefaResponsavelRoutes';
import tipoDocumentoRoutes from './routes/tipoDocumentoRoutes';
import clienteDocumentoRoutes from './routes/clienteDocumentoRoutes';
import supportRoutes from './routes/supportRoutes';
import notificationRoutes from './routes/notificationRoutes';
import integrationApiKeyRoutes from './routes/integrationApiKeyRoutes';
import chatRoutes from './routes/chatRoutes';
import wahaWebhookRoutes from './routes/wahaWebhookRoutes';
import authRoutes from './routes/authRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerOptions from './swagger';
import cronJobs from './services/cronJobs';
import { ensureChatSchema } from './services/chatSchema';
import { authenticateRequest } from './middlewares/authMiddleware';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 0;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:4200',
  'https://jusconnec.quantumtecnologia.com.br',
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

protectedApiRouter.use(areaAtuacaoRoutes);
protectedApiRouter.use(tipoEventoRoutes);
protectedApiRouter.use(tipoProcessoRoutes);
protectedApiRouter.use(tipoDocumentoRoutes);
protectedApiRouter.use(escritorioRoutes);
protectedApiRouter.use(perfilRoutes);
protectedApiRouter.use(planoRoutes);
protectedApiRouter.use(situacaoProcessoRoutes);
protectedApiRouter.use(situacaoClienteRoutes);
protectedApiRouter.use(situacaoPropostaRoutes);
protectedApiRouter.use(etiquetaRoutes);
protectedApiRouter.use(empresaRoutes);
protectedApiRouter.use(usuarioRoutes);
protectedApiRouter.use(clienteRoutes);
protectedApiRouter.use(agendaRoutes);
protectedApiRouter.use(templateRoutes);
protectedApiRouter.use(tagRoutes);
protectedApiRouter.use(documentRoutes);
protectedApiRouter.use(financialRoutes);
protectedApiRouter.use(processoRoutes);
protectedApiRouter.use(fluxoTrabalhoRoutes);
protectedApiRouter.use(uploadRoutes);
protectedApiRouter.use(oportunidadeRoutes);
protectedApiRouter.use(tarefaRoutes);
protectedApiRouter.use(tarefaResponsavelRoutes);
protectedApiRouter.use(clienteDocumentoRoutes);
protectedApiRouter.use(supportRoutes);
protectedApiRouter.use(notificationRoutes);
protectedApiRouter.use(integrationApiKeyRoutes);
protectedApiRouter.use(chatRoutes);

app.use('/api', wahaWebhookRoutes);
app.use('/api', authRoutes);
app.use('/api', protectedApiRouter);
app.use('/api/v1', authenticateRequest, usuarioRoutes);

// Background jobs
cronJobs.startProjudiSyncJob();

// Swagger
const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

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
    await ensureChatSchema();
  } catch (error) {
    console.error('Failed to initialize chat storage schema', error);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    const actualPort = (server.address() as AddressInfo).port;
    console.log(`Server listening on port ${actualPort}`);
  });
}

void startServer();
