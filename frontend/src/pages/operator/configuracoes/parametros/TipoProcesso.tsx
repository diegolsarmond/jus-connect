import ParameterPage from "./ParameterPage";

export default function TipoProcesso() {
  return (
    <ParameterPage
      title="Tipo de Processo"
      description="Gerencie os tipos de processo"
      placeholder="Novo tipo de processo"
      emptyMessage="Nenhum tipo cadastrado"
      endpoint="/api/tipo-processos"
      selectField={{ key: "area_atuacao_id", label: "Área", optionsEndpoint: "/api/areas" }}
    />
  );
}

