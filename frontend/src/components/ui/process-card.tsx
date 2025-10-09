import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Calendar, MapPin, Users, FileText } from "lucide-react";

interface ProcessCardProps {
  numero: string;
  status: string;
  cliente: string;
  dataDistribuicao: string;
  jurisdicao: string;
  orgaoJulgador: string;
  onView: () => void;
}

export function ProcessCard({
  numero,
  status,
  cliente,
  dataDistribuicao,
  jurisdicao,
  orgaoJulgador,
  onView,
}: ProcessCardProps) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary/20 hover:border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg truncate">{numero}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={status === "Em andamento" ? "default" : "secondary"}>
                {status}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Visualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Cliente</p>
            <p className="font-medium truncate">{cliente}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Distribuição</p>
              <p className="truncate">{dataDistribuicao}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Jurisdição</p>
              <p className="truncate">{jurisdicao}</p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Órgão Julgador</p>
            <p className="truncate">{orgaoJulgador}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
