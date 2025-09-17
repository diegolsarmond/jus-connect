import { useMemo, type ReactNode } from "react";
import clsx from "clsx";
import styles from "./WhatsAppWebEmbed.module.css";

const sanitize = (value?: string | null) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toAbsoluteUrl = (value: string) => {
  try {
    return new URL(value, window.location.origin).toString();
  } catch (error) {
    console.error("Não foi possível normalizar a URL do WhatsApp Web", error);
    return value;
  }
};

const resolvePathWithInstance = (path: string, instanceId: string) => {
  const encoded = encodeURIComponent(instanceId);
  if (path.includes(":instanceId") || path.includes("{instanceId}")) {
    return path.replace(/:instanceId/g, encoded).replace(/{instanceId}/g, encoded);
  }
  if (path.length === 0 || path === ".") {
    return encoded;
  }
  return `${path.replace(/\/+$/, "")}/${encoded}`;
};

export interface WhatsAppWebEmbedProps {
  className?: string;
  iframeClassName?: string;
  title?: string;
  /**
   * Permite sobrescrever a URL final do iframe manualmente.
   * Caso não seja informada, será utilizada a configuração do ambiente.
   */
  src?: string;
  /**
   * Caso definido, substitui o identificador de instância informado via variável de ambiente.
   */
  instanceId?: string;
  fallback?: ReactNode;
}

export const WhatsAppWebEmbed = ({
  className,
  iframeClassName,
  title = "WhatsApp Web",
  src,
  instanceId,
  fallback,
}: WhatsAppWebEmbedProps) => {
  const resolvedSrc = useMemo(() => {
    const env = import.meta.env as Record<string, string | undefined>;
    const directUrl = sanitize(src) ?? sanitize(env.VITE_WAHA_WHATSAPP_WEB_URL);
    const baseUrl = sanitize(env.VITE_WAHA_BASE_URL);
    const pathTemplate = sanitize(env.VITE_WAHA_WHATSAPP_WEB_PATH);
    const envInstanceId = sanitize(env.VITE_WAHA_INSTANCE_ID);
    const activeInstanceId = sanitize(instanceId ?? envInstanceId);

    if (directUrl) {
      return toAbsoluteUrl(directUrl);
    }

    if (!baseUrl) {
      return undefined;
    }

    let path = pathTemplate ?? "";

    if (activeInstanceId) {
      path = resolvePathWithInstance(path, activeInstanceId);
    }

    try {
      const base = new URL(baseUrl, window.location.origin);
      const finalUrl = new URL(path || ".", base).toString();
      return finalUrl;
    } catch (error) {
      console.error("Não foi possível compor a URL do WAHA", error);
      return undefined;
    }
  }, [instanceId, src]);

  if (!resolvedSrc) {
    return (
      <div className={clsx(styles.fallback, className)}>
        {fallback ?? (
          <>
            <h2>Integração com WhatsApp indisponível</h2>
            <p>
              Configure <code>VITE_WAHA_WHATSAPP_WEB_URL</code> ou defina{' '}
              <code>VITE_WAHA_BASE_URL</code> e <code>VITE_WAHA_WHATSAPP_WEB_PATH</code> para
              habilitar o painel.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(styles.container, className)}>
      <iframe
        src={resolvedSrc}
        title={title}
        className={clsx(styles.iframe, iframeClassName)}
        allow="clipboard-read; clipboard-write; camera; microphone"
        allowFullScreen
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
      />
    </div>
  );
};

export default WhatsAppWebEmbed;
