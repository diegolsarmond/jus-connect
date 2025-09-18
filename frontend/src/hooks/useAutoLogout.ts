import { useEffect, useRef } from "react";

const INACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "focus",
];

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutos

/**
 * Observa eventos de atividade do usuário e executa uma ação quando o limite de inatividade é atingido.
 *
 * @param onTimeout Função chamada ao atingir o tempo máximo de inatividade.
 * @param timeoutMs Tempo limite em milissegundos. Padrão de 60 minutos.
 */
export const useAutoLogout = (onTimeout: () => void, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const timeoutIdRef = useRef<number>();
  const hasTriggeredRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    const clearExistingTimeout = () => {
      if (timeoutIdRef.current !== undefined) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = undefined;
      }
    };

    const scheduleTimeout = () => {
      if (hasTriggeredRef.current) {
        return;
      }

      clearExistingTimeout();
      timeoutIdRef.current = window.setTimeout(() => {
        hasTriggeredRef.current = true;
        onTimeoutRef.current();
      }, timeoutMs);
    };

    const handleActivity = () => {
      if (hasTriggeredRef.current) {
        return;
      }

      scheduleTimeout();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
      }
    };

    hasTriggeredRef.current = false;
    scheduleTimeout();
    INACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleActivity));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearExistingTimeout();
      INACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [timeoutMs]);
};

