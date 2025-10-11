import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProcessCard } from "@/components/ui/process-card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
} from "@/components/ui/pagination";
import {
    Archive,
    Check,
    Calendar,
    Clock,
    FileText,
    Gavel as GavelIcon,
    Landmark,
    MapPin,
    Search,
    Users as UsersIcon,
    ChevronsUpDown,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Loader2,
} from "lucide-react";

const NO_EXISTING_CLIENT_SELECT_VALUE = "__no_existing_client__";
const NO_PROPOSTA_SELECT_VALUE = "__no_proposta__";
const VALID_UF_CODES = new Set([
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
]);

interface ProcessoCliente {
    id: number;
    nome: string;
    documento: string;
    papel: string;
}

interface ProcessoAdvogado {
    id: number;
    nome: string;
    funcao?: string;
}

interface ProcessoProposta {
    id: number;
    label: string;
    solicitante?: string | null;
}

export interface Processo {
    id: number;
    numero: string;
    dataDistribuicao: string;
    status: string;
    tipo: string;
    cliente: ProcessoCliente;
    advogados: ProcessoAdvogado[];
    classeJudicial: string;
    assunto: string;
    jurisdicao: string;
    orgaoJulgador: string;
    proposta: ProcessoProposta | null;
    ultimaSincronizacao: string | null;
    consultasApiCount: number;
    movimentacoesCount: number;
}

interface ProcessoSummary {
    andamento: number;
    arquivados: number;
    clientes: number;
    totalSincronizacoes: number;
    statusOptions: string[];
    tipoOptions: string[];
}

interface ProcessoLoadResult {
    items: Processo[];
    total: number;
    page: number;
    pageSize: number;
    summary: ProcessoSummary;
}

interface Municipio {
    id: number;
    nome: string;
}

interface ClienteResumo {
    id: number;
    nome: string;
    documento: string;
    tipo: string;
}

interface ApiCliente {
    id: number;
    nome?: string;
    documento?: string;
    tipo?: string;
}

interface ApiProcessoCliente {
    id: number;
    nome: string | null;
    documento: string | null;
    tipo: string | null;
}

interface ApiProcessoOportunidade {
    id?: number | string | null;
    sequencial_empresa?: number | string | null;
    data_criacao?: string | null;
    numero_processo_cnj?: string | null;
    numero_protocolo?: string | null;
    solicitante_id?: number | string | null;
    solicitante_nome?: string | null;
}

interface ApiProcesso {
    id: number;
    cliente_id: number;
    numero: string;
    uf: string | null;
    municipio: string | null;
    orgao_julgador: string | null;
    tipo: string | null;
    status: string | null;
    classe_judicial: string | null;
    assunto: string | null;
    jurisdicao: string | null;
    advogado_responsavel: string | null;
    data_distribuicao: string | null;
    criado_em: string | null;
    atualizado_em: string | null;
    cliente?: ApiProcessoCliente | null;
    oportunidade_id?: number | string | null;
    oportunidade?: ApiProcessoOportunidade | null;
    advogados?: ApiProcessoAdvogado[] | null;
    ultima_sincronizacao?: string | null;
    ultima_movimentacao?: string | null;
    consultas_api_count?: number | string | null;
    movimentacoes_count?: number | string | null;
}

interface ApiProcessoAdvogado {
    id?: number | string | null;
    nome?: string | null;
    name?: string | null;
    funcao?: string | null;
    cargo?: string | null;
    perfil?: string | null;
    perfil_nome?: string | null;
}

interface AdvogadoOption {
    id: string;
    nome: string;
    descricao?: string;
}

interface SimpleOption {
    id: string;
    nome: string;
}

interface ApiOportunidade {
    id?: number | string | null;
    sequencial_empresa?: number | string | null;
    data_criacao?: string | null;
    solicitante_nome?: string | null;
    solicitante?: { nome?: string | null } | null;
}

interface PropostaOption {
    id: string;
    label: string;
    solicitante?: string | null;
    sequencial?: number | null;
    dataCriacao?: string | null;
    solicitanteId: string | null;
}

interface ProcessFormState {
    numero: string;
    uf: string;
    municipio: string;
    clienteId: string;
    advogados: string[];
    propostaId: string;
    dataDistribuicao: string;
    instancia: string;
    instanciaOutro: string;
    areaAtuacaoId: string;
    tipoProcessoId: string;
    sistemaCnjId: string;
    monitorarProcesso: boolean;
}

interface OabMonitor {
    id: number;
    uf: string;
    numero: string;
    createdAt: string | null;
    updatedAt: string | null;
    usuarioId: number | null;
    usuarioNome: string | null;
    usuarioOab: string | null;
}

interface OabUsuarioOption {
    id: string;
    nome: string;
    oab: string | null;
    oabNumero: string | null;
    oabUf: string | null;
}

const UNASSIGNED_PAGE_SIZE = 5;

interface ApiProcessoParticipant {
    id?: number | string | null;
    name?: string | null;
    document?: string | null;
    role?: string | null;
    side?: string | null;
    type?: string | null;
    person_type?: string | null;
    party_role?: string | null;
}

interface ProcessoParticipantOption {
    id: string;
    name: string;
    document: string;
    side: string | null;
    role: string | null;
    type: string | null;
}

interface UnassignedProcessDetail {
    process: Processo;
    form: ProcessFormState;
    grau: string;
    participants: ProcessoParticipantOption[];
    selectedExistingClientId: string;
    selectedParticipantIds: string[];
    primaryParticipantId: string | null;
    relationshipByParticipantId: Record<string, string>;
    selectedPropostaId: string;
    saving: boolean;
    error: string | null;
}

const formatProcessNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 20);
    const match = digits.match(/^(\d{0,7})(\d{0,2})(\d{0,4})(\d{0,1})(\d{0,2})(\d{0,4})$/);
    if (!match) return digits;
    const [, part1 = "", part2 = "", part3 = "", part4 = "", part5 = "", part6 = ""] = match;

    let formatted = part1;
    if (part2) formatted += `-${part2}`;
    if (part3) formatted += `.${part3}`;
    if (part4) formatted += `.${part4}`;
    if (part5) formatted += `.${part5}`;
    if (part6) formatted += `.${part6}`;
    return formatted;
};

const formatDateToPtBR = (value: string | null | undefined): string => {
    if (!value) {
        return "Não informado";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Não informado";
    }

    return date.toLocaleDateString("pt-BR");
};

const formatDateTimeToPtBR = (value: string | null | undefined): string => {
    if (!value) {
        return "Sem registros";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Data inválida";
    }

    return date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    });
};

const formatOabDigits = (value: string): string => value.replace(/\D/g, "").slice(0, 12);
const normalizeUf = (value: string): string => value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();

const mapApiOabMonitor = (payload: Record<string, unknown>): OabMonitor | null => {
    const idValue = parseOptionalInteger(payload.id);
    const ufRaw = pickFirstNonEmptyString(
        typeof payload.uf === "string" ? payload.uf : undefined,
        typeof (payload as { UF?: string }).UF === "string" ? (payload as { UF: string }).UF : undefined,
    );
    const numeroRaw = pickFirstNonEmptyString(
        typeof payload.numero === "string" ? payload.numero : undefined,
        typeof (payload as { number?: string }).number === "string"
            ? (payload as { number: string }).number
            : undefined,
    );

    if (!idValue || !ufRaw || !numeroRaw) {
        return null;
    }

    const numero = formatOabDigits(numeroRaw);
    if (!numero) {
        return null;
    }

    const uf = normalizeUf(ufRaw);
    if (uf.length !== 2) {
        return null;
    }

    const createdAt = pickFirstNonEmptyString(
        typeof (payload as { createdAt?: string }).createdAt === "string"
            ? (payload as { createdAt: string }).createdAt
            : undefined,
        typeof (payload as { created_at?: string }).created_at === "string"
            ? (payload as { created_at: string }).created_at
            : undefined,
    );

    const updatedAt = pickFirstNonEmptyString(
        typeof (payload as { updatedAt?: string }).updatedAt === "string"
            ? (payload as { updatedAt: string }).updatedAt
            : undefined,
        typeof (payload as { updated_at?: string }).updated_at === "string"
            ? (payload as { updated_at: string }).updated_at
            : undefined,
    );

    const usuarioId = parseOptionalInteger(
        (payload as { usuarioId?: unknown }).usuarioId ??
            (payload as { usuario_id?: unknown }).usuario_id,
    );

    const usuarioNome = pickFirstNonEmptyString(
        typeof (payload as { usuarioNome?: string }).usuarioNome === "string"
            ? (payload as { usuarioNome: string }).usuarioNome
            : undefined,
        typeof (payload as { usuario_nome?: string }).usuario_nome === "string"
            ? (payload as { usuario_nome: string }).usuario_nome
            : undefined,
        typeof (payload as { nome_usuario?: string }).nome_usuario === "string"
            ? (payload as { nome_usuario: string }).nome_usuario
            : undefined,
    );

    const usuarioOab = pickFirstNonEmptyString(
        typeof (payload as { usuarioOab?: string }).usuarioOab === "string"
            ? (payload as { usuarioOab: string }).usuarioOab
            : undefined,
        typeof (payload as { usuario_oab?: string }).usuario_oab === "string"
            ? (payload as { usuario_oab: string }).usuario_oab
            : undefined,
    );

    return {
        id: idValue,
        uf,
        numero,
        createdAt: createdAt ?? null,
        updatedAt: updatedAt ?? null,
        usuarioId: usuarioId,
        usuarioNome: usuarioNome ?? null,
        usuarioOab: usuarioOab ?? null,
    };
};

const formatOabDisplay = (numero: string, uf: string): string => {
    const digits = formatOabDigits(numero);
    const padded = digits.padStart(6, "0");
    const ufDisplay = normalizeUf(uf);
    return `${padded}/${ufDisplay}`;
};

const mapApiParticipantOption = (
    participant: ApiProcessoParticipant,
    index: number,
): ProcessoParticipantOption | null => {
    const name =
        pickFirstNonEmptyString(
            typeof participant.name === "string" ? participant.name : undefined,
            typeof participant.role === "string" ? participant.role : undefined,
            typeof participant.party_role === "string" ? participant.party_role : undefined,
        ) ?? `Envolvido ${index + 1}`;

    const document = typeof participant.document === "string" ? participant.document.trim() : "";

    const type = pickFirstNonEmptyString(
        typeof participant.type === "string" ? participant.type : undefined,
        typeof participant.person_type === "string" ? participant.person_type : undefined,
    );

    const role = pickFirstNonEmptyString(
        typeof participant.role === "string" ? participant.role : undefined,
        typeof participant.party_role === "string" ? participant.party_role : undefined,
    );

    const side = typeof participant.side === "string" ? participant.side : null;

    const idCandidates: string[] = [];

    if (typeof participant.id === "string" && participant.id.trim().length > 0) {
        idCandidates.push(participant.id.trim());
    } else if (typeof participant.id === "number" && Number.isFinite(participant.id)) {
        idCandidates.push(String(Math.trunc(participant.id)));
    }

    if (document) {
        const digitsForId = document.replace(/\D/g, "");
        if (digitsForId) {
            idCandidates.push(`doc-${digitsForId}`);
        }
    }

    idCandidates.push(`participant-${index}`);

    const uniqueId = idCandidates.find((candidate) => candidate.length > 0) ?? `participant-${index}`;

    return {
        id: uniqueId,
        name,
        document,
        side,
        role: role ?? null,
        type: type ?? null,
    };
};

const extractParticipantOptions = (payload: Record<string, unknown>): ProcessoParticipantOption[] => {
    const participantsPayload = Array.isArray((payload as { participants?: unknown }).participants)
        ? ((payload as { participants: ApiProcessoParticipant[] }).participants)
        : [];
    const partiesPayload = Array.isArray((payload as { parties?: unknown }).parties)
        ? ((payload as { parties: ApiProcessoParticipant[] }).parties)
        : [];

    const combined = [...participantsPayload, ...partiesPayload];

    const options: ProcessoParticipantOption[] = [];
    const usedIds = new Set<string>();
    const usedDocuments = new Set<string>();

    combined.forEach((participant, index) => {
        if (!participant || typeof participant !== "object") {
            return;
        }

        const option = mapApiParticipantOption(participant as ApiProcessoParticipant, index);
        if (!option) {
            return;
        }

        const digits = option.document.replace(/\D/g, "");
        if (digits) {
            if (usedDocuments.has(digits)) {
                return;
            }
            usedDocuments.add(digits);
        }

        let candidateId = option.id;
        while (usedIds.has(candidateId)) {
            candidateId = `${candidateId}-${index}`;
        }
        usedIds.add(candidateId);

        options.push({ ...option, id: candidateId });
    });

    return options;
};

const getParticipantDefaultRelationship = (participant: ProcessoParticipantOption): string => {
    if (participant.role) {
        return participant.role;
    }

    if (participant.side) {
        return participant.side.charAt(0).toUpperCase() + participant.side.slice(1);
    }

    return "";
};

const getParticipantDocumentDigits = (participant: ProcessoParticipantOption): string =>
    participant.document.replace(/\D/g, "");

const pickFirstNonEmptyString = (
    ...values: Array<string | null | undefined>
): string | undefined => {
    for (const value of values) {
        if (!value || typeof value !== "string") {
            continue;
        }

        const trimmed = value.trim();
        if (trimmed) {
            return trimmed;
        }
    }

    return undefined;
};

const getNameFromEmail = (email: string | null | undefined): string | undefined => {
    if (!email || typeof email !== "string") {
        return undefined;
    }

    const trimmed = email.trim();
    if (!trimmed) {
        return undefined;
    }

    const [localPart] = trimmed.split("@");
    if (!localPart) {
        return undefined;
    }

    return localPart
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase())
        .trim();
};

const parseApiInteger = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return 0;
        }

        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
};

const parseOptionalInteger = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
};

const extractOptionItems = (
    payload: unknown,
): Record<string, unknown>[] => {
    if (Array.isArray(payload)) {
        return payload.filter(
            (item): item is Record<string, unknown> =>
                item !== null && typeof item === "object",
        );
    }

    if (payload && typeof payload === "object") {
        const directData = (payload as { data?: unknown }).data;
        if (Array.isArray(directData)) {
            return directData.filter(
                (item): item is Record<string, unknown> =>
                    item !== null && typeof item === "object",
            );
        }

        const directRows = (payload as { rows?: unknown }).rows;
        if (Array.isArray(directRows)) {
            return directRows.filter(
                (item): item is Record<string, unknown> =>
                    item !== null && typeof item === "object",
            );
        }

        const nestedRows = (payload as { data?: { rows?: unknown } }).data?.rows;
        if (Array.isArray(nestedRows)) {
            return nestedRows.filter(
                (item): item is Record<string, unknown> =>
                    item !== null && typeof item === "object",
            );
        }
    }

    return [];
};

const normalizeClienteTipo = (value: string | null | undefined): string => {
    if (!value) {
        return "";
    }

    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
};

const resolveClientePapel = (tipo: string | null | undefined): string => {
    const normalized = normalizeClienteTipo(tipo);

    if (
        normalized.includes("JURIDICA") ||
        ["2", "J", "PJ"].includes(normalized)
    ) {
        return "Pessoa Jurídica";
    }

    if (
        normalized.includes("FISICA") ||
        ["1", "F", "PF"].includes(normalized)
    ) {
        return "Pessoa Física";
    }

    return "Parte";
};

const formatPropostaLabel = (
    id: number,
    sequencial: number | null,
    dataCriacao: string | null,
    solicitante?: string | null,
): string => {
    const numero = sequencial && sequencial > 0 ? sequencial : id;
    let ano = new Date().getFullYear();

    if (dataCriacao) {
        const parsed = new Date(dataCriacao);
        if (!Number.isNaN(parsed.getTime())) {
            ano = parsed.getFullYear();
        }
    }

    const solicitanteNome =
        typeof solicitante === "string" && solicitante.trim().length > 0
            ? solicitante.trim()
            : "";

    return `Proposta #${numero}/${ano}${solicitanteNome ? ` - ${solicitanteNome}` : ""}`;
};

const INSTANCIA_OUTRO_VALUE = "Outro / Especificar";

const INSTANCIA_OPTIONS = [
    "1ª Vara Cível",
    "2ª Vara Cível",
    "Vara Criminal",
    "Vara de Família",
    "Vara da Fazenda Pública",
    "Juizado Especial Cível",
    "Juizado Especial Criminal",
    "Vara do Trabalho",
    "Tribunal de Justiça (TJ) — 2ª Instância",
    "Tribunal Regional Federal (TRF) — 2ª Instância",
    "Tribunal Regional do Trabalho (TRT) — 2ª Instância",
    "Tribunal Regional Eleitoral (TRE) — 2ª Instância",
    "Turma Recursal (Juizados)",
    "Tribunal Superior do Trabalho (TST)",
    "Tribunal Superior Eleitoral (TSE)",
    "Superior Tribunal de Justiça (STJ)",
    "Supremo Tribunal Federal (STF)",
    INSTANCIA_OUTRO_VALUE,

];

const createEmptyProcessForm = (): ProcessFormState => ({
    numero: "",
    uf: "",
    municipio: "",
    clienteId: "",
    advogados: [],
    propostaId: "",
    dataDistribuicao: "",
    instancia: "",
    instanciaOutro: "",
    areaAtuacaoId: "",
    tipoProcessoId: "",
    sistemaCnjId: "",
    monitorarProcesso: false,
});

const normalizeDateInputValue = (value: unknown): string => {
    if (typeof value !== "string") {
        return "";
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return parsed.toISOString().slice(0, 10);
};

const parseBooleanInput = (value: unknown): boolean => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return false;
        }

        if (normalized === "true" || normalized === "1" || normalized === "sim") {
            return true;
        }

        if (normalized === "false" || normalized === "0" || normalized === "nao" || normalized === "não") {
            return false;
        }
    }

    return false;
};

const mapProcessoDetailToFormState = (
    processo: Record<string, unknown>,
): { form: ProcessFormState; grau: string } => {
    const numeroValue =
        typeof processo.numero === "string" ? formatProcessNumber(processo.numero) : "";

    const ufValue = (() => {
        if (typeof processo.uf === "string") {
            const trimmed = processo.uf.trim().toUpperCase();
            if (trimmed) {
                return trimmed;
            }
        }

        if (typeof processo.jurisdicao === "string") {
            const normalized = processo.jurisdicao.trim();
            if (!normalized) {
                return "";
            }

            const separators = ["-", "/"];
            for (const separator of separators) {
                const parts = normalized.split(separator);
                if (parts.length < 2) {
                    continue;
                }

                for (let index = parts.length - 1; index >= 0; index -= 1) {
                    const candidate = parts[index]?.trim().toUpperCase();
                    if (candidate && VALID_UF_CODES.has(candidate)) {
                        return candidate;
                    }
                }
            }

            const words = normalized.split(" ");
            for (let index = words.length - 1; index >= 0; index -= 1) {
                const candidate = words[index]?.trim().toUpperCase();
                if (candidate && VALID_UF_CODES.has(candidate)) {
                    return candidate;
                }
            }
        }

        return "";
    })();

    const municipioValue =
        typeof processo.municipio === "string" ? processo.municipio.trim() : "";

    const clienteIdValue = parseOptionalInteger(processo.cliente_id);
    const propostaIdValue = parseOptionalInteger(processo.oportunidade_id);
    const areaAtuacaoIdValue = parseOptionalInteger(processo.area_atuacao_id);
    const tipoProcessoIdValue = parseOptionalInteger(processo.tipo_processo_id);
    const sistemaCnjIdValue = parseOptionalInteger(processo.sistema_cnj_id);

    const advogadosValue = Array.isArray(processo.advogados)
        ? processo.advogados
              .map((item) => {
                  if (!item || typeof item !== "object") {
                      return null;
                  }

                  const candidate =
                      (item as { id?: unknown }).id ??
                      (item as { usuario_id?: unknown }).usuario_id ??
                      null;
                  const parsed = parseOptionalInteger(candidate);
                  return parsed && parsed > 0 ? String(parsed) : null;
              })
              .filter((value): value is string => Boolean(value))
        : [];

    const advogadosIds = Array.from(new Set(advogadosValue));

    let instanciaOutro = "";
    let instanciaSelecionada = "";

    const instanciaRaw =
        typeof processo.instancia === "string"
            ? processo.instancia.trim()
            : typeof processo.instancia === "number" && Number.isFinite(processo.instancia)
                ? String(Math.trunc(processo.instancia))
                : "";

    if (instanciaRaw) {
        const matchedOption = INSTANCIA_OPTIONS.find(
            (option) => option.toLowerCase() === instanciaRaw.toLowerCase(),
        );

        if (matchedOption) {
            instanciaSelecionada = matchedOption;
        } else {
            instanciaSelecionada = INSTANCIA_OUTRO_VALUE;
            instanciaOutro = instanciaRaw;
        }
    }

    const dataDistribuicaoValue = normalizeDateInputValue(processo.data_distribuicao);

    const monitorarProcessoValue = parseBooleanInput(processo.monitorar_processo);

    const resolvedGrau = (() => {
        if (typeof processo.grau === "string") {
            const trimmed = processo.grau.trim();
            return trimmed || "1º Grau";
        }

        if (typeof processo.grau === "number" && Number.isFinite(processo.grau)) {
            return String(Math.trunc(processo.grau));
        }

        return "1º Grau";
    })();

    const form: ProcessFormState = {
        numero: numeroValue,
        uf: ufValue,
        municipio: municipioValue,
        clienteId: clienteIdValue ? String(clienteIdValue) : "",
        advogados: advogadosIds,
        propostaId: propostaIdValue ? String(propostaIdValue) : "",
        dataDistribuicao: dataDistribuicaoValue,
        instancia: instanciaSelecionada,
        instanciaOutro,
        areaAtuacaoId: areaAtuacaoIdValue ? String(areaAtuacaoIdValue) : "",
        tipoProcessoId: tipoProcessoIdValue ? String(tipoProcessoIdValue) : "",
        sistemaCnjId: sistemaCnjIdValue ? String(sistemaCnjIdValue) : "",
        monitorarProcesso: monitorarProcessoValue,
    };

    return { form, grau: resolvedGrau };
};

const mapApiProcessoToProcesso = (processo: ApiProcesso): Processo => {
    const clienteResumo = processo.cliente ?? null;
    const clienteId =
        parseOptionalInteger(clienteResumo?.id) ??
        parseOptionalInteger(processo.cliente_id) ??
        0;
    const documento = clienteResumo?.documento ?? "";
    let jurisdicao =
        processo.jurisdicao ||
        [processo.municipio, processo.uf].filter(Boolean).join(" - ") ||
        "Não informado";

    const oportunidadeResumo = processo.oportunidade ?? null;
    const oportunidadeId = parseOptionalInteger(
        processo.oportunidade_id ?? oportunidadeResumo?.id ?? null,
    );
    const oportunidadeSequencial = parseOptionalInteger(
        oportunidadeResumo?.sequencial_empresa,
    );
    const oportunidadeDataCriacao =
        typeof oportunidadeResumo?.data_criacao === "string"
            ? oportunidadeResumo?.data_criacao
            : null;
    const oportunidadeSolicitante =
        typeof oportunidadeResumo?.solicitante_nome === "string"
            ? oportunidadeResumo.solicitante_nome
            : null;

    const advogados: ProcessoAdvogado[] = [];
    const seen = new Set<number>();

    if (Array.isArray(processo.advogados)) {
        for (const advogado of processo.advogados) {
            if (!advogado) {
                continue;
            }

            const idValue =
                typeof advogado.id === "number"
                    ? advogado.id
                    : typeof advogado.id === "string"
                        ? Number.parseInt(advogado.id, 10)
                        : null;

            if (!idValue || !Number.isFinite(idValue) || idValue <= 0 || seen.has(idValue)) {
                continue;
            }

            const nome =
                pickFirstNonEmptyString(advogado.nome, advogado.name, advogado.perfil_nome) ??
                `Advogado #${idValue}`;

            const funcao = pickFirstNonEmptyString(
                advogado.funcao,
                advogado.cargo,
                advogado.perfil,
                advogado.perfil_nome,
            );

            advogados.push({ id: idValue, nome, funcao });
            seen.add(idValue);
        }
    }

    if (advogados.length === 0) {
        const fallbackNome = processo.advogado_responsavel?.trim();
        if (fallbackNome) {
            advogados.push({ id: 0, nome: fallbackNome });
        }
    }

    advogados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const proposta: ProcessoProposta | null =
        oportunidadeId && oportunidadeId > 0
            ? {
                id: oportunidadeId,
                label: formatPropostaLabel(
                    oportunidadeId,
                    oportunidadeSequencial,
                    oportunidadeDataCriacao,
                    oportunidadeSolicitante,
                ),
                solicitante: oportunidadeSolicitante ?? null,
            }
            : null;

    const statusLabel = processo.status?.trim() || "Não informado";

    const tipo = processo.tipo?.trim() || "Não informado";
    const classeJudicial = processo.classe_judicial?.trim() || "Não informada";
    const assunto = processo.assunto?.trim() || "Não informado";
    const orgaoJulgador = processo.orgao_julgador?.trim() || "Não informado";

    const lastSyncAt = processo.ultima_sincronizacao ?? null;

    const movimentacoesCount = Math.max(
        parseApiInteger(processo.movimentacoes_count),
        0,
    );

    const consultasApiCount = Math.max(
        parseApiInteger(processo.consultas_api_count),
        0,
    );

    return {
        id: processo.id,
        numero: processo.numero,
        dataDistribuicao:
            formatDateToPtBR(processo.data_distribuicao || processo.criado_em),
        status: statusLabel,
        tipo,
        cliente: {
            id: clienteId,
            nome: clienteResumo?.nome ?? "Cliente não informado",
            documento: documento,
            papel: resolveClientePapel(clienteResumo?.tipo),
        },
        advogados,
        classeJudicial,
        assunto,
        jurisdicao,
        orgaoJulgador,
        proposta,
        ultimaSincronizacao: lastSyncAt,
        consultasApiCount,
        movimentacoesCount,
    };
};

const ARQUIVADO_KEYWORDS = ["arquiv", "baix", "encerr", "finaliz", "transit", "extint"];

const normalizeStatusForSummary = (status: string) =>
    status
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

const computeProcessosSummary = (itens: Processo[]): ProcessoSummary => {
    let andamento = 0;
    let arquivados = 0;
    let totalSincronizacoes = 0;
    const clientes = new Set<number>();
    const statusSet = new Set<string>();
    const tipoSet = new Set<string>();

    itens.forEach((processo) => {
        const statusValue = processo.status?.trim() || "Não informado";
        if (statusValue.toLowerCase() !== "não informado") {
            statusSet.add(statusValue);
        }

        const normalizedStatus = normalizeStatusForSummary(statusValue);
        if (normalizedStatus && ARQUIVADO_KEYWORDS.some((keyword) => normalizedStatus.includes(keyword))) {
            arquivados += 1;
        } else {
            andamento += 1;
        }

        const tipoValue = processo.tipo?.trim() || "Não informado";
        if (tipoValue.toLowerCase() !== "não informado") {
            tipoSet.add(tipoValue);
        }

        if (processo.cliente?.id) {
            clientes.add(processo.cliente.id);
        }

        totalSincronizacoes += processo.consultasApiCount;
    });

    return {
        andamento,
        arquivados,
        clientes: clientes.size,
        totalSincronizacoes,
        statusOptions: Array.from(statusSet).sort((a, b) => a.localeCompare(b)),
        tipoOptions: Array.from(tipoSet).sort((a, b) => a.localeCompare(b)),
    };
};

const getStatusBadgeClassName = (status: string) => {
    const normalized = status.toLowerCase();

    if (normalized.includes("andamento") || normalized.includes("ativo")) {
        return "border-emerald-200 bg-emerald-500/10 text-emerald-600";
    }

    if (normalized.includes("arquiv")) {
        return "border-slate-200 bg-slate-500/10 text-slate-600";
    }

    if (normalized.includes("urg")) {
        return "border-amber-200 bg-amber-500/10 text-amber-600";
    }

    return "border-primary/20 bg-primary/5 text-primary";
};

const getTipoBadgeClassName = (tipo: string) => {
    if (!tipo || tipo.toLowerCase() === "não informado") {
        return "border-muted-foreground/20 bg-muted text-muted-foreground";
    }

    return "border-blue-200 bg-blue-500/10 text-blue-600";
};

export default function Processos() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [processos, setProcessos] = useState<Processo[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("todos");
    const [tipoFilter, setTipoFilter] = useState("todos");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isOabModalOpen, setIsOabModalOpen] = useState(false);
    const [oabModalDismissed, setOabModalDismissed] = useState(false);
    const [oabUf, setOabUf] = useState("");
    const [oabNumero, setOabNumero] = useState("");
    const [oabMonitors, setOabMonitors] = useState<OabMonitor[]>([]);
    const [oabMonitorsLoading, setOabMonitorsLoading] = useState(false);
    const [oabMonitorsInitialized, setOabMonitorsInitialized] = useState(false);
    const [oabMonitorsError, setOabMonitorsError] = useState<string | null>(null);
    const [oabSubmitLoading, setOabSubmitLoading] = useState(false);
    const [oabSubmitError, setOabSubmitError] = useState<string | null>(null);
    const [oabUsuarioOptions, setOabUsuarioOptions] = useState<OabUsuarioOption[]>([]);
    const [oabUsuariosLoading, setOabUsuariosLoading] = useState(false);
    const [oabUsuariosError, setOabUsuariosError] = useState<string | null>(null);
    const [oabUsuarioId, setOabUsuarioId] = useState("");
    const [oabRemovingId, setOabRemovingId] = useState<number | null>(null);
    const [processForm, setProcessForm] = useState<ProcessFormState>(
        createEmptyProcessForm,
    );
    const [advogadosOptions, setAdvogadosOptions] = useState<AdvogadoOption[]>([]);
    const [advogadosLoading, setAdvogadosLoading] = useState(false);
    const [advogadosError, setAdvogadosError] = useState<string | null>(null);
    const [advogadosPopoverOpen, setAdvogadosPopoverOpen] = useState(false);
    const [propostas, setPropostas] = useState<PropostaOption[]>([]);
    const [propostasLoading, setPropostasLoading] = useState(false);
    const [propostasError, setPropostasError] = useState<string | null>(null);
    const [propostasPopoverOpen, setPropostasPopoverOpen] = useState(false);
    const [areaOptions, setAreaOptions] = useState<SimpleOption[]>([]);
    const [areaLoading, setAreaLoading] = useState(false);
    const [areaError, setAreaError] = useState<string | null>(null);
    const [areaPopoverOpen, setAreaPopoverOpen] = useState(false);
    const [tipoProcessoOptions, setTipoProcessoOptions] = useState<SimpleOption[]>([]);
    const [tipoProcessoLoading, setTipoProcessoLoading] = useState(false);
    const [tipoProcessoError, setTipoProcessoError] = useState<string | null>(null);
    const [tipoProcessoPopoverOpen, setTipoProcessoPopoverOpen] = useState(false);
    const [sistemaOptions, setSistemaOptions] = useState<SimpleOption[]>([]);
    const [sistemaLoading, setSistemaLoading] = useState(false);
    const [sistemaError, setSistemaError] = useState<string | null>(null);
    const [sistemaPopoverOpen, setSistemaPopoverOpen] = useState(false);
    const [ufOptions, setUfOptions] = useState<{ sigla: string; nome: string }[]>([]);
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    const [municipiosLoading, setMunicipiosLoading] = useState(false);
    const [municipioPopoverOpen, setMunicipioPopoverOpen] = useState(false);
    const [clientes, setClientes] = useState<ClienteResumo[]>([]);
    const [clientesLoading, setClientesLoading] = useState(false);
    const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
    const [processosLoading, setProcessosLoading] = useState(false);
    const [processosError, setProcessosError] = useState<string | null>(null);
    const [totalProcessos, setTotalProcessos] = useState(0);
    const [processosEmAndamento, setProcessosEmAndamento] = useState(0);
    const [processosArquivados, setProcessosArquivados] = useState(0);
    const [clientesAtivos, setClientesAtivos] = useState(0);
    const [totalSincronizacoes, setTotalSincronizacoes] = useState(0);
    const [statusOptions, setStatusOptions] = useState<string[]>([]);
    const [tipoOptions, setTipoOptions] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [createError, setCreateError] = useState<string | null>(null);
    const [creatingProcess, setCreatingProcess] = useState(false);
    const [editingProcessId, setEditingProcessId] = useState<number | null>(null);
    const [editingProcessGrau, setEditingProcessGrau] = useState<string | null>(null);
    const [loadingProcessForm, setLoadingProcessForm] = useState(false);
    const [unassignedProcessIds, setUnassignedProcessIds] = useState<number[]>([]);
    const [unassignedDetails, setUnassignedDetails] = useState<
        Record<number, UnassignedProcessDetail>
    >({});
    const [unassignedModalOpen, setUnassignedModalOpen] = useState(false);
    const [unassignedClientPopoverOpenId, setUnassignedClientPopoverOpenId] = useState<
        number | null
    >(null);
    const [unassignedModalDismissed, setUnassignedModalDismissed] = useState(false);
    const [unassignedLoading, setUnassignedLoading] = useState(false);
    const [unassignedError, setUnassignedError] = useState<string | null>(null);
    const [hasUnassignedOnCurrentPage, setHasUnassignedOnCurrentPage] = useState(false);
    const [unassignedProcesses, setUnassignedProcesses] = useState<Processo[]>([]);
    const [unassignedTotal, setUnassignedTotal] = useState(0);
    const [unassignedPage, setUnassignedPage] = useState(1);

    const applyProcessosData = useCallback((data: ProcessoLoadResult) => {
        setProcessos(data.items);
        setTotalProcessos(data.total);
        setProcessosEmAndamento(data.summary.andamento);
        setProcessosArquivados(data.summary.arquivados);
        setClientesAtivos(data.summary.clientes);
        setTotalSincronizacoes(data.summary.totalSincronizacoes);
        setStatusOptions(data.summary.statusOptions);
        setTipoOptions(data.summary.tipoOptions);
    }, []);

    const loadProcessos = useCallback(
        async (
            options?: {
                signal?: AbortSignal;
                page?: number;
                pageSize?: number;
                searchParams?: Record<string, string | number | boolean | null | undefined>;
            },
        ): Promise<ProcessoLoadResult> => {
            const currentPage = options?.page ?? page;
            const currentPageSize = options?.pageSize ?? pageSize;

            const url = new URL(getApiUrl("processos"));
            url.searchParams.set("page", String(currentPage));
            url.searchParams.set("pageSize", String(currentPageSize));

            if (options?.searchParams) {
                Object.entries(options.searchParams).forEach(([key, value]) => {
                    if (value === undefined || value === null) {
                        return;
                    }

                    url.searchParams.set(key, String(value));
                });
            }

            const res = await fetch(url.toString(), {
                headers: { Accept: "application/json" },
                signal: options?.signal,
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch (error) {
                console.error("Não foi possível interpretar a resposta de processos", error);
            }

            if (!res.ok) {
                const message =
                    json && typeof json === "object" &&
                    "error" in json &&
                    typeof (json as { error: unknown }).error === "string"
                        ? (json as { error: string }).error
                        : `Não foi possível carregar os processos (HTTP ${res.status})`;
                throw new Error(message);
            }

            const rawData: unknown[] = Array.isArray(json)
                ? json
                : Array.isArray((json as { rows?: unknown[] })?.rows)
                    ? ((json as { rows: unknown[] }).rows)
                    : Array.isArray((json as { data?: { rows?: unknown[] } })?.data?.rows)
                        ? ((json as { data: { rows: unknown[] } }).data.rows)
                        : Array.isArray((json as { data?: unknown[] })?.data)
                            ? ((json as { data: unknown[] }).data)
                            : [];

            const data = rawData.filter(
                (item): item is ApiProcesso => item !== null && typeof item === "object",
            );

            const mapped = data.map(mapApiProcessoToProcesso);

            const headerTotal = Number.parseInt(res.headers.get("x-total-count") ?? "", 10);
            const payload = json as { total?: unknown; summary?: unknown };

            const payloadTotal = (() => {
                if (typeof payload?.total === "number" && Number.isFinite(payload.total)) {
                    return payload.total;
                }

                if (typeof payload?.total === "string") {
                    const parsed = Number.parseInt(payload.total, 10);
                    return Number.isFinite(parsed) ? parsed : undefined;
                }

                return undefined;
            })();

            const total =
                typeof payloadTotal === "number"
                    ? payloadTotal
                    : Number.isFinite(headerTotal)
                        ? headerTotal
                        : mapped.length;

            const summaryPayload =
                payload?.summary && typeof payload.summary === "object"
                    ? (payload.summary as Partial<ProcessoSummary>)
                    : undefined;

            const fallbackSummary = computeProcessosSummary(mapped);

            const ensureStringArray = (value: unknown): string[] | undefined => {
                if (!Array.isArray(value)) {
                    return undefined;
                }

                const filtered = value.filter((item): item is string => typeof item === "string");
                if (filtered.length !== value.length) {
                    return undefined;
                }

                return filtered.slice().sort((a, b) => a.localeCompare(b));
            };

            const summary: ProcessoSummary = {
                andamento:
                    typeof summaryPayload?.andamento === "number"
                        ? summaryPayload.andamento
                        : fallbackSummary.andamento,
                arquivados:
                    typeof summaryPayload?.arquivados === "number"
                        ? summaryPayload.arquivados
                        : fallbackSummary.arquivados,
                clientes:
                    typeof summaryPayload?.clientes === "number"
                        ? summaryPayload.clientes
                        : fallbackSummary.clientes,
                totalSincronizacoes:
                    typeof summaryPayload?.totalSincronizacoes === "number"
                        ? summaryPayload.totalSincronizacoes
                        : fallbackSummary.totalSincronizacoes,
                statusOptions:
                    ensureStringArray(summaryPayload?.statusOptions) ?? fallbackSummary.statusOptions,
                tipoOptions:
                    ensureStringArray(summaryPayload?.tipoOptions) ?? fallbackSummary.tipoOptions,
            };

            return {
                items: mapped,
                total,
                page: currentPage,
                pageSize: currentPageSize,
                summary,
            };
        },
        [page, pageSize],
    );
    useEffect(() => {
        let cancelled = false;

        const fetchMonitors = async () => {
            setOabMonitorsLoading(true);
            setOabMonitorsError(null);

            try {
                const res = await fetch(getApiUrl("processos/oab-monitoradas"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;

                try {
                    json = await res.json();
                } catch (error) {
                    console.error("Não foi possível interpretar a resposta de OABs monitoradas", error);
                }

                if (!res.ok) {
                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar as OABs monitoradas (HTTP ${res.status})`;
                    throw new Error(message);
                }

                const payloadArray: Record<string, unknown>[] = Array.isArray(json)
                    ? (json as Record<string, unknown>[])
                    : Array.isArray((json as { data?: unknown[] })?.data)
                        ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
                        : [];

                const monitors = payloadArray
                    .map((item) => mapApiOabMonitor(item))
                    .filter((item): item is OabMonitor => item !== null);

                if (!cancelled) {
                    setOabMonitors(monitors);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setOabMonitors([]);
                    setOabMonitorsError(
                        error instanceof Error ? error.message : "Erro ao carregar OABs monitoradas",
                    );
                }
            } finally {
                if (!cancelled) {
                    setOabMonitorsLoading(false);
                    setOabMonitorsInitialized(true);
                }
            }
        };

        fetchMonitors();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchUsuariosOab = async () => {
            setOabUsuariosLoading(true);
            setOabUsuariosError(null);

            const endpoints = ["get_api_usuarios_empresa", "usuarios/empresa"];
            let loaded = false;
            let lastError: Error | null = null;

            for (const endpoint of endpoints) {
                try {
                    const res = await fetch(getApiUrl(endpoint), {
                        headers: { Accept: "application/json" },
                    });

                    let json: unknown = null;

                    try {
                        json = await res.json();
                    } catch (error) {
                        console.error("Não foi possível interpretar a resposta de usuários", error);
                    }

                    if (!res.ok) {
                        const message =
                            json && typeof json === "object" && "error" in json &&
                                typeof (json as { error?: unknown }).error === "string"
                                ? String((json as { error: string }).error)
                                : `Não foi possível carregar os usuários (HTTP ${res.status})`;
                        throw new Error(message);
                    }

                    const payloadArray: Record<string, unknown>[] = Array.isArray(json)
                        ? (json as Record<string, unknown>[])
                        : Array.isArray((json as { data?: unknown[] })?.data)
                            ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
                            : Array.isArray((json as { rows?: unknown[] })?.rows)
                                ? ((json as { rows: unknown[] }).rows as Record<string, unknown>[])
                                : [];

                    const options: OabUsuarioOption[] = [];
                    const seen = new Set<string>();

                    for (const item of payloadArray) {
                        if (!item) {
                            continue;
                        }

                        const idValue = parseOptionalInteger(item["id"]);

                        if (!idValue) {
                            continue;
                        }

                        const id = String(idValue);

                        if (seen.has(id)) {
                            continue;
                        }

                        const nome = pickFirstNonEmptyString(
                            typeof item["nome_completo"] === "string" ? (item["nome_completo"] as string) : undefined,
                            typeof item["nome"] === "string" ? (item["nome"] as string) : undefined,
                            typeof item["nome_usuario"] === "string" ? (item["nome_usuario"] as string) : undefined,
                            typeof item["nomeusuario"] === "string" ? (item["nomeusuario"] as string) : undefined,
                            typeof item["email"] === "string" ? getNameFromEmail(item["email"] as string) : undefined,
                        );

                        if (!nome) {
                            continue;
                        }

                        const numeroRaw = pickFirstNonEmptyString(
                            typeof item["oabNumero"] === "string" ? (item["oabNumero"] as string) : undefined,
                            typeof item["oab_numero"] === "string" ? (item["oab_numero"] as string) : undefined,
                            typeof item["oab_number"] === "string" ? (item["oab_number"] as string) : undefined,
                            typeof item["oab"] === "string" ? (item["oab"] as string) : undefined,
                        );

                        const ufRaw = pickFirstNonEmptyString(
                            typeof item["oabUf"] === "string" ? (item["oabUf"] as string) : undefined,
                            typeof item["oab_uf"] === "string" ? (item["oab_uf"] as string) : undefined,
                        );

                        let oab: string | null = null;
                        let optionNumero: string | null = null;
                        let optionUf: string | null = null;

                        if (numeroRaw) {
                            const digits = formatOabDigits(numeroRaw);
                            if (digits) {
                                optionNumero = digits;
                                if (ufRaw) {
                                    const normalizedUf = normalizeUf(ufRaw);
                                    if (normalizedUf.length === 2) {
                                        optionUf = normalizedUf;
                                        oab = formatOabDisplay(digits, normalizedUf);
                                    } else {
                                        oab = digits;
                                    }
                                } else {
                                    oab = digits;
                                }
                            }
                        }

                        if (!oab) {
                            const oabRaw = pickFirstNonEmptyString(
                                typeof item["oab"] === "string" ? (item["oab"] as string) : undefined,
                                typeof item["oabNumber"] === "string" ? (item["oabNumber"] as string) : undefined,
                            );

                            if (oabRaw) {
                                oab = oabRaw;
                                const match = oabRaw.match(/(\d{3,})/);
                                if (match) {
                                    optionNumero = formatOabDigits(match[1]);
                                }
                                const ufMatches = oabRaw.match(/([A-Za-z]{2})(?=[^A-Za-z]*\d)/g);
                                let ufCandidate: string | null = null;

                                if (ufMatches && ufMatches.length > 0) {
                                    ufCandidate = ufMatches[ufMatches.length - 1];
                                }

                                if (!ufCandidate) {
                                    const lettersAfterNumberMatches = [...oabRaw.matchAll(/\d{3,}[^A-Za-z]*([A-Za-z]{2})\b/g)];
                                    if (lettersAfterNumberMatches.length > 0) {
                                        const lastMatch = lettersAfterNumberMatches[lettersAfterNumberMatches.length - 1];
                                        ufCandidate = lastMatch[1];
                                    }
                                }

                                if (!ufCandidate) {
                                    const fallbackUfMatch = oabRaw.match(/\/\s*([A-Za-z]{2})\b/);
                                    if (fallbackUfMatch) {
                                        ufCandidate = fallbackUfMatch[1];
                                    }
                                }

                                if (ufCandidate) {
                                    const normalizedUf = normalizeUf(ufCandidate);
                                    if (normalizedUf.length === 2) {
                                        optionUf = normalizedUf;
                                    }
                                }
                            } else if (ufRaw) {
                                const normalizedUf = normalizeUf(ufRaw);
                                if (normalizedUf.length === 2) {
                                    optionUf = normalizedUf;
                                    oab = normalizedUf;
                                }
                            }
                        }

                        options.push({
                            id,
                            nome,
                            oab: oab ?? null,
                            oabNumero: optionNumero,
                            oabUf: optionUf,
                        });
                        seen.add(id);
                    }

                    options.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                    if (!cancelled) {
                        setOabUsuarioOptions(options);
                    }

                    loaded = true;
                    lastError = null;
                    break;
                } catch (error) {
                    console.error(error);
                    lastError = error instanceof Error ? error : new Error("Erro ao carregar usuários");
                }
            }

            if (!loaded && !cancelled) {
                setOabUsuarioOptions([]);
                setOabUsuariosError(lastError ? lastError.message : "Erro ao carregar usuários");
            }

            if (!cancelled) {
                setOabUsuariosLoading(false);
            }
        };

        fetchUsuariosOab();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchClientes = async () => {
            setClientesLoading(true);
            try {
                const res = await fetch(getApiUrl("clientes"), {
                    headers: { Accept: "application/json" },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                const data: ApiCliente[] = Array.isArray(json)
                    ? json
                    : Array.isArray((json as { rows?: ApiCliente[] })?.rows)
                        ? ((json as { rows: ApiCliente[] }).rows)
                        : Array.isArray((json as { data?: { rows?: ApiCliente[] } })?.data?.rows)
                            ? ((json as { data: { rows: ApiCliente[] } }).data.rows)
                            : Array.isArray((json as { data?: ApiCliente[] })?.data)
                                ? ((json as { data: ApiCliente[] }).data)
                                : [];
                const mapped = data
                    .filter((cliente) => typeof cliente.id === "number")
                    .map((cliente) => ({
                        id: cliente.id,
                        nome: cliente.nome ?? "Sem nome",
                        documento: cliente.documento ?? "",
                        tipo:
                            cliente.tipo === null || cliente.tipo === undefined
                                ? ""
                                : typeof cliente.tipo === "string"
                                    ? cliente.tipo
                                    : String(cliente.tipo),
                    }));
                if (!cancelled) {
                    setClientes(mapped);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setClientes([]);
                }
            } finally {
                if (!cancelled) {
                    setClientesLoading(false);
                }
            }
        };

        fetchClientes();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchAdvogados = async () => {
            setAdvogadosLoading(true);
            setAdvogadosError(null);

            try {
                const res = await fetch(getApiUrl("usuarios/empresa"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error("Não foi possível interpretar a resposta de advogados", error);
                }

                if (!res.ok) {
                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar os advogados (HTTP ${res.status})`;
                    throw new Error(message);
                }

                const payloadArray: Record<string, unknown>[] = Array.isArray(json)
                    ? (json as Record<string, unknown>[])
                    : Array.isArray((json as { data?: unknown[] })?.data)
                        ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
                        : Array.isArray((json as { rows?: unknown[] })?.rows)
                            ? ((json as { rows: unknown[] }).rows as Record<string, unknown>[])
                            : [];

                const options: AdvogadoOption[] = [];
                const seen = new Set<string>();

                for (const item of payloadArray) {
                    if (!item) {
                        continue;
                    }

                    const idRaw = item["id"];
                    let idValue: string | null = null;

                    if (typeof idRaw === "number" && Number.isFinite(idRaw)) {
                        idValue = String(Math.trunc(idRaw));
                    } else if (typeof idRaw === "string") {
                        const trimmed = idRaw.trim();
                        if (trimmed) {
                            idValue = trimmed;
                        }
                    }

                    if (!idValue || seen.has(idValue)) {
                        continue;
                    }

                    const nome = pickFirstNonEmptyString(
                        typeof item["nome_completo"] === "string" ? (item["nome_completo"] as string) : undefined,
                        typeof item["nome"] === "string" ? (item["nome"] as string) : undefined,
                        typeof item["nome_usuario"] === "string" ? (item["nome_usuario"] as string) : undefined,
                        typeof item["nomeusuario"] === "string" ? (item["nomeusuario"] as string) : undefined,
                        typeof item["email"] === "string" ? getNameFromEmail(item["email"] as string) : undefined,
                    );

                    if (!nome) {
                        continue;
                    }

                    const descricao = pickFirstNonEmptyString(
                        typeof item["perfil_nome"] === "string" ? (item["perfil_nome"] as string) : undefined,
                        typeof item["perfil_nome_exibicao"] === "string"
                            ? (item["perfil_nome_exibicao"] as string)
                            : undefined,
                        typeof item["funcao"] === "string" ? (item["funcao"] as string) : undefined,
                        typeof item["cargo"] === "string" ? (item["cargo"] as string) : undefined,
                    );

                    options.push({ id: idValue, nome, descricao });
                    seen.add(idValue);
                }

                options.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                if (!cancelled) {
                    setAdvogadosOptions(options);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setAdvogadosOptions([]);
                    setAdvogadosError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar advogados",
                    );
                }
            } finally {
                if (!cancelled) {
                    setAdvogadosLoading(false);
                }
            }
        };

        fetchAdvogados();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchTipoProcessos = async () => {
            setTipoProcessoLoading(true);
            setTipoProcessoError(null);

            const areaId = parseOptionalInteger(processForm.areaAtuacaoId);
            const path = areaId
                ? `tipo-processos?area_atuacao_id=${areaId}`
                : "tipo-processos";

            try {
                const res = await fetch(getApiUrl(path), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error(
                        "Não foi possível interpretar a resposta de tipos de processo",
                        error,
                    );
                }

                if (!res.ok) {
                    throw new Error(
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar os tipos de processo (HTTP ${res.status})`,
                    );
                }

                const items = extractOptionItems(json);
                const options = items
                    .map((item) => {
                        const id = parseOptionalInteger(item.id);
                        const nome =
                            typeof item.nome === "string" ? item.nome.trim() : "";
                        if (!id || id <= 0 || !nome) {
                            return null;
                        }
                        return { id: String(id), nome };
                    })
                    .filter((option): option is SimpleOption => option !== null)
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                if (!cancelled) {
                    setTipoProcessoOptions(options);
                    setProcessForm((prev) => {
                        if (!prev.tipoProcessoId) {
                            return prev;
                        }

                        const exists = options.some(
                            (option) => option.id === prev.tipoProcessoId,
                        );

                        if (exists) {
                            return prev;
                        }

                        return { ...prev, tipoProcessoId: "" };
                    });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setTipoProcessoOptions([]);
                    setTipoProcessoError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar tipos de processo",
                    );
                    setProcessForm((prev) => {
                        if (!prev.tipoProcessoId) {
                            return prev;
                        }
                        return { ...prev, tipoProcessoId: "" };
                    });
                }
            } finally {
                if (!cancelled) {
                    setTipoProcessoLoading(false);
                }
            }
        };

        fetchTipoProcessos();

        return () => {
            cancelled = true;
        };
    }, [processForm.areaAtuacaoId]);

    useEffect(() => {
        let cancelled = false;

        const fetchAreas = async () => {
            setAreaLoading(true);
            setAreaError(null);

            try {
                const res = await fetch(getApiUrl("areas"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error(
                        "Não foi possível interpretar a resposta de áreas",
                        error,
                    );
                }

                if (!res.ok) {
                    throw new Error(
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar as áreas de atuação (HTTP ${res.status})`,
                    );
                }

                const items = extractOptionItems(json);
                const options = items
                    .map((item) => {
                        const id = parseOptionalInteger(item.id);
                        const nome =
                            typeof item.nome === "string" ? item.nome.trim() : "";
                        if (!id || id <= 0 || !nome) {
                            return null;
                        }
                        return { id: String(id), nome };
                    })
                    .filter((option): option is SimpleOption => option !== null)
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                if (!cancelled) {
                    setAreaOptions(options);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setAreaOptions([]);
                    setAreaError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar áreas de atuação",
                    );
                }
            } finally {
                if (!cancelled) {
                    setAreaLoading(false);
                }
            }
        };

        fetchAreas();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchSistemas = async () => {
            setSistemaLoading(true);
            setSistemaError(null);

            try {
                const res = await fetch(getApiUrl("sistemas-cnj"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error(
                        "Não foi possível interpretar a resposta de sistemas CNJ",
                        error,
                    );
                }

                if (!res.ok) {
                    throw new Error(
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar os sistemas judiciais (HTTP ${res.status})`,
                    );
                }

                const items = extractOptionItems(json);
                const options = items
                    .map((item) => {
                        const id = parseOptionalInteger(item.id);
                        const nome =
                            typeof item.nome === "string" ? item.nome.trim() : "";
                        if (!id || id <= 0 || !nome) {
                            return null;
                        }
                        return { id: String(id), nome };
                    })
                    .filter((option): option is SimpleOption => option !== null)
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

                if (!cancelled) {
                    setSistemaOptions(options);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setSistemaOptions([]);
                    setSistemaError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar sistemas judiciais",
                    );
                }
            } finally {
                if (!cancelled) {
                    setSistemaLoading(false);
                }
            }
        };

        fetchSistemas();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchPropostas = async () => {
            setPropostasLoading(true);
            setPropostasError(null);

            try {
                const res = await fetch(getApiUrl("oportunidades"), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error("Não foi possível interpretar a resposta de propostas", error);
                }

                if (!res.ok) {
                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar as propostas (HTTP ${res.status})`;
                    throw new Error(message);
                }

                const payloadArray: Record<string, unknown>[] = Array.isArray(json)
                    ? (json as Record<string, unknown>[])
                    : Array.isArray((json as { data?: unknown[] })?.data)
                        ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
                        : Array.isArray((json as { rows?: unknown[] })?.rows)
                            ? ((json as { rows: unknown[] }).rows as Record<string, unknown>[])
                            : [];

                const options: PropostaOption[] = [];
                const seen = new Set<string>();

                for (const item of payloadArray) {
                    if (!item) {
                        continue;
                    }

                    const idParsed = parseOptionalInteger(item["id"]);
                    if (!idParsed || idParsed <= 0) {
                        continue;
                    }

                    const sequencialValue = parseOptionalInteger(
                        item["sequencial_empresa"],
                    );
                    const dataCriacaoValue =
                        typeof item["data_criacao"] === "string"
                            ? (item["data_criacao"] as string)
                            : null;

                    const solicitanteIdValue = parseOptionalInteger(
                        item["solicitante_id"],
                    );
                    const solicitanteId =
                        solicitanteIdValue && solicitanteIdValue > 0
                            ? String(solicitanteIdValue)
                            : null;

                    const solicitanteNome =
                        pickFirstNonEmptyString(
                            typeof item["solicitante_nome"] === "string"
                                ? (item["solicitante_nome"] as string)
                                : undefined,
                            typeof (item["solicitante"] as { nome?: unknown })?.nome === "string"
                                ? ((item["solicitante"] as { nome?: string }).nome)
                                : undefined,
                        ) ?? null;

                    const idValue = String(idParsed);
                    if (seen.has(idValue)) {
                        continue;
                    }

                    options.push({
                        id: idValue,
                        label: formatPropostaLabel(
                            idParsed,
                            sequencialValue,
                            dataCriacaoValue,
                            solicitanteNome,
                        ),
                        solicitante: solicitanteNome,
                        sequencial: sequencialValue,
                        dataCriacao: dataCriacaoValue,
                        solicitanteId,
                    });
                    seen.add(idValue);
                }

                options.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

                if (!cancelled) {
                    setPropostas(options);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setPropostas([]);
                    setPropostasError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar propostas",
                    );
                }
            } finally {
                if (!cancelled) {
                    setPropostasLoading(false);
                }
            }
        };

        fetchPropostas();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setProcessForm((prev) => {
            const valid = prev.advogados.filter((id) =>
                advogadosOptions.some((option) => option.id === id)
            );

            if (valid.length === prev.advogados.length) {
                return prev;
            }

            return { ...prev, advogados: valid };
        });
    }, [advogadosOptions]);

    const filteredPropostas = useMemo(() => {
        if (!processForm.clienteId) {
            return propostas;
        }

        return propostas.filter(
            (proposta) => proposta.solicitanteId === processForm.clienteId,
        );
    }, [processForm.clienteId, propostas]);

    useEffect(() => {
        setProcessForm((prev) => {
            if (!prev.propostaId) {
                return prev;
            }

            const exists = filteredPropostas.some(
                (option) => option.id === prev.propostaId,
            );
            if (exists) {
                return prev;
            }

            return { ...prev, propostaId: "" };
        });
    }, [filteredPropostas]);

    const selectedAdvogados = useMemo(
        () =>
            processForm.advogados
                .map((id) => advogadosOptions.find((option) => option.id === id))
                .filter((option): option is AdvogadoOption => Boolean(option)),
        [processForm.advogados, advogadosOptions],
    );

    const selectedCliente = useMemo(
        () =>
            clientes.find((cliente) => String(cliente.id) === processForm.clienteId) ?? null,
        [processForm.clienteId, clientes],
    );

    const selectedProposta = useMemo(
        () =>
            filteredPropostas.find((option) => option.id === processForm.propostaId) ?? null,
        [processForm.propostaId, filteredPropostas],
    );

    const selectedArea = useMemo(
        () =>
            areaOptions.find((option) => option.id === processForm.areaAtuacaoId) ?? null,
        [processForm.areaAtuacaoId, areaOptions],
    );

    const selectedTipoProcesso = useMemo(
        () =>
            tipoProcessoOptions.find(
                (option) => option.id === processForm.tipoProcessoId,
            ) ?? null,
        [processForm.tipoProcessoId, tipoProcessoOptions],
    );

    const selectedSistema = useMemo(
        () =>
            sistemaOptions.find((option) => option.id === processForm.sistemaCnjId) ?? null,
        [processForm.sistemaCnjId, sistemaOptions],
    );

    const clienteButtonLabel = clientesLoading && clientes.length === 0
        ? "Carregando clientes..."
        : selectedCliente
            ? `${selectedCliente.nome}${selectedCliente.documento ? ` (${selectedCliente.documento})` : ""}`
            : clientes.length === 0
                ? "Nenhum cliente disponível"
                : "Selecione o cliente";

    const municipioButtonLabel = !processForm.uf
        ? "Selecione a UF primeiro"
        : municipiosLoading
            ? "Carregando municípios..."
            : processForm.municipio
                ? processForm.municipio
                : municipios.length === 0
                    ? "Nenhum município encontrado"
                    : "Selecione o município";


    const propostaButtonLabel = selectedProposta
        ? selectedProposta.label
        : propostasLoading && propostas.length === 0
            ? "Carregando propostas..."
            : processForm.propostaId
                ? `Proposta #${processForm.propostaId}`
                : filteredPropostas.length === 0
                    ? "Nenhuma proposta disponível"
                    : "Selecione a proposta";

    const tipoProcessoButtonLabel =
        tipoProcessoLoading && tipoProcessoOptions.length === 0
            ? "Carregando tipos..."
            : selectedTipoProcesso
                ? selectedTipoProcesso.nome
                : tipoProcessoOptions.length === 0
                    ? tipoProcessoError ?? "Nenhum tipo disponível"
                    : "Selecione o tipo de processo";

    const areaButtonLabel =
        areaLoading && areaOptions.length === 0
            ? "Carregando áreas..."
            : selectedArea
                ? selectedArea.nome
                : areaOptions.length === 0
                    ? areaError ?? "Nenhuma área disponível"
                    : "Selecione a área de atuação";

    const sistemaButtonLabel =
        sistemaLoading && sistemaOptions.length === 0
            ? "Carregando sistemas..."
            : selectedSistema
                ? selectedSistema.nome
                : sistemaOptions.length === 0
                    ? sistemaError ?? "Nenhum sistema disponível"
                    : "Selecione o sistema judicial";

    const toggleAdvogadoSelection = useCallback((id: string) => {
        setProcessForm((prev) => {
            const alreadySelected = prev.advogados.includes(id);
            const updated = alreadySelected
                ? prev.advogados.filter((advId) => advId !== id)
                : [...prev.advogados, id];

            return { ...prev, advogados: updated };
        });
    }, []);

    const handleOabModalChange = useCallback((open: boolean) => {
        setIsOabModalOpen(open);
        if (!open) {
            setOabModalDismissed(true);
            setOabSubmitError(null);
            setOabUsuarioId("");
            setOabUf("");
            setOabNumero("");
        }
    }, []);

    const handleOabUsuarioChange = useCallback(
        (value: string) => {
            setOabUsuarioId(value);
            const option = oabUsuarioOptions.find((item) => item.id === value);
            setOabUf(option?.oabUf ?? "");
            setOabNumero(option?.oabNumero ?? "");
        },
        [oabUsuarioOptions],
    );

    const handleRemoveOabMonitor = useCallback(
        async (monitorId: number) => {
            setOabRemovingId(monitorId);

            try {
                const res = await fetch(getApiUrl(`processos/oab-monitoradas/${monitorId}`), {
                    method: "DELETE",
                    headers: { Accept: "application/json" },
                });

                if (res.status !== 204) {
                    let json: unknown = null;

                    try {
                        json = await res.json();
                    } catch (error) {
                        console.error("Não foi possível interpretar a resposta de exclusão de OAB", error);
                    }

                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível remover a OAB (HTTP ${res.status})`;
                    throw new Error(message);
                }

                setOabMonitors((prev) => prev.filter((item) => item.id !== monitorId));
                toast({
                    title: "OAB removida",
                    description: "Monitoramento desativado com sucesso.",
                });
            } catch (error) {
                console.error(error);
                toast({
                    title: "Erro ao remover OAB",
                    description: error instanceof Error ? error.message : "Não foi possível remover a OAB.",
                    variant: "destructive",
                });
            } finally {
                setOabRemovingId(null);
            }
        },
        [toast],
    );

    const handleParticipantToggle = useCallback((processId: number, participantId: string) => {
        setUnassignedDetails((prev) => {
            const current = prev[processId];
            if (!current) {
                return prev;
            }

            const alreadySelected = current.selectedParticipantIds.includes(participantId);
            const nextSelected = alreadySelected
                ? current.selectedParticipantIds.filter((id) => id !== participantId)
                : [...current.selectedParticipantIds, participantId];

            let nextPrimary = current.primaryParticipantId;
            if (alreadySelected) {
                if (current.primaryParticipantId === participantId) {
                    nextPrimary = nextSelected[0] ?? null;
                }
            } else if (!current.primaryParticipantId) {
                nextPrimary = participantId;
            }

            return {
                ...prev,
                [processId]: {
                    ...current,
                    selectedParticipantIds: nextSelected,
                    primaryParticipantId: nextPrimary,
                },
            };
        });
    }, []);

    const handlePrimaryParticipantChange = useCallback((processId: number, participantId: string) => {
        setUnassignedDetails((prev) => {
            const current = prev[processId];
            if (!current) {
                return prev;
            }

            const alreadySelected = current.selectedParticipantIds.includes(participantId);
            const nextSelected = alreadySelected
                ? current.selectedParticipantIds
                : [...current.selectedParticipantIds, participantId];

            return {
                ...prev,
                [processId]: {
                    ...current,
                    selectedParticipantIds: nextSelected,
                    primaryParticipantId: participantId,
                },
            };
        });
    }, []);

    const handleParticipantRelationshipChange = useCallback(
        (processId: number, participantId: string, value: string) => {
            setUnassignedDetails((prev) => {
                const current = prev[processId];
                if (!current) {
                    return prev;
                }

                return {
                    ...prev,
                    [processId]: {
                        ...current,
                        relationshipByParticipantId: {
                            ...current.relationshipByParticipantId,
                            [participantId]: value,
                        },
                    },
                };
            });
        },
        [],
    );

    const handleExistingClientSelection = useCallback(
        (processId: number, clientId: string) => {
            const normalizedClientId =
                clientId === NO_EXISTING_CLIENT_SELECT_VALUE ? "" : clientId;

            setUnassignedDetails((prev) => {
                const current = prev[processId];
                if (!current) {
                    return prev;
                }

                const shouldKeepSelectedProposta =
                    Boolean(normalizedClientId) &&
                    Boolean(current.selectedPropostaId) &&
                    propostas.some(
                        (proposta) =>
                            proposta.id === current.selectedPropostaId &&
                            proposta.solicitanteId === normalizedClientId,
                    );

                return {
                    ...prev,
                    [processId]: {
                        ...current,
                        selectedExistingClientId: normalizedClientId,
                        selectedPropostaId:
                            normalizedClientId && shouldKeepSelectedProposta
                                ? current.selectedPropostaId
                                : "",
                    },
                };
            });
        },
        [propostas],
    );

    const handleSelectedPropostaChange = useCallback((processId: number, propostaId: string) => {
        const normalizedPropostaId =
            propostaId === NO_PROPOSTA_SELECT_VALUE ? "" : propostaId;
        setUnassignedDetails((prev) => {
            const current = prev[processId];
            if (!current) {
                return prev;
            }

            return {
                ...prev,
                [processId]: {
                    ...current,
                    selectedPropostaId: normalizedPropostaId,
                },
            };
        });
    }, []);

    const handleUnassignedModalChange = useCallback((open: boolean) => {
        setUnassignedModalOpen(open);
        if (open) {
            setUnassignedPage(1);
        } else {
            setUnassignedModalDismissed(true);
        }
    }, []);

    const handleOabSubmit = useCallback(async () => {
        if (!oabUsuarioId) {
            setOabSubmitError("Selecione o usuário responsável pela OAB.");
            return;
        }

        if (!oabUf || !oabNumero) {
            setOabSubmitError(
                "O responsável selecionado não possui OAB válida para monitoramento.",
            );
            return;
        }

        setOabSubmitError(null);
        setOabSubmitLoading(true);

        try {
            const res = await fetch(getApiUrl("processos/oab-monitoradas"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    uf: oabUf,
                    numero: formatOabDigits(oabNumero),
                    usuarioId: Number.parseInt(oabUsuarioId, 10),
                }),
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch (error) {
                console.error("Não foi possível interpretar a resposta de cadastro de OAB", error);
            }

            if (!res.ok) {
                const message =
                    json && typeof json === "object" && "error" in json &&
                        typeof (json as { error?: unknown }).error === "string"
                        ? String((json as { error: string }).error)
                        : `Não foi possível cadastrar a OAB (HTTP ${res.status})`;
                throw new Error(message);
            }

            if (!json || typeof json !== "object") {
                throw new Error("Resposta inválida do servidor ao cadastrar a OAB.");
            }

            const monitor = mapApiOabMonitor(json as Record<string, unknown>);
            if (!monitor) {
                throw new Error("Dados retornados para a OAB são inválidos.");
            }

            setOabMonitors((prev) => {
                const filtered = prev.filter((item) => item.id !== monitor.id);
                return [monitor, ...filtered];
            });
            setOabNumero("");
            setOabUsuarioId("");
            toast({
                title: "OAB cadastrada com sucesso",
                description: `Monitoramento ativado para ${formatOabDisplay(monitor.numero, monitor.uf)}.`,
            });
        } catch (error) {
            console.error(error);
            const message =
                error instanceof Error ? error.message : "Erro ao cadastrar OAB";
            setOabSubmitError(message);
            toast({
                title: "Erro ao cadastrar OAB",
                description: message,
                variant: "destructive",
            });
        } finally {
            setOabSubmitLoading(false);
        }
    }, [oabNumero, oabUf, oabUsuarioId, toast]);

    const ensureClientForParticipant = useCallback(
        async (participant: ProcessoParticipantOption): Promise<number> => {
            const documentDigits = getParticipantDocumentDigits(participant);

            if (documentDigits) {
                const existing = clientes.find((cliente) => {
                    if (!cliente.documento) {
                        return false;
                    }
                    return cliente.documento.replace(/\D/g, "") === documentDigits;
                });

                if (existing) {
                    return existing.id;
                }
            }

            const nome = participant.name || "Cliente sem identificação";
            const tipo = documentDigits.length === 14 ? "J" : "F";

            const payload = {
                nome,
                tipo,
                documento: documentDigits || null,
                email: null,
                telefone: null,
                cep: null,
                rua: null,
                numero: null,
                complemento: null,
                bairro: null,
                cidade: null,
                uf: null,
                ativo: true,
            };

            const res = await fetch(getApiUrl("clientes"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch (error) {
                console.error("Não foi possível interpretar a resposta de criação de cliente", error);
            }

            if (!res.ok) {
                const message =
                    json && typeof json === "object" && "error" in json &&
                        typeof (json as { error?: unknown }).error === "string"
                        ? String((json as { error: string }).error)
                        : `Não foi possível cadastrar o cliente ${nome} (HTTP ${res.status})`;
                throw new Error(message);
            }

            if (!json || typeof json !== "object") {
                throw new Error("Resposta inválida do servidor ao cadastrar cliente");
            }

            const idValue = parseOptionalInteger((json as { id?: unknown }).id);
            if (!idValue) {
                throw new Error("Cliente criado sem identificador válido");
            }

            const documentoRetornado =
                typeof (json as { documento?: string }).documento === "string"
                    ? (json as { documento: string }).documento
                    : documentDigits;
            const tipoRetornado =
                typeof (json as { tipo?: string }).tipo === "string"
                    ? (json as { tipo: string }).tipo
                    : tipo;

            const resumo: ClienteResumo = {
                id: idValue,
                nome:
                    typeof (json as { nome?: string }).nome === "string"
                        ? (json as { nome: string }).nome
                        : nome,
                documento: documentoRetornado ?? "",
                tipo: tipoRetornado ?? tipo,
            };

            setClientes((prev) => [...prev, resumo]);

            return idValue;
        },
        [clientes],
    );

    const fetchUnassignedPage = useCallback(
        async (
            page: number,
            { signal }: { signal?: AbortSignal } = {},
        ): Promise<void> => {
            if (signal?.aborted) {
                return;
            }

            setUnassignedLoading(true);
            setUnassignedError(null);
            setUnassignedProcesses([]);
            setUnassignedProcessIds([]);

            try {
                const data = await loadProcessos({
                    page,
                    pageSize: UNASSIGNED_PAGE_SIZE,
                    signal,
                    searchParams: { semCliente: true },
                });

                if (signal?.aborted) {
                    return;
                }

                setUnassignedProcesses(data.items);
                setUnassignedProcessIds(data.items.map((item) => item.id));
                setUnassignedTotal(data.total);
            } catch (error) {
                if (signal?.aborted) {
                    return;
                }

                console.error(error);

                setUnassignedError(
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar processos sem cliente",
                );
                setUnassignedProcesses([]);
                setUnassignedProcessIds([]);
                setUnassignedTotal(0);
            } finally {
                if (!signal?.aborted) {
                    setUnassignedLoading(false);
                }
            }
        },
        [loadProcessos],
    );

    const handleLinkProcess = useCallback(
        async (processId: number) => {
            const detail = unassignedDetails[processId];
            if (!detail || detail.saving) {
                return;
            }

            setUnassignedDetails((prev) => {
                const current = prev[processId];
                if (!current) {
                    return prev;
                }

                return {
                    ...prev,
                    [processId]: {
                        ...current,
                        saving: true,
                        error: null,
                    },
                };
            });

            try {
                let clienteId: number | null = null;
                const selectedExisting = parseOptionalInteger(detail.selectedExistingClientId);

                if (selectedExisting && selectedExisting > 0) {
                    clienteId = selectedExisting;
                } else if (detail.primaryParticipantId) {
                    const primaryParticipant = detail.participants.find(
                        (participant) => participant.id === detail.primaryParticipantId,
                    );

                    if (!primaryParticipant) {
                        throw new Error("Selecione um cliente principal para vincular ao processo.");
                    }

                    clienteId = await ensureClientForParticipant(primaryParticipant);
                } else {
                    throw new Error(
                        "Selecione um cliente existente ou marque um envolvido como cliente principal.",
                    );
                }

                const participantsToRegister = detail.selectedParticipantIds
                    .map((participantId) =>
                        detail.participants.find((participant) => participant.id === participantId),
                    )
                    .filter(
                        (participant): participant is ProcessoParticipantOption =>
                            Boolean(participant),
                    );

                for (const participant of participantsToRegister) {
                    if (detail.primaryParticipantId && participant.id === detail.primaryParticipantId) {
                        continue;
                    }
                    await ensureClientForParticipant(participant);
                }

                const relationshipEntries = participantsToRegister.map((participant) => {
                    const relation =
                        detail.relationshipByParticipantId[participant.id]?.trim() ||
                        getParticipantDefaultRelationship(participant);
                    return relation ? `${participant.name} (${relation})` : participant.name;
                });

                const descricaoPayload =
                    relationshipEntries.length > 0
                        ? `Clientes vinculados: ${relationshipEntries.join(", ")}`
                        : undefined;

                const advogadosPayload = detail.form.advogados
                    .map((id) => Number.parseInt(id, 10))
                    .filter((value) => Number.isFinite(value) && value > 0);

                const numeroFromForm = detail.form.numero.trim();
                const numeroFromProcess =
                    typeof detail.process.numero === "string" ? detail.process.numero.trim() : "";
                const numeroPayload = numeroFromForm || numeroFromProcess;
                if (!numeroPayload) {
                    throw new Error("Informe o número do processo antes de vincular.");
                }

                const municipioFromForm = detail.form.municipio.trim();
                const municipioFromJurisdicao = (() => {
                    const [municipio] = detail.process.jurisdicao.split("-");
                    return municipio ? municipio.trim() : "";
                })();
                const municipioPayload = municipioFromForm || municipioFromJurisdicao;
                if (!municipioPayload) {
                    throw new Error("Informe o município do processo antes de vincular.");
                }

                const ufFromForm = detail.form.uf.trim();
                const ufFromJurisdicao = (() => {
                    const raw = detail.process.jurisdicao;
                    if (typeof raw !== "string") {
                        return "";
                    }

                    const normalized = raw.trim();
                    if (!normalized) {
                        return "";
                    }

                    const separators = ["-", "/"];
                    for (const separator of separators) {
                        const parts = normalized.split(separator);
                        if (parts.length < 2) {
                            continue;
                        }

                        for (let index = parts.length - 1; index >= 0; index -= 1) {
                            const candidate = parts[index]?.trim().toUpperCase();
                            if (candidate && candidate.length === 2) {
                                return candidate;
                            }
                        }
                    }

                    const words = normalized.split(" ");
                    for (let index = words.length - 1; index >= 0; index -= 1) {
                        const candidate = words[index]?.trim().toUpperCase();
                        if (candidate && candidate.length === 2) {
                            return candidate;
                        }
                    }

                    return "";
                })();
                const ufPayload = ufFromForm || ufFromJurisdicao;
                if (!ufPayload) {
                    throw new Error("Informe a UF do processo antes de vincular.");
                }

                const grauPayload =
                    detail.grau && detail.grau.trim() ? detail.grau.trim() : "1º Grau";

                const payload: Record<string, unknown> = {
                    cliente_id: clienteId,
                    numero: numeroPayload,
                    uf: ufPayload,
                    municipio: municipioPayload,
                    advogados: advogadosPayload,
                };

                const instanciaPayload =
                    detail.form.instancia === INSTANCIA_OUTRO_VALUE
                        ? detail.form.instanciaOutro.trim()
                        : detail.form.instancia.trim();
                if (instanciaPayload) {
                    payload.instancia = instanciaPayload;
                }

                if (detail.form.dataDistribuicao.trim()) {
                    payload.data_distribuicao = detail.form.dataDistribuicao.trim();
                }

                const propostaId = parseOptionalInteger(detail.selectedPropostaId);
                if (propostaId && propostaId > 0) {
                    payload.oportunidade_id = propostaId;
                }

                const tipoProcessoId = parseOptionalInteger(detail.form.tipoProcessoId);
                if (tipoProcessoId && tipoProcessoId > 0) {
                    payload.tipo_processo_id = tipoProcessoId;
                }

                const areaAtuacaoId = parseOptionalInteger(detail.form.areaAtuacaoId);
                if (areaAtuacaoId && areaAtuacaoId > 0) {
                    payload.area_atuacao_id = areaAtuacaoId;
                }

                const sistemaId = parseOptionalInteger(detail.form.sistemaCnjId);
                if (sistemaId && sistemaId > 0) {
                    payload.sistema_cnj_id = sistemaId;
                }

                payload.monitorar_processo = detail.form.monitorarProcesso;
                payload.grau = grauPayload;

                if (descricaoPayload) {
                    payload.descricao = descricaoPayload;
                }

                const res = await fetch(getApiUrl(`processos/${processId}`), {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(payload),
                });

                let json: unknown = null;
                try {
                    json = await res.json();
                } catch (error) {
                    console.error(
                        "Não foi possível interpretar a resposta de atualização do processo",
                        error,
                    );
                }

                if (!res.ok) {
                    const message =
                        json && typeof json === "object" && "error" in json &&
                            typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível atualizar o processo (HTTP ${res.status})`;
                    throw new Error(message);
                }

                const remaining = unassignedProcessIds.filter((id) => id !== processId);
                const nextTotal = Math.max(0, unassignedTotal - 1);
                const nextTotalPages =
                    nextTotal <= 0 ? 1 : Math.max(1, Math.ceil(nextTotal / UNASSIGNED_PAGE_SIZE));

                setUnassignedDetails((prev) => {
                    const next = { ...prev };
                    delete next[processId];
                    return next;
                });
                setUnassignedProcesses((prev) =>
                    prev.filter((processo) => processo.id !== processId),
                );
                setUnassignedProcessIds(remaining);
                setUnassignedTotal(nextTotal);

                toast({
                    title: "Processo atualizado",
                    description: "Cliente vinculado com sucesso.",
                });

                if (nextTotal === 0) {
                    setUnassignedModalOpen(false);
                    setUnassignedModalDismissed(true);
                } else if (remaining.length === 0) {
                    const targetPage = Math.min(unassignedPage, nextTotalPages);
                    if (targetPage !== unassignedPage) {
                        setUnassignedPage(targetPage);
                    } else {
                        void fetchUnassignedPage(targetPage);
                    }
                }

                try {
                    const data = await loadProcessos();
                    applyProcessosData(data);
                } catch (refreshError) {
                    console.error("Erro ao atualizar lista de processos", refreshError);
                }
            } catch (error) {
                console.error(error);
                const message =
                    error instanceof Error ? error.message : "Erro ao vincular processo";
                setUnassignedDetails((prev) => {
                    const current = prev[processId];
                    if (!current) {
                        return prev;
                    }
                    return {
                        ...prev,
                        [processId]: {
                            ...current,
                            error: message,
                        },
                    };
                });
                toast({
                    title: "Erro ao vincular processo",
                    description: message,
                    variant: "destructive",
                });
            } finally {
                setUnassignedDetails((prev) => {
                    const current = prev[processId];
                    if (!current) {
                        return prev;
                    }

                    return {
                        ...prev,
                        [processId]: {
                            ...current,
                            saving: false,
                        },
                    };
                });
            }
        },
        [
            unassignedDetails,
            ensureClientForParticipant,
            toast,
            loadProcessos,
            applyProcessosData,
            unassignedProcessIds,
            unassignedTotal,
            unassignedPage,
            fetchUnassignedPage,
        ],
    );

    useEffect(() => {
        let active = true;

        const fetchProcessos = async () => {
            setProcessosLoading(true);
            setProcessosError(null);
            try {
                const data = await loadProcessos();
                if (!active) {
                    return;
                }

                if (page > 1 && data.items.length === 0 && data.total > 0) {
                    setPage((prev) => Math.max(1, prev - 1));
                    return;
                }

                applyProcessosData(data);
            } catch (error) {
                console.error(error);
                if (!active) {
                    return;
                }

                const message =
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar processos";
                setProcessos([]);
                setTotalProcessos(0);
                setProcessosEmAndamento(0);
                setProcessosArquivados(0);
                setClientesAtivos(0);
                setTotalSincronizacoes(0);
                setStatusOptions([]);
                setTipoOptions([]);
                setProcessosError(message);
                toast({
                    title: "Erro ao carregar processos",
                    description: message,
                    variant: "destructive",
                });
            } finally {
                if (active) {
                    setProcessosLoading(false);
                }
            }
        };

        fetchProcessos();

        return () => {
            active = false;
        };
    }, [applyProcessosData, loadProcessos, page, toast]);

    useEffect(() => {
        let cancelled = false;

        const fetchUfs = async () => {
            try {
                const res = await fetch(
                    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as { sigla: string; nome: string }[];
                if (!cancelled) setUfOptions(data);
            } catch (error) {
                console.error(error);
                if (!cancelled) setUfOptions([]);
            }
        };

        fetchUfs();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const POLLING_INTERVAL = 30000;
        let cancelled = false;

        const poll = async () => {
            try {
                const data = await loadProcessos();
                if (!cancelled) {
                    if (page > 1 && data.items.length === 0 && data.total > 0) {
                        setPage((prev) => Math.max(1, prev - 1));
                        return;
                    }

                    applyProcessosData(data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Erro ao atualizar processos em segundo plano", error);
                }
            }
        };

        const intervalId = window.setInterval(() => {
            void poll();
        }, POLLING_INTERVAL);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [applyProcessosData, loadProcessos, page]);

    useEffect(() => {
        if (
            processForm.clienteId &&
            !clientes.some((cliente) => String(cliente.id) === processForm.clienteId)
        ) {
            setProcessForm((prev) => ({ ...prev, clienteId: "" }));
        }
    }, [clientes, processForm.clienteId]);

    useEffect(() => {
        if (!processForm.uf) {
            setMunicipios([]);
            setMunicipiosLoading(false);
            return;
        }

        let cancelled = false;
        setMunicipiosLoading(true);

        const fetchMunicipios = async () => {
            try {
                const res = await fetch(
                    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${processForm.uf}/municipios?orderBy=nome`,
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as Municipio[];
                if (!cancelled) setMunicipios(data);
            } catch (error) {
                console.error(error);
                if (!cancelled) setMunicipios([]);
            } finally {
                if (!cancelled) setMunicipiosLoading(false);
            }
        };

        fetchMunicipios();

        return () => {
            cancelled = true;
        };
    }, [processForm.uf]);

    useEffect(() => {
        if (!processForm.uf || municipiosLoading) {
            setMunicipioPopoverOpen(false);
        }
    }, [processForm.uf, municipiosLoading]);

    useEffect(() => {
        if (statusFilter !== "todos" && !statusOptions.includes(statusFilter)) {
            setStatusFilter("todos");
        }
    }, [statusFilter, statusOptions]);

    useEffect(() => {
        if (tipoFilter !== "todos" && !tipoOptions.includes(tipoFilter)) {
            setTipoFilter("todos");
        }
    }, [tipoFilter, tipoOptions]);

    useEffect(() => {
        const hasUnassigned = processos.some(
            (processo) => !processo.cliente?.id || processo.cliente.id <= 0,
        );
        setHasUnassignedOnCurrentPage(hasUnassigned);
    }, [processos]);

    const hasOabMonitors = oabMonitors.length > 0;

    useEffect(() => {
        if (
            oabMonitorsInitialized &&
            !processosLoading &&
            totalProcessos === 0 &&
            !oabModalDismissed &&
            !oabMonitorsLoading &&
            !hasOabMonitors
        ) {
            setIsOabModalOpen(true);
        }
    }, [
        oabMonitorsInitialized,
        processosLoading,
        totalProcessos,
        oabModalDismissed,
        oabMonitorsLoading,
        hasOabMonitors,
    ]);

    useEffect(() => {
        if (!processosLoading && hasUnassignedOnCurrentPage && !unassignedModalDismissed) {
            setUnassignedPage(1);
            setUnassignedModalOpen(true);
        }
    }, [processosLoading, hasUnassignedOnCurrentPage, unassignedModalDismissed]);

    useEffect(() => {
        if (!unassignedModalOpen) {
            return;
        }

        const controller = new AbortController();

        void fetchUnassignedPage(unassignedPage, { signal: controller.signal });

        return () => {
            controller.abort();
        };
    }, [fetchUnassignedPage, unassignedModalOpen, unassignedPage]);

    useEffect(() => {
        if (!unassignedModalOpen) {
            return;
        }

        const idsToFetch = unassignedProcessIds.filter((id) => !unassignedDetails[id]);
        if (idsToFetch.length === 0) {
            return;
        }

        let cancelled = false;
        setUnassignedLoading(true);
        setUnassignedError(null);

        const fetchDetails = async () => {
            try {
                const entries = await Promise.all(
                    idsToFetch.map(async (id) => {
                        const res = await fetch(getApiUrl(`processos/${id}`), {
                            headers: { Accept: "application/json" },
                        });

                        let json: unknown = null;
                        try {
                            json = await res.json();
                        } catch (error) {
                            console.error("Não foi possível interpretar a resposta de detalhes do processo", error);
                        }

                        if (!res.ok) {
                            const message =
                                json && typeof json === "object" && "error" in json &&
                                    typeof (json as { error?: unknown }).error === "string"
                                    ? String((json as { error: string }).error)
                                    : `Não foi possível carregar os detalhes do processo (HTTP ${res.status})`;
                            throw new Error(message);
                        }

                        if (!json || typeof json !== "object") {
                            throw new Error("Resposta inválida do servidor ao carregar detalhes do processo");
                        }

                        const detail = mapProcessoDetailToFormState(json as Record<string, unknown>);
                        const participants = extractParticipantOptions(json as Record<string, unknown>);

                        const relationshipByParticipantId: Record<string, string> = {};
                        participants.forEach((participant) => {
                            const defaultRelation = getParticipantDefaultRelationship(participant);
                            if (defaultRelation) {
                                relationshipByParticipantId[participant.id] = defaultRelation;
                            }
                        });

                        return {
                            id,
                            form: detail.form,
                            grau: detail.grau,
                            participants,
                            relationshipByParticipantId,
                        };
                    }),
                );

                if (!cancelled) {
                    setUnassignedDetails((prev) => {
                        const next = { ...prev };
                        for (const entry of entries) {
                            const baseProcess = unassignedProcesses.find(
                                (processo) => processo.id === entry.id,
                            );
                            if (!baseProcess) {
                                continue;
                            }

                            next[entry.id] = {
                                process: baseProcess,
                                form: entry.form,
                                grau: entry.grau,
                                participants: entry.participants,
                                selectedExistingClientId: "",
                                selectedParticipantIds: [],
                                primaryParticipantId: null,
                                relationshipByParticipantId: entry.relationshipByParticipantId,
                                selectedPropostaId: entry.form.propostaId,
                                saving: false,
                                error: null,
                            };
                        }

                        return next;
                    });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setUnassignedError(
                        error instanceof Error
                            ? error.message
                            : "Erro ao carregar detalhes dos processos sem cliente",
                    );
                }
            } finally {
                if (!cancelled) {
                    setUnassignedLoading(false);
                }
            }
        };

        void fetchDetails();

        return () => {
            cancelled = true;
        };
    }, [unassignedModalOpen, unassignedProcessIds, unassignedDetails, unassignedProcesses]);

    const totalPages = useMemo(() => {
        if (pageSize <= 0) {
            return 1;
        }

        const pages = Math.ceil(totalProcessos / pageSize);
        return Math.max(1, pages || 1);
    }, [pageSize, totalProcessos]);

    const pageStart = useMemo(() => {
        if (totalProcessos === 0 || pageSize <= 0) {
            return 0;
        }

        return (page - 1) * pageSize + 1;
    }, [page, pageSize, totalProcessos]);

    const pageEnd = useMemo(() => {
        if (totalProcessos === 0 || pageSize <= 0) {
            return 0;
        }

        return Math.min(totalProcessos, page * pageSize);
    }, [page, pageSize, totalProcessos]);

    const unassignedTotalPages = useMemo(() => {
        if (UNASSIGNED_PAGE_SIZE <= 0) {
            return 1;
        }

        if (unassignedTotal <= 0) {
            return 1;
        }

        return Math.max(1, Math.ceil(unassignedTotal / UNASSIGNED_PAGE_SIZE));
    }, [unassignedTotal]);

    const unassignedPageStart = useMemo(() => {
        if (unassignedTotal === 0) {
            return 0;
        }

        return (unassignedPage - 1) * UNASSIGNED_PAGE_SIZE + 1;
    }, [unassignedPage, unassignedTotal]);

    const unassignedPageEnd = useMemo(() => {
        if (unassignedTotal === 0) {
            return 0;
        }

        return Math.min(unassignedTotal, unassignedPage * UNASSIGNED_PAGE_SIZE);
    }, [unassignedPage, unassignedTotal]);

    const unassignedPaginationRange = useMemo(() => {
        if (unassignedTotalPages <= 1) {
            return [1];
        }

        const uniquePages = new Set<number>();
        uniquePages.add(1);
        uniquePages.add(unassignedTotalPages);

        for (let index = unassignedPage - 1; index <= unassignedPage + 1; index += 1) {
            if (index >= 1 && index <= unassignedTotalPages) {
                uniquePages.add(index);
            }
        }

        return Array.from(uniquePages).sort((a, b) => a - b);
    }, [unassignedPage, unassignedTotalPages]);

    const unassignedPaginationItems = useMemo(() => {
        const items: (number | "ellipsis")[] = [];
        let previous = 0;

        unassignedPaginationRange.forEach((current) => {
            if (previous && current - previous > 1) {
                items.push("ellipsis");
            }

            items.push(current);
            previous = current;
        });

        return items;
    }, [unassignedPaginationRange]);

    const showUnassignedSkeleton = useMemo(
        () => unassignedLoading && unassignedProcessIds.length === 0,
        [unassignedLoading, unassignedProcessIds],
    );

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const handleDialogOpenChange = useCallback((open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setAdvogadosPopoverOpen(false);
            setPropostasPopoverOpen(false);
            setAreaPopoverOpen(false);
            setTipoProcessoPopoverOpen(false);
            setSistemaPopoverOpen(false);
            setProcessForm(createEmptyProcessForm());
            setCreateError(null);
            setEditingProcessId(null);
            setEditingProcessGrau(null);
            setLoadingProcessForm(false);
        }
    }, []);

    const handleProcessCreate = async () => {
        if (creatingProcess || loadingProcessForm) {
            return;
        }

        const isEditingProcess = editingProcessId !== null;

        if (!processForm.clienteId) {
            setCreateError("Selecione o cliente responsável pelo processo.");
            return;
        }

        const selectedCliente = clientes.find(
            (cliente) => String(cliente.id) === processForm.clienteId,
        );

        if (!selectedCliente) {
            return;
        }

        setCreateError(null);
        setCreatingProcess(true);

        try {
            const advogadosPayload = processForm.advogados
                .map((id) => Number.parseInt(id, 10))
                .filter((value) => Number.isFinite(value) && value > 0);

            const jurisdicaoPayload = [processForm.municipio, processForm.uf]
                .map((value) => value?.trim())
                .filter((value) => value && value.length > 0)
                .join(" - ");

            const payload: Record<string, unknown> = {
                cliente_id: selectedCliente.id,
                numero: processForm.numero,
                uf: processForm.uf,
                municipio: processForm.municipio,
                ...(jurisdicaoPayload ? { jurisdicao: jurisdicaoPayload } : {}),
                advogados: advogadosPayload,
            };

            if (isEditingProcess) {
                payload.grau =
                    editingProcessGrau && editingProcessGrau.trim().length > 0
                        ? editingProcessGrau
                        : "1º Grau";
            }

            const instanciaPayload =
                processForm.instancia === INSTANCIA_OUTRO_VALUE
                    ? processForm.instanciaOutro.trim()
                    : processForm.instancia.trim();
            if (instanciaPayload) {
                payload.instancia = instanciaPayload;
            }

            const dataDistribuicaoPayload = processForm.dataDistribuicao.trim();
            if (dataDistribuicaoPayload) {
                payload.data_distribuicao = dataDistribuicaoPayload;
            }

            const propostaId = parseOptionalInteger(processForm.propostaId);
            if (propostaId && propostaId > 0) {
                payload.oportunidade_id = propostaId;
            }

            const tipoProcessoId = parseOptionalInteger(processForm.tipoProcessoId);
            if (tipoProcessoId && tipoProcessoId > 0) {
                payload.tipo_processo_id = tipoProcessoId;
            }

            const areaAtuacaoId = parseOptionalInteger(processForm.areaAtuacaoId);
            if (areaAtuacaoId && areaAtuacaoId > 0) {
                payload.area_atuacao_id = areaAtuacaoId;
            }

            const sistemaCnjId = parseOptionalInteger(processForm.sistemaCnjId);
            if (sistemaCnjId && sistemaCnjId > 0) {
                payload.sistema_cnj_id = sistemaCnjId;
            }

            payload.monitorar_processo = processForm.monitorarProcesso;

            const endpoint = isEditingProcess
                ? `processos/${editingProcessId}`
                : "processos";

            const res = await fetch(getApiUrl(endpoint), {
                method: isEditingProcess ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch (error) {
                console.error("Não foi possível interpretar a resposta de criação", error);
            }

            if (!res.ok) {
                const message =
                    json && typeof json === "object" &&
                        "error" in json &&
                        typeof (json as { error: unknown }).error === "string"
                        ? (json as { error: string }).error
                        : `Não foi possível ${isEditingProcess ? "atualizar" : "cadastrar"} o processo (HTTP ${res.status})`;
                throw new Error(message);
            }

            if (!json || typeof json !== "object") {
                throw new Error(
                    `Resposta inválida do servidor ao ${isEditingProcess ? "atualizar" : "cadastrar"} o processo`,
                );
            }

            toast({
                title: isEditingProcess
                    ? "Processo atualizado com sucesso"
                    : "Processo cadastrado com sucesso",
            });
            handleDialogOpenChange(false);
            try {
                if (isEditingProcess || page === 1) {
                    const data = await loadProcessos();
                    applyProcessosData(data);
                } else {
                    setPage(1);
                }
            } catch (refreshError) {
                console.error("Erro ao atualizar lista de processos", refreshError);
            }
        } catch (error) {
            console.error(error);
            const message =
                error instanceof Error
                    ? error.message
                    : `Erro ao ${isEditingProcess ? "atualizar" : "cadastrar"} processo`;
            setCreateError(message);
            toast({
                title: isEditingProcess
                    ? "Erro ao atualizar processo"
                    : "Erro ao cadastrar processo",
                description: message,
                variant: "destructive",
            });
        } finally {
            setCreatingProcess(false);
        }
    };

    const navigateToProcess = useCallback(
        (
            processoToView: Processo,
            options?: { initialTab?: "resumo" | "historico" | "anexos" },
        ) => {
            const state = options?.initialTab ? { initialTab: options.initialTab } : undefined;
            const navigateOptions = state ? { state } : undefined;

            const clienteId = processoToView.cliente?.id ?? null;

            if (clienteId && clienteId > 0) {
                navigate(`/clientes/${clienteId}/processos/${processoToView.id}`, navigateOptions);
                return;
            }

            toast({
                title: "Cliente do processo não identificado",
                description: "Abrindo detalhes do processo diretamente.",
            });
            navigate(`/processos/${processoToView.id}`, navigateOptions);
        },
        [navigate, toast],
    );

    const handleViewProcessDetails = useCallback(
        (processoToView: Processo) => {
            navigateToProcess(processoToView);
        },
        [navigateToProcess],
    );

    const handleEditProcess = useCallback(
        async (processoToEdit: Processo) => {
            setCreateError(null);
            setLoadingProcessForm(true);

            try {
                const res = await fetch(getApiUrl(`processos/${processoToEdit.id}`), {
                    headers: { Accept: "application/json" },
                });

                let json: unknown = null;

                try {
                    json = await res.json();
                } catch (error) {
                    console.error("Não foi possível interpretar a resposta do processo", error);
                }

                if (!res.ok) {
                    const message =
                        json &&
                        typeof json === "object" &&
                        "error" in json &&
                        typeof (json as { error?: unknown }).error === "string"
                            ? String((json as { error: string }).error)
                            : `Não foi possível carregar o processo (HTTP ${res.status})`;
                    throw new Error(message);
                }

                if (!json || typeof json !== "object") {
                    throw new Error("Resposta inválida do servidor ao carregar o processo");
                }

                const parsed = mapProcessoDetailToFormState(json as Record<string, unknown>);

                setProcessForm(parsed.form);
                setEditingProcessId(processoToEdit.id);
                setEditingProcessGrau(parsed.grau);
                setAdvogadosPopoverOpen(false);
                setPropostasPopoverOpen(false);
                setAreaPopoverOpen(false);
                setTipoProcessoPopoverOpen(false);
                setSistemaPopoverOpen(false);
                setMunicipioPopoverOpen(false);
                setClientePopoverOpen(false);
                setIsDialogOpen(true);
            } catch (error) {
                console.error(error);
                const message =
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar dados do processo";
                toast({
                    title: "Erro ao carregar processo",
                    description: message,
                    variant: "destructive",
                });
                setEditingProcessId(null);
                setEditingProcessGrau(null);
            } finally {
                setLoadingProcessForm(false);
            }
        },
        [toast],
    );

    const handleCreateButtonClick = useCallback(() => {
        setEditingProcessId(null);
        setEditingProcessGrau(null);
        setLoadingProcessForm(false);
        setProcessForm(createEmptyProcessForm());
        setCreateError(null);
        setAdvogadosPopoverOpen(false);
        setPropostasPopoverOpen(false);
        setAreaPopoverOpen(false);
        setTipoProcessoPopoverOpen(false);
        setSistemaPopoverOpen(false);
        setMunicipioPopoverOpen(false);
        setClientePopoverOpen(false);
        setIsDialogOpen(true);
    }, []);

    const isInstanciaOutroSelected = processForm.instancia === INSTANCIA_OUTRO_VALUE;

    const isCreateDisabled =
        !processForm.numero ||
        !processForm.uf ||
        !processForm.municipio ||
        !processForm.clienteId ||
        (isInstanciaOutroSelected && processForm.instanciaOutro.trim().length === 0) ||
        creatingProcess ||
        loadingProcessForm;

    const filteredProcessos = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const numericSearch = normalizedSearch.replace(/\D/g, "");

        return processos.filter((processo) => {
            const matchesStatus =
                statusFilter === "todos" || processo.status === statusFilter;
            const matchesTipo = tipoFilter === "todos" || processo.tipo === tipoFilter;

            if (!matchesStatus || !matchesTipo) {
                return false;
            }

            if (normalizedSearch.length === 0) {
                return true;
            }

            const searchPool = [
                processo.numero,
                processo.cliente?.nome,
                processo.status,
                processo.tipo,
                processo.orgaoJulgador,
                processo.classeJudicial,
                processo.advogados.map((adv) => adv.nome).join(" "),
                processo.proposta?.label,
                processo.proposta?.solicitante ?? null,
            ];

            const hasTextMatch = searchPool.some((value) => {
                if (!value) return false;
                return value.toLowerCase().includes(normalizedSearch);
            });

            const documento = processo.cliente?.documento ?? "";
            const propostaNumero = processo.proposta?.label
                ? processo.proposta.label.replace(/\D/g, "")
                : "";
            const hasDocumentoMatch =
                numericSearch.length > 0
                    ? [documento.replace(/\D/g, ""), propostaNumero]
                        .filter((value) => value.length > 0)
                        .some((value) => value.includes(numericSearch))
                    : false;

            return hasTextMatch || hasDocumentoMatch;
        });
    }, [processos, searchTerm, statusFilter, tipoFilter]);

    const isEditing = editingProcessId !== null;

    const dialogTitle = isEditing ? "Editar processo" : "Cadastrar processo";

    const dialogDescription = loadingProcessForm
        ? "Carregando dados do processo selecionado..."
        : isEditing
            ? "Atualize os dados do processo selecionado."
            : "Informe os dados básicos para registrar um novo processo.";

    const submitButtonLabel = creatingProcess
        ? isEditing
            ? "Salvando..."
            : "Cadastrando..."
        : isEditing
            ? "Salvar alterações"
            : "Cadastrar";

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground">Processos</h1>
                    <p className="text-sm text-muted-foreground">
                        Monitore os processos em andamento, acompanhe movimentações internas e identifique prioridades com mais clareza.
                    </p>
                </div>
                <Button onClick={handleCreateButtonClick} className="self-start">
                    Cadastrar processo
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Card className="border-border/60 bg-card/60 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-4 pt-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <GavelIcon className="h-5 w-5" />
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Total de processos
                            </p>
                            <p className="text-2xl font-semibold">{totalProcessos}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/60 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-4 pt-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Em andamento
                            </p>
                            <p className="text-2xl font-semibold">{processosEmAndamento}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/60 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-4 pt-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-500/10 text-slate-600">
                            <Archive className="h-5 w-5" />
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Arquivados
                            </p>
                            <p className="text-2xl font-semibold">{processosArquivados}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/60 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-4 pt-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                            <UsersIcon className="h-5 w-5" />
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Clientes vinculados
                            </p>
                            <p className="text-2xl font-semibold">{clientesAtivos}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/60 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-4 pt-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                            <RefreshCw className="h-5 w-5" />
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Sincronizações do Processo
                            </p>
                            <p className="text-2xl font-semibold">{totalSincronizacoes}</p>
                            <p className="text-xs text-muted-foreground">Consultas manuais acumuladas</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {totalProcessos === 0 ? (
                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-6 space-y-3">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-primary">
                            Automatize a captura de novos processos
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Cadastre a OAB responsável para receber automaticamente processos em tempo real.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (oabMonitorsLoading) {
                                return;
                            }
                            setOabModalDismissed(false);
                            setIsOabModalOpen(true);
                        }}
                    >
                        Cadastrar OAB
                    </Button>
                </div>
            ) : null}

            <Card className="border-border/60 bg-card/60 shadow-sm">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg">OABs monitoradas</CardTitle>
                        <CardDescription>
                            Mantenha suas OABs cadastradas para monitorar e importar processos automaticamente.
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (oabMonitorsLoading) {
                                return;
                            }
                            setOabModalDismissed(false);
                            setIsOabModalOpen(true);
                        }}
                    >
                        Adicionar OAB
                    </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                            Mantenha suas OABs cadastradas para monitorar e importar processos automaticamente.
                        </p>
                        {oabMonitorsError ? (
                            <p className="text-sm text-destructive">{oabMonitorsError}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {oabMonitorsLoading && oabMonitors.length === 0
                                    ? "Carregando OABs monitoradas..."
                                    : `Total de OABs monitoradas: ${oabMonitors.length}`}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (oabMonitorsLoading) {
                                    return;
                                }
                                setIsOabModalOpen(true);
                            }}
                        >
                            Gerenciar OABs
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 shadow-sm">
                <CardHeader className="flex flex-col gap-2 pb-0 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg">Filtros inteligentes</CardTitle>
                        <CardDescription>
                            Refine a visualização por status, tipo de processo ou busque por cliente, número ou documento.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 pt-4 md:grid-cols-[1.5fr,1fr,1fr]">
                    <div className="relative flex items-center">
                        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Pesquisar por número, cliente, CPF ou advogado"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="h-11 pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-11">
                            <SelectValue placeholder="Status do processo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os status</SelectItem>
                            {statusOptions.length === 0 ? (
                                <SelectItem value="__empty" disabled>
                                    Nenhum status disponível
                                </SelectItem>
                            ) : (
                                statusOptions.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {status}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                    <Select value={tipoFilter} onValueChange={setTipoFilter}>
                        <SelectTrigger className="h-11">
                            <SelectValue placeholder="Tipo do processo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os tipos</SelectItem>
                            {tipoOptions.length === 0 ? (
                                <SelectItem value="__empty" disabled>
                                    Nenhum tipo disponível
                                </SelectItem>
                            ) : (
                                tipoOptions.map((tipo) => (
                                    <SelectItem key={tipo} value={tipo}>
                                        {tipo}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {processosLoading ? (
                <Card className="border-border/60 bg-card/60 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Processos</CardTitle>
                        <CardDescription>Carregando dados...</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ) : processosError ? (
                <Card className="border-destructive/40 bg-destructive/5 text-destructive">
                    <CardHeader>
                        <CardTitle>Não foi possível carregar os processos</CardTitle>
                        <CardDescription className="text-destructive/80">
                            {processosError}
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : filteredProcessos.length === 0 ? (
                <Card className="border-border/60 bg-card/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>Nenhum processo encontrado</CardTitle>
                        <CardDescription>
                            Ajuste os filtros ou refine a busca para visualizar outros resultados.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Você pode cadastrar um novo processo clicando no botão acima.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredProcessos.map((processo) => (
                        <ProcessCard
                            key={processo.id}
                            numero={processo.numero}
                            status={processo.status}
                            cliente={processo.cliente.nome}
                            dataDistribuicao={processo.dataDistribuicao}
                            jurisdicao={processo.jurisdicao}
                            orgaoJulgador={processo.orgaoJulgador}
                            onView={() => handleViewProcessDetails(processo)}
                            onEdit={() => handleEditProcess(processo)}
                        />
                    ))}

                    <div className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            {totalProcessos === 0
                                ? "Nenhum processo para exibir"
                                : `Mostrando ${pageStart}–${pageEnd} de ${totalProcessos} processos`}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Itens por página</span>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(value) => {
                                        const parsed = Number.parseInt(value, 10);
                                        if (Number.isFinite(parsed) && parsed > 0) {
                                            setPageSize(parsed);
                                            setPage(1);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-9 w-[84px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 20, 50].map((option) => (
                                            <SelectItem key={option} value={String(option)}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                    disabled={page <= 1}
                                >
                                    Anterior
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Página {page} de {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={page >= totalPages}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={isOabModalOpen} onOpenChange={handleOabModalChange}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Gerenciar OABs monitoradas</DialogTitle>
                        <DialogDescription>
                            Cadastre novas OABs monitoradas ou remova registros que não deseja mais acompanhar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">OABs cadastradas</p>
                                <p className="text-xs text-muted-foreground">
                                    Visualize e gerencie os números monitorados pela sua empresa.
                                </p>
                            </div>
                            {oabMonitorsLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Carregando OABs monitoradas...
                                </div>
                            ) : oabMonitorsError ? (
                                <p className="text-sm text-destructive">{oabMonitorsError}</p>
                            ) : oabMonitors.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Nenhuma OAB cadastrada no momento.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {oabMonitors.map((monitor) => (
                                        <div
                                            key={monitor.id}
                                            className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/60 p-3"
                                        >
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    {formatOabDisplay(monitor.numero, monitor.uf)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {monitor.usuarioNome ?? "Usuário não identificado"}
                                                    {monitor.usuarioOab ? ` • ${monitor.usuarioOab}` : ""}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Monitorando desde {formatDateTimeToPtBR(monitor.createdAt)}
                                                </p>
                                            </div>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleRemoveOabMonitor(monitor.id)}
                                                disabled={oabRemovingId === monitor.id}
                                            >
                                                {oabRemovingId === monitor.id ? "Removendo..." : "Remover"}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">Cadastrar nova OAB</p>
                                <p className="text-xs text-muted-foreground">
                                    Selecione o responsável e informe os dados da OAB que deseja monitorar.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="oab-usuario">Responsável</Label>
                                <Select
                                    value={oabUsuarioId}
                                    onValueChange={handleOabUsuarioChange}
                                    disabled={oabUsuariosLoading || oabUsuarioOptions.length === 0}
                                >
                                    <SelectTrigger id="oab-usuario">
                                        <SelectValue
                                            placeholder={
                                                oabUsuariosLoading
                                                    ? "Carregando usuários..."
                                                    : oabUsuariosError ?? "Selecione o responsável"
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {oabUsuarioOptions.map((option) => (
                                            <SelectItem key={option.id} value={option.id}>
                                                {option.oab ? `${option.nome} (${option.oab})` : option.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {oabUsuariosError ? (
                                    <p className="text-sm text-destructive">{oabUsuariosError}</p>
                                ) : null}
                            </div>
                            {oabSubmitError ? (
                                <p className="text-sm text-destructive">{oabSubmitError}</p>
                            ) : null}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            onClick={handleOabSubmit}
                            disabled={
                                oabSubmitLoading ||
                                !oabUf ||
                                !oabNumero ||
                                !oabUsuarioId ||
                                oabUsuariosLoading
                            }
                        >
                            {oabSubmitLoading ? "Cadastrando..." : "Cadastrar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={unassignedModalOpen} onOpenChange={handleUnassignedModalChange}>
                <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Processos sincronizados sem cliente vinculado</DialogTitle>
                        <DialogDescription>
                            Vincule clientes, propostas e relações com os envolvidos para completar o cadastro.
                        </DialogDescription>
                    </DialogHeader>
                    {unassignedError ? (
                        <p className="text-sm text-destructive">{unassignedError}</p>
                    ) : null}
                    {showUnassignedSkeleton ? (
                        <div className="space-y-2">
                            {[0, 1].map((item) => (
                                <Skeleton key={item} className="h-24 w-full" />
                            ))}
                        </div>
                    ) : unassignedProcessIds.length === 0 && !unassignedError ? (
                        <p className="text-sm text-muted-foreground">
                            Todos os processos já possuem clientes vinculados.
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {unassignedTotal > 0 ? (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Mostrando {unassignedPageStart}–{unassignedPageEnd} de {unassignedTotal}{" "}
                                        processos clientes vinculados 
                                    </p>
                                </div>
                            ) : null}
                            {unassignedProcessIds.map((processId) => {
                                const detail = unassignedDetails[processId];
                                const baseProcess = unassignedProcesses.find(
                                    (processo) => processo.id === processId,
                                );

                                if (!detail || !baseProcess) {
                                    return (
                                        <Card key={processId} className="border-border/60 bg-muted/30">
                                            <CardHeader>
                                                <CardTitle>Carregando processo...</CardTitle>
                                                <CardDescription>Aguarde enquanto buscamos os detalhes.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <Skeleton className="h-20 w-full" />
                                            </CardContent>
                                        </Card>
                                    );
                                }

                                const hasExistingClient = Boolean(detail.selectedExistingClientId);
                                const selectedExistingClient = hasExistingClient
                                    ? clientes.find(
                                          (cliente) =>
                                              String(cliente.id) === detail.selectedExistingClientId,
                                      ) ?? null
                                    : null;
                                const isClientPopoverOpen =
                                    unassignedClientPopoverOpenId === processId;
                                const clientButtonLabel = (() => {
                                    if (clientesLoading && clientes.length === 0) {
                                        return "Carregando clientes...";
                                    }

                                    if (selectedExistingClient) {
                                        return `${selectedExistingClient.nome}${
                                            selectedExistingClient.documento
                                                ? ` — ${selectedExistingClient.documento}`
                                                : ""
                                        }`;
                                    }

                                    if (hasExistingClient) {
                                        return `Cliente #${detail.selectedExistingClientId}`;
                                    }

                                    return "Cliente não cadastrado";
                                })();
                                const availablePropostas = hasExistingClient
                                    ? propostas.filter(
                                          (proposta) => proposta.solicitanteId === detail.selectedExistingClientId,
                                      )
                                    : [];
                                const canSave =
                                    hasExistingClient || Boolean(detail.primaryParticipantId);

                                return (
                                    <Card key={processId} className="border-border/60 bg-card/60 shadow-sm">
                                        <CardHeader>
                                            <CardTitle>Processo {baseProcess.numero}</CardTitle>
                                            <CardDescription>
                                                Indique quem é o cliente do escritório e vincule propostas relacionadas.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Meus Clientes</Label>
                                                    <Popover
                                                        open={isClientPopoverOpen}
                                                        onOpenChange={(open) =>
                                                            setUnassignedClientPopoverOpenId(
                                                                open ? processId : null,
                                                            )
                                                        }
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={isClientPopoverOpen}
                                                                className="w-full justify-between"
                                                            >
                                                                <span className="truncate">{clientButtonLabel}</span>
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Buscar cliente..." />
                                                                <CommandList>
                                                                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        <CommandItem
                                                                            value="Cliente não cadastrado"
                                                                            onSelect={() => {
                                                                                handleExistingClientSelection(
                                                                                    processId,
                                                                                    NO_EXISTING_CLIENT_SELECT_VALUE,
                                                                                );
                                                                                setUnassignedClientPopoverOpenId(null);
                                                                            }}
                                                                        >
                                                                            <span>Cliente não cadastrado</span>
                                                                            <Check
                                                                                className={`ml-auto h-4 w-4 ${
                                                                                    hasExistingClient
                                                                                        ? "opacity-0"
                                                                                        : "opacity-100"
                                                                                }`}
                                                                            />
                                                                        </CommandItem>
                                                                        {clientes.map((cliente) => {
                                                                            const optionLabel = `${cliente.nome}${
                                                                                cliente.documento
                                                                                    ? ` — ${cliente.documento}`
                                                                                    : ""
                                                                            }`;
                                                                            const isSelected =
                                                                                detail.selectedExistingClientId ===
                                                                                String(cliente.id);
                                                                            const searchableText = [
                                                                                cliente.nome,
                                                                                cliente.documento,
                                                                                cliente.tipo,
                                                                                String(cliente.id),
                                                                            ]
                                                                                .filter(Boolean)
                                                                                .join(" ");
                                                                            return (
                                                                                <CommandItem
                                                                                    key={cliente.id}
                                                                                    value={searchableText}
                                                                                    onSelect={() => {
                                                                                        handleExistingClientSelection(
                                                                                            processId,
                                                                                            String(cliente.id),
                                                                                        );
                                                                                        setUnassignedClientPopoverOpenId(null);
                                                                                    }}
                                                                                >
                                                                                    <span>{optionLabel}</span>
                                                                                    <Check
                                                                                        className={`ml-auto h-4 w-4 ${
                                                                                            isSelected
                                                                                                ? "opacity-100"
                                                                                                : "opacity-0"
                                                                                        }`}
                                                                                    />
                                                                                </CommandItem>
                                                                            );
                                                                        })}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    {!hasExistingClient ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            Se preferir, marque um envolvido abaixo para criar o
                                                            pré-cadastro automaticamente.
                                                        </p>
                                                    ) : null}
                                                </div>
                                                {hasExistingClient ? (
                                                    <div className="space-y-2">
                                                        <Label>Proposta relacionada</Label>
                                                        <Select
                                                            value={
                                                                detail.selectedPropostaId ||
                                                                NO_PROPOSTA_SELECT_VALUE
                                                            }
                                                            onValueChange={(value) =>
                                                                handleSelectedPropostaChange(processId, value)
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Sem proposta vinculada" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value={NO_PROPOSTA_SELECT_VALUE}>
                                                                    Sem proposta
                                                                </SelectItem>
                                                                {availablePropostas.map((proposta) => (
                                                                    <SelectItem key={proposta.id} value={proposta.id}>
                                                                        {proposta.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ) : null}
                                            </div>
                                            {!hasExistingClient ? (
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Envolvidos do processo</Label>
                                                    {detail.participants.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">
                                                            Nenhum envolvido identificado para este processo.
                                                        </p>
                                                    ) : (
                                                        <RadioGroup
                                                            value={detail.primaryParticipantId ?? ""}
                                                            onValueChange={(value) =>
                                                                handlePrimaryParticipantChange(processId, value)
                                                            }
                                                            className="space-y-3"
                                                        >
                                                            {detail.participants.map((participant) => {
                                                                const checked = detail.selectedParticipantIds.includes(
                                                                    participant.id,
                                                                );
                                                                return (
                                                                    <div
                                                                        key={participant.id}
                                                                        className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3"
                                                                    >
                                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                            <div className="space-y-1">
                                                                                <p className="text-sm font-medium text-foreground">
                                                                                    {participant.name}
                                                                                </p>
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    {participant.document
                                                                                        ? `Documento: ${participant.document}`
                                                                                        : "Documento não informado"}
                                                                                </p>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {participant.role ? (
                                                                                        <Badge variant="secondary">
                                                                                            {participant.role}
                                                                                        </Badge>
                                                                                    ) : null}
                                                                                    {participant.type ? (
                                                                                        <Badge variant="outline">
                                                                                            {participant.type}
                                                                                        </Badge>
                                                                                    ) : null}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-col items-end gap-2">
                                                                                <Checkbox
                                                                                    checked={checked}
                                                                                    onCheckedChange={() =>
                                                                                        handleParticipantToggle(
                                                                                            processId,
                                                                                            participant.id,
                                                                                        )
                                                                                    }
                                                                                /> 
                                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                                    <RadioGroupItem
                                                                                        value={participant.id}
                                                                                        id={`primary-${processId}-${participant.id}`}
                                                                                    /> 
                                                                                    <Label
                                                                                        htmlFor={`primary-${processId}-${participant.id}`}
                                                                                        className="text-xs font-normal"
                                                                                    >
                                                                                        Cliente principal
                                                                                    </Label>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2">

                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </RadioGroup>
                                                    )}
                                                </div>
                                            ) : null}
                                            {detail.error ? (
                                                <p className="text-sm text-destructive">{detail.error}</p>
                                            ) : null}
                                            <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-xs text-muted-foreground">
                                                    Selecione um cliente existente ou defina um envolvido como cliente
                                                    principal para concluir o vínculo.
                                                </p>
                                                <Button
                                                    onClick={() => void handleLinkProcess(processId)}
                                                    disabled={!canSave || detail.saving}
                                                >
                                                    {detail.saving ? "Vinculando..." : "Salvar vinculação"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                            {unassignedTotalPages > 1 ? (
                                <Pagination className="justify-center">
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationLink
                                                href="#"
                                                size="default"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    setUnassignedPage((current) => Math.max(current - 1, 1));
                                                }}
                                                aria-disabled={unassignedPage === 1}
                                                className={
                                                    unassignedPage === 1
                                                        ? "pointer-events-none opacity-50"
                                                        : undefined
                                                }
                                            >
                                                <ChevronLeft className="mr-1 h-4 w-4" />
                                                <span>Anterior</span>
                                            </PaginationLink>
                                        </PaginationItem>
                                        {unassignedPaginationItems.map((item, itemIndex) =>
                                            typeof item === "number" ? (
                                                <PaginationItem key={item}>
                                                    <PaginationLink
                                                        href="#"
                                                        isActive={item === unassignedPage}
                                                        size="default"
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            setUnassignedPage(item);
                                                        }}
                                                    >
                                                        {item}
                                                    </PaginationLink>
                                                </PaginationItem>
                                            ) : (
                                                <PaginationItem key={`ellipsis-${itemIndex}`}>
                                                    <PaginationEllipsis />
                                                </PaginationItem>
                                            ),
                                        )}
                                        <PaginationItem>
                                            <PaginationLink
                                                href="#"
                                                size="default"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    setUnassignedPage((current) =>
                                                        Math.min(current + 1, unassignedTotalPages),
                                                    );
                                                }}
                                                aria-disabled={unassignedPage === unassignedTotalPages}
                                                className={
                                                    unassignedPage === unassignedTotalPages
                                                        ? "pointer-events-none opacity-50"
                                                        : undefined
                                                }
                                            >
                                                <span>Próxima</span>
                                                <ChevronRight className="ml-1 h-4 w-4" />
                                            </PaginationLink>
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            ) : null}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleUnassignedModalChange(false)}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">

                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>{dialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-1">
                            <Label htmlFor="process-client">Cliente</Label>
                            <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="process-client"
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={clientePopoverOpen}
                                        className="w-full justify-between"
                                        disabled={clientesLoading && clientes.length === 0}
                                    >
                                        <span className="truncate">{clienteButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar cliente..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {clientesLoading
                                                    ? "Carregando clientes..."
                                                    : "Nenhum cliente encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {clientes.map((cliente) => (
                                                    <CommandItem
                                                        key={cliente.id}
                                                        value={`${cliente.nome} ${cliente.documento ?? ""}`.trim()}
                                                        onSelect={() => {
                                                            setProcessForm((prev) => ({
                                                                ...prev,
                                                                clienteId: String(cliente.id),
                                                            }));
                                                            setClientePopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${processForm.clienteId === String(cliente.id)
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                                }`}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{cliente.nome}</span>
                                                            {cliente.documento ? (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {cliente.documento}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                            <Label htmlFor="process-proposta">Proposta vinculada</Label>
                            <Popover
                                open={propostasPopoverOpen}
                                onOpenChange={setPropostasPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        id="process-proposta"
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={propostasPopoverOpen}
                                        className="w-full justify-between"
                                        disabled={propostasLoading && propostas.length === 0}
                                    >
                                        <span className="truncate">{propostaButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Buscar proposta..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {propostasLoading
                                                    ? "Carregando propostas..."
                                                    : propostasError ?? "Nenhuma proposta encontrada"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="Nenhuma proposta"
                                                    onSelect={() => {
                                                        setProcessForm((prev) => ({ ...prev, propostaId: "" }));
                                                        setPropostasPopoverOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${processForm.propostaId === "" ? "opacity-100" : "opacity-0"}`}
                                                    />
                                                    Nenhuma proposta vinculada
                                                </CommandItem>
                                                {filteredPropostas.map((proposta) => {
                                                    const selected = processForm.propostaId === proposta.id;
                                                    return (
                                                        <CommandItem
                                                            key={proposta.id}
                                                            value={proposta.label}
                                                            onSelect={() => {
                                                                setProcessForm((prev) => ({
                                                                    ...prev,
                                                                    propostaId: proposta.id,
                                                                }));
                                                                setPropostasPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{proposta.label}</span>
                                                                {proposta.solicitante ? (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Solicitante: {proposta.solicitante}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {propostasError ? (
                                <p className="text-xs text-destructive">{propostasError}</p>
                            ) : selectedProposta ? (
                                <p className="text-xs text-muted-foreground">
                                    Proposta selecionada{selectedProposta.solicitante ? ` para ${selectedProposta.solicitante}` : ""}.
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Vincule uma proposta existente ao processo (opcional).
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="process-uf">UF</Label>
                            <Select
                                value={processForm.uf}
                                onValueChange={(value) =>
                                    setProcessForm((prev) => ({
                                        ...prev,
                                        uf: value,
                                        municipio: "",
                                    }))
                                }
                            >
                                <SelectTrigger id="process-uf">
                                    <SelectValue placeholder="Selecione a UF" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ufOptions.map((uf) => (
                                        <SelectItem key={uf.sigla} value={uf.sigla}>
                                            {uf.nome} ({uf.sigla})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="process-municipio">Município</Label>
                            <Popover
                                open={municipioPopoverOpen}
                                onOpenChange={setMunicipioPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        id="process-municipio"
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={municipioPopoverOpen}
                                        className="w-full justify-between"
                                        disabled={!processForm.uf || municipiosLoading}
                                    >
                                        <span className="truncate">{municipioButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar município..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {municipiosLoading
                                                    ? "Carregando municípios..."
                                                    : "Nenhum município encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {municipios.map((municipio) => {
                                                    const selected = processForm.municipio === municipio.nome;
                                                    return (
                                                        <CommandItem
                                                            key={municipio.id}
                                                            value={municipio.nome}
                                                            onSelect={() => {
                                                                setProcessForm((prev) => ({
                                                                    ...prev,
                                                                    municipio: municipio.nome,
                                                                }));
                                                                setMunicipioPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            {municipio.nome}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Advogados responsáveis</Label>
                            <Popover
                                open={advogadosPopoverOpen}
                                onOpenChange={setAdvogadosPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={advogadosPopoverOpen}
                                        className="w-full justify-between"
                                        disabled={advogadosLoading && advogadosOptions.length === 0}
                                    >
                                        <span className="truncate">
                                            {advogadosLoading && advogadosOptions.length === 0
                                                ? "Carregando advogados..."
                                                : selectedAdvogados.length === 0
                                                    ? advogadosOptions.length === 0
                                                        ? "Nenhum advogado disponível"
                                                        : "Selecione os advogados responsáveis"
                                                    : selectedAdvogados.length === 1
                                                        ? selectedAdvogados[0].nome
                                                        : `${selectedAdvogados.length} advogados selecionados`}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar advogados..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {advogadosLoading
                                                    ? "Carregando advogados..."
                                                    : advogadosError ?? "Nenhum advogado encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {advogadosOptions.map((advogado) => {
                                                    const selected = processForm.advogados.includes(advogado.id);
                                                    return (
                                                        <CommandItem
                                                            key={advogado.id}
                                                            value={`${advogado.nome} ${advogado.descricao ?? ""}`}
                                                            onSelect={() => toggleAdvogadoSelection(advogado.id)}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{advogado.nome}</span>
                                                                {advogado.descricao ? (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {advogado.descricao}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {selectedAdvogados.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedAdvogados.map((advogado) => (
                                        <Badge
                                            key={`selected-${advogado.id}`}
                                            variant="secondary"
                                            className="flex items-center gap-1 text-xs"
                                        >
                                            <span>{advogado.nome}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleAdvogadoSelection(advogado.id)}
                                                className="ml-1 text-muted-foreground transition hover:text-foreground"
                                                aria-label={`Remover ${advogado.nome}`}
                                            >
                                                ×
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    {advogadosError
                                        ? advogadosError
                                        : ""}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2 sm:col-span-2 md:col-span-1">
                            <Label htmlFor="process-area-atuacao">Área de atuação</Label>
                            <Popover open={areaPopoverOpen} onOpenChange={setAreaPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={areaPopoverOpen}
                                        className="w-full justify-between"
                                        id="process-area-atuacao"
                                        disabled={areaLoading && areaOptions.length === 0}
                                    >
                                        <span className="truncate">{areaButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar área..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {areaLoading
                                                    ? "Carregando áreas..."
                                                    : areaError ?? "Nenhuma área encontrada"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {areaOptions.map((option) => (
                                                    <CommandItem
                                                        key={option.id}
                                                        value={`${option.nome} ${option.id}`}
                                                        onSelect={() => {
                                                            setProcessForm((prev) => ({
                                                                ...prev,
                                                                areaAtuacaoId:
                                                                    prev.areaAtuacaoId === option.id ? "" : option.id,
                                                            }));
                                                            setAreaPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${processForm.areaAtuacaoId === option.id
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                                }`}
                                                        />
                                                        {option.nome}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {areaError ? (
                                <p className="text-xs text-destructive">{areaError}</p>
                            ) : null}

                        </div>

                        <div className="space-y-2 sm:col-span-1">

                            <Label htmlFor="process-tipo-processo">Tipo de processo</Label>
                            <Popover
                                open={tipoProcessoPopoverOpen}
                                onOpenChange={setTipoProcessoPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={tipoProcessoPopoverOpen}
                                        className="w-full justify-between"
                                        id="process-tipo-processo"
                                        disabled={tipoProcessoLoading && tipoProcessoOptions.length === 0}
                                    >
                                        <span className="truncate">{tipoProcessoButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar tipo..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {tipoProcessoLoading
                                                    ? "Carregando tipos..."
                                                    : tipoProcessoError ?? "Nenhum tipo encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {tipoProcessoOptions.map((option) => (
                                                    <CommandItem
                                                        key={option.id}
                                                        value={`${option.nome} ${option.id}`}
                                                        onSelect={() => {
                                                            setProcessForm((prev) => ({
                                                                ...prev,
                                                                tipoProcessoId:
                                                                    prev.tipoProcessoId === option.id ? "" : option.id,
                                                            }));
                                                            setTipoProcessoPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${processForm.tipoProcessoId === option.id
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                                }`}
                                                        />
                                                        {option.nome}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {tipoProcessoError ? (
                                <p className="text-xs text-destructive">{tipoProcessoError}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2 sm:col-span-2 md:col-span-1">
                            <Label htmlFor="process-number">Número do processo</Label>
                            <Input
                                id="process-number"
                                placeholder="0000000-00.0000.0.00.0000"
                                value={processForm.numero}
                                onChange={(event) =>
                                    setProcessForm((prev) => ({
                                        ...prev,
                                        numero: formatProcessNumber(event.target.value),
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                            <Label htmlFor="process-instancia">Instância do processo</Label>
                            <Select
                                value={processForm.instancia}
                                onValueChange={(value) =>
                                    setProcessForm((prev) => ({
                                        ...prev,
                                        instancia: value,
                                        instanciaOutro:
                                            value === INSTANCIA_OUTRO_VALUE ? prev.instanciaOutro : "",
                                    }))
                                }
                            >
                                <SelectTrigger id="process-instancia">
                                    <SelectValue placeholder="Selecione a instância" />
                                </SelectTrigger>
                                <SelectContent>
                                    {INSTANCIA_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 sm:col-span-1">

                            <Label htmlFor="process-distribution-date">Data da distribuição</Label>
                            <Input
                                id="process-distribution-date"
                                type="date"
                                value={processForm.dataDistribuicao}
                                onChange={(event) =>
                                    setProcessForm((prev) => ({
                                        ...prev,
                                        dataDistribuicao: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        {isInstanciaOutroSelected ? (
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="process-instancia-outro">Especificar instância</Label>
                                <Input
                                    id="process-instancia-outro"
                                    placeholder="Descreva a instância"
                                    value={processForm.instanciaOutro}
                                    onChange={(event) =>
                                        setProcessForm((prev) => ({
                                            ...prev,
                                            instanciaOutro: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        ) : null}
                        <div className="space-y-2 sm:col-span-2 md:col-span-1">
                            <Label htmlFor="process-sistema-cnj">Sistema judicial</Label>
                            <Popover open={sistemaPopoverOpen} onOpenChange={setSistemaPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={sistemaPopoverOpen}
                                        className="w-full justify-between"
                                        id="process-sistema-cnj"
                                        disabled={sistemaLoading && sistemaOptions.length === 0}
                                    >
                                        <span className="truncate">{sistemaButtonLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput placeholder="Pesquisar sistema..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                {sistemaLoading
                                                    ? "Carregando sistemas..."
                                                    : sistemaError ?? "Nenhum sistema encontrado"}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {sistemaOptions.map((option) => (
                                                    <CommandItem
                                                        key={option.id}
                                                        value={`${option.nome} ${option.id}`}
                                                        onSelect={() => {
                                                            setProcessForm((prev) => ({
                                                                ...prev,
                                                                sistemaCnjId:
                                                                    prev.sistemaCnjId === option.id ? "" : option.id,
                                                            }));
                                                            setSistemaPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${processForm.sistemaCnjId === option.id
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                                }`}
                                                        />
                                                        {option.nome}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {sistemaError ? (
                                <p className="text-xs text-destructive">{sistemaError}</p>
                            ) : null}
                        </div>

                        <div className="sm:col-span-2">
                            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                                <div className="space-y-1">
                                    <Label htmlFor="process-monitorar" className="text-sm font-medium">
                                        Monitorar processo
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Ative para acompanhar automaticamente atualizações deste processo.
                                    </p>
                                </div>
                                <Switch
                                    id="process-monitorar"
                                    checked={processForm.monitorarProcesso}
                                    onCheckedChange={(checked) =>
                                        setProcessForm((prev) => ({
                                            ...prev,
                                            monitorarProcesso: checked,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    {createError ? (
                        <p className="text-sm text-destructive">{createError}</p>
                    ) : null}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleProcessCreate}
                            disabled={isCreateDisabled}
                        >
                            {submitButtonLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

