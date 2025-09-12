import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProfileCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "default" | "compact";
}

export function ProfileCard({ title, icon, children, className, variant = "default" }: ProfileCardProps) {
  return (
    <Card className={cn("shadow-card hover:shadow-elegant transition-shadow duration-300", className)}>
      <CardHeader className={cn(variant === "compact" && "pb-4")}>
        <CardTitle className="flex items-center gap-2 text-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(variant === "compact" && "pt-0")}>
        {children}
      </CardContent>
    </Card>
  );
}