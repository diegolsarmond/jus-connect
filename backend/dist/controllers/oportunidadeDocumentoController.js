"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpportunityDocumentFromTemplate = void 0;
const db_1 = __importDefault(require("../services/db"));
const templateService_1 = require("../services/templateService");
function ensureEditorJsonContent(value) {
    if (!value)
        return null;
    if (Array.isArray(value)) {
        return value.filter((node) => !!node && typeof node === 'object' && typeof node.type === 'string');
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return ensureEditorJsonContent(parsed);
        }
        catch {
            return null;
        }
    }
    if (typeof value === 'object') {
        const maybeNodes = value.nodes;
        if (Array.isArray(maybeNodes)) {
            return ensureEditorJsonContent(maybeNodes);
        }
    }
    return null;
}
function parseTemplateContent(raw) {
    if (!raw) {
        return { contentHtml: '<p></p>', contentEditorJson: null, metadata: null };
    }
    let contentHtml = raw;
    let contentEditorJson = null;
    let metadata = null;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.content_html === 'string') {
            contentHtml = parsed.content_html;
        }
        contentEditorJson = ensureEditorJsonContent(parsed?.content_editor_json);
        metadata = parsed?.metadata ?? null;
    }
    catch {
        // Conteúdo armazenado como HTML simples.
    }
    if (!contentHtml || contentHtml.trim().length === 0) {
        contentHtml = '<p></p>';
    }
    return { contentHtml, contentEditorJson, metadata };
}
function replaceInString(value, variables) {
    return (0, templateService_1.replaceVariables)(value, variables);
}
function fillEditorNodes(nodes, variables) {
    return nodes.map((node) => {
        const next = { type: node.type };
        if (typeof node.text === 'string') {
            next.text = replaceInString(node.text, variables);
        }
        if (node.attrs) {
            next.attrs = Object.fromEntries(Object.entries(node.attrs).map(([key, value]) => [
                key,
                typeof value === 'string' ? replaceInString(value, variables) : value,
            ]));
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
            next.children = fillEditorNodes(node.children, variables);
        }
        return next;
    });
}
function slugify(text) {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^\p{L}\p{N}]+/gu, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}
function coerceString(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return null;
}
function normalizeDocument(doc) {
    if (!doc)
        return null;
    const digits = doc.replace(/\D+/g, '');
    return digits.length > 0 ? digits : null;
}
function formatDatePtBr(input) {
    if (!input)
        return null;
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return new Intl.DateTimeFormat('pt-BR').format(date);
}
function formatDateExtenso(input) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(input);
}
function formatTime(input) {
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(input);
}
async function fetchNomeById(query, id) {
    if (id === null || id === undefined)
        return null;
    const result = await db_1.default.query(query, [id]);
    if (!result.rowCount) {
        return null;
    }
    const value = result.rows[0]?.nome;
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }
    return null;
}
function buildVariables({ opportunity, solicitante, envolvidos, responsavel, empresa, }) {
    const variables = {};
    const assign = (key, value) => {
        if (value === null || value === undefined)
            return;
        const str = coerceString(value);
        if (str !== null) {
            variables[key] = str;
        }
    };
    assign('processo.numero', opportunity.numero_processo_cnj);
    assign('processo.numero_protocolo', opportunity.numero_protocolo);
    assign('processo.vara', opportunity.vara_ou_orgao);
    assign('processo.comarca', opportunity.comarca);
    assign('processo.tipo_acao', opportunity.tipo_processo_nome ?? opportunity.tipo_processo_id);
    assign('processo.tipo_acao_id', opportunity.tipo_processo_id);
    assign('processo.fase_atual', opportunity.fase_nome ?? opportunity.fase_id);
    assign('processo.fase_id', opportunity.fase_id);
    assign('processo.etapa', opportunity.etapa_nome ?? opportunity.etapa_id);
    assign('processo.etapa_id', opportunity.etapa_id);
    assign('processo.status', opportunity.status_nome ?? opportunity.status_id);
    assign('processo.status_id', opportunity.status_id);
    assign('processo.area_atuacao', opportunity.area_atuacao_nome ?? opportunity.area_atuacao_id);
    assign('processo.area_atuacao_id', opportunity.area_atuacao_id);
    assign('processo.valor_causa', opportunity.valor_causa);
    assign('processo.valor_honorarios', opportunity.valor_honorarios);
    assign('processo.percentual_honorarios', opportunity.percentual_honorarios);
    assign('processo.forma_pagamento', opportunity.forma_pagamento);
    assign('processo.qtde_parcelas', opportunity.qtde_parcelas);
    assign('processo.contingenciamento', opportunity.contingenciamento);
    assign('processo.detalhes', opportunity.detalhes);
    assign('processo.prazo_proximo', formatDatePtBr(opportunity.prazo_proximo));
    assign('oportunidade.id', opportunity.id);
    assign('oportunidade.data_criacao', formatDatePtBr(opportunity.data_criacao));
    assign('oportunidade.ultima_atualizacao', formatDatePtBr(opportunity.ultima_atualizacao));
    if (solicitante) {
        const nome = coerceString(solicitante.nome);
        if (nome) {
            assign('cliente.nome_completo', nome);
            const [first, ...rest] = nome.split(/\s+/);
            assign('cliente.primeiro_nome', first ?? '');
            assign('cliente.sobrenome', rest.join(' '));
        }
        if (solicitante.tipo === 1) {
            assign('cliente.tipo', 'Pessoa Física');
        }
        else if (solicitante.tipo === 2) {
            assign('cliente.tipo', 'Pessoa Jurídica');
        }
        const doc = normalizeDocument(solicitante.documento);
        if (doc) {
            assign('cliente.documento', doc);
            if (doc.length === 11) {
                assign('cliente.documento.cpf', doc);
            }
            else if (doc.length === 14) {
                assign('cliente.documento.cnpj', doc);
            }
        }
        assign('cliente.contato.email', solicitante.email);
        assign('cliente.contato.telefone', solicitante.telefone);
        assign('cliente.endereco.cep', normalizeDocument(solicitante.cep));
        assign('cliente.endereco.rua', solicitante.rua);
        assign('cliente.endereco.numero', solicitante.numero);
        assign('cliente.endereco.complemento', solicitante.complemento);
        assign('cliente.endereco.bairro', solicitante.bairro);
        assign('cliente.endereco.cidade', solicitante.cidade);
        assign('cliente.endereco.estado', solicitante.uf);
    }
    envolvidos.forEach((envolvido, index) => {
        const relationSlug = envolvido.relacao ? slugify(envolvido.relacao) : null;
        const indexKey = `envolvidos.${index + 1}`;
        const baseKeys = [indexKey];
        if (relationSlug) {
            baseKeys.push(`envolvidos.${relationSlug}`);
        }
        baseKeys.forEach((base) => {
            assign(`${base}.nome`, envolvido.nome);
            const doc = normalizeDocument(envolvido.documento);
            assign(`${base}.documento`, doc);
            assign(`${base}.telefone`, envolvido.telefone);
            assign(`${base}.endereco`, envolvido.endereco);
            if (relationSlug) {
                assign(`${base}.relacao`, envolvido.relacao);
            }
        });
    });
    if (responsavel) {
        assign('usuario.nome', responsavel.nome_completo);
        assign('usuario.email', responsavel.email);
        assign('usuario.telefone', responsavel.telefone);
        assign('usuario.oab', responsavel.oab);
        assign('usuario.cargo', responsavel.perfil);
    }
    if (empresa) {
        assign('escritorio.nome', empresa.nome_empresa);
        assign('escritorio.razao_social', empresa.nome_empresa);
        assign('escritorio.cnpj', normalizeDocument(empresa.cnpj));
        assign('escritorio.telefone', empresa.telefone);
        assign('escritorio.email', empresa.email);
        assign('escritorio.responsavel', empresa.responsavel);
        assign('escritorio.plano', empresa.plano);
    }
    const now = new Date();
    assign('sistema.data_atual', formatDatePtBr(now.toISOString()));
    assign('sistema.hora_atual', formatTime(now));
    assign('sistema.data_extenso', formatDateExtenso(now));
    return variables;
}
async function fetchOpportunityData(id) {
    const opportunityResult = await db_1.default.query(`SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
            vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
            valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas,
            contingenciamento, detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao
       FROM public.oportunidades WHERE id = $1`, [id]);
    if (opportunityResult.rowCount === 0) {
        return null;
    }
    const opportunityBase = opportunityResult.rows[0];
    const [tipoProcessoNome, areaAtuacaoNome, faseNome, etapaNome, statusNome,] = await Promise.all([
        fetchNomeById('SELECT nome FROM public.tipo_processo WHERE id = $1', opportunityBase.tipo_processo_id),
        fetchNomeById('SELECT nome FROM public.area_atuacao WHERE id = $1', opportunityBase.area_atuacao_id),
        fetchNomeById('SELECT nome FROM public.fluxo_trabalho WHERE id = $1', opportunityBase.fase_id),
        fetchNomeById('SELECT nome FROM public.etiquetas WHERE id = $1', opportunityBase.etapa_id),
        fetchNomeById('SELECT nome FROM public.situacao_proposta WHERE id = $1', opportunityBase.status_id),
    ]);
    const opportunity = {
        ...opportunityBase,
        tipo_processo_nome: tipoProcessoNome,
        area_atuacao_nome: areaAtuacaoNome,
        fase_nome: faseNome,
        etapa_nome: etapaNome,
        status_nome: statusNome,
    };
    const envolvidosResult = await db_1.default.query(`SELECT nome, documento, telefone, endereco, relacao
       FROM public.oportunidade_envolvidos
      WHERE oportunidade_id = $1`, [id]);
    let solicitante = null;
    if (opportunity.solicitante_id) {
        const solicitanteResult = await db_1.default.query(`SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf
         FROM public.clientes
        WHERE id = $1`, [opportunity.solicitante_id]);
        solicitante = (solicitanteResult.rowCount ?? 0) > 0 ? solicitanteResult.rows[0] : null;
    }
    let responsavel = null;
    if (opportunity.responsavel_id) {
        const responsavelResult = await db_1.default.query('SELECT id, nome_completo, email, telefone, oab, perfil FROM public.vw_usuarios WHERE id = $1', [opportunity.responsavel_id]);
        responsavel = (responsavelResult.rowCount ?? 0) > 0 ? responsavelResult.rows[0] : null;
    }
    const empresaResult = await db_1.default.query('SELECT id, nome_empresa, cnpj, telefone, email, plano, responsavel FROM public."vw.empresas" ORDER BY id LIMIT 1');
    const empresa = (empresaResult.rowCount ?? 0) > 0 ? empresaResult.rows[0] : null;
    return { opportunity, solicitante, envolvidos: envolvidosResult.rows, responsavel, empresa };
}
const createOpportunityDocumentFromTemplate = async (req, res) => {
    const { id } = req.params;
    const { templateId } = req.body;
    const opportunityId = Number(id);
    if (!Number.isFinite(opportunityId)) {
        return res.status(400).json({ error: 'Oportunidade inválida' });
    }
    const numericTemplateId = typeof templateId === 'string' ? Number(templateId) : Number(templateId);
    if (!Number.isFinite(numericTemplateId)) {
        return res.status(400).json({ error: 'templateId inválido' });
    }
    try {
        const templateResult = await db_1.default.query('SELECT id, title, content FROM templates WHERE id = $1', [numericTemplateId]);
        if (templateResult.rowCount === 0) {
            return res.status(404).json({ error: 'Template não encontrado' });
        }
        const template = templateResult.rows[0];
        const opportunityData = await fetchOpportunityData(opportunityId);
        if (!opportunityData) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }
        const { contentHtml, contentEditorJson, metadata } = parseTemplateContent(template.content);
        const variables = buildVariables(opportunityData);
        const filledHtml = (0, templateService_1.replaceVariables)(contentHtml, variables);
        const filledJson = contentEditorJson ? fillEditorNodes(contentEditorJson, variables) : null;
        const storedContent = JSON.stringify({
            content_html: filledHtml,
            content_editor_json: filledJson,
            metadata,
        });
        const insertResult = await db_1.default.query(`INSERT INTO public.oportunidade_documentos (oportunidade_id, template_id, title, content, variables)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, oportunidade_id, template_id, title, content, variables, created_at`, [
            opportunityId,
            numericTemplateId,
            template.title,
            storedContent,
            JSON.stringify(variables),
        ]);
        const document = insertResult.rows[0];
        return res.status(201).json({
            id: document.id,
            oportunidade_id: document.oportunidade_id,
            template_id: document.template_id,
            title: document.title,
            content: document.content,
            variables: document.variables,
            created_at: document.created_at,
            content_html: filledHtml,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createOpportunityDocumentFromTemplate = createOpportunityDocumentFromTemplate;
