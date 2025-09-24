import ParameterPage from "./ParameterPage";

export default function SituacaoProposta() {
  return (
    <ParameterPage
      title="Situação da Proposta"
      description="Gerencie as situações da proposta"
      placeholder="Nova situação da proposta"
      emptyMessage="Nenhuma situação de proposta cadastrada"
      endpoint="/api/situacao-propostas"
    />
  );
}
