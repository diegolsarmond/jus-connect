import ParameterPage from "./ParameterPage";

export default function TipoDocumento() {
  return (
    <ParameterPage
      title="Tipos de Documento"
      description="Gerencie os tipos de documento"
      placeholder="Novo tipo de documento"
      emptyMessage="Nenhum tipo cadastrado"
      endpoint="/api/tipo-documentos"
    />
  );
}

