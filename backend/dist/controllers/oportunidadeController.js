"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOportunidade = exports.createOportunidadeFaturamento = exports.listOportunidadeParcelas = exports.listOportunidadeFaturamentos = exports.updateOportunidadeEtapa = exports.updateOportunidadeStatus = exports.updateOportunidade = exports.createOportunidade = exports.listEnvolvidosByOportunidade = exports.getOportunidadeById = exports.listOportunidadesByFase = exports.listOportunidades = void 0;
const db_1 = __importDefault(require("../services/db"));
const normalizeDecimal = (input) => {
    if (typeof input === 'number' && Number.isFinite(input)) {
        return input;
    }
    if (typeof input === 'string' && input.trim().length > 0) {
        const sanitized = input.replace(/\./g, '').replace(',', '.');
        const parsed = Number(sanitized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof input === 'bigint') {
        return Number(input);
    }
    return null;
};
const normalizeInteger = (input) => {
    if (typeof input === 'number' && Number.isFinite(input)) {
        const normalized = Math.trunc(input);
        return normalized > 0 ? normalized : null;
    }
    if (typeof input === 'string' && input.trim().length > 0) {
        const parsed = Number(input);
        if (!Number.isFinite(parsed)) {
            return null;
        }
        const normalized = Math.trunc(parsed);
        return normalized > 0 ? normalized : null;
    }
    if (typeof input === 'bigint') {
        const normalized = Number(input);
        return Number.isFinite(normalized) && normalized > 0
            ? Math.trunc(normalized)
            : null;
    }
    return null;
};
const normalizeText = (input) => {
    if (typeof input !== 'string') {
        return null;
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return null;
    }
    return trimmed;
};
const normalizePaymentLabel = (input) => {
    const text = normalizeText(input);
    if (!text) {
        return null;
    }
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
};
const shouldCreateInstallments = (paymentLabel) => {
    if (!paymentLabel)
        return false;
    if (paymentLabel.includes('parcel'))
        return true;
    if (paymentLabel.includes('vista'))
        return true;
    return false;
};
const buildInstallmentValues = (total, count) => {
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(count) || count <= 0) {
        return [];
    }
    const centsTotal = Math.round(total * 100);
    const baseValue = Math.floor(centsTotal / count);
    let remainder = centsTotal - baseValue * count;
    const values = [];
    for (let index = 0; index < count; index += 1) {
        let cents = baseValue;
        if (remainder > 0) {
            cents += 1;
            remainder -= 1;
        }
        values.push(cents / 100);
    }
    return values;
};
const resetOpportunityInstallments = async (client, oportunidadeId, values) => {
    await client.query('DELETE FROM public.oportunidade_parcelas WHERE oportunidade_id = $1', [
        oportunidadeId,
    ]);
    if (values.length === 0) {
        return;
    }
    for (let index = 0; index < values.length; index += 1) {
        const valorParcela = values[index];
        await client.query(`INSERT INTO public.oportunidade_parcelas (oportunidade_id, numero_parcela, valor)
       VALUES ($1, $2, $3)`, [oportunidadeId, index + 1, valorParcela]);
    }
};
const createOrReplaceOpportunityInstallments = async (client, oportunidadeId, valorHonorarios, formaPagamento, qtdeParcelas) => {
    const normalizedPayment = normalizePaymentLabel(formaPagamento);
    const honorarios = normalizeDecimal(valorHonorarios);
    if (!honorarios || honorarios <= 0 || !shouldCreateInstallments(normalizedPayment)) {
        await resetOpportunityInstallments(client, oportunidadeId, []);
        return;
    }
    const parcelasCount = normalizeInteger(qtdeParcelas);
    const totalParcelas = normalizedPayment?.includes('parcel')
        ? parcelasCount ?? 1
        : 1;
    if (!totalParcelas || totalParcelas <= 0) {
        await resetOpportunityInstallments(client, oportunidadeId, []);
        return;
    }
    const values = buildInstallmentValues(honorarios, totalParcelas);
    await resetOpportunityInstallments(client, oportunidadeId, values);
};
const ensureOpportunityInstallments = async (client, oportunidadeId, valorHonorarios, formaPagamento, qtdeParcelas) => {
    const existing = await client.query('SELECT id FROM public.oportunidade_parcelas WHERE oportunidade_id = $1 LIMIT 1', [oportunidadeId]);
    if ((existing.rowCount ?? 0) > 0) {
        return;
    }
    await createOrReplaceOpportunityInstallments(client, oportunidadeId, valorHonorarios, formaPagamento, qtdeParcelas);
};
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
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`INSERT INTO public.oportunidades
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
            const queries = envolvidos.map((env) => client.query(`INSERT INTO public.oportunidade_envolvidos
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
        await createOrReplaceOpportunityInstallments(client, oportunidade.id, valor_honorarios, forma_pagamento, qtde_parcelas);
        await client.query('COMMIT');
        res.status(201).json(oportunidade);
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
    finally {
        client.release();
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
const listOportunidadeFaturamentos = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query(`SELECT id, oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas,
              observacoes, data_faturamento, criado_em
         FROM public.oportunidade_faturamentos
        WHERE oportunidade_id = $1
        ORDER BY data_faturamento DESC NULLS LAST, id DESC`, [id]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listOportunidadeFaturamentos = listOportunidadeFaturamentos;
const listOportunidadeParcelas = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query(`SELECT id, oportunidade_id, numero_parcela, valor, valor_pago, status, data_prevista,
              quitado_em, faturamento_id, criado_em, atualizado_em
         FROM public.oportunidade_parcelas
        WHERE oportunidade_id = $1
        ORDER BY numero_parcela ASC`, [id]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listOportunidadeParcelas = listOportunidadeParcelas;
const createOportunidadeFaturamento = async (req, res) => {
    const { id } = req.params;
    const { forma_pagamento, condicao_pagamento, valor, parcelas, observacoes, data_faturamento, } = req.body;
    const formaValue = normalizeText(forma_pagamento);
    if (!formaValue) {
        return res
            .status(400)
            .json({ error: 'forma_pagamento é obrigatório e deve ser uma string.' });
    }
    const parsedValor = valor === undefined ? null : normalizeDecimal(valor);
    if (valor !== undefined && parsedValor === null) {
        return res.status(400).json({ error: 'valor inválido.' });
    }
    const condicaoValue = normalizeText(condicao_pagamento);
    const condicaoNormalized = normalizePaymentLabel(condicaoValue);
    const isParcelado = condicaoNormalized ? condicaoNormalized.includes('parcel') : false;
    let parsedParcelas = null;
    if (isParcelado) {
        parsedParcelas = normalizeInteger(parcelas);
        if (parsedParcelas === null) {
            return res
                .status(400)
                .json({ error: 'parcelas é obrigatório para pagamentos parcelados.' });
        }
    }
    let faturamentoDate = null;
    if (data_faturamento !== undefined && data_faturamento !== null && data_faturamento !== '') {
        const parsedDate = new Date(data_faturamento);
        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: 'data_faturamento inválida.' });
        }
        faturamentoDate = parsedDate;
    }
    const observations = normalizeText(observacoes);
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const opportunityResult = await client.query(`SELECT id, forma_pagamento, qtde_parcelas, valor_honorarios
         FROM public.oportunidades
        WHERE id = $1`, [id]);
        if (opportunityResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }
        const opportunity = opportunityResult.rows[0];
        await ensureOpportunityInstallments(client, Number(id), opportunity.valor_honorarios, opportunity.forma_pagamento, opportunity.qtde_parcelas);
        const installmentsResult = await client.query(`SELECT id, valor, numero_parcela
         FROM public.oportunidade_parcelas
        WHERE oportunidade_id = $1
          AND status = 'pendente'
        ORDER BY numero_parcela ASC`, [id]);
        const pendingInstallments = installmentsResult.rows.map((row) => ({
            id: Number(row.id),
            valor: Number(row.valor),
        }));
        let installmentsToClose = [];
        if (pendingInstallments.length > 0) {
            if (isParcelado) {
                const desiredCount = parsedParcelas ?? 1;
                if (desiredCount > pendingInstallments.length) {
                    await client.query('ROLLBACK');
                    return res
                        .status(400)
                        .json({ error: 'Quantidade de parcelas indisponível para faturamento.' });
                }
                installmentsToClose = pendingInstallments.slice(0, desiredCount);
            }
            else {
                installmentsToClose = pendingInstallments;
            }
        }
        let valorToPersist = parsedValor;
        if (installmentsToClose.length > 0) {
            const sum = installmentsToClose.reduce((acc, installment) => acc + installment.valor, 0);
            if (valorToPersist === null) {
                valorToPersist = sum;
            }
            else if (Math.abs(valorToPersist - sum) > 0.009) {
                valorToPersist = sum;
            }
        }
        const parcelasToPersist = isParcelado
            ? parsedParcelas ?? (installmentsToClose.length > 0 ? installmentsToClose.length : null)
            : installmentsToClose.length > 0
                ? installmentsToClose.length
                : null;
        const faturamentoDateValue = faturamentoDate ?? new Date();
        const insertResult = await client.query(`INSERT INTO public.oportunidade_faturamentos
         (oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas, observacoes, data_faturamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas,
                 observacoes, data_faturamento, criado_em`, [
            id,
            formaValue,
            condicaoValue,
            valorToPersist,
            parcelasToPersist,
            observations,
            faturamentoDateValue,
        ]);
        const faturamento = insertResult.rows[0];
        if (installmentsToClose.length > 0) {
            for (const installment of installmentsToClose) {
                await client.query(`UPDATE public.oportunidade_parcelas
             SET status = 'quitado',
                 valor_pago = $2,
                 quitado_em = $3,
                 faturamento_id = $4,
                 atualizado_em = NOW()
           WHERE id = $1`, [installment.id, installment.valor, faturamentoDateValue, faturamento.id]);
            }
        }
        await client.query('COMMIT');
        res.status(201).json(faturamento);
    }
    catch (error) {
        try {
            await client.query('ROLLBACK');
        }
        catch (rollbackError) {
            console.error('Rollback failed after faturamento creation error.', rollbackError);
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
    finally {
        client.release();
    }
};
exports.createOportunidadeFaturamento = createOportunidadeFaturamento;
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
