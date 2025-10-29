import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
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
    queryKey: ["api/events", { eventType: filterType }],
    queryFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : undefined;
      const url = new URL(`${API_URL}/events`);
      if (filterType && filterType !== "all") {
        url.searchParams.append('eventType', filterType);
      }
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(url.toString(), { headers });
      if (!response.ok) throw new Error('Falha ao buscar eventos');
      const items = await response.json();
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
      console.log('[Events] Join toggle clicked', { eventId, willJoin });
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : undefined;
      const res = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ join: willJoin })
      });
      console.log('[Events] Join response status', res.status);
      if (!res.ok) {
        const txt = await res.text();
        console.error('[Events] Join error response', txt);
        throw new Error('Falha ao participar do evento');
      }
      const json = await res.json();
      console.log('[Events] Join success payload', json);
      return json;
    },
    onMutate: async ({ eventId, willJoin }) => {
      console.log('[Events] ====== onMutate START (optimistic update) ======');
      console.log('[Events] onMutate params:', { eventId, willJoin });
      await queryClient.cancelQueries({ queryKey: ["api/events", { eventType: filterType }] });
      const prev = queryClient.getQueryData<any[]>(["api/events", { eventType: filterType }]);
      console.log('[Events] Previous cache data:', prev?.map(e => ({ id: e.id, attendeeIds: e.attendeeIds, attendeesCount: e.attendeesCount })));
      
      if (prev) {
        const uid = auth.currentUser?.uid;
        console.log('[Events] Current user UID:', uid);
        const next = prev.map((e: any) => {
          if (e.id !== eventId) return e;
          console.log('[Events] Found event to update:', { id: e.id, currentAttendeeIds: e.attendeeIds, currentAttendeesCount: e.attendeesCount });
          
          const attendeeIds = Array.isArray(e.attendeeIds) ? [...e.attendeeIds] : [];
          console.log('[Events] AttendeeIds array (copy):', attendeeIds);
          
          const exists = uid ? attendeeIds.includes(uid) : false;
          console.log('[Events] User exists in array?', exists);
          
          if (willJoin && uid && !exists) {
            attendeeIds.push(uid);
            console.log('[Events] Added user to array:', attendeeIds);
          }
          if (!willJoin && uid && exists) {
            const index = attendeeIds.indexOf(uid);
            attendeeIds.splice(index, 1);
            console.log('[Events] Removed user from array:', attendeeIds);
          }
          
          const newCount = attendeeIds.length;
          console.log('[Events] New attendeesCount:', newCount);
          
          const updated = {
            ...e,
            attendeeIds,
            attendeesCount: newCount,
          };
          console.log('[Events] Updated event data:', { id: updated.id, attendeeIds: updated.attendeeIds, attendeesCount: updated.attendeesCount });
          return updated;
        });
        
        console.log('[Events] New cache data:', next?.map(e => ({ id: e.id, attendeeIds: e.attendeeIds, attendeesCount: e.attendeesCount })));
        queryClient.setQueryData(["api/events", { eventType: filterType }], next);
        console.log('[Events] ====== onMutate END (cache updated) ======');
      } else {
        console.log('[Events] No previous data found');
      }
      return { prev };
    },
    onSuccess: (data, params) => {
      console.log('[Events] ====== onSuccess START (API response received) ======');
      console.log('[Events] API response data:', data);
      console.log('[Events] Response attendeeIds:', data?.attendeeIds);
      console.log('[Events] Response attendeesCount:', data?.attendeesCount);
      
      // Atualizar cache com dados da resposta da API (que já tem attendeeIds atualizado)
      const currentData = queryClient.getQueryData<any[]>(["api/events", { eventType: filterType }]);
      console.log('[Events] Current cache before update:', currentData?.map(e => ({ id: e.id, attendeeIds: e.attendeeIds, attendeesCount: e.attendeesCount })));
      
      if (currentData && data?.id) {
        const updated = currentData.map((e: any) => {
          if (e.id === data.id) {
            console.log('[Events] Updating event from API response:', {
              eventId: e.id,
              oldAttendeeIds: e.attendeeIds,
              oldAttendeesCount: e.attendeesCount,
              newAttendeeIds: data.attendeeIds,
              newAttendeesCount: data.attendeesCount
            });
            
            // Usar dados da API que já tem attendeeIds e attendeesCount atualizados
            const finalAttendeeIds = data.attendeeIds || e.attendeeIds;
            const finalAttendeesCount = data.attendeesCount !== undefined 
              ? data.attendeesCount 
              : (Array.isArray(data.attendeeIds) ? data.attendeeIds.length : (e.attendeesCount || 0));
            
            console.log('[Events] Final values:', { 
              attendeeIds: finalAttendeeIds, 
              attendeesCount: finalAttendeesCount 
            });
            
            return {
              ...e,
              attendeeIds: finalAttendeeIds,
              attendeesCount: finalAttendeesCount
            };
          }
          return e;
        });
        
        queryClient.setQueryData(["api/events", { eventType: filterType }], updated);
        const updatedEvent = updated.find((e: any) => e.id === data.id);
        console.log('[Events] Cache updated with API response:', updatedEvent);
        console.log('[Events] New cache data:', updated?.map(e => ({ id: e.id, attendeeIds: e.attendeeIds, attendeesCount: e.attendeesCount })));
      } else {
        console.log('[Events] Could not update cache - missing data.id or currentData');
      }
      
      // Não invalidar queries imediatamente - o cache já foi atualizado com os dados corretos da API
      // Invalidar apenas após um delay maior para sincronizar eventualmente com Firestore
      setTimeout(() => {
        console.log('[Events] ====== Invalidating queries após delay ======');
        queryClient.invalidateQueries({ queryKey: ["api/events", { eventType: filterType }] });
      }, 3000); // Delay maior para evitar race condition
      
      // Feedback
      import('@/hooks/use-toast').then(({ useToast }) => {
        try {
          const { toast } = useToast();
          toast({ title: params.willJoin ? 'Legal! 🎉' : 'Tudo certo 👍', description: params.willJoin ? 'Você vai participar deste evento.' : 'Você saiu do evento.' });
        } catch {}
      });
      console.log('[Events] ====== onSuccess END ======');
    },
    onError: (error, _vars, context) => {
      console.error('[Events] Join mutate error', error);
      if ((context as any)?.prev) {
        queryClient.setQueryData(["api/events", { eventType: filterType }], (context as any).prev);
      }
    }
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold" data-testid="text-events-title">Eventos</h1>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-create-event"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar eventos..."
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
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="clubs">Baladas</SelectItem>
              <SelectItem value="bars">Bares</SelectItem>
              <SelectItem value="shows">Shows</SelectItem>
              <SelectItem value="fairs">Feiras</SelectItem>
              <SelectItem value="food">Comida</SelectItem>
              <SelectItem value="other">Outros</SelectItem>
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
                Nenhum evento encontrado
              </h3>
              <p className="text-gray-400 mb-4">
                {searchQuery || filterType !== "all" 
                  ? "Tente ajustar sua busca ou filtros" 
                  : "Seja o primeiro a criar um evento na sua área!"}
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-create-first-event"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Evento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event: any) => {
              const uid = auth.currentUser?.uid;
              const isGoing = Array.isArray(event.attendeeIds) ? event.attendeeIds.includes(uid) : false;
              console.log('[Events] Rendering event:', { 
                id: event.id, 
                title: event.title,
                attendeeIds: event.attendeeIds, 
                attendeesCount: event.attendeesCount,
                uid,
                isGoing 
              });
              return (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  isGoing={isGoing}
                  onToggleJoin={(id, willJoin) => {
                    console.log('[Events] ====== ToggleJoin clicked ======', { id, willJoin, currentAttendeesCount: event.attendeesCount });
                    joinMutation.mutate({ eventId: id, willJoin });
                  }}
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
