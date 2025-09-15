import pool from '../services/db';
export const listPlanos = async (_req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, valor, ativo, datacadastro FROM public.planos');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const createPlano = async (req, res) => {
    const { nome, valor, ativo } = req.body;
    try {
        const result = await pool.query('INSERT INTO public.planos (nome, valor, ativo, datacadastro) VALUES ($1, $2, $3, NOW()) RETURNING id, nome, valor, ativo, datacadastro', [nome, valor, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const updatePlano = async (req, res) => {
    const { id } = req.params;
    const { nome, valor, ativo } = req.body;
    try {
        const result = await pool.query('UPDATE public.planos SET nome = $1, valor = $2, ativo = $3 WHERE id = $4 RETURNING id, nome, valor, ativo, datacadastro', [nome, valor, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deletePlano = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM public.planos WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
