import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import BottomNavigation from "@/components/BottomNavigation";
import { Loader2, Calendar as CalendarIcon, Clock, Filter, MapPin, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Coordenadas de Santos, SP
const SANTOS_CENTER = { lat: -23.9608, lng: -46.3332 };

// Rota aproximada da Rua Tolentino Filgueiras (Santos, SP) para decoração especial
// Pontos aproximados de oeste para leste
const HALLOWEEN_TOLENTINO_POINTS: Array<{ lat: number; lng: number }> = [
  // Traçado entre (-23.964271, -46.334800) e (-23.964840, -46.329028)
  { lat: -23.964271, lng: -46.3348 },
  { lat: -23.964334222, lng: -46.334158667 },
  { lat: -23.964397444, lng: -46.333517333 },
  { lat: -23.964460666, lng: -46.332876 },
  { lat: -23.964523888, lng: -46.332234667 },
  { lat: -23.96458711, lng: -46.331593333 },
  { lat: -23.964650332, lng: -46.330952 },
  { lat: -23.964713554, lng: -46.330310667 },
  { lat: -23.964776776, lng: -46.329669333 },
  { lat: -23.96484, lng: -46.329028 },
];

interface Place {
  id: string;
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  popularTimes?: {
    monday: number[];
    tuesday: number[];
    wednesday: number[];
    thursday: number[];
    friday: number[];
    saturday: number[];
    sunday: number[];
  };
  types: string[];
  // Campos adicionais usados no componente
  rating?: number;
  userRatingsTotal?: number;
  formattedAddress?: string;
  openingHours?: Record<string, any>;
}

interface ApprovedEvent {
  id: string;
  title: string;
  approvalStatus?: string;
  startDateTime?: string;
  endDateTime?: string;
  latitude?: number | string;
  longitude?: number | string;
  location?: { latitude?: number | string; longitude?: number | string; name?: string };
}

// Permitir uso global da API do Google Maps
declare const google: any;

export default function MapaCalor() {
  const [map, setMap] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [eventMarkers, setEventMarkers] = useState<any[]>([]);
  const [customOverlays, setCustomOverlays] = useState<any[]>([]);
  const markersMap = useRef<Map<string, { marker: any; infoWindow: any }>>(new Map()); // Mapa de placeId -> marker/infoWindow
  const mapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [updateSummary, setUpdateSummary] = useState<{ total: number; updated: number; errors: number; current?: string } | null>(null);
  const updateAbortRef = useRef<AbortController | null>(null);

  // Obter horário atual de Brasília
  const getBrasiliaTime = () => {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return brasiliaTime;
  };

  // Função para converter Date para dia da semana em inglês
  const getWeekdayFromDate = (date: Date): string => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[date.getDay()];
  };

  const brasiliaTime = getBrasiliaTime();

  // Controles de tempo
  const [selectedDate, setSelectedDate] = useState<Date>(brasiliaTime); // Padrão: Data atual
  const [selectedHour, setSelectedHour] = useState<number>(brasiliaTime.getHours()); // Padrão: Hora atual
  const [selectedType, setSelectedType] = useState<string>('bar'); // Filtro de tipo (default: Bares)
  const [selectedCity, setSelectedCity] = useState<string>('Santos'); // Filtro de cidade (default: Santos)
  const [statusFilter, setStatusFilter] = useState<'all' | 'openOnly' | 'closed' | 'tranquilo' | 'moderado' | 'movimentado' | 'muitoCheio'>('all'); // Filtro de status (default: Todos)
  const [minRating, setMinRating] = useState<number>(0); // Filtro de avaliação mínima
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false); // Controle de expansão dos filtros - padrão fechado

  // Calcular dia da semana a partir da data selecionada
  const selectedDay = getWeekdayFromDate(selectedDate);

  // Debug: Log do horário de Brasília
  useEffect(() => {
    console.log('[MapaCalor] Data selecionada:', selectedDate);
    console.log('[MapaCalor] Dia da semana (backend):', selectedDay);
    console.log('[MapaCalor] Hora selecionada:', selectedHour);
  }, [selectedDate, selectedDay, selectedHour]);

  // Buscar lugares
  const { data: places, isLoading, refetch } = useQuery<Place[]>({
    queryKey: ['/api/places'],
    queryFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const response = await fetch(`${API_URL}/places`);
      if (!response.ok) throw new Error('Failed to fetch places');
      return response.json();
    },
  });

  // Buscar eventos aprovados para exibir no mapa
  const { data: events = [] } = useQuery<ApprovedEvent[]>({
    queryKey: ["/api/events-map"],
    queryFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_URL}/events`, { headers }); // por padrão já traz apenas aprovados
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });
  const eventsArray: ApprovedEvent[] = Array.isArray(events) ? events : [];

  // Buscar lugares automaticamente se estiver vazio
  const searchPlacesMutation = useMutation({
    mutationFn: async (payload: any) => {
      const type = typeof payload === 'string' ? payload : payload?.locationType;
      console.log('[MapaCalor] Buscando lugares do tipo:', type);
      
      try {
        const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
        const body: any = { locationType: type };
        if (typeof payload === 'object' && payload?.center) {
          body.center = payload.center;
          if (payload.radiusMeters) body.radiusMeters = payload.radiusMeters;
          if (payload.rank) body.rank = payload.rank;
        }
        const response = await fetch(`${API_URL}/places/search-santos`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          },
          body: JSON.stringify(body)
        });
        
        console.log('[MapaCalor] Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[MapaCalor] Erro na resposta:', errorText);
          throw new Error(`Failed to search places: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[MapaCalor] Dados recebidos:', data);
        return data;
      } catch (error) {
        console.error('[MapaCalor] Erro ao buscar lugares:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('[MapaCalor] Busca bem-sucedida, refazendo query');
      refetch();
      toast({
        title: "Lugares carregados!",
        description: `${data.count || 0} lugares encontrados`,
      });
    },
    onError: (error: any) => {
      console.error('[MapaCalor] Erro na mutation:', error);
      toast({
        title: "Erro ao carregar lugares",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  // Carregar lugares automaticamente na primeira vez
  useEffect(() => {
    if (places && places.length === 0 && !searchPlacesMutation.isPending) {
      // Só dispara a busca inicial se o usuário estiver autenticado (endpoint exige token)
      if (!auth.currentUser) {
        console.log('[MapaCalor] Usuário não autenticado - não disparar busca inicial protegida');
        return;
      }
      console.log('[MapaCalor] Banco vazio, buscando lugares iniciais');
      toast({
        title: "Carregando lugares...",
        description: "Buscando bares em Santos",
      });
      searchPlacesMutation.mutate('bars');
    } else if (places && places.length > 0) {
      console.log('[MapaCalor] Usando', places.length, 'lugares do Firestore');
    }
  }, [places]);

  // Filtrar lugares (FORA do useEffect para usar na lista)
  const placesArray = Array.isArray(places) ? places : [];
  const filteredPlaces = selectedType === 'event'
    ? []
    : placesArray.filter(place => {
          // Filtro de tipo
          if (selectedType !== 'all' && (!place.types || !place.types.includes(selectedType))) {
            return false;
          }
          // Filtro de cidade
          if (selectedCity && selectedCity !== 'all') {
            const cityMatch = place.formattedAddress?.toLowerCase().includes(selectedCity.toLowerCase()) ||
                             (place as any).city?.toLowerCase().includes(selectedCity.toLowerCase());
            if (!cityMatch) return false;
          }
          // Filtro de avaliação
          if (minRating > 0 && (!place.rating || place.rating < minRating)) {
            return false;
          }
          // Cálculo de status para filtragem por legenda
          const dayKey: any = selectedDay;
          const dayHours = (place as any).openingHours?.[dayKey];
          const isClosedAllDay = dayHours?.closed === true;
          const rawPopularity = (place as any).popularTimes?.[dayKey]?.[selectedHour];
          const popularity = rawPopularity !== undefined ? rawPopularity : 0;
          if (statusFilter === 'openOnly') {
            if (isClosedAllDay) return false;
          } else if (statusFilter === 'closed') {
            if (!isClosedAllDay) return false;
          } else if (statusFilter === 'tranquilo') {
            if (isClosedAllDay || popularity >= 40) return false;
          } else if (statusFilter === 'moderado') {
            if (isClosedAllDay || popularity < 40 || popularity >= 60) return false;
          } else if (statusFilter === 'movimentado') {
            if (isClosedAllDay || popularity < 60 || popularity >= 80) return false;
          } else if (statusFilter === 'muitoCheio') {
            if (isClosedAllDay || popularity < 80) return false;
          }
        return true;
      });

  // Debug: Log quando places mudar
  useEffect(() => {
    console.log('[MapaCalor] Places atualizados:', places?.length || 0, 'lugares');
    console.log('[MapaCalor] isLoading:', isLoading);
    console.log('[MapaCalor] auth.currentUser:', !!auth.currentUser);
    console.log('[MapaCalor] filteredPlaces length:', filteredPlaces?.length || 0);
    if (places && places.length > 0) {
      console.log('[MapaCalor] Primeiro lugar:', places[0]);
      console.log('[MapaCalor] Primeiro lugar tem popularTimes?', !!places[0].popularTimes);
      console.log('[MapaCalor] Primeiro lugar tem openingHours?', !!places[0].openingHours);
    }
  }, [places, isLoading]);

  // Funções auxiliares - definidas antes dos useEffects
  const getDayLabel = (day: string): string => {
    const labels: Record<string, string> = {
      monday: 'Segunda-feira',
      tuesday: 'Terça-feira',
      wednesday: 'Quarta-feira',
      thursday: 'Quinta-feira',
      friday: 'Sexta-feira',
      saturday: 'Sábado',
      sunday: 'Domingo'
    };
    return labels[day] || day;
  };

  // Converter horário de 12h para 24h (formato brasileiro)
  const convertTo24h = (time12h: string): string => {
    if (!time12h) return '';
    // Remove espaços e converte
    const time = time12h.trim();
    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return time; // Se não estiver no formato esperado, retorna original
    
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[3].toUpperCase();
    
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  // Calcular próximo horário de abertura se estiver fechado
  const getNextOpeningTime = (place: Place, currentDay: string, currentHour: number): { time: string; isToday: boolean } | null => {
    if (!place.openingHours || !place.openingHours[currentDay]) return null;
    
    const dayHours = place.openingHours[currentDay];
    // Verifica se tem horário de abertura (mesmo que esteja fechado agora)
    if (dayHours.open && !dayHours.closed) {
      const openTime = convertTo24h(dayHours.open);
      const openHour = parseInt(openTime.split(':')[0]);
      
      // Se ainda vai abrir hoje (horário futuro)
      if (openHour > currentHour) {
        return { time: openTime, isToday: true };
      }
    }
    
    // Se já passou, verifica próximo dia
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayIndex = days.indexOf(currentDay);
    
    for (let i = 1; i <= 7; i++) {
      const nextDayIndex = (currentDayIndex + i) % 7;
      const nextDay = days[nextDayIndex];
      const nextDayHours = place.openingHours[nextDay];
      
      if (nextDayHours && !nextDayHours.closed && nextDayHours.open) {
        const openTime = convertTo24h(nextDayHours.open);
        const dayLabel = getDayLabel(nextDay);
        return { time: `${dayLabel} às ${openTime}`, isToday: false };
      }
    }
    
    return null;
  };

  // Função para abrir InfoWindow ao clicar na lista
  const openInfoWindowForPlace = (place: Place) => {
    const markerData = markersMap.current.get(place.id);
    if (markerData && markerData.infoWindow && map) {
      markerData.infoWindow.open(map, markerData.marker);
    }
  };

  // Inicializar Google Maps
  useEffect(() => {
    if (!mapRef.current) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";

    const loadGoogleMaps = () => {
      if (typeof google !== 'undefined' && google.maps) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        toast({
          title: "Erro ao carregar mapa",
          description: "Verifique sua conexão e a API key",
          variant: "destructive",
        });
      };
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      const mapInstance = new google.maps.Map(mapRef.current!, {
        center: SANTOS_CENTER,
        zoom: 14,
        mapTypeId: 'roadmap',
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });

      setMap(mapInstance);
    };

    loadGoogleMaps();
  }, [toast]);

  // (sem listener extra)

  // Atualizar heatmap quando mudar dia, hora ou lugares
  useEffect(() => {
    if (!map) return;

    // Limpar heatmap anterior
    if (heatmap) {
      heatmap.setMap(null);
    }

    // Limpar marcadores anteriores
    markers.forEach(marker => marker.setMap(null));
    eventMarkers.forEach(marker => marker.setMap(null));
    customOverlays.forEach(overlay => overlay.setMap && overlay.setMap(null));
    markersMap.current.clear(); // Limpar mapa de referências

    // Gerar dados do heatmap
    const heatmapData: any[] = [];
    const newMarkers: any[] = [];
    const newEventMarkers: any[] = [];
    const newCustomOverlays: any[] = [];

    // Renderizar lugares (heatmap + marcadores por popularidade/fechado)
    if (filteredPlaces && filteredPlaces.length > 0) {
      filteredPlaces.forEach(place => {
      if (!place.latitude || !place.longitude) return;

      const dayKey = selectedDay;
      // Checar fechado o dia todo e disponibilidade de popularidade
      const isClosedAllDay = (place as any).openingHours?.[dayKey]?.closed === true;
      const rawPopularity = place.popularTimes?.[dayKey as keyof typeof place.popularTimes]?.[selectedHour];
      const hasPopularity = rawPopularity !== undefined;
      const popularity = hasPopularity ? rawPopularity : 0;
      // popularidade calculada; fechado o dia todo controlado por isClosedAllDay

      // Adicionar ao heatmap com peso baseado na popularidade
      const location = new (google as any).maps.LatLng(
        parseFloat(place.latitude.toString()),
        parseFloat(place.longitude.toString())
      );

      // Peso: popularidade / 100 (normalizado para 0-1)
      const weight = popularity / 100;

      // Adicionar múltiplos pontos para aumentar intensidade
      const intensity = Math.ceil(weight * 10);
      for (let i = 0; i < intensity; i++) {
        heatmapData.push({ location, weight });
      }

      // Adicionar marcador: sempre renderizar, mas distinguir entre fechado, com popularidade, ou sem dados
      // Se não tem popularTimes e não está fechado, assume tranquilo (popularity = 0)
      const shouldShowMarker = isClosedAllDay || hasPopularity || !place.popularTimes;
      if (shouldShowMarker) {
        // Escala do marcador: diminuir um pouco o vermelho e suavizar crescimento
        const baseScale = 6;
        const dynamicScale = baseScale + (popularity / 12);
        const scaleForVeryBusy = 10; // tamanho fixo mais discreto para "Muito Cheio"
        const finalScale = isClosedAllDay
          ? baseScale
          : (popularity >= 80 ? scaleForVeryBusy : dynamicScale);
        const marker = new google.maps.Marker({
          position: location,
          map,
          title: (isClosedAllDay) ? `${place.name} - 🔒 Fechado` : `${place.name} - ${getPopularityLabel(popularity)}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: finalScale, // Sem aumento adicional para "Muito Cheio"
            fillColor: (isClosedAllDay) ? '#000000' : getColorByPopularity(popularity),
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          // Sem animação para manter estático mesmo quando muito cheio
          animation: undefined,
        });

        // InfoWindow ao clicar (criar por marcador)
        const isClosedAllDayLocal = isClosedAllDay;
        const statusLabel = isClosedAllDayLocal ? '🔒 Fechado' : `Movimento ${getPopularityLabel(popularity)}`;
        const bgColor = isClosedAllDayLocal ? '#000000' : getColorByPopularity(popularity);
        
        // Calcular mensagem de horário condizente com status
        let timeInfo = '';
        if (isClosedAllDayLocal) {
          const nextOpening = getNextOpeningTime(place, selectedDay, selectedHour);
          if (nextOpening) {
            if (nextOpening.isToday) {
              timeInfo = `<p style="margin: 0; color: #10b981; font-size: 13px; font-weight: 600;">🕐 Abre às ${nextOpening.time}</p>`;
            } else {
              timeInfo = `<p style="margin: 0; color: #10b981; font-size: 13px; font-weight: 600;">🕐 Abre ${nextOpening.time}</p>`;
            }
          } else {
            timeInfo = `<p style="margin: 0; color: #6b7280; font-size: 13px;">📅 ${getDayLabel(selectedDay)}<br/>🕐 ${selectedHour.toString().padStart(2, '0')}:00</p>`;
          }
        } else {
          const dayHours = (place as any).openingHours?.[selectedDay as any];
          const closeTime24h = dayHours?.close ? convertTo24h(dayHours.close) : null;
          if (closeTime24h) {
            timeInfo = `<p style="margin: 0; color: #10b981; font-size: 13px; font-weight: 600;">🟢 Aberto até ${closeTime24h}</p>`;
          } else {
            timeInfo = `<p style="margin: 0; color: #6b7280; font-size: 13px;">📅 ${getDayLabel(selectedDay)}<br/>🕐 ${selectedHour.toString().padStart(2, '0')}:00</p>`;
          }
        }
        
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; font-family: Arial, sans-serif; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">${place.name}</h3>
              <div style="background: ${bgColor}; color: white; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; text-align: center;">
                <strong style="font-size: 16px;">${statusLabel}</strong>
              </div>
              ${timeInfo}
              ${place.formattedAddress ? `
                <p style=\"margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;\">
                  📍 ${place.formattedAddress}
                </p>
              ` : ''}
              <button 
                onclick=\"window.open('https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}', '_blank')\"
                style=\"margin-top: 10px; width: 100%; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;\"
              >
                Ver no Google Maps
              </button>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        // Armazenar marker e infoWindow para poder abrir ao clicar na lista
        markersMap.current.set(place.id, { marker, infoWindow });

        newMarkers.push(marker);
      }
      });
    }

    // Renderizar eventos aprovados (bolinha azul)
    if (Array.isArray(eventsArray) && eventsArray.length > 0) {
      eventsArray.forEach((ev) => {
        // Exibir eventos apenas se a data selecionada estiver dentro do intervalo do evento
        if (!(function(date: Date, startStr?: string, endStr?: string){
          if (!startStr) return false;
          const toYmd = (d: Date): string => {
            const local = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            const y = local.getFullYear();
            const m = String(local.getMonth() + 1).padStart(2, '0');
            const dd = String(local.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
          };
          const s = toYmd(new Date(startStr));
          const e = endStr ? toYmd(new Date(endStr)) : s;
          const sel = toYmd(date);
          return sel >= s && sel <= e;
        })(selectedDate, ev.startDateTime, ev.endDateTime)) return;
        const lat = ev.latitude ?? ev.location?.latitude;
        const lng = ev.longitude ?? ev.location?.longitude;
        const latNum = lat !== undefined ? parseFloat(lat.toString()) : undefined;
        const lngNum = lng !== undefined ? parseFloat(lng.toString()) : undefined;
        if (typeof latNum !== 'number' || isNaN(latNum) || typeof lngNum !== 'number' || isNaN(lngNum)) return;

        const location = new google.maps.LatLng(latNum, lngNum);
        const marker = new google.maps.Marker({
          position: location,
          map,
          title: `Evento: ${ev.title || ''}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14, // maior para dar mais destaque
            fillColor: '#2563EB', // azul mais forte
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          zIndex: 1000,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; font-family: Arial, sans-serif; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">🎫 ${ev.title || 'Evento'}</h3>
              ${ev.startDateTime ? `<p style=\"margin:0; color:#6b7280; font-size:13px;\">Início: ${new Date(ev.startDateTime).toLocaleString('pt-BR')}</p>` : ''}
              ${ev.endDateTime ? `<p style=\"margin:0; color:#6b7280; font-size:13px;\">Fim: ${new Date(ev.endDateTime).toLocaleString('pt-BR')}</p>` : ''}
              <p style="margin:6px 0 0 0; color:#1f2937; font-size:13px;"><strong>${(ev as any).attendeesCount || 0} pessoas vão</strong></p>
              <div style="margin-top:10px; display:flex; align-items:center; gap:8px;">
                <div style="width:10px; height:10px; border-radius:50%; background:#3B82F6;"></div>
                <span style="font-size:12px; color:#1f2937;">Evento</span>
              </div>
              <button 
                onclick=\"window.open('https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}', '_blank')\"
                style=\"margin-top: 10px; width: 100%; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;\"
              >
                Ver no Google Maps
              </button>
            </div>
          `
        });

        marker.addListener('click', () => infoWindow.open(map, marker));
        newEventMarkers.push(marker);
      });
    }

    // Decoração especial: Halloween em 04/11 na Rua Tolentino Filgueiras
    const isHalloweenTolentino = selectedDate.getDate() === 4 && selectedDate.getMonth() === 10; // 10 = Novembro
    if (isHalloweenTolentino) {
      // Distribuir morceguinhos ao longo da rua (pontos aproximados)
      HALLOWEEN_TOLENTINO_POINTS.forEach((pos) => {
        const marker = new google.maps.Marker({
          position: new google.maps.LatLng(pos.lat, pos.lng),
          map,
          label: {
            text: '🦇',
            color: '#ffffff',
            fontSize: '16px',
          },
          // Fundo azul (cor de evento) para destacar
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#3B82F6',
            fillOpacity: 0.95,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: 'Halloween na Tolentino Filgueiras',
          zIndex: 9999,
        });
        newCustomOverlays.push(marker);
      });

      // Traçar a rua com uma polyline azul (realce do trajeto)
      const polyline = new google.maps.Polyline({
        path: HALLOWEEN_TOLENTINO_POINTS.map((p) => new google.maps.LatLng(p.lat, p.lng)),
        geodesic: true,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.7,
        strokeWeight: 4,
      });
      polyline.setMap(map);
      newCustomOverlays.push(polyline);
    }

    // Criar novo heatmap
    const heatmapLayer = new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map,
      radius: 40, // Aumentado para cobrir mais área
      opacity: 0.8,
      maxIntensity: 10,
      dissipating: true,
      gradient: [
        'rgba(0, 255, 0, 0)',      // Transparente (baixa popularidade)
        'rgba(102, 255, 0, 0.4)',  // Verde claro
        'rgba(255, 255, 0, 0.6)',  // Amarelo (média)
        'rgba(255, 165, 0, 0.8)',  // Laranja (alta)
        'rgba(255, 69, 0, 0.9)',   // Laranja escuro
        'rgba(255, 0, 0, 1)'       // Vermelho (muito alta)
      ]
    });

    // Adicionar listener de clique no mapa para mostrar lugares próximos
    const mapClickListener = map.addListener('click', (e: any) => {
      if (!e.latLng) return;
      
      const clickedLat = e.latLng.lat();
      const clickedLng = e.latLng.lng();
      
      // Encontrar lugares próximos (raio de ~200m)
      const nearbyPlaces = (Array.isArray(filteredPlaces) ? filteredPlaces : []).filter(place => {
        if (!place.latitude || !place.longitude) return false;
        
        const lat = parseFloat(place.latitude.toString());
        const lng = parseFloat(place.longitude.toString());
        
        const distance = Math.sqrt(
          Math.pow(lat - clickedLat, 2) + Math.pow(lng - clickedLng, 2)
        );
        
        return distance < 0.002; // ~200m
      });
      
      if (nearbyPlaces.length > 0) {
        const dayKey: any = selectedDay;
        
        const placesHtml = nearbyPlaces
          .map(p => {
            const pop = (p as any).popularTimes?.[dayKey]?.[selectedHour] ?? 0;
            const closedAllDay = (p as any).openingHours?.[dayKey]?.closed === true;
            const statusLabel = closedAllDay ? '🔒 Fechado' : `Movimento ${getPopularityLabel(pop)}`;
            const statusColor = closedAllDay ? '#000000' : getColorByPopularity(pop);
            return `
              <div style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                <strong style="color: #1f2937;">${p.name}</strong>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                  <div style="width: 12px; height: 12px; border-radius: 50%; background: ${statusColor};"></div>
                  <span style="font-size: 13px; color: #6b7280;">${statusLabel}</span>
                </div>
              </div>
            `;
          })
          .join('');
        
        const areaInfoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; font-family: Arial, sans-serif; max-width: 250px;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 15px;">
                📍 ${nearbyPlaces.length} lugar(es) nesta área
              </h3>
              <div style="max-height: 200px; overflow-y: auto;">
                ${placesHtml}
              </div>
            </div>
          `,
          position: e.latLng
        });
        
        areaInfoWindow.open(map);
      }
    });

    setHeatmap(heatmapLayer);
    setMarkers(newMarkers);
    setEventMarkers(newEventMarkers);
    setCustomOverlays(newCustomOverlays);
    
    // Cleanup
    return () => {
      google.maps.event.removeListener(mapClickListener);
    };
  }, [map, places, events, selectedDay, selectedHour, selectedType, selectedCity, minRating, statusFilter]);

  // Funções auxiliares
  const getColorByPopularity = (popularity: number): string => {
    if (popularity >= 80) return '#ef4444'; // Vermelho
    if (popularity >= 60) return '#f97316'; // Laranja
    if (popularity >= 40) return '#eab308'; // Amarelo
    return '#22c55e'; // Verde
  };

  const getPopularityLabel = (popularity: number): string => {
    if (popularity >= 80) return 'Muito Cheio';
    if (popularity >= 60) return 'Movimentado';
    if (popularity >= 40) return 'Moderado';
    return 'Tranquilo';
  };

  const getHourLabel = (hour: number): string => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };


  return (
    <div className="min-h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Header com Controles */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 space-y-4">
        {/* Título e Botão de Colapsar */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Mapa de Calor - Santos
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {isLoading 
                ? 'Carregando...'
                : filteredPlaces && filteredPlaces.length > 0 
                  ? `${filteredPlaces.length} de ${places?.length || 0} lugares`
                  : places && places.length === 0
                    ? 'Nenhum lugar encontrado'
                    : 'Carregando...'}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="text-gray-400 hover:text-white"
          >
            {filtersExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Filtros
              </>
            )}
          </Button>
        </div>

        {/* Botões de Busca e Controles - Apenas se expandido */}
        {filtersExpanded && (
          <>
            {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {(isLoading || searchPlacesMutation.isPending) && (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => searchPlacesMutation.mutate('bars')}
                disabled={searchPlacesMutation.isPending}
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                + Bares
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => searchPlacesMutation.mutate('clubs')}
                disabled={searchPlacesMutation.isPending}
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                + Baladas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => searchPlacesMutation.mutate('food')}
                disabled={searchPlacesMutation.isPending}
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                + Restaurantes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => searchPlacesMutation.mutate('cafe')}
                disabled={searchPlacesMutation.isPending}
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                + Cafés/Padarias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!map) return;
                  const center = map.getCenter?.();
                  if (!center) return;
                  const lat = center.lat();
                  const lng = center.lng();
                  // Mapear o filtro atual para o backend
                  const typeMap: Record<string, string[]> = {
                    all: ['bars','clubs','food','cafe'],
                    bar: ['bars'],
                    night_club: ['clubs'],
                    restaurant: ['food'],
                    cafe: ['cafe'],
                    event: []
                  };
                  const targets = typeMap[selectedType] || ['bars'];
                  for (const t of targets) {
                    try {
                      await searchPlacesMutation.mutateAsync({
                        locationType: t,
                        center: { latitude: lat, longitude: lng },
                        radiusMeters: 900,
                        rank: 'DISTANCE'
                      } as any);
                    } catch (e) {
                      console.error('[MapaCalor] Buscar + na área erro:', e);
                    }
                  }
                }}
                disabled={searchPlacesMutation.isPending}
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                Buscar + na área
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (isUpdatingAll) {
                    updateAbortRef.current?.abort();
                    return;
                  }
                  try {
                    setIsUpdatingAll(true);
                    setUpdateSummary({ total: 0, updated: 0, errors: 0 });
                    const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
                    const token = await auth.currentUser?.getIdToken();
                    const controller = new AbortController();
                    updateAbortRef.current = controller;
                    const resp = await fetch(`${API_URL}/places/update-all-hours-stream`, {
                      method: 'POST',
                      headers: token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'text/event-stream' } : { 'Accept': 'text/event-stream' },
                      signal: controller.signal
                    });
                    if (!resp.ok || !resp.body) {
                      throw new Error(`HTTP ${resp.status}`);
                    }
                    const reader = resp.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    const processChunk = (text: string) => {
                      buffer += text;
                      const parts = buffer.split('\n\n');
                      buffer = parts.pop() || '';
                      for (const part of parts) {
                        const line = part.trim();
                        if (!line.startsWith('data:')) continue;
                        const jsonStr = line.slice(5).trim();
                        try {
                          const evt = JSON.parse(jsonStr);
                          if (evt.type === 'start') {
                            setUpdateSummary({ total: evt.total || 0, updated: 0, errors: 0 });
                          } else if (evt.type === 'progress') {
                            setUpdateSummary(prev => prev ? { ...prev, current: evt.placeName || prev.current, updated: evt.status === 'updated' ? prev.updated + 1 : prev.updated, errors: evt.status === 'error' ? prev.errors + 1 : prev.errors } : prev);
                          } else if (evt.type === 'end' || evt.type === 'cancelled') {
                            setUpdateSummary(prev => prev ? { ...prev, updated: evt.updated ?? prev.updated, errors: evt.errors ?? prev.errors } : prev);
                          }
                        } catch {}
                      }
                    };
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      processChunk(decoder.decode(value, { stream: true }));
                    }
                    toast({ title: 'Atualização concluída', description: `${(updateSummary?.updated) || 0} atualizados, ${(updateSummary?.errors) || 0} erros` });
                    refetch();
                  } catch (err: any) {
                    if (err.name === 'AbortError') {
                      toast({ title: 'Atualização interrompida', description: 'Processo cancelado.' });
                    } else {
                      toast({ title: 'Erro ao atualizar lugares', description: err.message || String(err), variant: 'destructive' });
                    }
                  } finally {
                    setIsUpdatingAll(false);
                    updateAbortRef.current = null;
                  }
                }}
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isUpdatingAll ? 'animate-spin' : ''}`} /> {isUpdatingAll ? 'Parar atualização' : 'Atualizar horários/avaliações'}
              </Button>
            </div>
            )}
            {isAdmin && updateSummary && (
              <div className="w-full text-xs text-gray-300 flex items-center justify-end gap-3 pr-1">
                <span>Total: {updateSummary.total}</span>
                <span className="text-green-400">Atualizados: {updateSummary.updated}</span>
                <span className="text-red-400">Erros: {updateSummary.errors}</span>
                {updateSummary.current && <span className="text-gray-400 truncate max-w-[40%]">Atual: {updateSummary.current}</span>}
              </div>
            )}

            {/* Controles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Data */}
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-4">
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
                <CalendarIcon className="h-4 w-4" />
                Data
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal bg-slate-600 border-slate-500 text-white hover:bg-slate-500"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-700 border-slate-600" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="text-white"
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 bg-slate-700",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium text-white",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-white",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-gray-400 rounded-md w-9 font-normal text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-slate-600 rounded-md text-white",
                      day_selected: "bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700",
                      day_today: "bg-slate-600 text-white",
                      day_outside: "text-gray-500 opacity-50",
                      day_disabled: "text-gray-500 opacity-50",
                      day_range_middle: "aria-selected:bg-slate-600 aria-selected:text-white",
                      day_hidden: "invisible",
                    }}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-400 mt-2">
                {getDayLabel(selectedDay)}
              </p>
            </CardContent>
          </Card>

          {/* Horário */}
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-4">
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4" />
                Horário: {getHourLabel(selectedHour)}
              </label>
              <Slider
                value={[selectedHour]}
                onValueChange={(value) => setSelectedHour(value[0])}
                min={0}
                max={23}
                step={1}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>00:00</span>
                <span>12:00</span>
                <span>23:00</span>
              </div>
            </CardContent>
          </Card>

          {/* Tipo de Estabelecimento */}
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-4">
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4" />
                Tipo
              </label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="bar">🍺 Bares</SelectItem>
                  <SelectItem value="night_club">🎉 Baladas</SelectItem>
                  <SelectItem value="restaurant">🍽️ Restaurantes</SelectItem>
                  <SelectItem value="cafe">☕ Cafés</SelectItem>
                  <SelectItem value="event">🎫 Eventos</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Cidade */}
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-4">
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4" />
                Cidade
              </label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Santos">Santos</SelectItem>
                  <SelectItem value="São Vicente">São Vicente</SelectItem>
                  <SelectItem value="Guarujá">Guarujá</SelectItem>
                  <SelectItem value="Praia Grande">Praia Grande</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Avaliação Mínima */}
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-4">
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
                ⭐ Avaliação Mínima
              </label>
              <Select value={minRating.toString()} onValueChange={(v) => setMinRating(Number(v))}>
                <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="0">Todas</SelectItem>
                  <SelectItem value="3">3.0+ ⭐⭐⭐</SelectItem>
                  <SelectItem value="3.5">3.5+ ⭐⭐⭐✨</SelectItem>
                  <SelectItem value="4">4.0+ ⭐⭐⭐⭐</SelectItem>
                  <SelectItem value="4.5">4.5+ ⭐⭐⭐⭐✨</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          
          {/* Status */}
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-4">
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
                🟢 Status
              </label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="openOnly">Apenas abertos</SelectItem>
                  <SelectItem value="tranquilo">Tranquilo</SelectItem>
                  <SelectItem value="moderado">Moderado</SelectItem>
                  <SelectItem value="movimentado">Movimentado</SelectItem>
                  <SelectItem value="muitoCheio">Muito Cheio</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

            {/* Legenda - Responsiva com scroll horizontal em mobile */}
            <div className="w-full overflow-x-auto">
              <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-300 min-w-max px-1">
                <span className="font-semibold whitespace-nowrap">Legenda:</span>
                <div className="flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-green-500 flex-shrink-0"></div>
                  <span>Tranquilo</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-yellow-500 flex-shrink-0"></div>
                  <span>Moderado</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-orange-500 flex-shrink-0"></div>
                  <span>Movimentado</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-red-500 flex-shrink-0"></div>
                  <span>Muito Cheio</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-black flex-shrink-0"></div>
                  <span>Fechado</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-500 flex-shrink-0"></div>
                  <span>Evento</span>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
      
      {/* Mapa - Altura fixa em mobile para permitir visualização da lista */}
      <div ref={mapRef} className="w-full h-[50vh] md:h-auto md:flex-1 md:min-h-0 mb-16" />

      {/* Navegação Fixa - Sempre visível na parte inferior */}
      <BottomNavigation currentPage="map" onNavigate={() => {}} />

      {/* Lista de Lugares e Eventos - Abaixo do mapa */}
      {((filteredPlaces && filteredPlaces.length > 0) || (events && events.length > 0)) && (
        <div className="bg-slate-800 p-3 md:p-4 border-t border-slate-700 max-h-[40vh] md:max-h-[300px] overflow-y-auto relative z-10">
          <h2 className="text-base md:text-lg font-bold text-white mb-2 md:mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
            Lugares e Eventos ({(filteredPlaces?.length || 0) + ((Array.isArray(eventsArray) ? eventsArray : []).filter((ev) => {
              if (!ev.startDateTime) return false;
              const toYmd = (d: Date): string => {
                const local = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                const y = local.getFullYear();
                const m = String(local.getMonth() + 1).padStart(2, '0');
                const dd = String(local.getDate()).padStart(2, '0');
                return `${y}-${m}-${dd}`;
              };
              const s = toYmd(new Date(ev.startDateTime));
              const e = ev.endDateTime ? toYmd(new Date(ev.endDateTime)) : s;
              const sel = toYmd(selectedDate);
              return sel >= s && sel <= e;
            }).length || 0)})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {/* Primeiro: Eventos (prioridade) */}
            {eventsArray && Array.isArray(eventsArray) && eventsArray
              .filter((ev) => {
                // Filtrar eventos que estão dentro do intervalo da data selecionada
                if (!ev.startDateTime) return false;
                const toYmd = (d: Date): string => {
                  const local = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                  const y = local.getFullYear();
                  const m = String(local.getMonth() + 1).padStart(2, '0');
                  const dd = String(local.getDate()).padStart(2, '0');
                  return `${y}-${m}-${dd}`;
                };
                const s = toYmd(new Date(ev.startDateTime));
                const e = ev.endDateTime ? toYmd(new Date(ev.endDateTime)) : s;
                const sel = toYmd(selectedDate);
                return sel >= s && sel <= e;
              })
              .map((ev) => {
                const lat = ev.latitude ?? ev.location?.latitude;
                const lng = ev.longitude ?? ev.location?.longitude;
                const latNum = lat !== undefined ? parseFloat(lat.toString()) : undefined;
                const lngNum = lng !== undefined ? parseFloat(lng.toString()) : undefined;
                if (typeof latNum !== 'number' || isNaN(latNum) || typeof lngNum !== 'number' || isNaN(lngNum)) return null;

                return (
                  <Card 
                    key={`event-${ev.id}`} 
                    className="bg-blue-900/30 border-blue-500 cursor-pointer hover:bg-blue-900/50 transition-colors hover:border-blue-400"
                    onClick={() => {
                      if (map && latNum && lngNum) {
                        map.panTo({ lat: latNum, lng: lngNum });
                        map.setZoom(16);
                        toast({
                          title: "🎫 " + (ev.title || 'Evento'),
                          description: `${(ev as any).attendeesCount || 0} pessoas vão`,
                        });
                      }
                    }}
                  >
                    <CardContent className="p-2 md:p-3">
                      <div className="flex items-start gap-2">
                        {/* Indicador azul para evento */}
                        <div 
                          className="w-3 h-3 md:w-4 md:h-4 rounded-full flex-shrink-0 mt-1 bg-blue-500" 
                        ></div>
                        
                        <div className="flex-1 min-w-0">
                          {/* Nome/Título do evento */}
                          <h3 className="text-sm md:text-md font-semibold text-white truncate">
                            🎫 {ev.title || 'Evento'}
                          </h3>
                          
                          {/* Data/horário */}
                          <div className="flex items-center gap-1 mt-1">
                            {ev.startDateTime && (
                              <span className="text-xs md:text-sm text-gray-300">
                                📅 {new Date(ev.startDateTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                {ev.startDateTime.includes('T') && ` ${new Date(ev.startDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                            )}
                          </div>
                          
                          {/* Localização */}
                          {(ev.location?.name || (ev.location as any)?.address) && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs md:text-sm text-gray-400">
                                📍 {ev.location?.name || (ev.location as any)?.address || ''}
                              </span>
                            </div>
                          )}
                          
                          {/* Contagem de participantes */}
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs md:text-sm font-bold text-blue-400">
                              👥 {(ev as any).attendeesCount || 0} {(ev as any).attendeesCount === 1 ? 'pessoa vai' : 'pessoas vão'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            
            {/* Depois: Lugares */}
            {filteredPlaces && filteredPlaces.map(place => {
              const dayKey = selectedDay;
              // Verificar primeiro se está fechado pelas openingHours
              const isClosedByHours = (place as any).openingHours?.[dayKey]?.closed === true;
              // Obter popularidade (0 se não existir ou se estiver fechado)
              const rawPopularity = place.popularTimes?.[dayKey as keyof typeof place.popularTimes]?.[selectedHour];
              const popularity = (rawPopularity !== undefined ? rawPopularity : 0);
              const isClosedAllDay = isClosedByHours;
              const color = isClosedAllDay ? '#000000' : getColorByPopularity(popularity);
              
              return (
                <Card 
                  key={place.id} 
                  className="bg-slate-700 border-slate-600 cursor-pointer hover:bg-slate-600 transition-colors hover:border-blue-500"
                  onClick={() => {
                    if (map && place.latitude && place.longitude) {
                      // Centralizar no lugar
                      map.panTo({ 
                        lat: parseFloat(place.latitude.toString()), 
                        lng: parseFloat(place.longitude.toString()) 
                      });
                      // Dar zoom
                      map.setZoom(16);
                      
                      // Abrir InfoWindow automaticamente
                      openInfoWindowForPlace(place);
                    }
                  }}
                >
                  <CardContent className="p-2 md:p-3">
                    <div className="flex items-start gap-2">
                      {/* Indicador de cor */}
                      <div 
                        className="w-3 h-3 md:w-4 md:h-4 rounded-full flex-shrink-0 mt-1" 
                        style={{ backgroundColor: color }}
                      ></div>
                      
                      <div className="flex-1 min-w-0">
                        {/* Nome */}
                        <h3 className="text-sm md:text-md font-semibold text-white truncate">
                          {place.name}
                        </h3>
                        
                        {/* Status de movimentação (sem %) */}
                        <div className="flex items-center gap-1 mt-1">
                          {isClosedAllDay ? (
                            <span className="text-xs md:text-sm font-bold text-red-400">
                              🔒 Fechado
                            </span>
                          ) : (
                            <span className="text-xs md:text-sm font-bold" style={{ color }}>
                              {getPopularityLabel(popularity)}
                            </span>
                          )}
                        </div>
                        
                        {/* Horário de funcionamento */}
                        {(() => {
                          console.log('[MapaCalor] Place:', place.name);
                          console.log('[MapaCalor] openingHours:', place.openingHours);
                          console.log('[MapaCalor] dayKey:', dayKey);
                          console.log('[MapaCalor] openingHours[dayKey]:', place.openingHours?.[dayKey]);
                          
                          if (!place.openingHours || !place.openingHours[dayKey]) {
                            return null;
                          }
                          
                          const dayHours = place.openingHours[dayKey];
                          
                          // Converter horários para 24h
                          const openTime24h = convertTo24h(dayHours.open || '');
                          const closeTime24h = convertTo24h(dayHours.close || '');
                          
                          // Calcular próximo horário de abertura se estiver fechado
                          let openingInfo = '';
                          if (isClosedAllDay) {
                            const nextOpening = getNextOpeningTime(place, dayKey, selectedHour);
                            if (nextOpening) {
                              if (nextOpening.isToday) {
                                openingInfo = ` (Abre às ${nextOpening.time})`;
                              } else {
                                openingInfo = ` (Abre ${nextOpening.time})`;
                              }
                            }
                          }
                          
                          return (
                            <p className="text-[10px] md:text-xs mt-1">
                              {dayHours.closed ? (
                                <span className="text-red-400">🔒 Fechado o dia todo{openingInfo && <span className="text-green-400">{openingInfo}</span>}</span>
                              ) : isClosedAllDay ? (
                                <span className="text-red-400">🔒 Fechado{openingInfo && <span className="text-green-400">{openingInfo}</span>}</span>
                              ) : (
                                <span className="text-green-400">
                                  🟢 Aberto até {closeTime24h || '—'}
                                </span>
                              )}
                            </p>
                          );
                        })()}
                        
                        {/* Rating */}
                        {place.rating && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs md:text-sm text-yellow-400">⭐</span>
                            <span className="text-xs md:text-sm text-gray-300">
                              {place.rating.toFixed(1)}
                            </span>
                            <span className="text-[10px] md:text-xs text-gray-500">
                              ({place.userRatingsTotal})
                            </span>
                          </div>
                        )}
                        
                        {/* Endereço */}
                        {place.formattedAddress && (
                          <p className="text-[10px] md:text-xs text-gray-400 truncate mt-1">
                            📍 {place.formattedAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

