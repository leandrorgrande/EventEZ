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
import { Loader2, Calendar as CalendarIcon, Clock, Filter, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Coordenadas de Santos, SP
const SANTOS_CENTER = { lat: -23.9608, lng: -46.3332 };

interface Place {
  id: string;
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  popularTimes: {
    monday: number[];
    tuesday: number[];
    wednesday: number[];
    thursday: number[];
    friday: number[];
    saturday: number[];
    sunday: number[];
  };
  types: string[];
}

export default function MapaCalor() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [heatmap, setHeatmap] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
  const [selectedType, setSelectedType] = useState<string>('all'); // Filtro de tipo
  const [minRating, setMinRating] = useState<number>(0); // Filtro de avaliação mínima
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(true); // Controle de expansão dos filtros

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

  // Buscar lugares automaticamente se estiver vazio
  const searchPlacesMutation = useMutation({
    mutationFn: async (type: string) => {
      console.log('[MapaCalor] Buscando lugares do tipo:', type);
      
      try {
        const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
        const response = await fetch(`${API_URL}/places/search-santos`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          },
          body: JSON.stringify({ locationType: type, maxResults: 50 })
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
  const filteredPlaces = places
    ? places.filter(place => {
        // Filtro de tipo
        if (selectedType !== 'all' && (!place.types || !place.types.includes(selectedType))) {
          return false;
        }
        // Filtro de avaliação
        if (minRating > 0 && (!place.rating || place.rating < minRating)) {
          return false;
        }
        return true;
      })
    : [];

  // Debug: Log quando places mudar
  useEffect(() => {
    console.log('[MapaCalor] Places atualizados:', places?.length || 0, 'lugares');
    if (places && places.length > 0) {
      console.log('[MapaCalor] Primeiro lugar:', places[0]);
    }
  }, [places]);

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

  // Atualizar heatmap quando mudar dia, hora ou lugares
  useEffect(() => {
    if (!map || !filteredPlaces || filteredPlaces.length === 0) return;

    // Limpar heatmap anterior
    if (heatmap) {
      heatmap.setMap(null);
    }

    // Limpar marcadores anteriores
    markers.forEach(marker => marker.setMap(null));

    // Gerar dados do heatmap
    const heatmapData: google.maps.visualization.WeightedLocation[] = [];
    const newMarkers: google.maps.Marker[] = [];

    filteredPlaces.forEach(place => {
      if (!place.latitude || !place.longitude || !place.popularTimes) return;

      const dayKey = selectedDay as keyof typeof place.popularTimes;
      const popularity = place.popularTimes[dayKey]?.[selectedHour] || 50;

      // Adicionar ao heatmap com peso baseado na popularidade
      const location = new google.maps.LatLng(
        parseFloat(place.latitude.toString()),
        parseFloat(place.longitude.toString())
      );

      // Peso: popularidade / 100 (normalizado para 0-1)
      const weight = popularity / 100;

      // Adicionar múltiplos pontos para aumentar intensidade
      const intensity = Math.ceil(weight * 10);
      for (let i = 0; i < intensity; i++) {
        heatmapData.push({
          location,
          weight: weight
        });
      }

      // Adicionar marcador se popularidade > 40% (reduzido para mostrar mais lugares)
      if (popularity >= 40) {
        const marker = new google.maps.Marker({
          position: location,
          map,
          title: `${place.name} - ${popularity}%`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6 + (popularity / 8), // Tamanho baseado na popularidade
            fillColor: getColorByPopularity(popularity),
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          animation: popularity >= 80 ? google.maps.Animation.BOUNCE : undefined,
        });

        // InfoWindow ao clicar
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; font-family: Arial, sans-serif; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">${place.name}</h3>
              <div style="background: ${getColorByPopularity(popularity)}; color: white; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; text-align: center;">
                <strong style="font-size: 18px;">${popularity}%</strong>
                <div style="font-size: 12px;">${getPopularityLabel(popularity)}</div>
              </div>
              <p style="margin: 0; color: #6b7280; font-size: 13px;">
                📅 ${getDayLabel(selectedDay)}<br/>
                🕐 ${selectedHour}:00
              </p>
              ${place.formattedAddress ? `
                <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
                  📍 ${place.formattedAddress}
                </p>
              ` : ''}
              <button 
                onclick="window.open('https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}', '_blank')"
                style="margin-top: 10px; width: 100%; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
              >
                Ver no Google Maps
              </button>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        newMarkers.push(marker);
      }
    });

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
    const mapClickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      
      const clickedLat = e.latLng.lat();
      const clickedLng = e.latLng.lng();
      
      // Encontrar lugares próximos (raio de ~200m)
      const nearbyPlaces = filteredPlaces.filter(place => {
        if (!place.latitude || !place.longitude) return false;
        
        const lat = parseFloat(place.latitude.toString());
        const lng = parseFloat(place.longitude.toString());
        
        const distance = Math.sqrt(
          Math.pow(lat - clickedLat, 2) + Math.pow(lng - clickedLng, 2)
        );
        
        return distance < 0.002; // ~200m
      });
      
      if (nearbyPlaces.length > 0) {
        const dayKey = selectedDay as keyof typeof nearbyPlaces[0].popularTimes;
        
        const placesHtml = nearbyPlaces
          .map(p => {
            const pop = p.popularTimes[dayKey]?.[selectedHour] || 50;
            return `
              <div style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                <strong style="color: #1f2937;">${p.name}</strong>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                  <div style="width: 12px; height: 12px; border-radius: 50%; background: ${getColorByPopularity(pop)};"></div>
                  <span style="font-size: 13px; color: #6b7280;">${pop}% - ${getPopularityLabel(pop)}</span>
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
    
    // Cleanup
    return () => {
      google.maps.event.removeListener(mapClickListener);
    };
  }, [map, places, selectedDay, selectedHour, selectedType, minRating]);

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

  const getHourLabel = (hour: number): string => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
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
              {filteredPlaces && filteredPlaces.length > 0 
                ? `${filteredPlaces.length} de ${places?.length || 0} lugares`
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
            </div>

            {/* Controles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <span className="font-semibold">Legenda:</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span>Tranquilo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span>Moderado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <span>Movimentado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span>Muito Cheio</span>
              </div>
            </div>
          </>
        )}

      </div>
      
      {/* Mapa - Altura otimizada para mobile com espaço para navegação fixa */}
      <div ref={mapRef} className="flex-1 w-full min-h-[60vh] md:min-h-0 mb-16" />

      {/* Navegação Fixa - Sempre visível na parte inferior */}
      <BottomNavigation currentPage="map" onNavigate={() => {}} />

      {/* Lista de Lugares - Abaixo do mapa */}
      {filteredPlaces && filteredPlaces.length > 0 && (
        <div className="bg-slate-800 p-3 md:p-4 border-t border-slate-700 max-h-[35vh] md:max-h-[300px] overflow-y-auto">
          <h2 className="text-base md:text-lg font-bold text-white mb-2 md:mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
            Lugares ({filteredPlaces.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {filteredPlaces.map(place => {
              const dayKey = selectedDay as keyof typeof place.popularTimes;
              const popularity = place.popularTimes?.[dayKey]?.[selectedHour] || 0;
              const color = getColorByPopularity(popularity);
              
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
                      
                      // Feedback visual
                      toast({
                        title: "📍 " + place.name,
                        description: `${popularity}% de movimento às ${selectedHour}:00`,
                      });
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
                        
                        {/* Movimento */}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs md:text-sm font-bold" style={{ color }}>
                            {popularity}%
                          </span>
                          <span className="text-[10px] md:text-xs text-gray-400">
                            {getPopularityLabel(popularity)}
                          </span>
                        </div>
                        
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
                        
                        {/* Horário de funcionamento */}
                        {place.openingHours && place.openingHours[dayKey] && (
                          <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                            {place.openingHours[dayKey].closed ? (
                              <span className="text-red-400">🔒 Fechado</span>
                            ) : (
                              <span className="text-green-400">
                                🕐 {place.openingHours[dayKey].open} - {place.openingHours[dayKey].close}
                              </span>
                            )}
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

