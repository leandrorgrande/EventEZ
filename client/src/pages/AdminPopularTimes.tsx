import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Save, Loader2, MapPin, Clock } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

interface Place {
  id: string;
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: string | null;
  longitude: string | null;
  popularTimes?: {
    monday: number[];
    tuesday: number[];
    wednesday: number[];
    thursday: number[];
    friday: number[];
    saturday: number[];
    sunday: number[];
  };
  dataSource?: 'manual' | 'simulated' | 'user_checkins';
  lastUpdated?: any;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo'
};

export default function AdminPopularTimes() {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [editingDay, setEditingDay] = useState<string>('monday');
  const [hourlyData, setHourlyData] = useState<number[]>(Array(24).fill(0));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar lugares
  const { data: places, isLoading } = useQuery<Place[]>({
    queryKey: ['/api/places'],
    queryFn: async () => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const response = await fetch(`${API_URL}/places`);
      if (!response.ok) throw new Error('Failed to fetch places');
      return response.json();
    },
  });

  // Mutation para salvar dados
  const updatePlaceMutation = useMutation({
    mutationFn: async ({ placeId, popularTimes }: { placeId: string, popularTimes: any }) => {
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const response = await fetch(`${API_URL}/places/${placeId}/popular-times`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ popularTimes, dataSource: 'manual' })
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/places'] });
      toast({
        title: "Dados salvos!",
        description: "Horários de pico atualizados com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  });

  const handleSelectPlace = (place: Place) => {
    setSelectedPlace(place);
    if (place.popularTimes) {
      setHourlyData(place.popularTimes[editingDay as keyof typeof place.popularTimes] || Array(24).fill(0));
    } else {
      setHourlyData(Array(24).fill(0));
    }
  };

  const handleDayChange = (day: string) => {
    setEditingDay(day);
    if (selectedPlace?.popularTimes) {
      setHourlyData(selectedPlace.popularTimes[day as keyof typeof selectedPlace.popularTimes] || Array(24).fill(0));
    }
  };

  const handleHourChange = (hour: number, value: string) => {
    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    const newData = [...hourlyData];
    newData[hour] = numValue;
    setHourlyData(newData);
  };

  const handleSave = () => {
    if (!selectedPlace) return;

    const updatedPopularTimes = {
      ...selectedPlace.popularTimes,
      [editingDay]: hourlyData
    };

    updatePlaceMutation.mutate({
      placeId: selectedPlace.id,
      popularTimes: updatedPopularTimes
    });
  };

  const openGoogleMaps = () => {
    if (!selectedPlace) return;
    
    const url = selectedPlace.latitude && selectedPlace.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${selectedPlace.latitude},${selectedPlace.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.name + ' Santos')}`;
    
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="container mx-auto p-6 max-w-7xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" />
              Atualizar Horários de Pico - Admin
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Consulte o Google Maps manualmente e digite os dados aqui. 100% legal! ✅
            </p>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Lugares */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">
                Lugares ({places?.length || 0})
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Google limita a 20 por busca. Busque mais tipos para adicionar.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {places?.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => handleSelectPlace(place)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedPlace?.id === place.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{place.name}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {place.formattedAddress}
                    </div>
                    {place.dataSource && (
                      <div className="text-xs mt-1">
                        {place.dataSource === 'manual' ? '✅ Manual' : '📊 Simulado'}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Editor de Dados */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {selectedPlace ? selectedPlace.name : 'Selecione um lugar'}
                </CardTitle>
                {selectedPlace && (
                  <Button
                    onClick={openGoogleMaps}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir no Google Maps
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedPlace ? (
                <div className="space-y-6">
                  {/* Instruções */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">📋 Como usar:</h3>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Clique em "Abrir no Google Maps"</li>
                      <li>Procure por "Horários de pico" na página do lugar</li>
                      <li>Selecione o dia da semana (ex: Domingo)</li>
                      <li>Veja o gráfico de barras (6h, 9h, 12h, 15h, 18h, 21h, 00h)</li>
                      <li>Digite os valores aproximados abaixo (0-100%)</li>
                      <li>Clique em "Salvar Dados"</li>
                    </ol>
                  </div>

                  {/* Seletor de Dia */}
                  <div>
                    <Label>Dia da Semana</Label>
                    <div className="grid grid-cols-7 gap-2 mt-2">
                      {DAYS.map((day) => (
                        <Button
                          key={day}
                          onClick={() => handleDayChange(day)}
                          variant={editingDay === day ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs"
                        >
                          {DAY_LABELS[day]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Inputs de Horas */}
                  <div>
                    <Label className="mb-3 block">
                      Popularidade por Hora (0-100%)
                    </Label>
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                      {hourlyData.map((value, hour) => (
                        <div key={hour} className="space-y-1">
                          <Label className="text-xs text-gray-600">
                            {hour.toString().padStart(2, '0')}:00
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={value}
                            onChange={(e) => handleHourChange(hour, e.target.value)}
                            className="text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview do Gráfico */}
                  <div>
                    <Label className="mb-3 block">Preview</Label>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-end justify-between h-32 gap-1">
                        {hourlyData.map((value, hour) => (
                          <div
                            key={hour}
                            className="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                            style={{ height: `${value}%` }}
                            title={`${hour}:00 - ${value}%`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>00h</span>
                        <span>06h</span>
                        <span>12h</span>
                        <span>18h</span>
                        <span>23h</span>
                      </div>
                    </div>
                  </div>

                  {/* Botão Salvar */}
                  <Button
                    onClick={handleSave}
                    disabled={updatePlaceMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {updatePlaceMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Dados
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Selecione um lugar na lista ao lado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <BottomNavigation currentPage="admin" onNavigate={() => {}} />
    </div>
  );
}

