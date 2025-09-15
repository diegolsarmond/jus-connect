import { useMemo, useState } from "react";
import { RefreshCw, Smartphone, QrCode, ShieldCheck } from "lucide-react";
import { Modal } from "./Modal";
import styles from "./DeviceLinkModal.module.css";

interface DeviceLinkModalProps {
  open: boolean;
  onClose: () => void;
}

const generateCode = () => {
  const segment = () => Math.floor(100 + Math.random() * 899).toString();
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const suffix = letters[Math.floor(Math.random() * letters.length)]!;
  return `${segment()}-${suffix}${segment().slice(0, 1)}`;
};

export const DeviceLinkModal = ({ open, onClose }: DeviceLinkModalProps) => {
  const [code, setCode] = useState(() => generateCode());
  const [refreshing, setRefreshing] = useState(false);

  const steps = useMemo(
    () => [
      {
        title: "Abra o JusConnect Mobile",
        description:
          "No aplicativo, toque em Mais > Dispositivos Conectados e selecione \"Conectar novo dispositivo\".",
        icon: <Smartphone size={18} aria-hidden="true" />,
      },
      {
        title: "Escaneie o código",
        description:
          "Aponte a câmera para este código para autenticar a sessão com criptografia ponta a ponta.",
        icon: <QrCode size={18} aria-hidden="true" />,
      },
      {
        title: "Pronto para conversar",
        description:
          "As conversas serão sincronizadas instantaneamente com o painel web, mantendo notificações e filtros.",
        icon: <ShieldCheck size={18} aria-hidden="true" />,
      },
    ],
    [],
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setCode(generateCode());
      setRefreshing(false);
    }, 420);
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Conectar um novo dispositivo">
      <div className={styles.container}>
        <section className={styles.qrSection} aria-labelledby="qr-title">
          <h2 id="qr-title" className="sr-only">
            Código QR para emparelhar dispositivo
          </h2>
          <div className={styles.qrFrame} aria-hidden="true">
            <div className={styles.qrPattern} />
            <span className={styles.codeChip}>{code}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className={styles.refreshButton}
            aria-label="Atualizar código QR"
            disabled={refreshing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {refreshing ? "Gerando..." : "Atualizar código"}
          </button>
        </section>
        <div className={styles.instructions}>
          <h2>Sincronize o chat com o seu celular</h2>
          <p>
            Conecte um dispositivo móvel para responder clientes pelo painel web mantendo a segurança
            das conversas com autenticação temporária.
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
