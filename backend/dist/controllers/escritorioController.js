import pool from '../services/db';
export const listEscritorios = async (_req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, empresa, ativo, datacriacao FROM public.escritorios');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const createEscritorio = async (req, res) => {
    const { nome, empresa, ativo } = req.body;
    try {
        const result = await pool.query('INSERT INTO public.escritorios (nome, empresa, ativo, datacriacao) VALUES ($1, $2, $3, NOW()) RETURNING id, nome, empresa, ativo, datacriacao', [nome, empresa, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateEscritorio = async (req, res) => {
    const { id } = req.params;
    const { nome, empresa, ativo } = req.body;
    try {
        const result = await pool.query('UPDATE public.escritorios SET nome = $1, empresa = $2, ativo = $3 WHERE id = $4 RETURNING id, nome, empresa, ativo, datacriacao', [nome, empresa, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Escritório não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteEscritorio = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM public.escritorios WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Escritório não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
