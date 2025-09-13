import ParameterPage from "./ParameterPage";

export default function Etiquetas() {
  return (
    <ParameterPage
      title="Etiquetas"
      description="Gerencie as etiquetas"
      placeholder="Nova etiqueta"
      emptyMessage="Nenhuma etiqueta cadastrada"
      endpoint="/api/etiquetas"
    />
  );
}
