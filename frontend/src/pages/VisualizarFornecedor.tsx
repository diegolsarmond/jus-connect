import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getApiBaseUrl } from "@/lib/api";

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

type SupplierDetails = {
  id: number;
  nome: string;
  tipo: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  datacadastro: string;
};

const formatDocument = (value: string | null, type: string | null) => {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "-";
  if (type === "2" || type?.toUpperCase() === "PJ" || type?.toUpperCase() === "J") {
    return digits
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const formatPhone = (value: string | null) => {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

const resolveTypeLabel = (type: string | null) => {
  if (!type) return "Pessoa Física";
  const normalized = type.toUpperCase();
  return normalized === "2" || normalized === "PJ" || normalized === "J"
    ? "Pessoa Jurídica"
    : "Pessoa Física";
};

const buildAddress = (supplier: SupplierDetails) => {
  const streetParts = [supplier.rua, supplier.numero].filter(Boolean).join(", ");
  const cityParts = [supplier.bairro, supplier.cidade, supplier.uf].filter(Boolean).join(", ");
  const address = [streetParts, cityParts].filter(Boolean).join(" - ");
  return address || "-";
};

export default function VisualizarFornecedor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<SupplierDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const url = joinUrl(apiUrl, `/api/fornecedores/${id}`);
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          throw new Error("Failed to fetch supplier");
        }
        const json: SupplierDetails = await response.json();
        setSupplier(json);
      } catch (error) {
        console.error("Erro ao carregar fornecedor:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSupplier();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Fornecedor não encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={() => navigate("/fornecedores")}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typeLabel = resolveTypeLabel(supplier.tipo);
  const statusLabel = supplier.ativo ? "Ativo" : "Inativo";
  const statusBadgeClass = supplier.ativo
    ? "bg-success text-success-foreground"
    : "bg-muted text-muted-foreground";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">{supplier.nome}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{typeLabel}</Badge>
            <Badge className={statusBadgeClass}>{statusLabel}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/fornecedores")}>Voltar</Button>
          <Button onClick={() => navigate(`/fornecedores/${supplier.id}/editar`)}>Editar fornecedor</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Documento</p>
            <p>{formatDocument(supplier.documento, supplier.tipo)}</p>
          </div>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{supplier.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Telefone</p>
              <p>{formatPhone(supplier.telefone)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Endereço</p>
              <p>{buildAddress(supplier)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">CEP</p>
              <p>{supplier.cep ? supplier.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Complemento</p>
              <p>{supplier.complemento || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Criado em</p>
              <p>{new Date(supplier.datacadastro).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
