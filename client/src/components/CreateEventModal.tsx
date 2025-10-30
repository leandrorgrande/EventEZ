import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

// EVENTU: Enhanced validation schema with date checks
const createEventSchema = z.object({
  title: z.string().min(1, "Título do evento é obrigatório"),
  description: z.string().optional(),
  locationName: z.string().min(1, "Local é obrigatório"),
  locationAddress: z.string().min(1, "Endereço é obrigatório"),
  googlePlaceId: z.string().optional(),
  startDateTime: z.string().min(1, "Data e hora de início são obrigatórias"),
  endDateTime: z.string().optional(),
  eventType: z.string().min(1, "Tipo de evento é obrigatório"),
  mediaFile: z.any().optional(),
}).refine((data) => {
  // EVENTU: Validate end time is after start time
  if (data.endDateTime && data.startDateTime) {
    return new Date(data.endDateTime) > new Date(data.startDateTime);
  }
  return true;
}, {
  message: "Data de término deve ser após a data de início",
  path: ["endDateTime"],
});

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateEventModal({ open, onOpenChange }: CreateEventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placePredictions, setPlacePredictions] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof createEventSchema>>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      description: "",
      locationName: "",
      locationAddress: "",
      googlePlaceId: "",
      startDateTime: "",
      endDateTime: "",
      eventType: "",
      mediaFile: null,
    },
  });

  const handlePlaceSearch = async (query: string) => {
    if (query.length < 3) {
      setPlacePredictions([]);
      return;
    }

    try {
      // Usar Google Places Autocomplete API
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
      
      const url = `https://places.googleapis.com/v1/places:autocomplete`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'
        },
        body: JSON.stringify({
          input: query,
          locationBias: {
            circle: {
              center: { latitude: -23.9608, longitude: -46.3332 },
              radius: 50000.0
            }
          },
          includedRegionCodes: ['BR']
        })
      });

      if (!response.ok) {
        console.error('Places API error:', response.status);
        setPlacePredictions([]);
        return;
      }

      const data = await response.json();
      
      // Converter predictions para formato esperado
      const places = data.suggestions?.map((suggestion: any) => {
        const prediction = suggestion.placePrediction;
        return {
          place_id: prediction.placeId,
          description: prediction.text?.text || '',
          name: prediction.structuredFormat?.mainText?.text || prediction.text?.text || '',
          formatted_address: prediction.structuredFormat?.secondaryText?.text || '',
          geometry: { location: { lat: null, lng: null } }, // Será preenchido quando selecionar
          types: []
        };
      }) || [];
      
      setPlacePredictions(places);
    } catch (error) {
      console.error('Error searching places:', error);
      setPlacePredictions([]);
    }
  };

  const handlePlaceSelect = async (place: any) => {
    try {
      // Buscar detalhes completos do lugar
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
      
      const detailsUrl = `https://places.googleapis.com/v1/places/${place.place_id}`;
      
      const response = await fetch(detailsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types'
        }
      });

      if (response.ok) {
        const details = await response.json();
        
        const fullPlace = {
          place_id: details.id,
          name: details.displayName?.text || place.name,
          formatted_address: details.formattedAddress || place.formatted_address,
          geometry: {
            location: {
              lat: details.location?.latitude || null,
              lng: details.location?.longitude || null
            }
          },
          types: details.types || []
        };
        
        setSelectedPlace(fullPlace);
        form.setValue("locationName", fullPlace.name);
        form.setValue("locationAddress", fullPlace.formatted_address);
        form.setValue("googlePlaceId", fullPlace.place_id);
      } else {
        // Fallback para dados disponíveis
        setSelectedPlace(place);
        form.setValue("locationName", place.name);
        form.setValue("locationAddress", place.formatted_address);
        form.setValue("googlePlaceId", place.place_id);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      // Fallback para dados disponíveis
      setSelectedPlace(place);
      form.setValue("locationName", place.name);
      form.setValue("locationAddress", place.formatted_address);
      form.setValue("googlePlaceId", place.place_id);
    }
    
    setPlacePredictions([]);
  };

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("mediaFile", file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadMedia = async (file: File): Promise<string> => {
    // Mock media upload - in real app, upload to Firebase Storage or similar
    const mockUrl = `https://example.com/uploads/${Date.now()}_${file.name}`;
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return mockUrl;
  };

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      let mediaUrl = null;
      let mediaType = null;

      // Upload media if provided
      if (data.mediaFile) {
        mediaUrl = await uploadMedia(data.mediaFile);
        mediaType = data.mediaFile.type.startsWith('image/') ? 'image' : 'video';
      }

      // Create event directly with location data
      const eventData = {
        title: data.title,
        description: data.description,
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        googlePlaceId: data.googlePlaceId || null,
        latitude: selectedPlace?.geometry?.location?.lat?.toString() || null,
        longitude: selectedPlace?.geometry?.location?.lng?.toString() || null,
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: data.endDateTime ? new Date(data.endDateTime).toISOString() : null,
        eventType: data.eventType,
        mediaUrl,
        mediaType,
        isActive: true,
      };

      console.log('[CreateEventModal] Event Data a ser enviado:', JSON.stringify(eventData, null, 2));

      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      
      console.log('[CreateEventModal] Token disponível:', !!token);
      console.log('[CreateEventModal] URL:', `${API_URL}/events`);
      
      const eventResponse = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      });

      console.log('[CreateEventModal] Response status:', eventResponse.status);

      if (!eventResponse.ok) {
        const errorText = await eventResponse.text();
        console.error('[CreateEventModal] Erro na resposta:', errorText);
        throw new Error('Failed to create event');
      }

      const responseData = await eventResponse.json();
      console.log('[CreateEventModal] Evento criado com sucesso:', responseData);
      
      return responseData;
    },
    onSuccess: () => {
      toast({
        title: "Evento criado",
        description: "Seu evento foi criado com sucesso!",
      });
      
      // Atualizar lista de eventos
      queryClient.invalidateQueries({ queryKey: ["api/events"] });
      
      // Close modal and reset form
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "Sua sessão expirou. Redirecionando para login...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Erro",
        description: "Falha ao criar evento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof createEventSchema>) => {
    createEventMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-create-event-title">Criar Evento</DialogTitle>
          <DialogDescription className="text-gray-400">
            Cadastre um novo evento para outros descobrirem e participarem
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Título do evento</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Digite o título do evento"
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                      data-testid="input-event-title"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Local</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Busque um local..."
                        className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                        data-testid="input-location-search"
                        onChange={(e) => {
                          field.onChange(e);
                          handlePlaceSearch(e.target.value);
                        }}
                        value={field.value}
                      />
                      {placePredictions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                          {placePredictions.map((place) => (
                            <button
                              key={place.place_id}
                              type="button"
                              className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 focus:bg-slate-600 focus:outline-none"
                              onClick={() => handlePlaceSelect(place)}
                              data-testid={`place-option-${place.place_id}`}
                            >
                              <div className="font-medium">{place.name}</div>
                              <div className="text-sm text-gray-400">{place.formatted_address}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedPlace && (
              <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{selectedPlace.name}</div>
                    <div className="text-sm text-gray-400">{selectedPlace.formatted_address}</div>
                    <div className="text-xs text-blue-400 mt-1">
                      {selectedPlace.types?.join(", ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlace(null);
                      form.setValue("locationName", "");
                      form.setValue("locationAddress", "");
                      form.setValue("googlePlaceId", "");
                    }}
                    className="text-gray-400 hover:text-white"
                    data-testid="button-clear-place"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Data e hora de início</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="bg-slate-700 border-slate-600 text-white"
                        data-testid="input-start-datetime"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Data e hora de término</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="bg-slate-700 border-slate-600 text-white"
                        data-testid="input-end-datetime"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Tipo de evento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-event-type">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="clubs">Baladas</SelectItem>
                      <SelectItem value="bars">Bares</SelectItem>
                      <SelectItem value="shows">Shows</SelectItem>
                      <SelectItem value="fairs">Feiras</SelectItem>
                      <SelectItem value="food">Comida</SelectItem>
                      <SelectItem value="other">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Conte sobre o seu evento..."
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-400 resize-none"
                      rows={3}
                      data-testid="textarea-event-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Media Upload */}
            <FormField
              control={form.control}
              name="mediaFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Foto/Vídeo do evento</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleMediaUpload}
                        className="bg-slate-700 border-slate-600 text-white file:bg-slate-600 file:text-white file:border-0"
                        data-testid="input-media-upload"
                      />
                      {mediaPreview && (
                        <div className="relative">
                          {form.getValues("mediaFile")?.type?.startsWith("image/") ? (
                            <img
                              src={mediaPreview}
                              alt="Prévia do evento"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          ) : (
                            <video
                              src={mediaPreview}
                              className="w-full h-32 object-cover rounded-lg"
                              controls
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setMediaPreview(null);
                              form.setValue("mediaFile", null);
                            }}
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                            data-testid="button-remove-media"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700"
                data-testid="button-cancel-event"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createEventMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="button-submit-event"
              >
                {createEventMutation.isPending ? "Criando..." : "Criar Evento"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
