import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, FileText, Gavel, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const ConsultaPublica = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchType, setSearchType] = useState<"numero" | "cpf">("numero");
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = () => {
    const trimmedValue = searchValue.trim();

    if (!trimmedValue) {
      toast({
        title: "Informe um valor para busca",
        description: "Digite o número do processo ou o CPF/CNPJ da parte antes de continuar.",
      });
      return;
    }

    const params = new URLSearchParams();
    params.set("type", searchType);
    params.set("value", trimmedValue);

    navigate({ pathname: "/consulta-publica/processos", search: params.toString() });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Consulta Pública</h1>
        <p className="text-muted-foreground">
          Consulte rapidamente processos disponíveis no Portal de Serviços do PJe.
        </p>
      </div>

      <Alert className="bg-info/10 border-info/20">
        <AlertCircle className="h-4 w-4 text-info" />
        <AlertDescription className="text-sm text-info-foreground/90">
          Esta consulta possui caráter informativo e pode não apresentar processos sigilosos. Estamos ampliando a cobertura
          dos tribunais integrados para oferecer resultados cada vez mais completos.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Informe os dados para consulta</h2>
            <p className="text-sm text-muted-foreground">
              Escolha se deseja pesquisar por número do processo ou CPF/CNPJ da parte envolvida.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="consulta-publica-tipo">
                Tipo de pesquisa
              </label>
              <Select value={searchType} onValueChange={(value) => setSearchType(value as "numero" | "cpf")}>
                <SelectTrigger id="consulta-publica-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numero">Número do processo</SelectItem>
                  <SelectItem value="cpf">CPF/CNPJ da parte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="consulta-publica-valor">
                {searchType === "numero" ? "Número do processo" : "CPF/CNPJ da parte"}
              </label>
              <Input
                id="consulta-publica-valor"
                placeholder={searchType === "numero" ? "0000000-00.0000.0.00.0000" : "000.000.000-00"}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSearchValue("")} className="sm:w-auto">
              Limpar campos
            </Button>
            <Button onClick={handleSearch} className="sm:w-auto">
              <Search className="mr-2 h-4 w-4" />
              Buscar processos
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Consulte processos</p>
              <p className="text-2xl font-semibold text-foreground">Busca unificada</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Partes envolvidas</p>
              <p className="text-2xl font-semibold text-foreground">Visão completa</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <Gavel className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Movimentações</p>
              <p className="text-2xl font-semibold text-foreground">Atualizações oficiais</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsultaPublica;
