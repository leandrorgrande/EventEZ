import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";
import { Loader2, MapPin, Clock, Star, Users, TrendingUp, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { searchNearbyPlaces, getSavedPlaces, getCurrentPopularity, type Place } from "@/lib/googlePlacesService";

export default function SantosPlaces() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedType, setSelectedType] = useState<string>('bars');
  const { toast } = useToast();

  // Buscar lugares salvos
  const { data: savedPlaces, isLoading: loadingSaved } = useQuery({
    queryKey: ['/api/places'],
    queryFn: getSavedPlaces,
  });

  // Mutation para buscar novos lugares
  const searchMutation = useMutation({
    mutationFn: async (locationType: string) => {
      return await searchNearbyPlaces(locationType, 20);
    },
    onSuccess: (data) => {
      setPlaces(data);
      toast({
        title: "Lugares encontrados!",
        description: `${data.length} lugares foram carregados`,
      });
    },
    onError: () => {
      toast({
        title: "Erro ao buscar lugares",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  // Carregar lugares salvos ao montar
  useEffect(() => {
    if (savedPlaces && savedPlaces.length > 0) {
      setPlaces(savedPlaces);
    }
  }, [savedPlaces]);

  const handleSearch = (type: string) => {
    setSelectedType(type);
    searchMutation.mutate(type);
  };

  const getPopularityColor = (popularity: number) => {
    if (popularity >= 80) return "text-red-500";
    if (popularity >= 60) return "text-orange-500";
    if (popularity >= 40) return "text-yellow-500";
    return "text-green-500";
  };

  const getPopularityLabel = (popularity: number) => {
    if (popularity >= 80) return "Muito Cheio";
    if (popularity >= 60) return "Movimentado";
    if (popularity >= 40) return "Moderado";
    return "Tranquilo";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <h1 className="text-3xl font-bold mb-2">Bares e Baladas em Santos</h1>
        <p className="text-blue-100">Descubra os melhores lugares e horários de pico</p>
      </div>

      {/* Filtros */}
      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedType === 'bars' ? 'default' : 'outline'}
            onClick={() => handleSearch('bars')}
            disabled={searchMutation.isPending}
            className="whitespace-nowrap"
          >
            🍺 Bares
          </Button>
          <Button
            variant={selectedType === 'clubs' ? 'default' : 'outline'}
            onClick={() => handleSearch('clubs')}
            disabled={searchMutation.isPending}
            className="whitespace-nowrap"
          >
            🎉 Baladas
          </Button>
          <Button
            variant={selectedType === 'food' ? 'default' : 'outline'}
            onClick={() => handleSearch('food')}
            disabled={searchMutation.isPending}
            className="whitespace-nowrap"
          >
            🍽️ Restaurantes
          </Button>
          <Button
            variant={selectedType === 'shows' ? 'default' : 'outline'}
            onClick={() => handleSearch('shows')}
            disabled={searchMutation.isPending}
            className="whitespace-nowrap"
          >
            🎭 Shows
          </Button>
        </div>

        {/* Botão Atualizar */}
        <Button
          onClick={() => handleSearch(selectedType)}
          disabled={searchMutation.isPending}
          variant="secondary"
          className="w-full"
        >
          {searchMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando lugares...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar Lugares
            </>
          )}
        </Button>
      </div>

      {/* Lista de Lugares */}
      <div className="p-4 space-y-4">
        {loadingSaved && places.length === 0 ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="mt-2 text-gray-400">Carregando lugares...</p>
          </div>
        ) : places.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-8 text-center">
              <MapPin className="h-12 w-12 mx-auto text-gray-500 mb-4" />
              <p className="text-gray-400">
                Nenhum lugar encontrado. Clique em um dos botões acima para buscar!
              </p>
            </CardContent>
          </Card>
        ) : (
          places.map((place) => {
            const currentPopularity = getCurrentPopularity(place);
            
            return (
              <Card key={place.id} className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">{place.name}</CardTitle>
                      <CardDescription className="text-gray-400 flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {place.formattedAddress}
                      </CardDescription>
                    </div>
                    {place.rating && (
                      <Badge variant="secondary" className="ml-2">
                        <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                        {place.rating}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Popularidade Atual */}
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`h-5 w-5 ${getPopularityColor(currentPopularity)}`} />
                      <span className="text-sm font-medium">Agora:</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getPopularityColor(currentPopularity)}`}>
                        {Math.round(currentPopularity)}%
                      </div>
                      <div className="text-xs text-gray-400">
                        {getPopularityLabel(currentPopularity)}
                      </div>
                    </div>
                  </div>

                  {/* Informações Adicionais */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {place.userRatingsTotal && (
                      <div className="flex items-center gap-1 text-gray-400">
                        <Users className="h-4 w-4" />
                        <span>{place.userRatingsTotal} avaliações</span>
                      </div>
                    )}
                    {place.types && place.types.length > 0 && (
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span className="capitalize">{place.types[0].replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        window.open(
                          `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}&query_place_id=${place.placeId}`,
                          '_blank'
                        );
                      }}
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      Ver no Mapa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <BottomNavigation currentPage="map" onNavigate={() => {}} />
    </div>
  );
}

