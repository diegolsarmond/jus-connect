import ParameterPage from "./ParameterPage";

export default function SituacaoCliente() {
  return (
    <ParameterPage
      title="Situação do Cliente"
      description="Gerencie as situações do cliente"
      placeholder="Nova situação do cliente"
      emptyMessage="Nenhuma situação cadastrada"
      endpoint="/api/situacao-clientes"
    />
  );
}

