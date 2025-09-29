const pad = (value: number) => value.toString().padStart(2, "0");

const createFormatter = () =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

let blogPublicationFormatter: Intl.DateTimeFormat | undefined;

const getBlogPublicationFormatter = () => {
  if (!blogPublicationFormatter) {
    blogPublicationFormatter = createFormatter();
  }

  return blogPublicationFormatter;
};

export const formatBlogPublicationDate = (value: string): string => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  try {
    return getBlogPublicationFormatter().format(parsedDate);
  } catch (error) {
    return `${pad(parsedDate.getDate())}/${pad(parsedDate.getMonth() + 1)}/${parsedDate.getFullYear()}`;
  }
};

export const formatPostDateTime = (value: string): string =>
  formatBlogPublicationDate(value);
