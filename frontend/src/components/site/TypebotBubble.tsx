import { useEffect } from "react";

const TYPEBOT_SCRIPT_ATTRIBUTE = "data-typebot-inline";
const TYPEBOT_BUBBLE_SELECTOR = "typebot-bubble";
const TYPEBOT_STYLE_SELECTOR = "style[data-typebot], link[rel=\"stylesheet\"][href*=\"typebot\"]";
const TYPEBOT_CONTAINER_SELECTOR = "[id^=\"typebot\"]";

let activeInstances = 0;

const injectTypebotBubble = () => {
  const scriptElement = document.createElement("script");
  scriptElement.type = "module";
  scriptElement.setAttribute(TYPEBOT_SCRIPT_ATTRIBUTE, "true");
  scriptElement.textContent = `import Typebot from 'https://cdn.jsdelivr.net/npm/@typebot.io/js@0/dist/web.js';

Typebot.initBubble({
  typebot: "quantumbot",
  apiHost: "https://form.quantumtecnologia.com.br",
  previewMessage: {
    message: "Olá, sou o assistente do Jus Connect. Em que posso ajudar?",
    autoShowDelay: 10000,
    avatarUrl: "https://i.postimg.cc/CLKVTcfx/graident-ai-robot-vectorart-em-ingles-78370-4114.avif",
  },
  theme: {
    button: { backgroundColor: "#303235" },
    chatWindow: { backgroundColor: "#FFFFFF" },
  },
});
`;

  document.body.append(scriptElement);

  return scriptElement;
};

const removeTypebotArtifacts = () => {
  document
    .querySelectorAll(`script[${TYPEBOT_SCRIPT_ATTRIBUTE}]`)
    .forEach((element) => element.remove());

  document
    .querySelectorAll(TYPEBOT_BUBBLE_SELECTOR)
    .forEach((element) => element.remove());

  document
    .querySelectorAll(TYPEBOT_STYLE_SELECTOR)
    .forEach((element) => element.remove());

  document
    .querySelectorAll(TYPEBOT_CONTAINER_SELECTOR)
    .forEach((element) => {
      if (element instanceof HTMLElement && element.getAttribute(TYPEBOT_SCRIPT_ATTRIBUTE) === "true") {
        return;
      }

      element.remove();
    });
};

const TypebotBubble = () => {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    activeInstances += 1;

    const scriptElement = injectTypebotBubble();

    return () => {
      if (typeof document === "undefined") {
        return;
      }

      scriptElement.remove();
      activeInstances = Math.max(0, activeInstances - 1);

      if (activeInstances === 0) {
        removeTypebotArtifacts();
      }
    };
  }, []);

  return null;
};

export default TypebotBubble;
