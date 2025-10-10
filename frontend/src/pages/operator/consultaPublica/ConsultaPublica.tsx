import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, FileText, Gavel, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

type SearchType = "numero" | "cpf" | "oab";

const formatProcessNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 20);
  const part1 = digits.slice(0, 7);
  const part2 = digits.slice(7, 9);
  const part3 = digits.slice(9, 13);
  const part4 = digits.slice(13, 14);
  const part5 = digits.slice(14, 16);
  const part6 = digits.slice(16, 20);

  let result = part1;
  if (part2) result += `-${part2}`;
  if (part3) result += `.${part3}`;
  if (part4) result += `.${part4}`;
  if (part5) result += `.${part5}`;
  if (part6) result += `.${part6}`;

  return result;
};

const formatCpfCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  if (digits.length <= 11) {
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6, 9);
    const part4 = digits.slice(9, 11);

    let result = part1;
    if (part2) result += `.${part2}`;
    if (part3) result += `.${part3}`;
    if (part4) result += `-${part4}`;

    return result;
  }

  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);

  let result = part1;
  if (part2) result += `.${part2}`;
  if (part3) result += `.${part3}`;
  if (part4) result += `/${part4}`;
  if (part5) result += `-${part5}`;

  return result;
};

const formatOab = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  const letters = value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  const hasSlash = value.includes("/");

  if (!digits) {
    return letters ? `${hasSlash ? "/" : ""}${letters}` : "";
  }

  let result = digits;

  if (hasSlash || letters) {
    result += "/";
  }

  if (letters) {
    result += letters;
  }

  return result;
};

const maskSearchValue = (type: SearchType, value: string) => {
  if (type === "numero") {
    return formatProcessNumber(value);
  }

  if (type === "cpf") {
    return formatCpfCnpj(value);
  }

  return formatOab(value);
};

const sanitizeSearchValue = (type: SearchType, value: string) => {
  if (type === "numero") {
    return value.replace(/\D/g, "").slice(0, 20);
  }

  if (type === "cpf") {
    return value.replace(/\D/g, "").slice(0, 14);
  }

  const digits = value.replace(/\D/g, "").slice(0, 6);
  const letters = value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  if (!digits) {
    return "";
  }
  return letters ? `${digits}/${letters}` : digits;
};

const getPlaceholder = (type: SearchType) => {
  if (type === "numero") {
    return "0000000-00.0000.0.00.0000";
  }

  if (type === "cpf") {
    return "000.000.000-00 ou 00.000.000/0000-00";
  }

  return "000000/UF";
};

const ConsultaPublica = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchType, setSearchType] = useState<SearchType>("numero");
  const [searchValue, setSearchValue] = useState("");

  const handleTypeChange = (value: SearchType) => {
    setSearchType(value);
    setSearchValue("");
  };

  const handleSearch = () => {
    const sanitizedValue = sanitizeSearchValue(searchType, searchValue);

    if (!sanitizedValue) {
      toast({
        title: "Informe um valor para busca",
        description: "Digite o número do processo, o CPF/CNPJ da parte ou a OAB do advogado antes de continuar.",
      });
      return;
    }

    const params = new URLSearchParams();
    params.set("type", searchType);
    params.set("value", sanitizedValue);

    navigate({ pathname: "/consulta-publica/processos", search: params.toString() });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Consulta Pública</h1>
        <p className="text-muted-foreground">
          Consulte rapidamente processos disponíveis no CNJ.
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
              Escolha se deseja pesquisar por número do processo, número da OAB ou CPF/CNPJ da parte envolvida.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="consulta-publica-tipo">
                Tipo de pesquisa
              </label>
              <Select value={searchType} onValueChange={(value) => handleTypeChange(value as SearchType)}>
                <SelectTrigger id="consulta-publica-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numero">Número do processo</SelectItem>
                  <SelectItem value="cpf">CPF/CNPJ da parte</SelectItem>
                  <SelectItem value="oab">OAB do advogado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="consulta-publica-valor">
                {searchType === "numero"
                  ? "Número do processo"
                  : searchType === "cpf"
                    ? "CPF/CNPJ da parte"
                    : "OAB do advogado"}
              </label>
              <Input
                id="consulta-publica-valor"
                placeholder={getPlaceholder(searchType)}
                value={searchValue}
                onChange={(event) => setSearchValue(maskSearchValue(searchType, event.target.value))}
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
