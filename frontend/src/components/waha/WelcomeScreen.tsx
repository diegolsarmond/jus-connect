import { MessageSquare, Zap, Shield, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WebhookInfo } from './WebhookInfo';

export const WelcomeScreen = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-chat-background p-8 overflow-y-auto">
      <div className="max-w-4xl w-full space-y-8">
        {/* Main Welcome */}
        <div className="text-center space-y-4">
          <div className="w-32 h-32 mx-auto mb-8 text-whatsapp">
            <MessageSquare className="w-full h-full" />
          </div>
          <h1 className="text-4xl font-light text-foreground mb-2">
            WhatsApp Web WAHA
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A modern WhatsApp Web interface integrated with WAHA (WhatsApp HTTP API) 
            for seamless messaging and automation.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-whatsapp-light text-whatsapp-dark">
              Session: QuantumTecnologia01
            </Badge>
            <Badge variant="outline">
              Real-time messaging
            </Badge>
            <Badge variant="outline">
              Webhook integration
            </Badge>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="text-center">
              <Zap className="w-8 h-8 text-whatsapp mx-auto mb-2" />
              <CardTitle className="text-lg">Real-time Messaging</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Send and receive messages in real-time through the WAHA API integration
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Shield className="w-8 h-8 text-whatsapp mx-auto mb-2" />
              <CardTitle className="text-lg">Secure Connection</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Secure API communication with proper authentication and encryption
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="w-8 h-8 text-whatsapp mx-auto mb-2" />
              <CardTitle className="text-lg">Group & Individual</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Support for both individual and group conversations with full feature parity
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Webhook Configuration */}
        <WebhookInfo />

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Your WhatsApp session is ready. Select a chat from the sidebar to start messaging.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>Session Status:</strong> Check the green bar at the top for connection status</p>
              <p>• <strong>Chat List:</strong> Browse your existing conversations in the left sidebar</p>
              <p>• <strong>Send Messages:</strong> Click on any chat to start sending messages</p>
              <p>• <strong>Real-time Updates:</strong> Configure the webhook above to receive messages instantly</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};