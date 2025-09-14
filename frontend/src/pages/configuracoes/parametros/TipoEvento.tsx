import ParameterPage from "./ParameterPage";

export default function TipoEvento() {
  return (
    <ParameterPage
      title="Tipo de Evento"
      description="Gerencie os tipos de evento"
      placeholder="Novo tipo de evento"
      emptyMessage="Nenhum tipo cadastrado"
      endpoint="/api/tipo-eventos"
      booleanFields={[
        { key: "exibe_agenda", label: "Exibe na agenda", default: true },
        { key: "exibe_tarefa", label: "Exibe na tarefa", default: true },
      ]}
    />
  );
}

