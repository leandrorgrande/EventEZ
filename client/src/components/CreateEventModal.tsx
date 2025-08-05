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
  startDateTime: z.string().min(1, "Start date and time is required"),
  endDateTime: z.string().optional(),
  eventType: z.string().min(1, "Event type is required"),
});

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateEventModal({ open, onOpenChange }: CreateEventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof createEventSchema>>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      description: "",
      locationName: "",
      locationAddress: "",
      startDateTime: "",
      endDateTime: "",
      eventType: "",
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      // First create the location
      const locationResponse = await apiRequest("POST", "/api/locations", {
        name: data.locationName,
        address: data.locationAddress,
        latitude: "40.7589", // Mock coordinates - would use geocoding in real app
        longitude: "-73.9851",
      });
      
      const location = await locationResponse.json();

      // Then create the event
      const eventResponse = await apiRequest("POST", "/api/events", {
        title: data.title,
        description: data.description,
        locationId: location.id,
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: data.endDateTime ? new Date(data.endDateTime).toISOString() : null,
        eventType: data.eventType,
        isActive: true,
      });

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
                  <FormLabel className="text-gray-300">Location Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter location name"
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                      data-testid="input-location-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter full address"
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                      data-testid="input-location-address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
