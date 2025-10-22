import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Users } from "lucide-react";

// EVENTU: Event History modal with Created/Attending tabs
interface EventHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export default function EventHistoryModal({ open, onOpenChange, user }: EventHistoryModalProps) {
  const [activeTab, setActiveTab] = useState("created");

  // EVENTU: Fetch events created by user
  const { data: createdEvents, isLoading: createdLoading } = useQuery({
    queryKey: ["/api/users", user?.id, "events"],
    enabled: !!user?.id && open,
  });

  // EVENTU: Fetch events user is attending (mock for now)
  const { data: attendingEvents = [], isLoading: attendingLoading } = useQuery({
    queryKey: ["/api/users", user?.id, "attending"],
    enabled: !!user?.id && open,
    queryFn: async () => {
      // Mock data - in real app, fetch from /api/users/:id/attending
      return [] as any[];
    },
  });

  const renderEventCard = (event: any) => (
    <Card key={event.id} className="bg-slate-700 border-slate-600 p-4 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1" data-testid={`text-event-title-${event.id}`}>
            {event.title}
          </h4>
          {event.description && (
            <p className="text-sm text-gray-400 mb-2 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
        <Badge variant="outline" className="ml-2 text-xs">
          {event.eventType}
        </Badge>
      </div>

      <div className="space-y-2">
        {event.location && (
          <div className="flex items-center text-sm text-gray-300">
            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
            <span>{event.location.name}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-300">
            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
            <span>{new Date(event.startDateTime).toLocaleDateString()}</span>
            <span className="mx-2">•</span>
            <span>{new Date(event.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {event.attendeeCount !== undefined && (
            <div className="flex items-center text-gray-300">
              <Users className="h-4 w-4 mr-1 text-gray-400" />
              <span>{event.attendeeCount} going</span>
            </div>
          )}
        </div>

        {event.isActive === false && (
          <Badge variant="secondary" className="mt-2 bg-gray-600 text-gray-300">
            Ended
          </Badge>
        )}
      </div>
    </Card>
  );

  const renderLoadingState = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-slate-700 border-slate-600 p-4">
          <Skeleton className="h-6 w-3/4 mb-2 bg-slate-600" />
          <Skeleton className="h-4 w-full mb-2 bg-slate-600" />
          <Skeleton className="h-4 w-1/2 bg-slate-600" />
        </Card>
      ))}
    </div>
  );

  const renderEmptyState = (message: string) => (
    <div className="text-center py-12">
      <Calendar className="h-16 w-16 text-gray-600 mx-auto mb-4" />
      <p className="text-gray-400" data-testid="text-no-events">{message}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-history-title">Event History</DialogTitle>
          <DialogDescription className="text-gray-400">
            View all your created events and events you're attending
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-700">
            <TabsTrigger 
              value="created" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              data-testid="tab-created"
            >
              Created ({createdEvents?.length || 0})
            </TabsTrigger>
            <TabsTrigger 
              value="attending"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              data-testid="tab-attending"
            >
              Attending ({attendingEvents?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="mt-4">
            {createdLoading ? (
              renderLoadingState()
            ) : createdEvents && createdEvents.length > 0 ? (
              <div>
                {createdEvents.map((event: any) => renderEventCard(event))}
              </div>
            ) : (
              renderEmptyState("You haven't created any events yet")
            )}
          </TabsContent>

          <TabsContent value="attending" className="mt-4">
            {attendingLoading ? (
              renderLoadingState()
            ) : attendingEvents && attendingEvents.length > 0 ? (
              <div>
                {attendingEvents.map((event: any) => renderEventCard(event))}
              </div>
            ) : (
              renderEmptyState("You're not attending any events yet")
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
