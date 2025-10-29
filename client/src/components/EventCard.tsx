import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Clock } from "lucide-react";

interface EventCardProps {
  event: any;
  isGoing?: boolean;
  onToggleJoin?: (eventId: string, willJoin: boolean) => void;
}

export default function EventCard({ event, isGoing, onToggleJoin }: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-BR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      clubs: "bg-red-600",
      bars: "bg-orange-600",
      shows: "bg-yellow-600",
      fairs: "bg-green-600",
      food: "bg-blue-600",
      other: "bg-gray-600",
    };
    return colors[type] || colors.other;
  };

  return (
    <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-lg mb-1" data-testid={`text-event-title-${event.id}`}>
              {event.title}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {event.description}
            </CardDescription>
          </div>
          <Badge 
            className={`${getEventTypeColor(event.eventType)} text-white ml-2`}
            data-testid={`badge-event-type-${event.id}`}
          >
            {event.eventType}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-300">
            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
            <span data-testid={`text-event-date-${event.id}`}>
              {formatDate(event.startDateTime)}
            </span>
            <Clock className="h-4 w-4 ml-4 mr-2 text-gray-400" />
            <span data-testid={`text-event-time-${event.id}`}>
              {formatTime(event.startDateTime)}
            </span>
          </div>
          
          {event.location && (
            <div className="flex items-center text-sm text-gray-300">
              <MapPin className="h-4 w-4 mr-2 text-gray-400" />
              <span data-testid={`text-event-location-${event.id}`}>
                {event.location.name}
              </span>
            </div>
          )}
          
          <div className="flex items-center text-sm text-gray-300">
            <Users className="h-4 w-4 mr-2 text-gray-400" />
            <span data-testid={`text-event-attendees-${event.id}`}>
              {event.attendeesCount || 0} {event.attendeesCount === 1 ? 'pessoa vai' : 'pessoas vão'}
            </span>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            className={`${isGoing ? 'flex-1 bg-green-600 hover:bg-green-700' : 'flex-1 bg-blue-600 hover:bg-blue-700'} text-white`}
            onClick={() => onToggleJoin?.(event.id, !isGoing)}
            data-testid={`button-join-event-${event.id}`}
          >
            {isGoing ? 'Participando' : 'Participar'}
          </Button>
          <Button
            variant="secondary"
            className="bg-gray-600 hover:bg-gray-700"
            data-testid={`button-share-event-${event.id}`}
          >
            Compartilhar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
