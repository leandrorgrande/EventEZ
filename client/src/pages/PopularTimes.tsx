import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BottomNavigation from "@/components/BottomNavigation";
import { Loader2, MapPin, Clock, Star, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Place {
  id: string;
  placeId: string;
  name: string;
  formattedAddress: string;
  rating: number | null;
  userRatingsTotal: number | null;
  regularOpeningHours: any;
  latitude: string | null;
  longitude: string | null;
}

export default function PopularTimes() {
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const searchSantosMutation = useMutation({
    mutationFn: async (locationType: string) => {
      const response = await fetch('/api/places/search-santos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locationType }),
      });

      if (!response.ok) {
        throw new Error('Failed to search places');
      }

      const data = await response.json();
      return data.places;
    },
    onSuccess: (places) => {
      setSearchResults(places);
      toast({
        title: "Busca concluída",
        description: `Encontrados ${places.length} lugares em Santos`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao buscar",
        description: "Não foi possível buscar os lugares",
        variant: "destructive",
      });
    },
  });

  const fetchPopularTimesMutation = useMutation({
    mutationFn: async (placeId: string) => {
      const response = await fetch('/api/places/fetch-popular-times', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ placeId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch popular times');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Dados atualizados",
        description: "Os horários foram atualizados com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível buscar os horários",
        variant: "destructive",
      });
    },
  });

  const handleSearchBars = () => {
    setIsSearching(true);
    searchSantosMutation.mutate('bars', {
      onSettled: () => setIsSearching(false),
    });
  };

  const handleSearchClubs = () => {
    setIsSearching(true);
    searchSantosMutation.mutate('clubs', {
      onSettled: () => setIsSearching(false),
    });
  };

  const handleFetchPopularTimes = (placeId: string) => {
    fetchPopularTimesMutation.mutate(placeId);
  };

  const formatOpeningHours = (hours: any) => {
    if (!hours) return 'Horários não disponíveis';
    
    try {
      const weekdays = hours.weekdayDescriptions || [];
      return weekdays.join('\n') || 'Horários não disponíveis';
    } catch {
      return 'Horários não disponíveis';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-4">
        <h1 className="text-2xl font-bold">Horários Populares em Santos</h1>
        <p className="text-gray-400 text-sm mt-1">
          Busque bares e baladas e veja os horários de maior movimento
        </p>
      </div>

      {/* Search Buttons */}
      <div className="p-4 space-y-3">
        <Button
          onClick={handleSearchBars}
          disabled={isSearching}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4 mr-2" />
          )}
          Buscar Bares em Santos
        </Button>

        <Button
          onClick={handleSearchClubs}
          disabled={isSearching}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4 mr-2" />
          )}
          Buscar Baladas em Santos
        </Button>
      </div>

      {/* Results */}
      <div className="p-4 space-y-4">
        {searchResults.length === 0 && !isSearching && (
          <Card className="bg-slate-800 border-slate-700 text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold text-white mb-2">
                Nenhum lugar encontrado
              </h3>
              <p className="text-gray-400">
                Clique em um dos botões acima para buscar lugares em Santos
              </p>
            </CardContent>
          </Card>
        )}

        {searchResults.map((place) => (
          <Card key={place.id} className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-start justify-between">
                <span>{place.name}</span>
                {place.rating && (
                  <div className="flex items-center gap-1 text-yellow-400 text-sm">
                    <Star className="h-4 w-4 fill-current" />
                    <span>{place.rating.toFixed(1)}</span>
                  </div>
                )}
              </CardTitle>
              <CardDescription className="text-gray-400 flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                {place.formattedAddress}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {place.userRatingsTotal && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users className="h-4 w-4" />
                    <span>{place.userRatingsTotal} avaliações</span>
                  </div>
                )}

                <div className="border-t border-slate-700 pt-3">
                  <div className="flex items-start gap-2 mb-2">
                    <Clock className="h-4 w-4 text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-400 mb-1">
                        Horários de Funcionamento:
                      </p>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                        {formatOpeningHours(place.regularOpeningHours)}
                      </pre>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleFetchPopularTimes(place.placeId)}
                  disabled={fetchPopularTimesMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  {fetchPopularTimesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 mr-2" />
                  )}
                  Atualizar Horários
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="events" />
    </div>
  );
}
