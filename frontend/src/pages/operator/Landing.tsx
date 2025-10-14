import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Shield, BarChart3, Users, Zap, ArrowRight, Star, Sparkles, TrendingUp, Globe, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import quantumLogo from "@/assets/quantum-logo.png";
import { useEffect, useState } from "react";
import { routes } from "@/config/routes";
import { appConfig } from "@/config/app-config";
import { fetchPlanOptions, formatPlanPriceLabel, type PlanOption } from "@/features/plans/api";

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const appName = appConfig.appName;

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingPlans(true);
    setPlansError(null);

    fetchPlanOptions(controller.signal)
      .then((loadedPlans) => {
        setPlans(loadedPlans);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Falha ao carregar planos para a landing page", error);
        setPlansError("Não foi possível carregar os planos no momento.");
      })
      .finally(() => {
        setIsLoadingPlans(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 overflow-x-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={quantumLogo} alt={appName} className="h-10 w-10" />
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">{appName}</h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-primary transition-colors story-link">Recursos</a>
            <a href="#pricing" className="text-muted-foreground hover:text-primary transition-colors story-link">Planos</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-primary transition-colors story-link">Depoimentos</a>
            <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors story-link">Contato</a>
            <Button variant="outline" asChild className="hover-scale">
              <Link to={routes.login}>Login</Link>
            </Button>
            <Button asChild className="bg-gradient-primary hover:opacity-90 hover-scale">
              <Link to={routes.register}>Cadastre-se</Link>
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-sm border-t animate-fade-in">
            <nav className="flex flex-col gap-4 p-4">
              <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">Recursos</a>
              <a href="#pricing" className="text-muted-foreground hover:text-primary transition-colors">Planos</a>
              <a href="#testimonials" className="text-muted-foreground hover:text-primary transition-colors">Depoimentos</a>
              <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors">Contato</a>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={routes.login}>Login</Link>
                </Button>
                <Button size="sm" asChild className="bg-gradient-primary">
                  <Link to={routes.register}>Cadastre-se</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto text-center relative z-10">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 animate-fade-in hover-scale">
            <Sparkles className="w-4 h-4 mr-2" />
            🚀 Sistema CRM para Advocacia
          </Badge>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in">
            <span className="bg-gradient-to-r from-primary via-primary-light to-accent bg-clip-text text-transparent">
              Revolucione sua
            </span>
            <br />
            <span className="bg-gradient-to-r from-accent via-primary to-primary-dark bg-clip-text text-transparent">
              Gestão Jurídica
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto animate-fade-in">
            O {appName} é a solução completa para escritórios de advocacia que buscam
            <span className="text-primary font-semibold"> eficiência</span>,
            <span className="text-primary font-semibold"> organização</span> e
            <span className="text-primary font-semibold"> crescimento sustentável</span>.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in">
            <Button size="lg" className="text-lg px-8 py-6 bg-gradient-primary hover:opacity-90 hover-scale shadow-glow" asChild>
              <Link to={routes.register}>
                Começar Teste Gratuito
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 hover-scale border-primary/30 hover:border-primary">
              Ver Demonstração
              <TrendingUp className="ml-2 h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-sm text-muted-foreground animate-fade-in">
            <div className="flex items-center gap-2 hover-scale">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="font-medium">14 dias grátis</span>
            </div>
            <div className="flex items-center gap-2 hover-scale">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="font-medium">Sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-2 hover-scale">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="font-medium">Suporte incluído</span>
            </div>
            <div className="flex items-center gap-2 hover-scale">
              <Globe className="h-5 w-5 text-primary" />
              <span className="font-medium">LGPD Compliant</span>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid md:grid-cols-3 gap-8 mt-16 max-w-4xl mx-auto">
            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-glow transition-all duration-500 hover-scale">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-2">500+</div>
                <div className="text-muted-foreground">Escritórios Atendidos</div>
              </CardContent>
            </Card>
            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-glow transition-all duration-500 hover-scale">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-2">40%</div>
                <div className="text-muted-foreground">Aumento de Produtividade</div>
              </CardContent>
            </Card>
            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-glow transition-all duration-500 hover-scale">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
                <div className="text-muted-foreground">Uptime Garantido</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Funcionalidades pensadas especificamente para atender as necessidades dos profissionais do direito.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Gestão de Clientes</CardTitle>
                <CardDescription>
                  Centralize todas as informações dos seus clientes em um só lugar
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Controle de Processos</CardTitle>
                <CardDescription>
                  Acompanhe o andamento de todos os processos em tempo real
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Relatórios Avançados</CardTitle>
                <CardDescription>
                  Analytics detalhados para tomada de decisões estratégicas
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Automação Inteligente</CardTitle>
                <CardDescription>
                  Automatize tarefas repetitivas e ganhe mais tempo
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Segurança Total</CardTitle>
                <CardDescription>
                  Conformidade com LGPD e máxima segurança dos dados
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 bg-background/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Multi-usuário</CardTitle>
                <CardDescription>
                  Trabalhe em equipe com controle de permissões granular
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Planos que crescem com você
            </h2>
            <p className="text-xl text-muted-foreground">
              Escolha o plano ideal para o seu escritório
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {isLoadingPlans ? (
              <Card className="border-2 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-center">Carregando planos…</CardTitle>
                  <CardDescription className="text-center">Estamos buscando as opções disponíveis para você.</CardDescription>
                </CardHeader>
              </Card>
            ) : plansError ? (
              <Card className="border-2 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-center">Planos indisponíveis</CardTitle>
                  <CardDescription className="text-center">{plansError}</CardDescription>
                </CardHeader>
              </Card>
            ) : plans.length === 0 ? (
              <Card className="border-2 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-center">Nenhum plano disponível</CardTitle>
                  <CardDescription className="text-center">
                    Entre em contato com a nossa equipe para conhecer as opções.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              plans.map((plan, index) => {
                const descriptionItems = plan.description
                  ? plan.description.split(/\r?\n|•/).map((item) => item.trim()).filter(Boolean)
                  : [];
                const isFeatured = index === 1;

                return (
                  <Card
                    key={plan.id}
                    className={`border-2 hover:shadow-xl transition-all duration-300 ${
                      isFeatured ? "border-primary relative" : ""
                    }`}
                  >
                    {isFeatured && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">Mais Popular</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-center">{plan.name}</CardTitle>
                      <div className="text-center">
                        <span className="text-3xl font-bold">{formatPlanPriceLabel(plan)}</span>
                      </div>
                      <CardDescription className="text-center whitespace-pre-line">
                        {plan.description ?? "Conheça os recursos deste plano em detalhes."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {descriptionItems.length > 0 ? (
                        descriptionItems.map((item) => (
                          <div key={item} className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-primary" />
                            <span>{item}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <span>Plano sob medida para o seu escritório.</span>
                        </div>
                      )}
                      <Button className="w-full mt-6 bg-gradient-primary hover:opacity-90" asChild>
                        <Link to={routes.register}>Começar Teste</Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 bg-background/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  {`"O ${appName} revolucionou nossa gestão. Aumentamos nossa produtividade em 40%."`}
                </p>
                <div>
                  <p className="font-semibold">Dr. Ana Silva</p>
                  <p className="text-sm text-muted-foreground">Silva & Associados</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-background/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "Interface intuitiva e recursos poderosos. Recomendo para qualquer escritório."
                </p>
                <div>
                  <p className="font-semibold">Dr. Carlos Santos</p>
                  <p className="text-sm text-muted-foreground">Santos Advocacia</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-background/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "Suporte excepcional e funcionalidades que realmente fazem a diferença."
                </p>
                <div>
                  <p className="font-semibold">Dra. Maria Costa</p>
                  <p className="text-sm text-muted-foreground">Costa & Parceiros</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para transformar seu escritório?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de advogados que já confiam no {appName} para gerir seus escritórios.
          </p>
          <Button size="lg" className="text-lg px-8 py-6 bg-gradient-primary hover:opacity-90 hover-scale shadow-glow" asChild>
            <Link to={routes.register}>
              Começar Teste Gratuito de 14 Dias
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/50 py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={quantumLogo} alt={appName} className="h-8 w-8" />
                <h3 className="text-lg font-bold">{appName}</h3>
              </div>
              <p className="text-muted-foreground">
                A solução completa para gestão jurídica moderna.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Recursos</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Segurança</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Carreiras</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 {appName}. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;