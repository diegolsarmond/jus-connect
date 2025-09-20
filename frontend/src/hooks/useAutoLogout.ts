import { useEffect, useRef } from "react";

const INACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "focus",
];

export const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutos
const LAST_ACTIVITY_STORAGE_KEY = "jus-connect:last-activity";
const ACTIVITY_PERSISTENCE_INTERVAL_MS = 5_000;

/**
 * Observa eventos de atividade do usuário e executa uma ação quando o limite de inatividade é atingido.
 *
 * @param onTimeout Função chamada ao atingir o tempo máximo de inatividade.
 * @param timeoutMs Tempo limite em milissegundos. Padrão de 60 minutos.
 */
export const LAST_ACTIVITY_KEY = LAST_ACTIVITY_STORAGE_KEY;

export const useAutoLogout = (onTimeout: () => void, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const timeoutIdRef = useRef<number>();
  const hasTriggeredRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  const lastActivityRef = useRef<number>(Date.now());
  const lastPersistedActivityRef = useRef<number>(0);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const readStoredActivity = (): number | null => {
      try {
        const raw = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
        if (!raw) {
          return null;
        }

        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) {
          return null;
        }

        return parsed;
      } catch (error) {
        console.warn("Falha ao ler última atividade armazenada", error);
        return null;
      }
    };

    const persistActivity = (timestamp: number) => {
      lastPersistedActivityRef.current = timestamp;
      try {
        window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp));
      } catch (error) {
        console.warn("Falha ao registrar última atividade", error);
      }
    };

    const initializeActivity = () => {
      const storedActivity = readStoredActivity();
      if (storedActivity !== null) {
        lastActivityRef.current = storedActivity;
        lastPersistedActivityRef.current = storedActivity;
      } else {
        const now = Date.now();
        lastActivityRef.current = now;
        persistActivity(now);
      }
    };

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
      const now = Date.now();
      const elapsed = Math.max(now - lastActivityRef.current, 0);

      if (elapsed >= timeoutMs) {
        hasTriggeredRef.current = true;
        onTimeoutRef.current();
        return;
      }

      timeoutIdRef.current = window.setTimeout(() => {
        hasTriggeredRef.current = true;
        onTimeoutRef.current();
      }, timeoutMs - elapsed);
    };

    const handleActivity = () => {
      if (hasTriggeredRef.current) {
        return;
      }

      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastPersistedActivityRef.current >= ACTIVITY_PERSISTENCE_INTERVAL_MS) {
        persistActivity(now);
      }

      scheduleTimeout();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_STORAGE_KEY) {
        return;
      }

      if (!event.newValue) {
        return;
      }

      const parsed = Number.parseInt(event.newValue, 10);

      if (!Number.isFinite(parsed)) {
        return;
      }

      if (parsed <= lastActivityRef.current) {
        return;
      }

      lastActivityRef.current = parsed;
      lastPersistedActivityRef.current = parsed;
      scheduleTimeout();
    };

    initializeActivity();
    hasTriggeredRef.current = false;
    scheduleTimeout();
    INACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleActivity));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearExistingTimeout();
      INACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [timeoutMs]);
};

