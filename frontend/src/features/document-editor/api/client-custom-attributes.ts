import { getApiUrl } from '@/lib/api';

export interface ClientCustomAttributeType {
  id: string;
  label: string;
  value?: string;
}

const COLLECTION_KEYS = ['data', 'items', 'rows', 'tipos', 'values'];
const LABEL_KEYS = [
  'nome',
  'nome_tipo',
  'nome_atributo',
  'descricao',
  'descricao_tipo',
  'descricao_atributo',
  'descricao_tipo_atributo',
  'descricao_tipodocumento',
  'descricao_tipo_documento',
  'titulo',
  'label',
  'tipo',
  'name',
];
const VALUE_KEYS = [
  'variavel',
  'chave',
  'key',
  'slug',
  'campo',
  'tag',
  'identificador',
  'codigo',
  'valor',
];
const ID_KEYS = [
  'id',
  'idtipo',
  'id_tipo',
  'idtipodocumento',
  'id_tipo_documento',
  'idtipoatributo',
  'id_tipo_atributo',
  'idatributo',
  'id_atributo',
  'idtipoatributocliente',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickFirstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    } else if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return undefined;
}

function extractCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload)) {
    for (const key of COLLECTION_KEYS) {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

export async function fetchClientCustomAttributeTypes(): Promise<ClientCustomAttributeType[]> {
  const response = await fetch(getApiUrl('clientes/atributos/tipos'), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Não foi possível carregar os atributos personalizados.');
  }

  const payload = (await response.json()) as unknown;
  const rawItems = extractCollection(payload);
  const attributes: ClientCustomAttributeType[] = [];
  const seen = new Set<string>();

  rawItems.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const label = pickFirstString(item, LABEL_KEYS);
    if (!label) {
      return;
    }

    const id = pickFirstString(item, ID_KEYS) ?? `custom-${index}`;
    const value = pickFirstString(item, VALUE_KEYS);
    const signature = `${id}|${label}`;

    if (seen.has(signature)) {
      return;
    }

    seen.add(signature);
    attributes.push({
      id,
      label,
      value: value?.trim() || undefined,
    });
  });

  return attributes.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}
