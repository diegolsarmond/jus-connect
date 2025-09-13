import { useParams } from "react-router-dom";

export default function PipelineMenu() {
  const { fluxoId } = useParams<{ fluxoId: string }>();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-foreground">Pipeline - Menu {fluxoId}</h1>
      <p className="text-muted-foreground">Em desenvolvimento</p>
    </div>
  );
}
