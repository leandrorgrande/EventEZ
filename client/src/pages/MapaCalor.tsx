import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import BottomNavigation from "@/components/BottomNavigation";
import { Loader2, Calendar, Clock, Filter, MapPin } from "lucide-react";
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

  // Controles de tempo
  const [selectedDay, setSelectedDay] = useState<string>('friday'); // Padrão: Sexta-feira
  const [selectedHour, setSelectedHour] = useState<number>(22); // Padrão: 22h
  const [selectedType, setSelectedType] = useState<string>('all'); // Filtro de tipo

  // Buscar lugares
  const { data: places, isLoading } = useQuery<Place[]>({
    queryKey: ['/api/places'],
    queryFn: async () => {
      const response = await fetch('/api/places');
      if (!response.ok) throw new Error('Failed to fetch places');
      return response.json();
    },
  });

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
    if (!map || !places || places.length === 0) return;

    // Limpar heatmap anterior
    if (heatmap) {
      heatmap.setMap(null);
    }

    // Limpar marcadores anteriores
    markers.forEach(marker => marker.setMap(null));

    // Filtrar lugares por tipo
    const filteredPlaces = selectedType === 'all' 
      ? places 
      : places.filter(place => place.types && place.types.includes(selectedType));

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

      // Adicionar marcador se popularidade > 60%
      if (popularity >= 60) {
        const marker = new google.maps.Marker({
          position: location,
          map,
          title: `${place.name} - ${popularity}%`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8 + (popularity / 10), // Tamanho baseado na popularidade
            fillColor: getColorByPopularity(popularity),
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }
        });

        // InfoWindow ao clicar
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; font-family: Arial, sans-serif;">
              <h3 style="margin: 0 0 5px 0; color: #1f2937;">${place.name}</h3>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                <strong>Popularidade:</strong> ${popularity}% (${getPopularityLabel(popularity)})
              </p>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">
                ${getDayLabel(selectedDay)} às ${selectedHour}:00
              </p>
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
      radius: 30,
      opacity: 0.7,
      gradient: [
        'rgba(0, 255, 0, 0)',      // Transparente (baixa popularidade)
        'rgba(255, 255, 0, 0.7)',  // Amarelo (média)
        'rgba(255, 165, 0, 0.8)',  // Laranja (alta)
        'rgba(255, 0, 0, 1)'       // Vermelho (muito alta)
      ]
    });

    setHeatmap(heatmapLayer);
    setMarkers(newMarkers);
  }, [map, places, selectedDay, selectedHour, selectedType]);

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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Mapa de Calor - Santos
          </h1>
          {isLoading && (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          )}
        </div>

        {/* Controles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Dia da Semana */}
          <Card className="bg-slate-700 border-slate-600">
            <CardContent className="p-4">
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                Dia da Semana
              </label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="monday">Segunda-feira</SelectItem>
                  <SelectItem value="tuesday">Terça-feira</SelectItem>
                  <SelectItem value="wednesday">Quarta-feira</SelectItem>
                  <SelectItem value="thursday">Quinta-feira</SelectItem>
                  <SelectItem value="friday">Sexta-feira</SelectItem>
                  <SelectItem value="saturday">Sábado</SelectItem>
                  <SelectItem value="sunday">Domingo</SelectItem>
                </SelectContent>
              </Select>
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
      </div>

      {/* Mapa */}
      <div ref={mapRef} className="flex-1 w-full" />

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="map" onNavigate={() => {}} />
    </div>
  );
}

