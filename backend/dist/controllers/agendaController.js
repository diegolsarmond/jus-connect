import pool from '../services/db';
export const listAgendas = async (_req, res) => {
    try {
        const result = await pool.query('SELECT id, titulo, id_evento, tipo_evento, descricao, data, hora_inicio, hora_fim, cliente, cliente_email, cliente_telefone, tipo_local, local, lembrete, status, datacadastro FROM public."vw.agenda"');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const getTotalCompromissosHoje = async (_req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) AS total_compromissos_hoje FROM public.agenda WHERE "data" = CURRENT_DATE AND status <> 0');
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const createAgenda = async (req, res) => {
    const { titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, } = req.body;
    try {
        const result = await pool.query('INSERT INTO public.agenda (titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, datacadastro) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING id, titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, datacadastro', [
            titulo,
            tipo,
            descricao,
            data,
            hora_inicio,
            hora_fim,
            cliente,
            tipo_local,
            local,
            lembrete,
            status,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateAgenda = async (req, res) => {
    const { id } = req.params;
    const { titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, } = req.body;
    try {
        const result = await pool.query('UPDATE public.agenda SET titulo = $1, tipo = $2, descricao = $3, data = $4, hora_inicio = $5, hora_fim = $6, cliente = $7, tipo_local = $8, local = $9, lembrete = $10, status = $11 WHERE id = $12 RETURNING id, titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, datacadastro', [
            titulo,
            tipo,
            descricao,
            data,
            hora_inicio,
            hora_fim,
            cliente,
            tipo_local,
            local,
            lembrete,
            status,
            id,
        ]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Agenda não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteAgenda = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM public.agenda WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Agenda não encontrada' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
