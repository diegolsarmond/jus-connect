import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileCardProps {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  variant?: "default" | "compact";
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyState?: ReactNode;
}

export function ProfileCard({
  title,
  icon,
  children,
  className,
  variant = "default",
  isLoading,
  error,
  onRetry,
  emptyState,
}: ProfileCardProps) {
  let content: ReactNode = children;

  if (isLoading) {
    content = (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  } else if (error) {
    content = (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  } else if (!children && emptyState) {
    content = emptyState;
  }

  return (
    <Card className={cn("shadow-card hover:shadow-elegant transition-shadow duration-300", className)}>
      <CardHeader className={cn(variant === "compact" && "pb-4")}>
        <CardTitle className="flex items-center gap-2 text-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(variant === "compact" && "pt-0")}>{content}</CardContent>
    </Card>
  );
}