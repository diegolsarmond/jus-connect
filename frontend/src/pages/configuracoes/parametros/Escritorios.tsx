import ParameterPage from "./ParameterPage";

export default function Escritorios() {
  return (
    <ParameterPage
      title="Escritórios"
      description="Gerencie os escritórios"
      placeholder="Novo escritório"
      emptyMessage="Nenhum escritório cadastrado"
      endpoint="/api/escritorios"
    />
  );
}

