import { useCallback, useEffect, useMemo } from "react";
import clsx from "clsx";
import { Smartphone, QrCode, ShieldCheck, RefreshCw, LogOut } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Modal } from "./Modal";
import { WhatsAppWebEmbed } from "../../../components/waha";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  deriveSessionName,
  ensureDeviceSession,
  fetchPreferredCompany,
  fetchSessionQrCode,
  logoutDeviceSession,
  type DeviceSessionInfo,
} from "../services/deviceLinkingApi";
import styles from "./DeviceLinkModal.module.css";

type SessionStatusTone = "connected" | "pending" | "error" | "unknown";

const STATUS_INFO: Record<string, { label: string; description: string; tone: SessionStatusTone }> = {
  WORKING: {
    label: "Conectado",
    description: "O dispositivo está conectado e sincronizando as conversas normalmente.",
    tone: "connected",
  },
  STARTING: {
    label: "Inicializando",
    description: "A sessão está em processo de inicialização. Isso pode levar alguns instantes.",
    tone: "pending",
  },
  SCAN_QR_CODE: {
    label: "Aguardando leitura do QR Code",
    description:
      "Abra o WhatsApp no celular desejado, toque em \"Dispositivos conectados\" e escaneie o QR Code exibido ao lado.",
    tone: "pending",
  },
  FAILED: {
    label: "Falha na conexão",
    description:
      "Não foi possível manter a sessão conectada. Gere um novo QR Code e autentique novamente para restabelecer a comunicação.",
    tone: "error",
  },
  STOPPED: {
    label: "Sessão desconectada",
    description: "A sessão foi encerrada. Gere um novo QR Code e escaneie-o para retomar o atendimento pelo WhatsApp.",
    tone: "error",
  },
  UNKNOWN: {
    label: "Status desconhecido",
    description: "Não foi possível identificar o status atual da sessão. Tente atualizar o status ou gerar um novo QR Code.",
    tone: "unknown",
  },
};

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

interface DeviceLinkContentProps {
  isActive: boolean;
  layout?: "modal" | "inline";
  className?: string;
  onClose?: () => void;
}

export const DeviceLinkContent = ({
  isActive,
  layout = "modal",
  className,
  onClose,
}: DeviceLinkContentProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
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
        description: "Utilize a câmera do aparelho para ler o código exibido no painel do sistema.",
        icon: <QrCode size={18} aria-hidden="true" />,
      },
      {
        title: "Sincronização automática",
        description: "Aguarde alguns instantes até que o WhatsApp sincronize as conversas com o QuantumJus.",
        icon: <ShieldCheck size={18} aria-hidden="true" />,
      },
      {
        title: "Reconecte quando necessário",
        description:
          "Use o botão \"Desconectar dispositivo\" para gerar rapidamente um novo QR Code e autenticar novamente.",
        icon: <RefreshCw size={18} aria-hidden="true" />,
      },
    ],
    [],
  );

  const companyNameFromAuth = useMemo(() => {
    const value = user?.empresa_nome;
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [user?.empresa_nome]);

  const companyQuery = useQuery({
    queryKey: ["companies", "primary"],
    queryFn: fetchPreferredCompany,
    enabled: isActive && !companyNameFromAuth,
  });

  const companyName = companyNameFromAuth ?? companyQuery.data?.name ?? null;
  const sessionName = useMemo(() => deriveSessionName(companyName), [companyName]);

  const sessionQuery = useQuery<DeviceSessionInfo>({
    queryKey: ["waha", "session", sessionName],
    queryFn: () => ensureDeviceSession(sessionName, companyName),
    enabled: isActive && !companyQuery.isLoading,
    retry: false,
  });

  const {
    data: qrCode,
    isFetching: isFetchingQr,
    isError: isQrError,
    error: qrError,
    refetch: refetchQr,
    remove: removeQr,
    dataUpdatedAt: qrUpdatedAt,
  } = useQuery({
    queryKey: ["waha", "session", sessionName, "qr"],
    queryFn: () => fetchSessionQrCode(sessionName),
    enabled: false,
    staleTime: 0,
    gcTime: 0,
  });

  const clearQr = useCallback(() => {
    if (typeof removeQr === "function") {
      removeQr();
    }
  }, [removeQr]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (!sessionName) {
        throw new Error("Sessão não configurada.");
      }
      await logoutDeviceSession(sessionName);
    },
    onSuccess: async () => {
      toast({
        title: "Dispositivo desconectado",
        description: "Geramos um novo QR Code para que você possa autenticar o WhatsApp novamente.",
      });
      await sessionQuery.refetch();
      await refetchQr();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível desconectar o dispositivo.";
      toast({
        title: "Falha ao desconectar",
        description: message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isActive) {
      clearQr();
      return;
    }

    if (sessionQuery.data?.status === "SCAN_QR_CODE") {
      void refetchQr();
    } else if (qrCode) {
      clearQr();
    }
  }, [isActive, sessionQuery.data?.status, refetchQr, clearQr, qrCode]);

  useEffect(() => {
    return () => {
      clearQr();
    };
  }, [clearQr]);

  const handleRefreshStatus = async () => {
    const result = await sessionQuery.refetch();
    if (result.data?.status === "SCAN_QR_CODE") {
      await refetchQr();
    } else {
      clearQr();
    }
  };

  const handleLogout = () => {
    if (!sessionName || logoutMutation.isPending) {
      return;
    }
    logoutMutation.mutate();
  };

  const normalizedStatus = (sessionQuery.data?.status ?? "UNKNOWN").toUpperCase();
  const statusInfo = STATUS_INFO[normalizedStatus] ?? STATUS_INFO.UNKNOWN;
  const statusBadgeClass = clsx(styles.statusBadge, {
    [styles.statusBadgeConnected]: statusInfo.tone === "connected",
    [styles.statusBadgePending]: statusInfo.tone === "pending",
    [styles.statusBadgeError]: statusInfo.tone === "error",
  });

  const sessionUpdatedAt = sessionQuery.dataUpdatedAt
    ? timeFormatter.format(new Date(sessionQuery.dataUpdatedAt))
    : null;
  const qrUpdatedAtLabel = qrUpdatedAt ? timeFormatter.format(new Date(qrUpdatedAt)) : null;

  const qrPlaceholderMessage = sessionQuery.isLoading
    ? "Carregando status da sessão..."
    : sessionQuery.data?.status === "WORKING"
      ? "A sessão está conectada. Gere um novo QR Code apenas se precisar autenticar outro dispositivo."
      : "O QR Code será exibido aqui quando a sessão estiver aguardando uma nova autenticação.";

  const containerClassName = clsx(
    styles.container,
    layout === "inline" && styles.inlineContainer,
    layout === "modal" && styles.modalBody,
    className,
  );

  const content = (
    <div className={containerClassName}>
      <div className={styles.instructions}>
        <h2>Como conectar</h2>
        <p>
          Após a leitura do QR Code, o WhatsApp mantém a sessão ativa e sincroniza automaticamente as
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
      <section className={styles.integrationPanel} aria-labelledby="waha-integration-title">
        <header className={styles.integrationHeader}>
          <h2 id="waha-integration-title">Conecte o WhatsApp Web</h2>
        </header>
        <div className={styles.statusCard}>
          <div className={styles.statusHeader}>
            <div>
              <p className={styles.sessionLabel}>
                Sessão vinculada: <span className={styles.sessionName}>{sessionName}</span>
              </p>
              <span className={statusBadgeClass}>{statusInfo.label}</span>
            </div>
            <div className={styles.sessionActions}>
              <Button
                size="sm"
                onClick={handleLogout}
                disabled={
                  sessionQuery.isLoading ||
                  sessionQuery.isFetching ||
                  logoutMutation.isPending ||
                  !sessionName
                }
              >
                {logoutMutation.isPending ? (
                  <span className={styles.buttonSpinner} aria-hidden="true" />
                ) : (
                  <LogOut size={16} aria-hidden="true" />
                )}
                Desconectar dispositivo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshStatus}
                disabled={sessionQuery.isLoading || sessionQuery.isFetching}
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                  className={sessionQuery.isFetching ? styles.refreshIconSpinning : undefined}
                />
                Atualizar status
              </Button>
            </div>
          </div>

          {!companyNameFromAuth && companyQuery.isError && (
            <p className={styles.sessionWarning}>
              Não foi possível carregar as informações da empresa. Utilizando a sessão padrão
              <strong> {sessionName}</strong>.

            </p>
          )}

          {sessionQuery.isLoading ? (
            <div className={styles.sessionFeedback}>
              <span className={styles.statusSpinner} aria-hidden="true" />
              Carregando status da sessão...
            </div>
          ) : sessionQuery.isError ? (
            <div className={styles.sessionError} role="alert">
              Não foi possível carregar o status da sessão. Tente atualizar novamente ou entre em contato com o suporte.
            </div>
          ) : (
            <p className={styles.statusDescription}>{statusInfo.description}</p>
          )}

          <div className={styles.sessionMetaRow}>
            <span>
              Empresa:{" "}
              <span className={styles.sessionMetaHighlight}>{companyName ?? "Não informada"}</span>
            </span>
            {sessionUpdatedAt && (
              <span>
                Atualizado às <span className={styles.sessionMetaHighlight}>{sessionUpdatedAt}</span>
              </span>
            )}
          </div>
        </div>

        <div className={styles.qrSection}>
          <div className={styles.qrHeader}>
            <h3>QR Code de autenticação</h3>
            <div className={styles.qrActions}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetchQr()}
                disabled={isFetchingQr || sessionQuery.isLoading || sessionQuery.isFetching}
              >
                <QrCode size={16} aria-hidden="true" />
                Atualizar QR Code
              </Button>
            </div>
          </div>
          <div className={styles.qrContent}>
            {isFetchingQr ? (
              <div className={styles.sessionFeedback}>
                <span className={styles.statusSpinner} aria-hidden="true" />
                Gerando QR Code...
              </div>
            ) : qrCode ? (
              <img
                src={qrCode}
                alt="QR Code do WhatsApp"
                className={styles.qrImage}
                loading="lazy"
              />
            ) : isQrError ? (
              <div className={styles.sessionError} role="alert">
                {qrError instanceof Error
                  ? qrError.message
                  : "Não foi possível carregar o QR Code. Tente novamente."}
              </div>
            ) : (
              <p className={styles.qrPlaceholder}>{qrPlaceholderMessage}</p>
            )}
          </div>
          {qrUpdatedAtLabel && (
            <p className={styles.sessionMetaRow}>
              Última geração às
              <span className={styles.sessionMetaHighlight}> {qrUpdatedAtLabel}</span>
            </p>
          )}
        </div>

      </section>
    </div>
  );

  if (layout === "modal" && typeof onClose === "function") {
    return (
      <div className={styles.modalWrapper}>
        <div className={styles.modalHeader}>
          <button type="button" className={styles.modalCloseButton} onClick={onClose}>
            Fechar
          </button>
        </div>
        {content}
      </div>
    );
  }

  return content;
};

interface DeviceLinkModalProps {
  open: boolean;
  onClose: () => void;
}

export const DeviceLinkModal = ({ open, onClose }: DeviceLinkModalProps) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Conectar um novo dispositivo"
      contentClassName={styles.modalContent}
    >
      <DeviceLinkContent isActive={open} layout="modal" onClose={onClose} />
    </Modal>
  );
};
