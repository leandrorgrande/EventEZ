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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const businessClaimSchema = z.object({
  locationName: z.string().min(1, "Location name is required"),
  locationAddress: z.string().min(1, "Address is required"),
  contactName: z.string().min(1, "Contact name is required"),
  contactPhone: z.string().min(1, "Phone number is required"),
});

interface BusinessClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BusinessClaimModal({ open, onOpenChange }: BusinessClaimModalProps) {
  const [placePredictions, setPlacePredictions] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof businessClaimSchema>>({
    resolver: zodResolver(businessClaimSchema),
    defaultValues: {
      locationName: "",
      locationAddress: "",
      contactName: "",
      contactPhone: "",
    },
  });

  const handlePlaceSearch = async (query: string) => {
    if (query.length < 3) {
      setPlacePredictions([]);
      return;
    }

    // Mock Google Places API search
    const mockPlaces = [
      {
        place_id: "claim_1",
        description: `${query} Restaurant - 123 Main St, Manhattan`,
        name: `${query} Restaurant`,
        formatted_address: "123 Main St, Manhattan, NY 10001",
        geometry: { location: { lat: 40.7589, lng: -73.9851 } },
        types: ["restaurant", "food"]
      },
      {
        place_id: "claim_2", 
        description: `${query} Bar & Lounge - 456 Broadway, Brooklyn`,
        name: `${query} Bar & Lounge`,
        formatted_address: "456 Broadway, Brooklyn, NY 11201",
        geometry: { location: { lat: 40.6892, lng: -73.9442 } },
        types: ["bar", "night_club"]
      }
    ];
    
    setPlacePredictions(mockPlaces);
  };

  const handlePlaceSelect = (place: any) => {
    setSelectedPlace(place);
    form.setValue("locationName", place.name);
    form.setValue("locationAddress", place.formatted_address);
    setPlacePredictions([]);
  };

  const claimBusinessMutation = useMutation({
    mutationFn: async (data: any) => {
      // First, create/find the location
      const locationData = {
        name: data.locationName,
        address: data.locationAddress,
        latitude: selectedPlace?.geometry?.location?.lat?.toString() || "40.7589",
        longitude: selectedPlace?.geometry?.location?.lng?.toString() || "-73.9851",
        googlePlaceId: selectedPlace?.place_id,
        category: selectedPlace?.types?.[0] || "business",
        verified: false,
      };

      const locationResponse = await apiRequest("POST", "/api/locations", locationData);
      const location = await locationResponse.json();

      // Create the business claim
      const claimData = {
        locationId: location.id,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
      };

      const claimResponse = await apiRequest("POST", "/api/business-claims", claimData);
      return claimResponse.json();
    },
    onSuccess: () => {
      toast({
        title: "Claim Submitted",
        description: "Your business claim has been submitted for review. You'll be notified once it's processed.",
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/business-claims"] });
      
      // Close modal and reset form
      onOpenChange(false);
      form.reset();
      setSelectedPlace(null);
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
        description: "Failed to submit business claim. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof businessClaimSchema>) => {
    claimBusinessMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-claim-business-title">Claim Your Business</DialogTitle>
          <DialogDescription className="text-gray-400">
            Submit a request to claim ownership of your business location
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Location Search */}
            <FormField
              control={form.control}
              name="locationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Business Location</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Search for your business..."
                        className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                        data-testid="input-business-search"
                        onChange={(e) => {
                          field.onChange(e);
                          handlePlaceSearch(e.target.value);
                        }}
                        value={field.value}
                      />
                      {placePredictions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg max-h-40 overflow-auto">
                          {placePredictions.map((place) => (
                            <button
                              key={place.place_id}
                              type="button"
                              className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 focus:bg-slate-600 focus:outline-none"
                              onClick={() => handlePlaceSelect(place)}
                              data-testid={`business-option-${place.place_id}`}
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

            {/* Selected Place Display */}
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
                    }}
                    className="text-gray-400 hover:text-white"
                    data-testid="button-clear-business"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Contact Information */}
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Your Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your full name"
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                      data-testid="input-contact-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter phone number"
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                      data-testid="input-contact-phone"
                      {...field}
                    />
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
                data-testid="button-cancel-claim"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={claimBusinessMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="button-submit-claim"
              >
                {claimBusinessMutation.isPending ? "Submitting..." : "Submit Claim"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}