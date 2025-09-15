import pool from '../services/db';
export const listAreas = async (_req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, ativo, datacriacao FROM public.area_atuacao');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const getAreaById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT id, nome, ativo, datacriacao FROM public.area_atuacao WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Area not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const createArea = async (req, res) => {
    const { nome, ativo } = req.body;
    try {
        const result = await pool.query('INSERT INTO public.area_atuacao (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao', [nome, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateArea = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    try {
        const result = await pool.query('UPDATE public.area_atuacao SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao', [nome, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Area not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteArea = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE public.area_atuacao SET ativo = FALSE WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Area not found' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
