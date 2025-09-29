const pad = (value: number) => value.toString().padStart(2, "0");

export const formatPostDateTime = (value: string): string => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(parsedDate);
  } catch (error) {
    return `${pad(parsedDate.getDate())}/${pad(parsedDate.getMonth() + 1)}/${parsedDate.getFullYear()} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`;
  }
};
