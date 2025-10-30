import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users, Clock } from "lucide-react";

interface EventCardProps {
  event: any;
  isGoing?: boolean;
  onToggleJoin?: (eventId: string, willJoin: boolean) => void;
}

export default function EventCard({ event, isGoing, onToggleJoin }: EventCardProps) {
  const { toast } = useToast();
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

  const getEventEnded = (): boolean => {
    const end = event.endDateTime ? new Date(event.endDateTime) : (event.startDateTime ? new Date(event.startDateTime) : null);
    return end ? end.getTime() < Date.now() : false;
  };

  const isPast = getEventEnded();

  const buildEventShareUrl = (): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eventu.app';
    // Fallback simples para levar ao app com referência do evento
    const url = new URL(origin);
    url.searchParams.set('event', event.id);
    return url.toString();
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const openInstagramStory = () => {
    try {
      const deepLink = 'instagram://story-camera';
      const opened = window.open(deepLink, '_blank');
      return !!opened;
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    const eventUrl = buildEventShareUrl();
    const shareText = `Eu vou no ${event.title}! Confirme sua presença: ${eventUrl}`;

    // Marcar presença automaticamente antes de compartilhar (se ainda não marcado e evento não for passado)
    if (!isPast && !isGoing) {
      onToggleJoin?.(event.id, true);
    }

    // Tentar Web Share API com arquivo (quando imagem disponível e suportado)
    const tryWebShareWithFile = async (): Promise<boolean> => {
      try {
        const isImage = event.mediaType === 'image' && typeof event.mediaUrl === 'string' && event.mediaUrl.length > 0;
        if (!isImage) return false;

        const response = await fetch(event.mediaUrl, { mode: 'cors' });
        if (!response.ok) return false;
        const blob = await response.blob();
        const fileName = `evento-${event.id}.jpg`;
        const fileType = blob.type || 'image/jpeg';
        const file = new File([blob], fileName, { type: fileType });

        // @ts-expect-error canShare existe em navegadores que suportam Web Share Level 2
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            // @ts-expect-error share aceita files em navegadores compatíveis
            files: [file],
            title: event.title,
            text: shareText,
            url: eventUrl,
          });
          return true;
        }
      } catch {
        // Ignorar e seguir para fallbacks
      }
      return false;
    };

    // Tentar Web Share API sem arquivo
    if (navigator.share) {
      const sharedWithFile = await tryWebShareWithFile();
      if (sharedWithFile) return;
      try {
        await navigator.share({ title: event.title, text: shareText, url: eventUrl });
        return;
      } catch {
        // Usuário pode ter cancelado; seguir para fallback
      }
    }

    // Fallback: Abrir câmera de Stories do Instagram (se disponível) e copiar link
    const opened = openInstagramStory();
    const copied = await copyToClipboard(`${shareText}`);
    if (opened) {
      toast({
        title: 'Abra o Instagram',
        description: copied
          ? 'Link copiado. Cole na sua Story e publique!'
          : 'Não foi possível copiar o link automaticamente. Copie e compartilhe manualmente.',
      });
    } else {
      toast({
        title: 'Compartilhamento',
        description: copied
          ? 'Link do evento copiado. Compartilhe no Instagram Stories.'
          : 'Não foi possível compartilhar automaticamente. Tente pela Web Share ou copie o link.',
        variant: 'default',
      });
      // Último recurso: abrir o Instagram no navegador
      try { window.open('https://instagram.com', '_blank'); } catch {}
    }
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
              {event.attendeesCount || 0} {isPast
                ? (event.attendeesCount === 1 ? 'pessoa foi' : 'pessoas foram')
                : (event.attendeesCount === 1 ? 'pessoa vai' : 'pessoas vão')}
            </span>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            className={`${isGoing ? 'flex-1 bg-green-600 hover:bg-green-700' : 'flex-1 bg-blue-600 hover:bg-blue-700'} text-white ${isPast ? 'opacity-60 cursor-not-allowed hover:bg-inherit' : ''}`}
            onClick={() => { if (!isPast) onToggleJoin?.(event.id, !isGoing); }}
            disabled={isPast}
            data-testid={`button-join-event-${event.id}`}
          >
            {isPast ? (isGoing ? 'Você foi' : 'Você não foi') : (isGoing ? 'Participando' : 'Participar')}
          </Button>
          <Button
            variant="secondary"
            className="bg-gray-600 hover:bg-gray-700"
            onClick={handleShare}
            data-testid={`button-share-event-${event.id}`}
          >
            Compartilhar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
