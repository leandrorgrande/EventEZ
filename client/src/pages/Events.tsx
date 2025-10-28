import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { collection, getDocs, query as fsQuery, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNavigation from "@/components/BottomNavigation";
import EventCard from "@/components/EventCard";
import CreateEventModal from "@/components/CreateEventModal";
import { Search, Plus, Filter } from "lucide-react";

export default function Events() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ["firestore/events", { eventType: filterType }],
    queryFn: async () => {
      const eventsRef = collection(db, "events");
      const constraints: any[] = [where("approvalStatus", "==", "approved")];
      if (filterType && filterType !== "all") {
        constraints.push(where("eventType", "==", filterType));
      }

      const q = constraints.length > 0 ? fsQuery(eventsRef, ...constraints) : eventsRef;
      const snapshot = await getDocs(q as any);
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
      // Ordenar por data de início (mais recentes primeiro)
      items.sort((a: any, b: any) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
      return items;
    },
  });

  const filteredEvents = events?.filter((event: any) => 
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const joinMutation = useMutation({
    mutationFn: async ({ eventId, willJoin }: { eventId: string; willJoin: boolean }) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = (await import('@/lib/firebase')).auth.currentUser ? await (await import('@/lib/firebase')).auth.currentUser?.getIdToken() : undefined;
      const res = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ join: willJoin })
      });
      if (!res.ok) throw new Error('Falha ao participar do evento');
      return res.json();
    },
    onSuccess: (_data, params) => {
      // Recarregar lista
      queryClient.invalidateQueries({ queryKey: ["firestore/events", { eventType: filterType }] });
      // Feedback
      // Usando lazy import do toast para evitar ciclo
      import('@/hooks/use-toast').then(({ useToast }) => {
        try {
          const { toast } = useToast();
          toast({ title: params.willJoin ? 'Legal! 🎉' : 'Tudo certo 👍', description: params.willJoin ? 'Você vai participar deste evento.' : 'Você saiu do evento.' });
        } catch {}
      });
    }
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold" data-testid="text-events-title">Events</h1>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-create-event"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-gray-400"
              data-testid="input-search-events"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32 bg-slate-700 border-slate-600" data-testid="select-filter-type">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="clubs">Clubs</SelectItem>
              <SelectItem value="bars">Bars</SelectItem>
              <SelectItem value="shows">Shows</SelectItem>
              <SelectItem value="fairs">Fairs</SelectItem>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Events List */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-600 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-slate-600 rounded w-full"></div>
                  <div className="h-3 bg-slate-600 rounded w-2/3 mt-2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700 text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold text-white mb-2" data-testid="text-no-events">
                No events found
              </h3>
              <p className="text-gray-400 mb-4">
                {searchQuery || filterType !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Be the first to create an event in your area!"}
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-create-first-event"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event: any) => {
              const currentUser = (window as any).firebase?.auth?.currentUser || undefined;
              const uid = currentUser?.uid;
              const isGoing = Array.isArray(event.attendeeIds) ? event.attendeeIds.includes(uid) : false;
              return (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  isGoing={isGoing}
                  onToggleJoin={(id, willJoin) => joinMutation.mutate({ eventId: id, willJoin })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="events" />

      {/* Create Event Modal */}
      <CreateEventModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
