import { MessageCircle } from "lucide-react";

const shimmerItems = [0, 1, 2, 3];

export const ConversationLoadingScreen = () => {
  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-1 items-center justify-center overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.28),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.22),_transparent_60%)]" />

      <div className="relative flex w-full max-w-3xl flex-col items-center gap-10 px-6 text-center">
        <div className="relative h-28 w-28 animate-float">
          <div className="absolute inset-4 rounded-full bg-sky-500/20 blur-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-900/80 shadow-[0_0_30px_rgba(59,130,246,0.35)] backdrop-blur-sm">
              <MessageCircle className="h-10 w-10 text-sky-300" />
            </div>
            <div className="absolute h-24 w-24 rounded-full border-2 border-sky-400/40 border-t-transparent animate-spin-slow" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-semibold tracking-tight">Carregando suas conversas</p>
          <p className="text-sm text-slate-300">
            Estamos sincronizando seus atendimentos com o WhatsApp Business.
          </p>
        </div>

        <div className="flex w-full max-w-lg flex-col gap-4">
          {shimmerItems.map((item) => (
            <div
              key={item}
              className="relative flex h-16 items-center gap-4 overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/70 px-5"
            >
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-slate-800/80" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-3 w-2/3 rounded-full bg-slate-800/70" />
                <div className="h-3 w-1/2 rounded-full bg-slate-800/50" />
              </div>
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(110deg,transparent,rgba(148,163,184,0.45),transparent)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversationLoadingScreen;
