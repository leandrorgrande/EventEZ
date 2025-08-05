import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import HeatMap from "@/components/HeatMap";
import FilterBar from "@/components/FilterBar";
import BottomNavigation from "@/components/BottomNavigation";
import CreateEventModal from "@/components/CreateEventModal";
import UserSidebar from "@/components/UserSidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Gem } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Map() {
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [currentFilter, setCurrentFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUserSidebar, setShowUserSidebar] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch heatmap data
  const { data: liveHeatmapData, isLoading: liveLoading } = useQuery({
    queryKey: ["/api/heatmap/live"],
    refetchInterval: 5000, // Refresh every 5 seconds for live data
  });

  const { data: predictionHeatmapData, isLoading: predictionLoading } = useQuery({
    queryKey: ["/api/heatmap/prediction"],
  });

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/events", { eventType: currentFilter !== "all" ? currentFilter : undefined }],
  });

  const togglePredictionMode = () => {
    setIsLiveMode(!isLiveMode);
  };

  const handleFilterChange = (filter: string) => {
    setCurrentFilter(filter);
  };

  const handleNavigation = (page: string) => {
    if (page === "profile") {
      setShowUserSidebar(true);
    }
    // Handle other navigation
  };

  const handleCreateEvent = () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create events",
        variant: "destructive",
      });
      return;
    }
    setShowCreateModal(true);
  };

  // Simulate user location tracking
  useEffect(() => {
    if (!user) return;

    const trackLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Send anonymous check-in data
            fetch("/api/checkins", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: position.coords.latitude.toString(),
                longitude: position.coords.longitude.toString(),
                userId: user.id,
                isAnonymous: false,
              }),
            }).catch(console.error);
          },
          () => {
            // If geolocation fails, use mock location data
            const mockLat = 40.7589 + (Math.random() - 0.5) * 0.01;
            const mockLng = -73.9851 + (Math.random() - 0.5) * 0.01;
            
            fetch("/api/checkins", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: mockLat.toString(),
                longitude: mockLng.toString(),
                userId: user.id,
                isAnonymous: false,
              }),
            }).catch(console.error);
          }
        );
      }
    };

    // Track location every 30 seconds
    const interval = setInterval(trackLocation, 30000);
    trackLocation(); // Initial tracking

    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="h-screen w-screen relative bg-slate-900 overflow-hidden">
      {/* Map Container */}
      <div className="absolute inset-0 z-0">
        <HeatMap
          data={isLiveMode ? liveHeatmapData : predictionHeatmapData}
          events={events}
          isLoading={liveLoading || predictionLoading || eventsLoading}
          onEventSelect={setSelectedEvent}
        />
      </div>

      {/* Top Bar with Controls */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between mb-4">
          {/* Logo */}
          <Card className="bg-slate-800/80 backdrop-blur-md border-slate-700 px-4 py-2">
            <h1 className="text-xl font-bold text-white" data-testid="text-logo">Event-U</h1>
          </Card>

          {/* Prediction Toggle */}
          <Button
            onClick={togglePredictionMode}
            className={`${
              isLiveMode 
                ? "bg-blue-600 hover:bg-blue-700" 
                : "bg-purple-600 hover:bg-purple-700"
            } text-white px-4 py-2 font-medium transition-all duration-200 shadow-lg backdrop-blur-md`}
            data-testid="button-prediction-toggle"
          >
            <Gem className="mr-2 h-4 w-4" />
            <span>{isLiveMode ? "Prediction" : "Live Mode"}</span>
          </Button>
        </div>

        {/* Filter Bar */}
        <FilterBar
          currentFilter={currentFilter}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Heat Legend */}
      <div className="absolute top-32 right-4 z-20">
        <Card className="bg-slate-800/80 backdrop-blur-md border-slate-700 p-3">
          <div className="text-xs text-gray-300 mb-2 font-medium">Heat Intensity</div>
          <div className="flex flex-col space-y-1">
            <div className="flex items-center">
              <div className="w-4 h-2 bg-red-500 rounded mr-2"></div>
              <span className="text-xs text-gray-300">Very High</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-2 bg-orange-500 rounded mr-2"></div>
              <span className="text-xs text-gray-300">High</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-2 bg-yellow-500 rounded mr-2"></div>
              <span className="text-xs text-gray-300">Medium</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-2 bg-green-500 rounded mr-2"></div>
              <span className="text-xs text-gray-300">Low</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-2 bg-blue-500 rounded mr-2"></div>
              <span className="text-xs text-gray-300">Very Low</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Selected Event Panel */}
      {selectedEvent && (
        <div className="absolute bottom-20 left-4 right-4 z-20">
          <Card className="bg-slate-800/90 backdrop-blur-md border-slate-700 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white" data-testid="text-event-title">
                  {selectedEvent.title}
                </h3>
                <p className="text-sm text-gray-300" data-testid="text-event-location">
                  {selectedEvent.location?.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-white"
                data-testid="button-close-event"
              >
                ✕
              </Button>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-sm text-gray-300">
                  <span data-testid="text-event-date">{new Date(selectedEvent.startDateTime).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <span data-testid="text-event-attendees">Going</span>
                </div>
              </div>
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full" data-testid="text-event-type">
                {selectedEvent.eventType}
              </span>
            </div>
            <div className="flex space-x-2">
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-join-event"
              >
                Join Event
              </Button>
              <Button 
                variant="secondary" 
                className="bg-gray-600 hover:bg-gray-700"
                data-testid="button-share-event"
              >
                Share
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Floating Create Event Button */}
      <Button
        onClick={handleCreateEvent}
        className="absolute bottom-24 right-4 z-30 bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-lg transition-all duration-200"
        data-testid="button-create-event"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentPage="map" 
        onNavigate={handleNavigation}
      />

      {/* Modals and Sidebars */}
      <CreateEventModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
      />
      
      <UserSidebar 
        open={showUserSidebar} 
        onOpenChange={setShowUserSidebar}
      />
    </div>
  );
}
