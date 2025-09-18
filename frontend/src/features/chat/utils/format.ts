const intlTime = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const intlDay = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const intlFull = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return intlTime.format(date);
};

export const formatConversationTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfGivenDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffInDays = Math.floor(
    (startOfToday.getTime() - startOfGivenDay.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (date >= startOfToday) {
    return formatTime(value);
  }
  if (date >= startOfYesterday) {
    return "Ontem";
  }
  if (diffInDays < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return intlDay.format(date);
  }
  return intlFull.format(date);
};

export const getMessagePreview = (content: string, type: string) => {
  if (type === "image") return "Imagem";
  if (type === "audio") return "Mensagem de áudio";
  if (content.length <= 56) return content;
  return `${content.slice(0, 56).trim()}…`;
};

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "");
