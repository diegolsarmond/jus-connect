import ParameterPage from "@/pages/operator/configuracoes/parametros/ParameterPage";

export default function AdminSettingsCategories() {
  return (
    <ParameterPage
      title="Categorias"
      description="Gerencie as categorias utilizadas para organizar cadastros e fluxos do sistema."
      placeholder="Nome da categoria"
      emptyMessage="Nenhuma categoria cadastrada até o momento."
      endpoint="/api/categorias"
      booleanFields={[{ key: "ativo", label: "Ativo", default: true }]}
    />
  );
}

