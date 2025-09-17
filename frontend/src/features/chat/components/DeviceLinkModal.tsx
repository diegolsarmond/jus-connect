import { useMemo } from "react";
import { Smartphone, QrCode, ShieldCheck } from "lucide-react";
import { Modal } from "./Modal";
import { WhatsAppWebEmbed } from "../../../components/waha";
import styles from "./DeviceLinkModal.module.css";

interface DeviceLinkModalProps {
  open: boolean;
  onClose: () => void;
}

export const DeviceLinkModal = ({ open, onClose }: DeviceLinkModalProps) => {
  const steps = useMemo(
    () => [
      {
        title: "Abra o WhatsApp no celular",
        description:
          "No app, toque em Configurações > Dispositivos Conectados e escolha \"Conectar um dispositivo\".",
        icon: <Smartphone size={18} aria-hidden="true" />,
      },
      {
        title: "Escaneie o QR Code",
        description:
          "Utilize a câmera do aparelho para ler o código exibido no painel do WAHA.",
        icon: <QrCode size={18} aria-hidden="true" />,
      },
      {
        title: "Sincronização automática",
        description:
          "Aguarde alguns instantes até que o WAHA sincronize as conversas com o JusConnect.",
        icon: <ShieldCheck size={18} aria-hidden="true" />,
      },
    ],
    [],
  );

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Conectar um novo dispositivo">
      <div className={styles.container}>
        <section className={styles.integrationPanel} aria-labelledby="waha-integration-title">
          <header className={styles.integrationHeader}>
            <h2 id="waha-integration-title">Conecte o WhatsApp Web</h2>
            <p>
              Use o painel integrado do WAHA para autenticar sua conta do WhatsApp Business. O QR Code
              é atualizado automaticamente para garantir uma conexão segura.
            </p>
          </header>
          <WhatsAppWebEmbed
            className={styles.embedWrapper}
            fallback={
              <div className={styles.fallbackMessage}>
                <h3>Configuração necessária</h3>
                <p>
                  Defina <code>VITE_WAHA_WHATSAPP_WEB_URL</code> ou combine{' '}
                  <code>VITE_WAHA_BASE_URL</code> com <code>VITE_WAHA_WHATSAPP_WEB_PATH</code> para carregar
                  o WhatsApp Web integrado.
                </p>
              </div>
            }
          />
        </section>
        <div className={styles.instructions}>
          <h2>Como conectar</h2>
          <p>
            Após a leitura do QR Code, o WAHA mantém a sessão ativa e sincroniza automaticamente as
            mensagens com o painel de conversas.
          </p>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.stepItem}>
                <span className={styles.stepBadge}>{index + 1}</span>
                <div className={styles.stepContent}>
                  <h3>
                    <span className={styles.stepIcon}>{step.icon}</span>
                    {step.title}
                  </h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  );
};
