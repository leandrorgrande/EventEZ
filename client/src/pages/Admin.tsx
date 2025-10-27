import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Shield, 
  Users, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  Edit
} from "lucide-react";

export default function Admin() {
  const { userProfile, isLoading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scrapingResults, setScrapingResults] = useState<any>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingLogs, setScrapingLogs] = useState<any[]>([]);
  const [currentScraping, setCurrentScraping] = useState<any>(null);
  const [scrapingSummary, setScrapingSummary] = useState<any>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [updatingPlaces, setUpdatingPlaces] = useState<Set<string>>(new Set());
  const [editingPlace, setEditingPlace] = useState<{ id: string; name: string; currentUrl?: string } | null>(null);
  const [manualGoogleMapsUrl, setManualGoogleMapsUrl] = useState('');

  // Queries (enabled only if admin to prevent unnecessary calls)
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      console.log('[Admin] Buscando usuários...');
      
      const response = await fetch(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('[Admin] Erro ao buscar usuários:', response.status);
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Admin] Usuários retornados:', data.length);
      return data;
    },
  });

  const { data: allEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/events-all"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      console.log('[Admin] Buscando eventos com approvalStatus=all...');
      
      const response = await fetch(`${API_URL}/events?approvalStatus=all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('[Admin] Erro ao buscar eventos:', response.status);
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Admin] Eventos retornados da API:', data.length);
      console.log('[Admin] Primeiro evento:', data[0]);
      return data;
    },
  });

  // Filter events
  const pendingEvents = Array.isArray(allEvents) ? allEvents.filter((e: any) => e.approvalStatus === 'pending') : [];
  const approvedEvents = Array.isArray(allEvents) ? allEvents.filter((e: any) => e.approvalStatus === 'approved') : [];
  const rejectedEvents = Array.isArray(allEvents) ? allEvents.filter((e: any) => e.approvalStatus === 'rejected') : [];
  
  console.log('[Admin] Total eventos:', Array.isArray(allEvents) ? allEvents.length : 0);
  console.log('[Admin] Pendentes:', pendingEvents.length);
  console.log('[Admin] Aprovados:', approvedEvents.length);
  console.log('[Admin] Rejeitados:', rejectedEvents.length);

  // Mutations
  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, approvalStatus }: { eventId: string; approvalStatus: string }) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      const response = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ approvalStatus })
      });
      
      if (!response.ok) throw new Error('Failed to update event');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Event Updated", description: "Event status has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/events-all"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update event status.", variant: "destructive" });
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      // Criar novo AbortController
      const controller = new AbortController();
      setAbortController(controller);
      
      // Limpar logs anteriores
      setScrapingLogs([]);
      setCurrentScraping(null);
      setScrapingSummary(null);
      
      const response = await fetch(`${API_URL}/places/scrape-popular-times`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal
      });
      
      if (!response.ok) throw new Error(`Failed to scrape`);
      
      // Processar Server-Sent Events
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No reader available');
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.substring(6));
              
              if (data.type === 'start') {
                toast({ title: "Scraping iniciado", description: `Processando ${data.total} lugares...` });
              } else if (data.type === 'progress') {
                setCurrentScraping(data.result);
              } else if (data.type === 'result') {
                setScrapingLogs(prev => [...prev, data.result]);
                setCurrentScraping(null);
              } else if (data.type === 'complete') {
                setScrapingSummary(data.summary);
                toast({ 
                  title: "Scraping concluído", 
                  description: `${data.summary.success} sucesso, ${data.summary.errors} erros, ${data.summary.skipped} pulados` 
                });
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          toast({ title: "Scraping interrompido", description: "Execução cancelada pelo usuário" });
        }
        throw error;
      } finally {
        setAbortController(null);
      }
      
      return { success: true };
    },
    onError: (error) => {
      toast({ title: "Erro no scraping", description: error.message, variant: "destructive" });
    },
    onSettled: () => setIsScraping(false),
  });

  // Função para atualizar um place individual
  const updatePlaceMutation = useMutation({
    mutationFn: async (placeId: string) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      setUpdatingPlaces(prev => new Set(prev).add(placeId));
      
      const response = await fetch(`${API_URL}/places/${placeId}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to update place');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso", description: data.message });
      // Atualizar o log correspondente
      setScrapingLogs(prev => prev.map(log => 
        log.placeId === data.placeName ? { ...log, status: 'success', data: data.data } : log
      ));
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar place", variant: "destructive" });
    },
    onSettled: (data, error, placeId) => {
      setUpdatingPlaces(prev => {
        const newSet = new Set(prev);
        newSet.delete(placeId as string);
        return newSet;
      });
    },
  });

  const handleStopScraping = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsScraping(false);
      setCurrentScraping(null);
    }
  };

  // Mutation para atualizar googleMapsUri
  const updateGoogleMapsUriMutation = useMutation({
    mutationFn: async ({ placeId, googleMapsUri }: { placeId: string; googleMapsUri: string }) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      const response = await fetch(`${API_URL}/places/${placeId}/googlemaps`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ googleMapsUri })
      });
      
      if (!response.ok) throw new Error('Failed to update googleMapsUri');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "URL do Google Maps atualizado com sucesso!" });
      setEditingPlace(null);
      setManualGoogleMapsUrl('');
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar URL", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-600";
      case "rejected": return "bg-red-600";
      case "pending": return "bg-yellow-600";
      default: return "bg-gray-600";
    }
  };

  // Loading and Auth checks
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <Shield className="h-16 w-16 text-blue-400 animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-gray-400 mb-2">This page is restricted to administrators only.</p>
          <p className="text-sm text-yellow-400 mb-6">Your user type: {userProfile?.userType || 'none'}</p>
          <Button onClick={() => window.location.href = "/"}>Go to Home</Button>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      <div className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-6">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400">Manage users, events, and business claims</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{Array.isArray(allUsers) ? allUsers.length : 0}</div>
              <div className="text-sm text-gray-400">Total Users</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{Array.isArray(allEvents) ? allEvents.length : 0}</div>
              <div className="text-sm text-gray-400">Total Events</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{pendingEvents.length}</div>
              <div className="text-sm text-gray-400">Pending Events</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="events" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="events" className="data-[state=active]:bg-slate-700">Events</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-slate-700">Users</TabsTrigger>
            <TabsTrigger value="scraping" className="data-[state=active]:bg-slate-700">Scraping</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            {eventsLoading && (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-8 text-center">
                  <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-400">Loading events...</p>
                </CardContent>
              </Card>
            )}
            
            {!eventsLoading && pendingEvents.length === 0 && approvedEvents.length === 0 && rejectedEvents.length === 0 && (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-8 text-center">
                  <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No events found</p>
                  <p className="text-gray-500 text-sm mt-2">Total eventos no Firestore: {Array.isArray(allEvents) ? allEvents.length : 0}</p>
                </CardContent>
              </Card>
            )}
            
            {pendingEvents.length > 0 && (
              <Card className="bg-slate-800 border-2 border-yellow-600">
                <CardHeader className="bg-yellow-600/10">
                  <CardTitle className="text-yellow-400 flex items-center justify-between">
                    <div className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                      Pending Approval ({pendingEvents.length})
                    </div>
                    <Badge className="bg-yellow-600 text-white">{pendingEvents.length} events pending</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingEvents.map((event: any) => (
                    <div key={event.id} className="p-4 bg-slate-700/50 rounded-lg border border-yellow-700/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white mb-2 text-lg">{event.title}</h4>
                          {event.description && (
                            <p className="text-sm text-gray-300 mb-3">{event.description}</p>
                          )}
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center text-gray-400">
                              <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span className="truncate">{event.location?.name || event.location?.address || "No location"}</span>
                            </div>
                            <div className="flex items-center text-gray-400">
                              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span>{new Date(event.startDateTime).toLocaleString('pt-BR')}</span>
                            </div>
                            {event.endDateTime && (
                              <div className="flex items-center text-gray-400">
                                <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>Até: {new Date(event.endDateTime).toLocaleString('pt-BR')}</span>
                              </div>
                            )}
                            <div className="flex items-center text-gray-400">
                              <span className="font-medium">Tipo:</span>
                              <Badge className="ml-2 bg-blue-600">{event.eventType || 'N/A'}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 ml-4 flex-shrink-0">
                          <Button 
                            size="sm" 
                            onClick={() => updateEventMutation.mutate({ eventId: event.id, approvalStatus: "approved" })} 
                            className="bg-green-600 hover:bg-green-700 min-w-[100px]"
                            disabled={updateEventMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => updateEventMutation.mutate({ eventId: event.id, approvalStatus: "rejected" })}
                            disabled={updateEventMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(approvedEvents.length > 0 || rejectedEvents.length > 0) && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Processed Events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...approvedEvents, ...rejectedEvents].map((event: any) => (
                    <div key={event.id} className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{event.title}</h4>
                          <p className="text-sm text-gray-400">{event.location?.name} • {new Date(event.startDateTime).toLocaleDateString()}</p>
                        </div>
                        <Badge className={event.approvalStatus === 'approved' ? 'bg-green-600' : 'bg-red-600'}>
                          {event.approvalStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
              <CardContent>
                {Array.isArray(allUsers) && allUsers.length > 0 ? (
                  <div className="space-y-3">
                    {allUsers.map((user: any) => (
                      <div key={user.id} className="p-3 bg-slate-700/50 rounded-lg flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white">{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}</h4>
                          <p className="text-sm text-gray-400">{user.email}</p>
                        </div>
                        <Badge variant="secondary">{user.userType || "regular"}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No users found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scraping" className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Web Scraping - Popular Times
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-200">
                    <strong>⚠️ Atenção:</strong> Este processo busca horários de pico reais do Google Maps para os lugares cadastrados no Firestore.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => { setIsScraping(true); scrapeMutation.mutate(); }} 
                    disabled={isScraping} 
                    className="w-full" 
                    size="lg"
                  >
                  {isScraping ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Executando...</> : <><MapPin className="h-4 w-4 mr-2" /> Iniciar Scraping</>}
                </Button>
                  <Button 
                    onClick={handleStopScraping}
                    disabled={!isScraping}
                    variant="destructive"
                    className="w-full"
                    size="lg"
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Parar
                  </Button>
                </div>
                
                {/* Resumo do scraping */}
                {scrapingSummary && (
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <Card className="bg-slate-700 border-slate-600"><CardContent className="pt-4"><p className="text-sm text-gray-400">Total</p><p className="text-2xl font-bold">{scrapingSummary.total}</p></CardContent></Card>
                    <Card className="bg-green-900/20 border-green-800"><CardContent className="pt-4"><p className="text-sm text-green-300">Sucesso</p><p className="text-2xl font-bold text-green-400">{scrapingSummary.success}</p></CardContent></Card>
                    <Card className="bg-red-900/20 border-red-800"><CardContent className="pt-4"><p className="text-sm text-red-300">Erros</p><p className="text-2xl font-bold text-red-400">{scrapingSummary.errors}</p></CardContent></Card>
                    <Card className="bg-yellow-900/20 border-yellow-800"><CardContent className="pt-4"><p className="text-sm text-yellow-300">Pulados</p><p className="text-2xl font-bold text-yellow-400">{scrapingSummary.skipped}</p></CardContent></Card>
                  </div>
                )}
                
                {/* Item sendo processado atualmente */}
                {currentScraping && (
                  <Card className="bg-blue-900/20 border border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-blue-400 animate-spin" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-300">
                            Processando: {currentScraping.placeName}
                          </p>
                          <p className="text-xs text-blue-400">
                            {currentScraping.index}/{currentScraping.total}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Logs detalhados em tempo real */}
                {scrapingLogs.length > 0 && (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Logs de Processamento:</h4>
                    {scrapingLogs.map((log, index) => (
                      <Card 
                        key={index} 
                        className={`border ${
                          log.status === 'success' ? 'bg-green-900/10 border-green-800' :
                          log.status === 'error' ? 'bg-red-900/10 border-red-800' :
                          log.status === 'skipped' ? 'bg-yellow-900/10 border-yellow-800' :
                          'bg-slate-700/50 border-slate-600'
                        }`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {log.status === 'success' && <CheckCircle className="h-4 w-4 text-green-400" />}
                                {log.status === 'error' && <XCircle className="h-4 w-4 text-red-400" />}
                                {log.status === 'skipped' && <Clock className="h-4 w-4 text-yellow-400" />}
                                <span className="font-medium text-white">{log.placeName}</span>
                              </div>
                              <div className="space-y-1 text-xs text-gray-400">
                                {log.logs.map((logItem: string, logIndex: number) => (
                                  <p key={logIndex}>{logItem}</p>
                                ))}
                              </div>
                              {log.data && (
                                <div className="mt-2 text-xs">
                                  <Badge className="bg-green-700">Dias: {log.data.totalDays}</Badge>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-xs text-gray-500">
                                {log.duration}ms
                              </div>
                              <div className="flex gap-1">
                                {!log.googleMapsUri && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingPlace({ id: log.placeId, name: log.placeName });
                                          setManualGoogleMapsUrl('');
                                        }}
                                        className="text-xs"
                                      >
                                        <Edit className="h-3 w-3 mr-1" /> URL
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Adicionar URL do Google Maps</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div>
                                          <Label>Nome do Lugar: {log.placeName}</Label>
                                        </div>
                                        <div>
                                          <Label>URL do Google Maps:</Label>
                                          <Input
                                            type="url"
                                            placeholder="https://maps.google.com/..."
                                            value={manualGoogleMapsUrl}
                                            onChange={(e) => setManualGoogleMapsUrl(e.target.value)}
                                          />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                          <Button 
                                            variant="outline"
                                            onClick={() => setEditingPlace(null)}
                                          >
                                            Cancelar
                                          </Button>
                                          <Button 
                                            onClick={() => {
                                              updateGoogleMapsUriMutation.mutate({
                                                placeId: log.placeId,
                                                googleMapsUri: manualGoogleMapsUrl
                                              });
                                            }}
                                            disabled={!manualGoogleMapsUrl}
                                          >
                                            Salvar
                                          </Button>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                {(log.status === 'error' || log.status === 'skipped' || !log.data) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updatePlaceMutation.mutate(log.placeId)}
                                    disabled={updatingPlaces.has(log.placeId)}
                                    className="text-xs"
                                  >
                                    {updatingPlaces.has(log.placeId) ? (
                                      <>
                                        <Clock className="h-3 w-3 mr-1 animate-spin" /> Atualizando...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-3 w-3 mr-1" /> Update
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {log.error && (
                            <div className="mt-2 text-xs text-red-400">
                              ❌ {log.error}
                    </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation currentPage="/admin" />
    </div>
  );
}