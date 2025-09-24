import Header from "../components/Header";
import Hero from "../components/Hero";
import Services from "../components/Services";
import CRMAdvogados from "../components/CRMAdvogados";
import About from "../components/About";
import Blog from "../components/Blog";
import Contact from "../components/Contact";
import Footer from "../components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
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
