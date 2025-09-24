import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import Hero from "@/pages/site/components/Hero";
import Services from "@/pages/site/components/Services";
import CRMAdvogados from "@/pages/site/components/CRMAdvogados";
import About from "@/pages/site/components/About";
import Blog from "@/pages/site/components/Blog";
import Contact from "@/pages/site/components/Contact";

const Index = () => {
  return (
    <div className="min-h-screen">
      <TypebotBubble />
      <Header />
      <main>
        <Hero />
        <Services />
        <CRMAdvogados />
        <About />
        <Blog />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
