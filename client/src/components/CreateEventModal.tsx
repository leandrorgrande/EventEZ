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

const createEventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().optional(),
  locationName: z.string().min(1, "Location is required"),
  locationAddress: z.string().min(1, "Address is required"),
  googlePlaceId: z.string().optional(),
  startDateTime: z.string().min(1, "Start date and time is required"),
  endDateTime: z.string().optional(),
  eventType: z.string().min(1, "Event type is required"),
  mediaFile: z.any().optional(),
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

    // Mock Google Places API - in real app, use Google Places API
    const mockPlaces = [
      {
        place_id: "mock_1",
        description: `${query} - Bar & Grill, Manhattan, NY`,
        name: `${query} Bar & Grill`,
        formatted_address: "123 Main St, Manhattan, NY 10001",
        geometry: { location: { lat: 40.7589, lng: -73.9851 } },
        types: ["bar", "restaurant"]
      },
      {
        place_id: "mock_2", 
        description: `${query} Club, Brooklyn, NY`,
        name: `${query} Club`,
        formatted_address: "456 Brooklyn Ave, Brooklyn, NY 11201",
        geometry: { location: { lat: 40.6892, lng: -73.9442 } },
        types: ["night_club"]
      }
    ];
    
    setPlacePredictions(mockPlaces);
  };

  const handlePlaceSelect = (place: any) => {
    setSelectedPlace(place);
    form.setValue("locationName", place.name);
    form.setValue("locationAddress", place.formatted_address);
    form.setValue("googlePlaceId", place.place_id);
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

      // Create location with Google Place data
      const locationData = {
        name: data.locationName,
        address: data.locationAddress,
        latitude: selectedPlace?.geometry?.location?.lat?.toString() || "40.7589",
        longitude: selectedPlace?.geometry?.location?.lng?.toString() || "-73.9851",
        googlePlaceId: data.googlePlaceId,
        category: selectedPlace?.types?.[0] || "venue",
      };

      const locationResponse = await apiRequest("POST", "/api/locations", locationData);
      const location = await locationResponse.json();

      // Create the event
      const eventData = {
        title: data.title,
        description: data.description,
        locationId: location.id,
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: data.endDateTime ? new Date(data.endDateTime).toISOString() : null,
        eventType: data.eventType,
        mediaUrl,
        mediaType,
        isActive: true,
      };

      const eventResponse = await apiRequest("POST", "/api/events", eventData);
      return eventResponse.json();
    },
    onSuccess: () => {
      toast({
        title: "Event Created",
        description: "Your event has been created successfully!",
      });
      
      // Invalidate and refetch events
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      
      // Close modal and reset form
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
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
          <DialogTitle data-testid="text-create-event-title">Create Event</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a new event for others to discover and join
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Event Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter event title"
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
                  <FormLabel className="text-gray-300">Location</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Search for a place..."
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
                    <FormLabel className="text-gray-300">Start Date & Time</FormLabel>
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
                    <FormLabel className="text-gray-300">End Date & Time</FormLabel>
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
                  <FormLabel className="text-gray-300">Event Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-event-type">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="clubs">Club Night</SelectItem>
                      <SelectItem value="bars">Bar Event</SelectItem>
                      <SelectItem value="shows">Live Show</SelectItem>
                      <SelectItem value="fairs">Fair/Market</SelectItem>
                      <SelectItem value="food">Food Event</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
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
                  <FormLabel className="text-gray-300">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell people about your event..."
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
                  <FormLabel className="text-gray-300">Event Photo/Video</FormLabel>
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
                              alt="Event preview"
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createEventMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="button-submit-event"
              >
                {createEventMutation.isPending ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
