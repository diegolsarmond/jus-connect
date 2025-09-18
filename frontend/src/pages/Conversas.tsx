import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WhatsAppLayout } from "../components/waha";

const Conversas = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();

  const handleRouteChange = useCallback(
    (nextConversationId: string | null) => {
      if (nextConversationId) {
        if (nextConversationId === conversationId) {
          return;
        }
        const encodedId = encodeURIComponent(nextConversationId);
        navigate(`/conversas/${encodedId}`);
        return;
      }

      if (conversationId) {
        navigate("/conversas");
      }
    },
    [conversationId, navigate],
  );

  return (
    <div className="h-full min-h-0 flex flex-1 flex-col overflow-hidden">
      <WhatsAppLayout
        conversationIdFromRoute={conversationId}
        onConversationRouteChange={handleRouteChange}
      />
    </div>
  );
};

export default Conversas;
