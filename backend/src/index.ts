import express from 'express';
import areaAtuacaoRoutes from './routes/areaAtuacaoRoutes';
import tipoEventoRoutes from './routes/tipoEventoRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerOptions from './swagger';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', areaAtuacaoRoutes);
app.use('/api', tipoEventoRoutes);
const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.get('/', (_req, res) => {
  res.send('Backend up and running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
