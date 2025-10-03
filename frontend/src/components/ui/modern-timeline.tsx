import { Calendar, Clock, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TimelineEvent {
  id: string;
  date: string | null;
  time?: string | null;
  title: string;
  description?: string | null;
  type?: string;
  isPrivate?: boolean;
  onGenerateSummary?: () => void;
}

interface TimelineGroup {
  label: string;
  events: TimelineEvent[];
  defaultExpanded?: boolean;
}

interface ModernTimelineProps {
  groups: TimelineGroup[];
  className?: string;
}

export function ModernTimeline({ groups, className }: ModernTimelineProps) {
  return (
    <div className={cn("space-y-8", className)}>
      {groups.map((group, groupIndex) => (
        <TimelineGroupComponent
          key={`group-${groupIndex}`}
          group={group}
          isLast={groupIndex === groups.length - 1}
        />
      ))}
    </div>
  );
}

function TimelineGroupComponent({
  group,
  isLast
}: {
  group: TimelineGroup;
  isLast: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(Boolean(group.defaultExpanded));

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-4 gap-2 font-semibold text-lg hover:bg-accent/50"
      >
        {isExpanded ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
        {group.label}
        <Badge variant="secondary" className="ml-2">
          {group.events.length}
        </Badge>
      </Button>

      {isExpanded && (
        <div className="space-y-4 pl-6 border-l-2 border-primary/20">
          {group.events.map((event, eventIndex) => (
            <TimelineEventComponent
              key={event.id}
              event={event}
              isLast={isLast && eventIndex === group.events.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineEventComponent({
  event,
  isLast
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const [showFull, setShowFull] = useState(false);
  const hasLongContent = (event.description?.length || 0) > 300;

  return (
    <Card className="relative ml-6 group hover:shadow-md transition-all duration-200">
      <div className="absolute -left-9 top-6 w-4 h-4 rounded-full bg-primary border-4 border-background shadow-sm" />

      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {event.type && (
                <Badge variant="outline" className="text-xs">
                  {event.type}
                </Badge>
              )}
              {event.isPrivate && (
                <Badge variant="secondary" className="text-xs">
                  Privado
                </Badge>
              )}
            </div>
            <h4 className="font-semibold text-base">{event.title}</h4>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
            {event.date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{event.date}</span>
              </div>
            )}
            {event.time && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{event.time}</span>
              </div>
            )}
          </div>
        </div>

        {event.description && (
          <div className="text-sm text-muted-foreground mt-2">
            <p className={cn(
              "whitespace-pre-wrap",
              !showFull && hasLongContent && "line-clamp-3"
            )}>
              {event.description}
            </p>
            {hasLongContent && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowFull(!showFull)}
                className="mt-2 p-0 h-auto"
              >
                {showFull ? "Ver menos" : "Ver mais"}
              </Button>
            )}
          </div>
        )}
        {event.onGenerateSummary ? (
          <div className="mt-4">
            <Button type="button" onClick={event.onGenerateSummary} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Resumir com IA
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
