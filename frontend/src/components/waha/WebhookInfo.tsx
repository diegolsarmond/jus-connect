import { Copy, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export const WebhookInfo = () => {
  const { toast } = useToast();
  
  const webhookUrl = `${window.location.origin}/api/webhook/waha`;
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Webhook URL copied to clipboard',
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-whatsapp" />
          <CardTitle>WAHA Webhook Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure this webhook URL in your WAHA instance to receive real-time message events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Webhook URL</label>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-sm font-mono break-all">
              {webhookUrl}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(webhookUrl)}
              className="flex-shrink-0"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Configuration Steps</label>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">1</Badge>
              <span>Open your WAHA dashboard or configuration</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">2</Badge>
              <span>Navigate to webhook settings for session <code className="bg-muted px-1 rounded">QuantumTecnologia01</code></span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">3</Badge>
              <span>Add the webhook URL above</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">4</Badge>
              <span>Enable events: <code className="bg-muted px-1 rounded">message</code>, <code className="bg-muted px-1 rounded">message.ack</code></span>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => window.open('https://waha.devlike.pro/docs/how-to/webhooks', '_blank')}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            WAHA Webhook Documentation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};