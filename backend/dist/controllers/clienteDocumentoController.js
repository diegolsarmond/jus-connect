import pool from '../services/db';
export const listClienteDocumentos = async (req, res) => {
    const { clienteId } = req.params;
    try {
        const result = await pool.query(`SELECT cd.id, cd.nome_arquivo, cd.tipo_documento_id, td.nome AS tipo_nome,
              cd.arquivo_base64, cd.data_upload
       FROM public.cliente_documento cd
       JOIN public.tipo_documento td ON cd.tipo_documento_id = td.id
       WHERE cd.cliente_id = $1`, [clienteId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const createClienteDocumento = async (req, res) => {
    const { clienteId } = req.params;
    const { tipo_documento_id, nome_arquivo, arquivo_base64 } = req.body;
    try {
        const result = await pool.query(`INSERT INTO public.cliente_documento (cliente_id, tipo_documento_id, nome_arquivo, arquivo_base64)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome_arquivo, tipo_documento_id, data_upload`, [clienteId, tipo_documento_id, nome_arquivo, arquivo_base64]);
        const row = result.rows[0];
        const tipo = await pool.query('SELECT nome FROM public.tipo_documento WHERE id = $1', [row.tipo_documento_id]);
        res.status(201).json({
            id: row.id,
            nome_arquivo: row.nome_arquivo,
            tipo_documento_id: row.tipo_documento_id,
            tipo_nome: tipo.rows[0]?.nome || null,
            data_upload: row.data_upload,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteClienteDocumento = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM public.cliente_documento WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Documento não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
