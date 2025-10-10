import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Search, LogOut, Menu, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState("numero");
  const [searchValue, setSearchValue] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("pdpj_access_token");
    if (!token) {
      navigate("/");
      return;
    }
    const name = localStorage.getItem("pdpj_user_name") || "Usuário";
    setUserName(name);
  }, [navigate]);

  const handleSearch = () => {
    if (searchValue.trim()) {
      navigate(`/processos?type=${searchType}&value=${searchValue}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pdpj_access_token");
    localStorage.removeItem("pdpj_refresh_token");
    localStorage.removeItem("pdpj_user_name");
    localStorage.removeItem("pdpj_user_email");
    localStorage.removeItem("pdpj_user_cpf");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-accent">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">JusConsult</h1>
                <p className="text-xs text-muted-foreground">Consulta em um só lugar</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">{userName}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Page Title */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Consultar Processos</h2>
            <p className="text-muted-foreground">
              Página Inicial / Consultar Processos
            </p>
          </div>

          {/* Info Alert */}
          <Alert className="bg-info/10 border-info/20">
            <AlertCircle className="h-4 w-4 text-info" />
            <AlertDescription className="text-sm text-info-foreground/90">
              Esta consulta processual é exclusivamente informativa e não possui validade de certidão. 
              Processos sigilosos podem não ser exibidos, dependendo do nível de sigilo aplicado. 
              Devido à recente integração dos tribunais, ainda estamos em fase de desenvolvimento 
              de funcionalidades para consultas mais robustas e segmentadas.
            </AlertDescription>
          </Alert>

          {/* Search Card */}
          <Card className="shadow-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Selecione uma das opções a seguir para consultar processos.
              </h3>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Pesquisar por *
                  </label>
                  <Select value={searchType} onValueChange={setSearchType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numero">Número do Processo</SelectItem>
                      <SelectItem value="cpf">CPF da Parte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    {searchType === "numero" ? "Número do Processo" : "CPF da Parte"}
                  </label>
                  <Input
                    placeholder={
                      searchType === "numero" 
                        ? "0000000-00.0000.0.00.0000" 
                        : "000.000.000-00"
                    }
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setSearchValue("")} variant="outline">
                  Limpar Busca
                </Button>
                <Button onClick={handleSearch} className="shadow-primary">
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-gradient-primary text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Processos Encontrados</p>
                    <p className="text-3xl font-bold mt-1">5</p>
                  </div>
                  <FileText className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-success text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Processos Ativos</p>
                    <p className="text-3xl font-bold mt-1">3</p>
                  </div>
                  <FileText className="w-10 h-10 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Processos Arquivados</p>
                    <p className="text-3xl font-bold mt-1 text-foreground">2</p>
                  </div>
                  <FileText className="w-10 h-10 text-muted-foreground opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
