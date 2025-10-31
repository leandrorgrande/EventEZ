import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Edit,
  Trash,
  Download
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
  const [debugEventsData, setDebugEventsData] = useState<any>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [updatePlaceLogs, setUpdatePlaceLogs] = useState<Record<string, string[]>>({});
  const { data: allPlaces = [], refetch: refetchPlaces } = useQuery({
    queryKey: ["/api/places-admin"],
    enabled: true,
    queryFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      const response = await fetch(`${API_URL}/places`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(`Failed to fetch places: ${response.status}`);
      return response.json();
    }
  });

  // Controles de filtro/ordenação/paginação para Places
  const [placesFilter, setPlacesFilter] = useState<'all' | 'semTipo' | 'comTipo'>('all');
  const [dataFilter, setDataFilter] = useState<'all' | 'missingHours' | 'missingRating' | 'missingAny' | 'complete'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [placeTypeFilter, setPlaceTypeFilter] = useState<string>('all');
  const [placesSort, setPlacesSort] = useState<'none' | 'manual_desc' | 'auto_desc' | 'manual_asc' | 'auto_asc' | 'rating_desc' | 'rating_asc' | 'reviews_desc' | 'reviews_asc' | 'name_asc' | 'name_desc' | 'updated_desc' | 'updated_asc' | 'hours_desc' | 'hours_asc'>('none');
  const [dateFilter, setDateFilter] = useState<'all' | 'neverHours' | 'neverPopAuto' | 'neverPopManual'>('all');
  const [compactView, setCompactView] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);

  const toMillis = (ts: any): number => ts?.toMillis ? ts.toMillis() : (ts?._seconds ? ts._seconds * 1000 : 0);
  const filteredSortedPlaces = Array.isArray(allPlaces) ? allPlaces
    .filter((p: any) => {
      // Filtro por tipo definido manualmente
      if (placesFilter === 'semTipo') return !(p.types && p.types.length);
      if (placesFilter === 'comTipo') return (p.types && p.types.length);
      // Filtro por tipo de lugar (bar, night_club, restaurant, cafe, ...)
      if (placeTypeFilter !== 'all') {
        const tArr = Array.isArray(p.types) ? p.types.map((x: string) => (x || '').toLowerCase()) : [];
        if (!tArr.includes((placeTypeFilter || '').toLowerCase())) return false;
      }
      // Filtro por cidade (por endereço formatado ou campo city, quando existir)
      if (cityFilter !== 'all') {
        const addr = String(p.formattedAddress || p.address || '').toLowerCase();
        const cityVal = String(p.city || '').toLowerCase();
        const needle = cityFilter.toLowerCase();
        if (!(addr.includes(needle) || cityVal.includes(needle))) return false;
      }
      // Filtros por dados coletados
      const hasHours = !!p.openingHours;
      const hasRating = typeof p.rating === 'number';
      if (dataFilter === 'missingHours' && hasHours) return false;
      if (dataFilter === 'missingRating' && hasRating) return false;
      if (dataFilter === 'missingAny' && (hasHours && hasRating)) return false;
      if (dataFilter === 'complete' && (!hasHours || !hasRating)) return false;
      // Filtro por datas específicas
      if (dateFilter === 'neverHours' && toMillis(p.hoursUpdatedAt)) return false;
      if (dateFilter === 'neverPopAuto' && toMillis(p.popularityAutoUpdatedAt)) return false;
      if (dateFilter === 'neverPopManual' && toMillis(p.popularityManualUpdatedAt)) return false;
      return true;
    })
    .slice()
    .sort((a: any, b: any) => {
      const aAuto = toMillis(a.popularityAutoUpdatedAt);
      const bAuto = toMillis(b.popularityAutoUpdatedAt);
      const aManual = toMillis(a.popularityManualUpdatedAt);
      const bManual = toMillis(b.popularityManualUpdatedAt);
      const aUpdated = toMillis(a.updatedAt);
      const bUpdated = toMillis(b.updatedAt);
      const aHours = toMillis(a.hoursUpdatedAt);
      const bHours = toMillis(b.hoursUpdatedAt);
      const aRating = typeof a.rating === 'number' ? a.rating : -1;
      const bRating = typeof b.rating === 'number' ? b.rating : -1;
      const aReviews = typeof a.userRatingsTotal === 'number' ? a.userRatingsTotal : -1;
      const bReviews = typeof b.userRatingsTotal === 'number' ? b.userRatingsTotal : -1;
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      switch (placesSort) {
        case 'manual_desc': return bManual - aManual;
        case 'manual_asc': return aManual - bManual;
        case 'auto_desc': return bAuto - aAuto;
        case 'auto_asc': return aAuto - bAuto;
        case 'hours_desc': return bHours - aHours;
        case 'hours_asc': return aHours - bHours;
        case 'rating_desc': return (bRating - aRating);
        case 'rating_asc': return (aRating - bRating);
        case 'reviews_desc': return (bReviews - aReviews);
        case 'reviews_asc': return (aReviews - bReviews);
        case 'name_asc': return aName.localeCompare(bName);
        case 'name_desc': return bName.localeCompare(aName);
        case 'updated_desc': return bUpdated - aUpdated;
        case 'updated_asc': return aUpdated - bUpdated;
        default: return 0;
      }
    }) : [];

  const totalPages = Math.max(1, Math.ceil(filteredSortedPlaces.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredSortedPlaces.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const deletePlaceMutation = useMutation({
    mutationFn: async (docId: string) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_URL}/places/${docId}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Lugar excluído', description: 'O lugar foi removido com sucesso.' });
      refetchPlaces();
    },
    onError: (err: any) => toast({ title: 'Erro ao excluir', description: err.message || String(err), variant: 'destructive' })
  });

  const updateTypesMutation = useMutation({
    mutationFn: async ({ docId, types }: { docId: string; types: string[] }) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_URL}/places/${docId}/types`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify({ types }) });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Tipo atualizado', description: 'Tipos do lugar atualizados.' });
      refetchPlaces();
    },
    onError: (err: any) => toast({ title: 'Erro ao atualizar tipo', description: err.message || String(err), variant: 'destructive' })
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, userType }: { userId: string; userType: 'admin' | 'regular' | 'business' }) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_URL}/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userType })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Permissão atualizada', description: 'O tipo de usuário foi alterado.' });
    },
    onError: (err: any) => toast({ title: 'Erro ao atualizar permissão', description: err.message || String(err), variant: 'destructive' })
  });
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  // SerpApi import (one-time) states
  const [serpApiKey, setSerpApiKey] = useState<string>("");
  const [serpImporting, setSerpImporting] = useState(false);
  const [serpResults, setSerpResults] = useState<any | null>(null);
  const [serpLimit, setSerpLimit] = useState<number>(50);

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

  // Import Popular Times via SerpApi (one-time, sequential)
  const importSerpApiMutation = useMutation({
    mutationFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      setSerpResults(null);
      const body: any = {
        limit: serpLimit,
        type: 'bar',
        areaIncludes: 'Gonzaga',
      };
      if (serpApiKey) body.apiKey = serpApiKey; // opcional, não persiste
      const response = await fetch(`${API_URL}/places/popular-times/import-once`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'Falha ao importar via SerpApi');
      }
      return response.json();
    },
    onMutate: () => setSerpImporting(true),
    onSuccess: (data) => {
      setSerpResults(data);
      toast({ title: 'Importação concluída', description: `${data.updated} atualizados, ${data.failed} falhas (de ${data.total})` });
    },
    onError: (error: any) => {
      toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
    },
    onSettled: () => setSerpImporting(false),
  });

  // Import Popular Times para uma linha
  const importOnePopularityMutation = useMutation({
    mutationFn: async ({ docId, apiKey }: { docId: string; apiKey?: string }) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_URL}/places/${docId}/popular-times/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(apiKey ? { apiKey } : {})
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: 'Importação (linha) concluída', description: data?.source ? `Fonte: ${data.source}` : 'OK' });
      refetchPlaces();
    },
    onError: (err: any) => toast({ title: 'Erro na importação (linha)', description: err.message || String(err), variant: 'destructive' })
  });

  // Import Popular Times (linha) via Outscraper (forçado)
  const importOneOutscraperMutation = useMutation({
    mutationFn: async (docId: string) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_URL}/places/${docId}/popular-times/import?provider=outscraper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({})
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: 'Importação (linha) concluída', description: data?.source ? `Fonte: ${data.source}` : 'OK' });
      refetchPlaces();
    },
    onError: (err: any) => toast({ title: 'Erro na importação (linha)', description: err.message || String(err), variant: 'destructive' })
  });

  // Atualizar horários/avaliações (por lugar)
  const updateHoursMutation = useMutation({
    mutationFn: async (docId: string) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_URL}/places/${docId}/update-hours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data;
    },
    onSuccess: (data: any, docId: string) => {
      const u = data?.updated || {};
      toast({ title: 'Horários/avaliações atualizados', description: `horários: ${u.openingHours ? 'ok' : '—'} • rating: ${u.rating ? 'ok' : '—'} • reviews: ${u.userRatingsTotal ? 'ok' : '—'}` });
      // Guardar logs por docId, se disponíveis
      const key = data?.id || docId;
      if (data?.logs && Array.isArray(data.logs) && key) {
        setUpdatePlaceLogs(prev => ({ ...prev, [key]: data.logs }));
      }
      refetchPlaces();
    },
    onError: (err: any) => toast({ title: 'Erro ao atualizar', description: err.message || String(err), variant: 'destructive' })
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

  // Função para buscar eventos em modo debug
  const fetchDebugEvents = async () => {
    try {
      setIsLoadingDebug(true);
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      console.log('[Admin] Buscando eventos em modo debug...');
      
      const response = await fetch(`${API_URL}/events/debug`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Admin] Erro na resposta:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Admin] Dados de debug recebidos:', data);
      setDebugEventsData(data);
      toast({ 
        title: "Debug concluído", 
        description: `${data.total} eventos encontrados no Firestore` 
      });
    } catch (error: any) {
      console.error('[Admin] Erro ao buscar eventos debug:', error);
      toast({ 
        title: "Erro no debug", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsLoadingDebug(false);
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-gray-400">Manage users, events, and business claims</p>
            </div>
          </div>
          <Button 
            onClick={() => window.location.href = '/admin/popular-times'}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Clock className="h-4 w-4 mr-2" />
            Popular Times
          </Button>
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
            <TabsTrigger value="places" className="data-[state=active]:bg-slate-700">Places</TabsTrigger>
          </TabsList>
          <TabsContent value="places" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Gerenciar Lugares
                  <span className="text-xs text-gray-400 ml-2">{Array.isArray(allPlaces) ? allPlaces.length : 0}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap items-center">
                  <Button onClick={() => importSerpApiMutation.mutate()} disabled={serpImporting} className="bg-blue-600 hover:bg-blue-700">
                    {serpImporting ? <><Clock className="h-4 w-4 mr-2 animate-spin"/>Importando...</> : <><Download className="h-4 w-4 mr-2"/>Importar Popular Times (bulk)</>}
                  </Button>
                  {/* Filtro Tipo */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">Filtro:</span>
                    <Select value={placesFilter} onValueChange={(v) => { setPage(1); setPlacesFilter(v as any); }}>
                      <SelectTrigger className="h-8 bg-slate-600 border-slate-500 text-white w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600 text-white">
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="semTipo">Sem tipo</SelectItem>
                        <SelectItem value="comTipo">Com tipo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                {/* Filtro de dados (horários/avaliação) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Dados:</span>
                  <Select value={dataFilter} onValueChange={(v) => { setPage(1); setDataFilter(v as any); }}>
                    <SelectTrigger className="h-8 bg-slate-600 border-slate-500 text-white w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 text-white">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="missingAny">Faltando horários OU avaliação</SelectItem>
                      <SelectItem value="missingHours">Faltando horários</SelectItem>
                      <SelectItem value="missingRating">Faltando avaliação</SelectItem>
                      <SelectItem value="complete">Completos (ambos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Filtro por datas (nunca atualizados) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Datas:</span>
                  <Select value={dateFilter} onValueChange={(v) => { setPage(1); setDateFilter(v as any); }}>
                    <SelectTrigger className="h-8 bg-slate-600 border-slate-500 text-white w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 text-white">
                      <SelectItem value="all">Sem filtro</SelectItem>
                      <SelectItem value="neverHours">Nunca atualizou horários</SelectItem>
                      <SelectItem value="neverPopAuto">Nunca popularidade (auto)</SelectItem>
                      <SelectItem value="neverPopManual">Nunca popularidade (manual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Filtro de Cidade */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Cidade:</span>
                  <Select value={cityFilter} onValueChange={(v) => { setPage(1); setCityFilter(v); }}>
                    <SelectTrigger className="h-8 bg-slate-600 border-slate-500 text-white w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 text-white">
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Santos">Santos</SelectItem>
                      <SelectItem value="São Vicente">São Vicente</SelectItem>
                      <SelectItem value="Guarujá">Guarujá</SelectItem>
                      <SelectItem value="Praia Grande">Praia Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Filtro de Tipo (igual à página principal) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Tipo:</span>
                  <Select value={placeTypeFilter} onValueChange={(v) => { setPage(1); setPlaceTypeFilter(v); }}>
                    <SelectTrigger className="h-8 bg-slate-600 border-slate-500 text-white w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 text-white">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="bar">bar</SelectItem>
                      <SelectItem value="night_club">night_club</SelectItem>
                      <SelectItem value="restaurant">restaurant</SelectItem>
                      <SelectItem value="cafe">cafe</SelectItem>
                      <SelectItem value="bakery">bakery</SelectItem>
                      <SelectItem value="movie_theater">movie_theater</SelectItem>
                      <SelectItem value="amusement_park">amusement_park</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  {/* Ordenação */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">Ordenar por:</span>
                    <Select value={placesSort} onValueChange={(v) => { setPage(1); setPlacesSort(v as any); }}>
                      <SelectTrigger className="h-8 bg-slate-600 border-slate-500 text-white w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600 text-white">
                        <SelectItem value="none">Sem ordenação</SelectItem>
                        <SelectItem value="manual_desc">Manual: mais recente</SelectItem>
                        <SelectItem value="manual_asc">Manual: mais antigo</SelectItem>
                        <SelectItem value="auto_desc">Auto: mais recente</SelectItem>
                        <SelectItem value="auto_asc">Auto: mais antigo</SelectItem>
                      <SelectItem value="hours_desc">Horários: mais recente</SelectItem>
                      <SelectItem value="hours_asc">Horários: mais antigo</SelectItem>
                      <SelectItem value="updated_desc">Atualizado: mais recente</SelectItem>
                      <SelectItem value="updated_asc">Atualizado: mais antigo</SelectItem>
                      <SelectItem value="rating_desc">Rating: maior</SelectItem>
                      <SelectItem value="rating_asc">Rating: menor</SelectItem>
                      <SelectItem value="reviews_desc">Reviews: maior</SelectItem>
                      <SelectItem value="reviews_asc">Reviews: menor</SelectItem>
                      <SelectItem value="name_asc">Nome: A → Z</SelectItem>
                      <SelectItem value="name_desc">Nome: Z → A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Tamanho da página */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">Por página:</span>
                    <Select value={String(pageSize)} onValueChange={(v) => { setPage(1); setPageSize(Number(v)); }}>
                      <SelectTrigger className="h-8 bg-slate-600 border-slate-500 text-white w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600 text-white">
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                        <SelectItem value="48">48</SelectItem>
                        <SelectItem value="96">96</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Modo compacto */}
                  <Button 
                    variant="secondary" 
                    className="h-8"
                    onClick={() => setCompactView(v => !v)}
                  >
                    {compactView ? 'Detalhar' : 'Compactar'}
                  </Button>
                </div>
                {Array.isArray(pageItems) && pageItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pageItems.map((p: any) => (
                      <div key={p.id} className="p-3 bg-slate-700/50 rounded border border-slate-600">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-white font-semibold truncate">{p.name}</div>
                            <div className="text-xs text-gray-400 truncate">{p.formattedAddress || ''}</div>
                            {compactView ? (
                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-300">
                                <div>Fonte: <span className="text-gray-200">{p.popularityProvider || p.dataSource || '—'}</span></div>
                                <div>Tipo: <span className="text-gray-200">{p.types?.[0] || '—'}</span></div>
                                <div>Auto: <span className="text-gray-200">{p.popularityAutoUpdatedAt?._seconds ? new Date(p.popularityAutoUpdatedAt._seconds*1000).toLocaleDateString('pt-BR') : '—'}</span></div>
                                <div>Manual: <span className="text-gray-200">{p.popularityManualUpdatedAt?._seconds ? new Date(p.popularityManualUpdatedAt._seconds*1000).toLocaleDateString('pt-BR') : '—'}</span></div>
                              </div>
                            ) : (
                              <>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-300">
                                  <div>Fonte: <span className="text-gray-200">{p.popularityProvider || p.dataSource || '—'}</span></div>
                                  <div>Auto done: <span className="text-gray-200">{p.popularityAutoDone ? 'sim' : 'não'}</span></div>
                                  <div>Auto em: <span className="text-gray-200">{p.popularityAutoUpdatedAt?._seconds ? new Date(p.popularityAutoUpdatedAt._seconds*1000).toLocaleString('pt-BR') : '—'}</span></div>
                                  <div>Manual em: <span className="text-gray-200">{p.popularityManualUpdatedAt?._seconds ? new Date(p.popularityManualUpdatedAt._seconds*1000).toLocaleString('pt-BR') : '—'}</span></div>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs text-gray-300">Tipo:</span>
                                  <Select value={(p.types?.[0]) || ''} onValueChange={(v) => updateTypesMutation.mutate({ docId: p.id, types: [v] })}>
                                    <SelectTrigger className="h-8 bg-slate-600 border-slate-500 text-white w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-700 border-slate-600 text-white">
                                      <SelectItem value="bar">bar</SelectItem>
                                      <SelectItem value="night_club">night_club</SelectItem>
                                      <SelectItem value="restaurant">restaurant</SelectItem>
                                      <SelectItem value="cafe">cafe</SelectItem>
                                      <SelectItem value="bakery">bakery</SelectItem>
                                      <SelectItem value="movie_theater">movie_theater</SelectItem>
                                      <SelectItem value="amusement_park">amusement_park</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <Button variant="secondary" size="sm" onClick={() => importOnePopularityMutation.mutate({ docId: p.id, apiKey: serpApiKey || undefined })}>
                              <Download className="h-4 w-4 mr-1" /> Buscar API (linha)
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => importOneOutscraperMutation.mutate(p.id)} disabled={importOneOutscraperMutation.isPending}>
                              <Download className="h-4 w-4 mr-1" /> Buscar via Outscraper
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => updateHoursMutation.mutate(p.id)} disabled={updateHoursMutation.isPending}>
                              <Clock className="h-4 w-4 mr-1" /> Atualizar horários/avaliações
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deletePlaceMutation.mutate(p.id)}>
                              <Trash className="h-4 w-4 mr-1" /> Excluir
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-400">rating: {p.rating ?? '—'} • reviews: {p.userRatingsTotal ?? 0}</div>
                        {(!p.openingHours || !p.rating) ? (
                          <div className="mt-1 text-[11px]">
                            {!p.openingHours && <span className="text-yellow-400 mr-2">• faltam horários</span>}
                            {!p.rating && <span className="text-yellow-400">• falta avaliação</span>}
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-green-400">• dados de horários/avaliação ok</div>
                        )}
                        {updatePlaceLogs[p.id]?.length ? (
                          <div className="mt-2 text-[11px] text-gray-300 space-y-1">
                            {updatePlaceLogs[p.id].map((line, idx) => (
                              <div key={idx}>- {line}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400">Nenhum lugar encontrado</div>
                )}

                {/* Paginação */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-gray-400">
                    Página {currentPage} de {totalPages} • {filteredSortedPlaces.length} lugares
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >Anterior</Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >Próxima</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {/* Botão de Debug */}
            <Card className="bg-blue-900/20 border-2 border-blue-700">
              <CardHeader>
                <CardTitle className="text-blue-400 flex items-center justify-between">
                  <span>🔍 Debug de Eventos</span>
                  <Button 
                    onClick={fetchDebugEvents} 
                    disabled={isLoadingDebug}
                    variant="outline"
                    size="sm"
                  >
                    {isLoadingDebug ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" /> Carregando...
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-2" /> Buscar Eventos (Debug)
                      </>
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              {debugEventsData && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-700 rounded p-3">
                        <p className="text-xs text-gray-400">Total Firestore</p>
                        <p className="text-2xl font-bold text-white">{debugEventsData.total}</p>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <p className="text-xs text-gray-400">Snapshot Size</p>
                        <p className="text-2xl font-bold text-white">{debugEventsData.snapshotSize}</p>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <p className="text-xs text-gray-400">Collection Path</p>
                        <p className="text-sm font-bold text-white">{debugEventsData.collectionPath}</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-700 rounded p-4 max-h-96 overflow-y-auto">
                      <h4 className="text-sm font-semibold text-white mb-2">Eventos Encontrados:</h4>
                      {debugEventsData.events && debugEventsData.events.length > 0 ? (
                        <div className="space-y-2">
                          {debugEventsData.events.map((event: any, idx: number) => (
                            <div key={idx} className="bg-slate-800 rounded p-3 text-xs">
                              <p className="text-white font-semibold">ID: {event.id}</p>
                              <p className="text-gray-300">Title: {event.title || 'N/A'}</p>
                              <p className="text-gray-300">Status: <Badge className={
                                event.approvalStatus === 'approved' ? 'bg-green-600' :
                                event.approvalStatus === 'pending' ? 'bg-yellow-600' :
                                'bg-red-600'
                              }>{event.approvalStatus || 'N/A'}</Badge></p>
                              <p className="text-gray-400 mt-2">Dados completos:</p>
                              <pre className="text-xs text-gray-400 mt-1 overflow-x-auto">
                                {JSON.stringify(event, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400">Nenhum evento encontrado</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

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
                        <div className="min-w-0">
                          <h4 className="font-medium text-white truncate">{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}</h4>
                          <p className="text-sm text-gray-400 truncate">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-300">Permissão</span>
                          <Select
                            value={user.userType || 'regular'}
                            onValueChange={(v) => updateUserRoleMutation.mutate({ userId: user.id, userType: v as any })}
                          >
                            <SelectTrigger className="h-8 w-36 bg-slate-600 border-slate-500 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600 text-white">
                              <SelectItem value="regular">regular</SelectItem>
                              <SelectItem value="business">business</SelectItem>
                              <SelectItem value="admin">admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No users found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Removed Scraping tab */}
        </Tabs>
      </div>

      <BottomNavigation currentPage="/admin" />
    </div>
  );
}