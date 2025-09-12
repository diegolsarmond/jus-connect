import express from 'express';
import areaAtuacaoRoutes from './routes/areaAtuacaoRoutes';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', areaAtuacaoRoutes);

app.get('/', (_req, res) => {
  res.send('Backend up and running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
