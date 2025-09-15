import pool from '../services/db';
export const listFluxosTrabalho = async (_req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, ativo, datacriacao, exibe_menu, ordem FROM public.fluxo_trabalho');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const listFluxoTrabalhoMenus = async (_req, res) => {
    try {
        const result = await pool.query(`SELECT id, nome, ordem
       FROM public.fluxo_trabalho
       WHERE ativo IS TRUE AND exibe_menu IS TRUE
       ORDER BY ordem ASC`);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const createFluxoTrabalho = async (req, res) => {
    const { nome, ativo, exibe_menu = true, ordem } = req.body;
    try {
        const result = await pool.query('INSERT INTO public.fluxo_trabalho (nome, ativo, exibe_menu, ordem, datacriacao) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, nome, ativo, exibe_menu, ordem, datacriacao', [nome, ativo, exibe_menu, ordem]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateFluxoTrabalho = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo, exibe_menu = true, ordem } = req.body;
    try {
        const result = await pool.query('UPDATE public.fluxo_trabalho SET nome = $1, ativo = $2, exibe_menu = $3, ordem = $4 WHERE id = $5 RETURNING id, nome, ativo, exibe_menu, ordem, datacriacao', [nome, ativo, exibe_menu, ordem, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Fluxo de trabalho não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteFluxoTrabalho = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM public.fluxo_trabalho WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Fluxo de trabalho não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
