import express from 'express';
import areaAtuacaoRoutes from './routes/areaAtuacaoRoutes';
import tipoEventoRoutes from './routes/tipoEventoRoutes';
import tipoProcessoRoutes from './routes/tipoProcessoRoutes';
import escritorioRoutes from './routes/escritorioRoutes';
import perfilRoutes from './routes/perfilRoutes';
import planoRoutes from './routes/planoRoutes';
import situacaoClienteRoutes from './routes/situacaoClienteRoutes';
import situacaoProcessoRoutes from './routes/situacaoProcessoRoutes';
import etiquetaRoutes from './routes/etiquetaRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import empresaRoutes from './routes/empresaRoutes';
import clienteRoutes from './routes/clienteRoutes';
import agendaRoutes from './routes/agendaRoutes';
import templateRoutes from './routes/templateRoutes';
import tagRoutes from './routes/tagRoutes';
import documentRoutes from './routes/documentRoutes';
import financialRoutes from './routes/financialRoutes';
import fluxoTrabalhoRoutes from './routes/fluxoTrabalhoRoutes';
import uploadRoutes from './routes/uploadRoutes';
import oportunidadeRoutes from './routes/oportunidadeRoutes';
import tarefaRoutes from './routes/tarefaRoutes';
import tarefaResponsavelRoutes from './routes/tarefaResponsavelRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerOptions from './swagger';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

/**
 * Middleware de CORS
 */
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ];
  const origin = req.headers.origin as string | undefined;

  if (origin && allowedOrigins.includes(origin)) {
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
app.use('/api', areaAtuacaoRoutes);
app.use('/api', tipoEventoRoutes);
app.use('/api', tipoProcessoRoutes);
app.use('/api', escritorioRoutes);
app.use('/api', perfilRoutes);
app.use('/api', planoRoutes);
app.use('/api', situacaoProcessoRoutes);
app.use('/api', situacaoClienteRoutes);
app.use('/api', etiquetaRoutes);
app.use('/api', empresaRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', clienteRoutes);
app.use('/api', agendaRoutes);
app.use('/api', templateRoutes);
app.use('/api', tagRoutes);
app.use('/api', documentRoutes);
app.use('/api', financialRoutes);
app.use('/api', fluxoTrabalhoRoutes);
app.use('/api', uploadRoutes);
app.use('/api', oportunidadeRoutes);
app.use('/api', tarefaRoutes);
app.use('/api', tarefaResponsavelRoutes);

// Swagger
const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @swagger
 * /:
 *   get:
 *     summary: Verifica o status do backend
 *     responses:
 *       200:
 *         description: Backend up and running
 */
app.get('/', (_req, res) => {
  res.send('Backend up and running');
});

// Start
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
