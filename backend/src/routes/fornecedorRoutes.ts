import { Router } from 'express';
import {
  listFornecedores,
  getFornecedorById,
  createFornecedor,
  updateFornecedor,
  deleteFornecedor,
} from '../controllers/fornecedorController';

const router = Router();

router.get('/fornecedores', listFornecedores);
router.get('/fornecedores/:id', getFornecedorById);
router.post('/fornecedores', createFornecedor);
router.put('/fornecedores/:id', updateFornecedor);
router.delete('/fornecedores/:id', deleteFornecedor);

export default router;
