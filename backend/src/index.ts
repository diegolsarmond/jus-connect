import express from 'express';
import areaAtuacaoRoutes from './routes/areaAtuacaoRoutes';
import tipoEventoRoutes from './routes/tipoEventoRoutes';

import situacaoProcessoRoutes from './routes/situacaoProcessoRoutes';
import situacaoClienteRoutes from './routes/situacaoClienteRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerOptions from './swagger';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Basic CORS handling so the frontend can access the API from a different origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use('/api', areaAtuacaoRoutes);
app.use('/api', tipoEventoRoutes);

app.use('/api', situacaoProcessoRoutes);
app.use('/api', situacaoClienteRoutes);
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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
