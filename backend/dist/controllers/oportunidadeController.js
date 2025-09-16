"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOportunidade = exports.updateOportunidadeEtapa = exports.updateOportunidadeStatus = exports.updateOportunidade = exports.createOportunidade = exports.listEnvolvidosByOportunidade = exports.getOportunidadeById = exports.listOportunidadesByFase = exports.listOportunidades = void 0;
const db_1 = __importDefault(require("../services/db"));
const listOportunidades = async (_req, res) => {
    try {
        const result = await db_1.default.query(`SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
              detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao
       FROM public.oportunidades`);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listOportunidades = listOportunidades;
const listOportunidadesByFase = async (req, res) => {
    const { faseId } = req.params;
    try {
        const result = await db_1.default.query(`SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
              detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao
       FROM public.oportunidades WHERE fase_id = $1`, [faseId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listOportunidadesByFase = listOportunidadesByFase;
const getOportunidadeById = async (req, res) => {
    const { id } = req.params;
    try {
        const oportunidadeResult = await db_1.default.query(`SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
              detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao
       FROM public.oportunidades WHERE id = $1`, [id]);
        if (oportunidadeResult.rowCount === 0) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }
        const envolvidosResult = await db_1.default.query(`SELECT nome, documento, telefone, endereco, relacao
       FROM public.oportunidade_envolvidos
       WHERE oportunidade_id = $1`, [id]);
        const oportunidade = oportunidadeResult.rows[0];
        oportunidade.envolvidos = envolvidosResult.rows.map((env) => ({
            nome: env.nome,
            cpf_cnpj: env.documento,
            telefone: env.telefone,
            endereco: env.endereco,
            relacao: env.relacao,
        }));
        res.json(oportunidade);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getOportunidadeById = getOportunidadeById;
const listEnvolvidosByOportunidade = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query(`SELECT id, oportunidade_id, nome, documento, telefone, endereco, relacao
       FROM public.oportunidade_envolvidos
       WHERE oportunidade_id = $1`, [id]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listEnvolvidosByOportunidade = listEnvolvidosByOportunidade;
const createOportunidade = async (req, res) => {
    const { tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo, vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id, valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento, detalhes, documentos_anexados, criado_por, envolvidos, } = req.body;
    try {
        const result = await db_1.default.query(`INSERT INTO public.oportunidades
       (tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
        vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
        valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
        detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
       RETURNING id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
                 vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
                 valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
                 detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao`, [
            tipo_processo_id,
            area_atuacao_id,
            responsavel_id,
            numero_processo_cnj,
            numero_protocolo,
            vara_ou_orgao,
            comarca,
            fase_id,
            etapa_id,
            prazo_proximo,
            status_id,
            solicitante_id,
            valor_causa,
            valor_honorarios,
            percentual_honorarios,
            forma_pagamento,
            qtde_parcelas,
            contingenciamento,
            detalhes,
            documentos_anexados,
            criado_por,
        ]);
        const oportunidade = result.rows[0];
        if (Array.isArray(envolvidos) && envolvidos.length > 0) {
            const queries = envolvidos.map((env) => db_1.default.query(`INSERT INTO public.oportunidade_envolvidos
           (oportunidade_id, nome, documento, telefone, endereco, relacao)
           VALUES ($1, $2, $3, $4, $5, $6)`, [
                oportunidade.id,
                env.nome || null,
                env.cpf_cnpj || null,
                env.telefone || null,
                env.endereco || null,
                env.relacao || null,
            ]));
            await Promise.all(queries);
        }
        res.status(201).json(oportunidade);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createOportunidade = createOportunidade;
const updateOportunidade = async (req, res) => {
    const { id } = req.params;
    const { tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo, vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id, valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento, detalhes, documentos_anexados, criado_por, envolvidos, } = req.body;
    try {
        const result = await db_1.default.query(`UPDATE public.oportunidades SET
         tipo_processo_id = $1,
         area_atuacao_id = $2,
         responsavel_id = $3,
         numero_processo_cnj = $4,
         numero_protocolo = $5,
         vara_ou_orgao = $6,
         comarca = $7,
         fase_id = $8,
         etapa_id = $9,
         prazo_proximo = $10,
         status_id = $11,
         solicitante_id = $12,
         valor_causa = $13,
         valor_honorarios = $14,
         percentual_honorarios = $15,
         forma_pagamento = $16,
         qtde_parcelas = $17,
         contingenciamento = $18,
         detalhes = $19,
         documentos_anexados = $20,
         criado_por = $21,
         ultima_atualizacao = NOW()
       WHERE id = $22
       RETURNING id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
                 vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
                 valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
                 detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao`, [
            tipo_processo_id,
            area_atuacao_id,
            responsavel_id,
            numero_processo_cnj,
            numero_protocolo,
            vara_ou_orgao,
            comarca,
            fase_id,
            etapa_id,
            prazo_proximo,
            status_id,
            solicitante_id,
            valor_causa,
            valor_honorarios,
            percentual_honorarios,
            forma_pagamento,
            qtde_parcelas,
            contingenciamento,
            detalhes,
            documentos_anexados,
            criado_por,
            id,
        ]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }
        if (Array.isArray(envolvidos)) {
            await db_1.default.query('DELETE FROM public.oportunidade_envolvidos WHERE oportunidade_id = $1', [id]);
            const queries = envolvidos.map((env) => db_1.default.query(`INSERT INTO public.oportunidade_envolvidos
           (oportunidade_id, nome, documento, telefone, endereco, relacao)
           VALUES ($1, $2, $3, $4, $5, $6)`, [
                id,
                env.nome || null,
                env.cpf_cnpj || null,
                env.telefone || null,
                env.endereco || null,
                env.relacao || null,
            ]));
            await Promise.all(queries);
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateOportunidade = updateOportunidade;
const updateOportunidadeStatus = async (req, res) => {
    const { id } = req.params;
    const { status_id } = req.body;
    const parsedStatus = status_id === null || status_id === undefined || status_id === ''
        ? null
        : Number(status_id);
    if (parsedStatus !== null && Number.isNaN(parsedStatus)) {
        return res.status(400).json({ error: 'status_id inválido' });
    }
    try {
        const result = await db_1.default.query(`UPDATE public.oportunidades
       SET status_id = $1,
           ultima_atualizacao = NOW()
       WHERE id = $2
       RETURNING id, status_id, ultima_atualizacao`, [parsedStatus, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateOportunidadeStatus = updateOportunidadeStatus;
const updateOportunidadeEtapa = async (req, res) => {
    const { id } = req.params;
    const { etapa_id } = req.body;
    try {
        const result = await db_1.default.query(`UPDATE public.oportunidades
       SET etapa_id = $1,
           ultima_atualizacao = NOW()
       WHERE id = $2
       RETURNING id, etapa_id, ultima_atualizacao`, [etapa_id, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateOportunidadeEtapa = updateOportunidadeEtapa;
const deleteOportunidade = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.oportunidades WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteOportunidade = deleteOportunidade;
