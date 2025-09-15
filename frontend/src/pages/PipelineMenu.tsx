import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
}

export default function PipelineMenu() {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/fluxos-trabalho/menus`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        type MenuApiItem = { id: number | string; nome?: string };
        const parsed: MenuApiItem[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data?.rows)
          ? data.data.rows
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setMenus(parsed.map((i) => ({ id: String(i.id), name: i.nome ?? "" })));
      } catch (e) {
        console.error(e);
      }
    };
    fetchMenus();
  }, [apiUrl]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pipelines</h1>
          <p className="text-muted-foreground">Selecione um pipeline para visualizar</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary-hover"
          onClick={() => navigate("/configuracoes/parametros/fluxo-de-trabalho")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Pipeline
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {menus.map((menu) => (
          <Card
            key={menu.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/pipeline/${menu.id}`)}
          >
            <CardHeader>
              <CardTitle>{menu.name}</CardTitle>
            </CardHeader>
          </Card>
        ))}
        {menus.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhum pipeline encontrado
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

