import ParameterPage from "./ParameterPage";

export default function FluxoTrabalho() {
  return (
    <ParameterPage
      title="Fluxo de Trabalho"
      description="Gerencie os fluxos de trabalho"
      placeholder="Novo fluxo de trabalho"
      emptyMessage="Nenhum fluxo de trabalho cadastrado"
      endpoint="/api/fluxos-trabalho"
    />
  );
}
