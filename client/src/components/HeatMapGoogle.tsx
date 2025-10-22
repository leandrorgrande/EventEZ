import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

interface HeatMapGoogleProps {
  data?: any[];
  events?: any[];
  isLoading?: boolean;
  onEventSelect?: (event: any) => void;
}

// EVENTU: Flag for future internal heatmap logic combining with Google signals
const USE_INTERNAL_HEATMAP_LOGIC = false;

export default function HeatMapGoogle({ data, events, isLoading, onEventSelect }: HeatMapGoogleProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const heatmapLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const placesServiceRef = useRef<any>(null);

  // EVENTU: Load Google Maps with Places and Visualization libraries
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setLoadError("Google Maps API key not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your environment.");
      return;
    }

    const loadGoogleMaps = async () => {
      if (typeof (window as any).google?.maps !== "undefined") {
        setGoogleMapsLoaded(true);
        return;
      }

      try {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,visualization`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          setGoogleMapsLoaded(true);
        };
        
        script.onerror = () => {
          setLoadError("Failed to load Google Maps. Please check your API key and internet connection.");
        };
        
        document.head.appendChild(script);
      } catch (error) {
        setLoadError("Error loading Google Maps script.");
      }
    };

    loadGoogleMaps();
  }, []);

  // EVENTU: Initialize Google Map
  useEffect(() => {
    if (!googleMapsLoaded || !mapContainerRef.current || mapRef.current) return;

    try {
      const google = (window as any).google;
      
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 40.748, lng: -73.985 }, // NYC
        zoom: 13,
        mapTypeId: "roadmap",
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#334155" }]
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#0f172a" }]
          }
        ],
        mapId: "event-u-dark-map"
      });

      // EVENTU: Initialize Places service for location data
      placesServiceRef.current = new google.maps.places.PlacesService(mapRef.current);

      // EVENTU: Load heatmap based on Google Maps data
      loadGoogleBasedHeatmap();
      
      // EVENTU: Add event markers
      if (events && events.length > 0) {
        addEventMarkers();
      }
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
      setLoadError("Error initializing map. Please refresh the page.");
    }

    return () => {
      clearMarkers();
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setMap(null);
      }
    };
  }, [googleMapsLoaded]);

  // EVENTU: Update heatmap when data changes
  useEffect(() => {
    if (mapRef.current && googleMapsLoaded) {
      loadGoogleBasedHeatmap();
    }
  }, [data, googleMapsLoaded]);

  // EVENTU: Update event markers when events change
  useEffect(() => {
    if (mapRef.current && googleMapsLoaded && events) {
      addEventMarkers();
    }
  }, [events, googleMapsLoaded]);

  // EVENTU: Load heatmap based on Google Maps location density and public signals
  const loadGoogleBasedHeatmap = () => {
    if (!mapRef.current || !googleMapsLoaded) return;

    const google = (window as any).google;
    const heatmapData: any[] = [];

    // EVENTU: Phase 1 - Use Google Maps data directly
    // Search for active locations in the current viewport
    const center = mapRef.current.getCenter();
    
    // EVENTU: Query nearby places using Google Places API
    const request = {
      location: center,
      radius: 5000, // 5km radius
      type: ['restaurant', 'bar', 'night_club', 'cafe', 'food']
    };

    if (placesServiceRef.current) {
      placesServiceRef.current.nearbySearch(request, (results: any[], status: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          results.forEach((place: any) => {
            if (place.geometry?.location) {
              // EVENTU: Weight by Google's public signals
              let weight = 0.5; // base weight
              
              // EVENTU: Factor in rating
              if (place.rating) {
                weight += (place.rating / 5) * 0.2;
              }
              
              // EVENTU: Factor in user ratings total (popularity)
              if (place.user_ratings_total) {
                const popularityScore = Math.min(place.user_ratings_total / 1000, 1);
                weight += popularityScore * 0.3;
              }
              
              // EVENTU: Factor in open_now status (higher weight if currently open)
              if (place.opening_hours?.open_now) {
                weight += 0.3;
              }

              // EVENTU: Create weighted location for heatmap
              heatmapData.push({
                location: place.geometry.location,
                weight: Math.min(weight, 1)
              });
            }
          });

          // EVENTU: If USE_INTERNAL_HEATMAP_LOGIC is enabled, combine with internal data
          if (USE_INTERNAL_HEATMAP_LOGIC && data && data.length > 0) {
            data.forEach((point: any) => {
              heatmapData.push({
                location: new google.maps.LatLng(
                  parseFloat(point.latitude),
                  parseFloat(point.longitude)
                ),
                weight: point.intensity || 0.5
              });
            });
          }

          // EVENTU: Create or update heatmap layer
          if (heatmapLayerRef.current) {
            heatmapLayerRef.current.setMap(null);
          }

          heatmapLayerRef.current = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: mapRef.current,
            radius: 30,
            opacity: 0.7,
            gradient: [
              'rgba(0, 0, 255, 0)',
              'rgba(59, 130, 246, 1)',
              'rgba(16, 185, 129, 1)',
              'rgba(245, 158, 11, 1)',
              'rgba(249, 115, 22, 1)',
              'rgba(239, 68, 68, 1)'
            ]
          });
        }
      });
    }
  };

  // EVENTU: Add event markers with boost indicators
  const addEventMarkers = () => {
    if (!mapRef.current || !events) return;

    const google = (window as any).google;
    clearMarkers();

    events.forEach((event: any) => {
      const lat = parseFloat(event.location?.latitude) || 40.748;
      const lng = parseFloat(event.location?.longitude) || -73.985;
      const position = { lat, lng };

      // EVENTU: Check if event is boosted
      const isBoosted = event.is_boosted && 
        (!event.boost_until || new Date(event.boost_until) > new Date());

      // EVENTU: Create custom marker with glow effect for boosted events
      const markerColor = getEventColor(event.eventType);
      
      const marker = new google.maps.Marker({
        position,
        map: mapRef.current,
        title: event.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isBoosted ? 12 : 8,
          fillColor: markerColor,
          fillOpacity: isBoosted ? 1 : 0.8,
          strokeColor: isBoosted ? "#fff" : markerColor,
          strokeWeight: isBoosted ? 3 : 2,
        },
        animation: isBoosted ? google.maps.Animation.BOUNCE : null,
      });

      // EVENTU: Add click listener
      marker.addListener("click", () => {
        if (onEventSelect) {
          onEventSelect(event);
        }
      });

      markersRef.current.push(marker);
    });
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      clubs: "#EF4444",
      bars: "#F97316",
      shows: "#F59E0B",
      fairs: "#10B981",
      food: "#3B82F6",
      other: "#6B7280",
    };
    return colors[type] || colors.other;
  };

  // EVENTU: Error state with friendly message
  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Map Configuration Required</h3>
          <p className="text-gray-400 mb-4">{loadError}</p>
          <p className="text-sm text-gray-500">
            To enable the interactive map and heatmap features, please configure your Google Maps API key.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        <div className="text-center">
          <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  if (!googleMapsLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        <div className="text-center">
          <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full"
      style={{ minHeight: "calc(100vh - 120px)" }}
      data-testid="map-container"
    />
  );
}
