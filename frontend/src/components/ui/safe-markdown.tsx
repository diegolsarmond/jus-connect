import { useMemo } from "react";

import { cn } from "@/lib/utils";

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(markdown: string): string {
  if (!markdown.trim()) {
    return "";
  }

  const escaped = escapeHtml(markdown);
  const codeBlocks: string[] = [];
  let processado = escaped.replace(/```([\s\S]*?)```/g, (_, bloco: string) => {
    const indice = codeBlocks.push(bloco) - 1;
    return `@@CODEBLOCK${indice}@@`;
  });

  processado = processado.replace(/`([^`]+)`/g, (_, codigo: string) => `<code>${codigo}</code>`);
  processado = processado.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  processado = processado.replace(/__(.+?)__/g, "<strong>$1</strong>");
  processado = processado.replace(/(?<!\\)\*(?!\*)(.+?)(?<!\\)\*(?!\*)/g, "<em>$1</em>");
  processado = processado.replace(/_(?!_)(.+?)_(?!_)/g, "<em>$1</em>");
  processado = processado.replace(
    /\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  processado = processado.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  const linhas = processado.split(/\r?\n/);
  let html = "";
  let emLista = false;

  linhas.forEach((linha) => {
    if (!linha.trim()) {
      if (emLista) {
        html += "</ul>";
        emLista = false;
      }
      return;
    }

    if (/^\s*[-*]\s+/.test(linha)) {
      if (!emLista) {
        html += "<ul>";
        emLista = true;
      }
      const conteudo = linha.replace(/^\s*[-*]\s+/, "");
      html += `<li>${conteudo}</li>`;
      return;
    }

    if (emLista) {
      html += "</ul>";
      emLista = false;
    }

    html += `<p>${linha}</p>`;
  });

  if (emLista) {
    html += "</ul>";
  }

  return html.replace(/@@CODEBLOCK(\d+)@@/g, (_, indice: string) => {
    const codigo = codeBlocks[Number.parseInt(indice, 10)] ?? "";
    return `<pre><code>${codigo}</code></pre>`;
  });
}

export function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  if (!html) {
    return null;
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-muted-foreground dark:prose-invert",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
