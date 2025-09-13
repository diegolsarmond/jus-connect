import ParameterPage from "./ParameterPage";

export default function SituacaoProcesso() {
  return (
    <ParameterPage
      title="Situação do Processo"
      description="Gerencie as situações de processo"
      placeholder="Nova situação de processo"
      emptyMessage="Nenhuma situação cadastrada"
      endpoint="/api/situacoes-processo"

    />
  );
}

