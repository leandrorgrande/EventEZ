import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

interface HeatMapGoogleProps {
  data?: any[];
  events?: any[];
  isLoading?: boolean;
  onEventSelect?: (event: any) => void;
  currentFilter?: string; // EVENTU: P0 - Filter for place types
  onCreateEventAtPlace?: (placeId: string, placeName: string, lat: number, lng: number) => void; // EVENTU: P0 - Create event callback
}

// EVENTU: Flag for future internal heatmap logic combining with Google signals
const USE_INTERNAL_HEATMAP_LOGIC = false;

// EVENTU: P0 - Map event types to Google Places types
const FILTER_TO_PLACES_TYPES: Record<string, string[]> = {
  clubs: ['night_club'],
  bars: ['bar'],
  shows: ['movie_theater', 'stadium', 'art_gallery', 'museum'],
  fairs: ['amusement_park', 'tourist_attraction', 'park', 'campground'],
  food: ['restaurant', 'cafe'],
  all: ['restaurant', 'bar', 'night_club', 'cafe', 'food']
};

export default function HeatMapGoogle({ 
  data, 
  events, 
  isLoading, 
  onEventSelect, 
  currentFilter = 'all',
  onCreateEventAtPlace 
}: HeatMapGoogleProps) {
  console.log('[EVENTU:COMPONENT] HeatMapGoogle component mounted/rendered'); // EVENTU: Debug log
  console.log('[EVENTU:COMPONENT] Props:', { dataLength: data?.length, eventsLength: events?.length, isLoading, currentFilter }); // EVENTU: Debug log
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [containerMounted, setContainerMounted] = useState(false); // EVENTU: Track when container is mounted
  const heatmapLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const placeMarkersRef = useRef<any[]>([]); // EVENTU: P0 - Separate markers for places
  const placesServiceRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null); // EVENTU: P0 - InfoWindow reference

  // EVENTU: Load Google Maps with Places and Visualization libraries
  useEffect(() => {
    console.log('[EVENTU:COMPONENT] Google Maps loading effect triggered'); // EVENTU: Debug log
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

  // EVENTU: Track when container div is mounted
  useEffect(() => {
    if (mapContainerRef.current && !containerMounted) {
      console.log('[EVENTU:MAP] Container mounted!'); // EVENTU: Debug log
      setContainerMounted(true);
    }
  }, [mapContainerRef.current, containerMounted]);

  // EVENTU: Initialize Google Map
  useEffect(() => {
    console.log('[EVENTU:MAP-INIT-CHECK] Checking conditions:', { 
      googleMapsLoaded, 
      containerMounted,
      hasContainer: !!mapContainerRef.current, 
      mapExists: !!mapRef.current 
    }); // EVENTU: Debug log
    
    if (!googleMapsLoaded || !containerMounted || !mapContainerRef.current || mapRef.current) {
      console.log('[EVENTU:MAP-INIT-CHECK] Cannot initialize - bailing out'); // EVENTU: Debug log
      return;
    }

    console.log('[EVENTU:MAP] Starting map initialization...'); // EVENTU: Debug log
    console.log('[EVENTU:MAP] Container ref exists:', !!mapContainerRef.current); // EVENTU: Debug log
    console.log('[EVENTU:MAP] Google maps loaded:', !!googleMapsLoaded); // EVENTU: Debug log

    try {
      const google = (window as any).google;
      
      if (!google || !google.maps) {
        console.error('[EVENTU:MAP] Google Maps API not available');
        setLoadError("Google Maps API not loaded properly");
        return;
      }

      // EVENTU: P0 - Initialize map without mapId and with minimal config first
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 40.7589, lng: -73.9851 }, // NYC - Times Square
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      
      console.log('[EVENTU:MAP] Map object created:', !!mapRef.current); // EVENTU: Debug log
      
      // EVENTU: Initialize Places service immediately for location data
      placesServiceRef.current = new google.maps.places.PlacesService(mapRef.current);
      console.log('[EVENTU:MAP] Places service initialized'); // EVENTU: Debug log

      // EVENTU: Load heatmap based on Google Maps data (with delay to ensure map is ready)
      setTimeout(() => {
        console.log('[EVENTU:MAP] Loading heatmap...'); // EVENTU: Debug log
        loadGoogleBasedHeatmap();
      }, 1500);
      
      // EVENTU: Add event markers
      if (events && events.length > 0) {
        setTimeout(() => addEventMarkers(), 1500);
      }

    } catch (error) {
      console.error("[EVENTU:MAP] Error initializing Google Maps:", error);
      setLoadError("Error initializing map. Please refresh the page.");
    }

    return () => {
      console.log('[EVENTU:MAP] Cleaning up map'); // EVENTU: Debug log
      clearMarkers();
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setMap(null);
      }
    };
  }, [googleMapsLoaded, containerMounted]); // EVENTU: Updated dependencies

  // EVENTU: Update heatmap when data or filter changes
  useEffect(() => {
    if (mapRef.current && googleMapsLoaded && placesServiceRef.current) {
      console.log('[EVENTU:MAP] Reloading heatmap due to filter/data change'); // EVENTU: Debug log
      loadGoogleBasedHeatmap();
    }
  }, [data, googleMapsLoaded, currentFilter]);

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
    
    // EVENTU: P0 - Get types based on current filter
    const types = FILTER_TO_PLACES_TYPES[currentFilter] || FILTER_TO_PLACES_TYPES.all;
    
    // EVENTU: Query nearby places using Google Places API with filter
    const request = {
      location: center,
      radius: 5000, // 5km radius
      type: types
    };

    console.log('[EVENTU:MAP] Requesting places with filter:', currentFilter, 'types:', types); // EVENTU: Debug log

    if (placesServiceRef.current) {
      placesServiceRef.current.nearbySearch(request, (results: any[], status: any) => {
        console.log('[EVENTU:MAP] Places API callback executed!'); // EVENTU: Debug log
        console.log('[EVENTU:MAP] Places API response status:', status); // EVENTU: Debug log
        console.log('[EVENTU:MAP] Places API results count:', results?.length || 0); // EVENTU: Debug log
        
        // EVENTU: Log detailed error information
        if (status !== google.maps.places.PlacesServiceStatus.OK) {
          console.error('[EVENTU:MAP] Places API ERROR - Status:', status); // EVENTU: Debug log
          console.error('[EVENTU:MAP] Possible causes:'); // EVENTU: Debug log
          console.error('[EVENTU:MAP] - ZERO_RESULTS: No places found'); // EVENTU: Debug log
          console.error('[EVENTU:MAP] - OVER_QUERY_LIMIT: Too many requests'); // EVENTU: Debug log
          console.error('[EVENTU:MAP] - REQUEST_DENIED: API key issue or billing not enabled'); // EVENTU: Debug log
          console.error('[EVENTU:MAP] - INVALID_REQUEST: Bad request parameters'); // EVENTU: Debug log
          console.error('[EVENTU:MAP] - UNKNOWN_ERROR: Server error, try again'); // EVENTU: Debug log
          return; // EVENTU: Exit early on error
        }
        
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('[EVENTU:MAP] Places found:', results.length); // EVENTU: Debug log
          
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

              // EVENTU: Check for boosted events at this place
              const boostedEvent = events?.find((e: any) => 
                e.location?.googlePlaceId === place.place_id && 
                e.isBoosted && 
                (!e.boostUntil || new Date(e.boostUntil) > new Date())
              );
              
              if (boostedEvent) {
                weight += 0.2 * (boostedEvent.boostLevel || 1); // EVENTU: Boost bonus
              }

              // EVENTU: Create weighted location for heatmap
              heatmapData.push({
                location: place.geometry.location,
                weight: Math.min(weight, 1.5) // Allow slightly higher weight for boosted
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

          console.log('[EVENTU:MAP] Heatmap data points:', heatmapData.length); // EVENTU: Debug log

          // EVENTU: Create or update heatmap layer
          if (heatmapLayerRef.current) {
            heatmapLayerRef.current.setMap(null);
          }

          if (heatmapData.length > 0) {
            heatmapLayerRef.current = new google.maps.visualization.HeatmapLayer({
              data: heatmapData,
              map: mapRef.current,
              radius: 40, // EVENTU: Increased radius for better visibility
              opacity: 0.8, // EVENTU: Increased opacity
              maxIntensity: 2, // EVENTU: Added max intensity
              gradient: [
                'rgba(0, 0, 255, 0)',
                'rgba(59, 130, 246, 1)',
                'rgba(16, 185, 129, 1)',
                'rgba(245, 158, 11, 1)',
                'rgba(249, 115, 22, 1)',
                'rgba(239, 68, 68, 1)'
              ]
            });
            console.log('[EVENTU:MAP] Heatmap layer created successfully'); // EVENTU: Debug log
          } else {
            console.warn('[EVENTU:MAP] No heatmap data to display'); // EVENTU: Debug log
          }
        } else {
          console.error('[EVENTU:MAP] Places search failed with status:', status); // EVENTU: Debug log
        }
      });
    } else {
      console.error('[EVENTU:MAP] Places service not initialized'); // EVENTU: Debug log
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
