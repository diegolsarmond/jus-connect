import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { routes } from "@/config/routes";

import { useAuth } from "./AuthProvider";

const STORAGE_KEY = "jus-connect:trial-banner:dismissed";

const readDismissedFlag = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const sessionValue = window.sessionStorage.getItem(STORAGE_KEY);
    if (sessionValue !== null) {
      return sessionValue === "true";
    }

    const localValue = window.localStorage.getItem(STORAGE_KEY);
    if (localValue !== null) {
      return localValue === "true";
    }
  } catch {
    // Ignored: accessing storage can throw in restricted environments
  }

  return false;
};

const persistDismissal = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Ignore persistence errors silently
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore cleanup errors silently
  }
};

const getRemainingMilliseconds = (targetDate: Date) => {
  return Math.max(targetDate.getTime() - Date.now(), 0);
};

const formatCountdown = (remainingMs: number) => {
  const totalSeconds = Math.floor(remainingMs / 1000);
  const secondsPerMinute = 60;
  const secondsPerHour = 60 * secondsPerMinute;
  const secondsPerDay = 24 * secondsPerHour;

  const days = Math.floor(totalSeconds / secondsPerDay);
  const hours = Math.floor((totalSeconds % secondsPerDay) / secondsPerHour);
  const minutes = Math.floor((totalSeconds % secondsPerHour) / secondsPerMinute);

  const paddedHours = hours.toString().padStart(2, "0");
  const paddedMinutes = minutes.toString().padStart(2, "0");

  return {
    label: `${days}d ${paddedHours}h ${paddedMinutes}min`,
    days,
    hours,
    minutes,
  };
};

interface TrialBannerProps {
  className?: string;
}

export function TrialBanner({ className }: TrialBannerProps) {
  const { user } = useAuth();
  const subscription = user?.subscription ?? null;
  const isTrialing = subscription?.status === "trialing";
  const trialEndsAt = subscription?.trialEndsAt ?? null;

  const trialEndsAtDate = useMemo(() => {
    if (!trialEndsAt) {
      return null;
    }

    const parsedDate = new Date(trialEndsAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate;
  }, [trialEndsAt]);

  const [isDismissed, setIsDismissed] = useState(() => readDismissedFlag());
  const [remainingMs, setRemainingMs] = useState<number | null>(() => {
    if (!trialEndsAtDate) {
      return null;
    }

    return getRemainingMilliseconds(trialEndsAtDate);
  });

  useEffect(() => {
    if (!trialEndsAtDate) {
      setRemainingMs(null);
      return;
    }

    const updateCountdown = () => {
      const nextValue = getRemainingMilliseconds(trialEndsAtDate);
      setRemainingMs(nextValue);
      return nextValue;
    };

    const initialValue = updateCountdown();
    if (initialValue <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextValue = updateCountdown();
      if (nextValue <= 0) {
        window.clearInterval(intervalId);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [trialEndsAtDate]);

  const handleDismiss = () => {
    setIsDismissed(true);
    persistDismissal();
  };

  if (!isTrialing || !trialEndsAtDate || isDismissed || remainingMs === null || remainingMs <= 0) {
    return null;
  }

  const countdown = formatCountdown(remainingMs);

  return (
    <Alert
      variant="destructive"
      className={cn(
        "relative flex w-full shrink-0 flex-col gap-4 border-b border-t-0 border-destructive/40 bg-destructive/10 px-4 py-4 text-destructive dark:text-destructive-foreground sm:flex-row sm:items-center sm:px-6",

        className,
      )}
    >
      <div className="flex-1 space-y-1">
        <AlertTitle>Você está aproveitando o período de teste</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>Contrate um plano para continuar com acesso completo após o fim do teste.</p>
          <p>
            Tempo restante:{" "}
            <span data-testid="trial-banner-countdown" className="font-semibold">
              {countdown.label}
            </span>
          </p>
        </AlertDescription>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          asChild
          variant="secondary"
          className="bg-background text-destructive hover:bg-background/90 dark:bg-muted dark:text-destructive-foreground dark:hover:bg-muted/90"
        >

          <Link to={routes.meuPlano}>Conhecer planos</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fechar aviso de período de teste"
          onClick={handleDismiss}
          data-testid="trial-banner-dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
