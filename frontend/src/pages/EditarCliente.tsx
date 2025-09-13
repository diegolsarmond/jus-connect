import { useParams } from "react-router-dom";

export default function EditarCliente() {
  const { id } = useParams();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-foreground mb-2">Editar Cliente</h1>
      <p className="text-muted-foreground">
        Funcionalidade em desenvolvimento para o cliente {id}.
      </p>
    </div>
  );
}
