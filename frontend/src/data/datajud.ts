export type DatajudCategoriaId =
  | "tribunais-superiores"
  | "justica-federal"
  | "justica-estadual"
  | "justica-trabalho"
  | "justica-eleitoral"
  | "justica-militar";

export interface DatajudCategoria {
  id: DatajudCategoriaId;
  nome: string;
}

export interface DatajudTribunal {
  alias: string;
  nome: string;
  categoriaId: DatajudCategoriaId;
}

export const DATAJUD_CATEGORIAS: DatajudCategoria[] = [
  { id: "tribunais-superiores", nome: "Tribunais Superiores" },
  { id: "justica-federal", nome: "Justiça Federal" },
  { id: "justica-estadual", nome: "Justiça Estadual" },
  { id: "justica-trabalho", nome: "Justiça do Trabalho" },
  { id: "justica-eleitoral", nome: "Justiça Eleitoral" },
  { id: "justica-militar", nome: "Justiça Militar" },
];

export const DATAJUD_TRIBUNAIS: DatajudTribunal[] = [
  { alias: "api_publica_tst", nome: "Tribunal Superior do Trabalho", categoriaId: "tribunais-superiores" },
  { alias: "api_publica_tse", nome: "Tribunal Superior Eleitoral", categoriaId: "tribunais-superiores" },
  { alias: "api_publica_stj", nome: "Tribunal Superior de Justiça", categoriaId: "tribunais-superiores" },
  { alias: "api_publica_stm", nome: "Tribunal Superior Militar", categoriaId: "tribunais-superiores" },
  { alias: "api_publica_trf1", nome: "Tribunal Regional Federal da 1ª Região", categoriaId: "justica-federal" },
  { alias: "api_publica_trf2", nome: "Tribunal Regional Federal da 2ª Região", categoriaId: "justica-federal" },
  { alias: "api_publica_trf3", nome: "Tribunal Regional Federal da 3ª Região", categoriaId: "justica-federal" },
  { alias: "api_publica_trf4", nome: "Tribunal Regional Federal da 4ª Região", categoriaId: "justica-federal" },
  { alias: "api_publica_trf5", nome: "Tribunal Regional Federal da 5ª Região", categoriaId: "justica-federal" },
  { alias: "api_publica_trf6", nome: "Tribunal Regional Federal da 6ª Região", categoriaId: "justica-federal" },
  { alias: "api_publica_tjac", nome: "Tribunal de Justiça do Acre", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjal", nome: "Tribunal de Justiça de Alagoas", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjam", nome: "Tribunal de Justiça do Amazonas", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjap", nome: "Tribunal de Justiça do Amapá", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjba", nome: "Tribunal de Justiça da Bahia", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjce", nome: "Tribunal de Justiça do Ceará", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjdft", nome: "Tribunal de Justiça do Distrito Federal e Territórios", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjes", nome: "Tribunal de Justiça do Espírito Santo", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjgo", nome: "Tribunal de Justiça de Goiás", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjma", nome: "Tribunal de Justiça do Maranhão", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjmg", nome: "Tribunal de Justiça de Minas Gerais", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjms", nome: "Tribunal de Justiça do Mato Grosso do Sul", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjmt", nome: "Tribunal de Justiça do Mato Grosso", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjpa", nome: "Tribunal de Justiça do Pará", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjpb", nome: "Tribunal de Justiça da Paraíba", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjpe", nome: "Tribunal de Justiça de Pernambuco", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjpi", nome: "Tribunal de Justiça do Piauí", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjpr", nome: "Tribunal de Justiça do Paraná", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjrj", nome: "Tribunal de Justiça do Rio de Janeiro", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjrn", nome: "Tribunal de Justiça do Rio Grande do Norte", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjro", nome: "Tribunal de Justiça de Rondônia", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjrr", nome: "Tribunal de Justiça de Roraima", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjrs", nome: "Tribunal de Justiça do Rio Grande do Sul", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjsc", nome: "Tribunal de Justiça de Santa Catarina", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjse", nome: "Tribunal de Justiça de Sergipe", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjsp", nome: "Tribunal de Justiça de São Paulo", categoriaId: "justica-estadual" },
  { alias: "api_publica_tjto", nome: "Tribunal de Justiça do Tocantins", categoriaId: "justica-estadual" },
  { alias: "api_publica_trt1", nome: "Tribunal Regional do Trabalho da 1ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt2", nome: "Tribunal Regional do Trabalho da 2ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt3", nome: "Tribunal Regional do Trabalho da 3ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt4", nome: "Tribunal Regional do Trabalho da 4ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt5", nome: "Tribunal Regional do Trabalho da 5ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt6", nome: "Tribunal Regional do Trabalho da 6ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt7", nome: "Tribunal Regional do Trabalho da 7ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt8", nome: "Tribunal Regional do Trabalho da 8ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt9", nome: "Tribunal Regional do Trabalho da 9ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt10", nome: "Tribunal Regional do Trabalho da 10ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt11", nome: "Tribunal Regional do Trabalho da 11ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt12", nome: "Tribunal Regional do Trabalho da 12ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt13", nome: "Tribunal Regional do Trabalho da 13ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt14", nome: "Tribunal Regional do Trabalho da 14ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt15", nome: "Tribunal Regional do Trabalho da 15ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt16", nome: "Tribunal Regional do Trabalho da 16ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt17", nome: "Tribunal Regional do Trabalho da 17ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt18", nome: "Tribunal Regional do Trabalho da 18ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt19", nome: "Tribunal Regional do Trabalho da 19ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt20", nome: "Tribunal Regional do Trabalho da 20ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt21", nome: "Tribunal Regional do Trabalho da 21ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt22", nome: "Tribunal Regional do Trabalho da 22ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt23", nome: "Tribunal Regional do Trabalho da 23ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_trt24", nome: "Tribunal Regional do Trabalho da 24ª Região", categoriaId: "justica-trabalho" },
  { alias: "api_publica_tre-ac", nome: "Tribunal Regional Eleitoral do Acre", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-al", nome: "Tribunal Regional Eleitoral de Alagoas", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-am", nome: "Tribunal Regional Eleitoral do Amazonas", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-ap", nome: "Tribunal Regional Eleitoral do Amapá", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-ba", nome: "Tribunal Regional Eleitoral da Bahia", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-ce", nome: "Tribunal Regional Eleitoral do Ceará", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-dft", nome: "Tribunal Regional Eleitoral do Distrito Federal", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-es", nome: "Tribunal Regional Eleitoral do Espírito Santo", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-go", nome: "Tribunal Regional Eleitoral de Goiás", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-ma", nome: "Tribunal Regional Eleitoral do Maranhão", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-mg", nome: "Tribunal Regional Eleitoral de Minas Gerais", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-ms", nome: "Tribunal Regional Eleitoral do Mato Grosso do Sul", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-mt", nome: "Tribunal Regional Eleitoral do Mato Grosso", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-pa", nome: "Tribunal Regional Eleitoral do Pará", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-pb", nome: "Tribunal Regional Eleitoral da Paraíba", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-pe", nome: "Tribunal Regional Eleitoral de Pernambuco", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-pi", nome: "Tribunal Regional Eleitoral do Piauí", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-pr", nome: "Tribunal Regional Eleitoral do Paraná", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-rj", nome: "Tribunal Regional Eleitoral do Rio de Janeiro", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-rn", nome: "Tribunal Regional Eleitoral do Rio Grande do Norte", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-ro", nome: "Tribunal Regional Eleitoral de Rondônia", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-rr", nome: "Tribunal Regional Eleitoral de Roraima", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-rs", nome: "Tribunal Regional Eleitoral do Rio Grande do Sul", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-sc", nome: "Tribunal Regional Eleitoral de Santa Catarina", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-se", nome: "Tribunal Regional Eleitoral de Sergipe", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-sp", nome: "Tribunal Regional Eleitoral de São Paulo", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tre-to", nome: "Tribunal Regional Eleitoral do Tocantins", categoriaId: "justica-eleitoral" },
  { alias: "api_publica_tjmmg", nome: "Tribunal Justiça Militar de Minas Gerais", categoriaId: "justica-militar" },
  { alias: "api_publica_tjmrs", nome: "Tribunal Justiça Militar do Rio Grande do Sul", categoriaId: "justica-militar" },
  { alias: "api_publica_tjmsp", nome: "Tribunal Justiça Militar de São Paulo", categoriaId: "justica-militar" },
];

export const DATAJUD_TRIBUNAIS_BY_CATEGORIA: Record<
  DatajudCategoriaId,
  DatajudTribunal[]
> = DATAJUD_CATEGORIAS.reduce((acc, categoria) => {
  acc[categoria.id] = DATAJUD_TRIBUNAIS.filter(
    (tribunal) => tribunal.categoriaId === categoria.id,
  );
  return acc;
}, {} as Record<DatajudCategoriaId, DatajudTribunal[]>);

export const DATAJUD_TRIBUNAL_MAP = new Map(
  DATAJUD_TRIBUNAIS.map((tribunal) => [tribunal.alias, tribunal] as const),
);

export const DATAJUD_CATEGORIA_MAP = new Map(
  DATAJUD_CATEGORIAS.map((categoria) => [categoria.id, categoria.nome] as const),
);

export const normalizeDatajudAlias = (
  alias: string | null | undefined,
): string | null => {
  if (!alias) {
    return null;
  }

  const sanitized = alias
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "_");

  if (!sanitized) {
    return null;
  }

  if (sanitized.startsWith("api_publica_")) {
    return sanitized;
  }

  const withoutPrefix = sanitized.replace(/^api_publica_/, "");
  return `api_publica_${withoutPrefix}`;
};

export const getDatajudTribunalLabel = (alias: string | null | undefined) => {
  const normalizedAlias = normalizeDatajudAlias(alias);
  if (!normalizedAlias) {
    return null;
  }

  const tribunal = DATAJUD_TRIBUNAL_MAP.get(normalizedAlias);
  return tribunal ? tribunal.nome : null;
};

export const getDatajudCategoriaLabel = (
  categoriaId: string | null | undefined,
) => {
  if (!categoriaId) {
    return null;
  }

  const nome = DATAJUD_CATEGORIA_MAP.get(
    categoriaId as DatajudCategoriaId,
  );
  return nome ?? null;
};
