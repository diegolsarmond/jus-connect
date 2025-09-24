import { useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WhatsAppLayout } from "../../components/waha";

const Conversas = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();

  const decodedConversationId = useMemo(() => {
    if (!conversationId) {
      return undefined;
    }
    try {
      return decodeURIComponent(conversationId);
    } catch (error) {
      console.warn("Falha ao decodificar o identificador da conversa", error);
      return conversationId;
    }
  }, [conversationId]);

  const handleRouteChange = useCallback(
    (nextConversationId: string | null) => {
      if (nextConversationId) {
        if (nextConversationId === decodedConversationId) {
          return;
        }
        const encodedId = encodeURIComponent(nextConversationId);
        navigate(`/conversas/${encodedId}`);
        return;
      }

      if (decodedConversationId) {
        navigate("/conversas");
      }
    },
    [decodedConversationId, navigate],
  );

  return (
    <div className="h-full min-h-0 flex flex-1 flex-col overflow-hidden">

      <WhatsAppLayout
        conversationIdFromRoute={decodedConversationId}
        onConversationRouteChange={handleRouteChange}
      />
    </div>
  );
};

export default Conversas;
