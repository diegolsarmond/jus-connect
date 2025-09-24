import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import SimpleBackground from "@/components/ui/SimpleBackground";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TypebotBubble />
      <Header />
      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background pb-20 pt-32">
          <SimpleBackground className="opacity-50" />
          <div className="container relative z-10 space-y-6 px-4 md:space-y-8">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                Política de Privacidade
              </span>
              <h1 className="text-4xl font-semibold md:text-5xl">Como tratamos dados no Jus Connect</h1>
              <p className="text-base text-muted-foreground">
                Este documento descreve as práticas adotadas pelo Jus Connect, plataforma desenvolvida pela Quantum Tecnologia,
                para coletar, armazenar, utilizar e proteger informações pessoais em conformidade com a Lei Geral de Proteção de
                Dados (LGPD).
              </p>
            </div>
          </div>
        </section>

        <section className="container space-y-12 px-4 py-16 text-sm leading-relaxed text-muted-foreground md:text-base">
          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">1. Informações que coletamos</h2>
            <p>
              Coletamos dados fornecidos diretamente por você ao preencher formulários, contratar serviços ou interagir com nossos
              canais digitais. Também registramos informações geradas pelo uso da plataforma, como logs de acesso, mensagens e
              documentos armazenados. Esses dados são utilizados exclusivamente para prestar e aprimorar nossos serviços.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">2. Uso e compartilhamento de dados</h2>
            <p>
              Utilizamos os dados coletados para personalizar a experiência de uso, oferecer suporte, comunicar novidades relevantes
              e garantir a segurança da plataforma. Compartilhamos informações com parceiros e fornecedores apenas quando
              necessário para execução contratual, sempre sob cláusulas de confidencialidade e proteção de dados.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">3. Segurança e armazenamento</h2>
            <p>
              Implementamos controles técnicos e administrativos para proteger os dados contra acessos não autorizados, perdas ou
              alterações indevidas. Os registros são armazenados em ambientes seguros, com criptografia e monitoramento contínuo,
              respeitando os prazos legais e contratuais aplicáveis.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">4. Direitos dos titulares</h2>
            <p>
              Você pode solicitar a qualquer momento a confirmação do tratamento, acesso, correção, anonimização, portabilidade ou
              exclusão dos seus dados pessoais. Para exercer esses direitos, envie uma solicitação para privacidade@jusconnect.com.br.
            </p>
          </article>

          <article className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">5. Atualizações desta política</h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças legais ou melhorias em nossos
              processos internos. Sempre que houver ajustes relevantes, comunicaremos os usuários pelos canais cadastrados e
              indicaremos a data da última revisão no documento.
            </p>
          </article>

          <p className="text-xs text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
