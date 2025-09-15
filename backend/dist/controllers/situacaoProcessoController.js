import pool from '../services/db';
export const listSituacoesProcesso = async (_req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, ativo, datacriacao FROM public.situacao_processo');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const createSituacaoProcesso = async (req, res) => {
    const { nome, ativo } = req.body;
    try {
        const result = await pool.query('INSERT INTO public.situacao_processo (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao', [nome, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateSituacaoProcesso = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    try {
        const result = await pool.query('UPDATE public.situacao_processo SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao', [nome, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Situação de processo não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteSituacaoProcesso = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM public.situacao_processo WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Situação de processo não encontrada' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
