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

      // EVENTU: Dark theme styles for the map
      const darkMapStyles = [
        { elementType: "geometry", stylers: [{ color: "#212121" }] },
        { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
        {
          featureType: "administrative",
          elementType: "geometry",
          stylers: [{ color: "#757575" }],
        },
        {
          featureType: "administrative.country",
          elementType: "labels.text.fill",
          stylers: [{ color: "#9e9e9e" }],
        },
        {
          featureType: "administrative.land_parcel",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "administrative.locality",
          elementType: "labels.text.fill",
          stylers: [{ color: "#bdbdbd" }],
        },
        {
          featureType: "poi",
          elementType: "labels.text.fill",
          stylers: [{ color: "#757575" }],
        },
        {
          featureType: "poi.park",
          elementType: "geometry",
          stylers: [{ color: "#181818" }],
        },
        {
          featureType: "poi.park",
          elementType: "labels.text.fill",
          stylers: [{ color: "#616161" }],
        },
        {
          featureType: "poi.park",
          elementType: "labels.text.stroke",
          stylers: [{ color: "#1b1b1b" }],
        },
        {
          featureType: "road",
          elementType: "geometry.fill",
          stylers: [{ color: "#2c2c2c" }],
        },
        {
          featureType: "road",
          elementType: "labels.text.fill",
          stylers: [{ color: "#8a8a8a" }],
        },
        {
          featureType: "road.arterial",
          elementType: "geometry",
          stylers: [{ color: "#373737" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [{ color: "#3c3c3c" }],
        },
        {
          featureType: "road.highway.controlled_access",
          elementType: "geometry",
          stylers: [{ color: "#4e4e4e" }],
        },
        {
          featureType: "road.local",
          elementType: "labels.text.fill",
          stylers: [{ color: "#616161" }],
        },
        {
          featureType: "transit",
          elementType: "labels.text.fill",
          stylers: [{ color: "#757575" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#000000" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.fill",
          stylers: [{ color: "#3d3d3d" }],
        },
      ];

      // EVENTU: Initialize map with dark theme
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 40.7589, lng: -73.9851 }, // NYC - Times Square
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: darkMapStyles, // EVENTU: Apply dark theme
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

    // EVENTU: STEP 1 - Create heatmap IMMEDIATELY with demo data (don't wait for Places API)
    console.log('[EVENTU:MAP] Creating heatmap with demo data...'); // EVENTU: Debug log

    // EVENTU: Demo hotspots around Manhattan for immediate visualization
    const demoHotspots = [
      // Times Square area (high activity)
      { lat: 40.758, lng: -73.9855, weight: 1.5 },
      { lat: 40.7589, lng: -73.9851, weight: 1.3 },
      { lat: 40.7575, lng: -73.986, weight: 1.2 },
      
      // Greenwich Village (medium-high activity)
      { lat: 40.7335, lng: -74.0027, weight: 1.0 },
      { lat: 40.7342, lng: -74.0015, weight: 0.9 },
      
      // Lower East Side (medium activity)
      { lat: 40.7209, lng: -73.9862, weight: 0.8 },
      { lat: 40.7198, lng: -73.9875, weight: 0.7 },
      
      // Chelsea (medium activity)
      { lat: 40.7465, lng: -74.0014, weight: 0.9 },
      { lat: 40.7455, lng: -74.0025, weight: 0.8 },
      
      // Union Square (high activity)
      { lat: 40.7359, lng: -73.9911, weight: 1.2 },
      { lat: 40.7368, lng: -73.9906, weight: 1.1 },
      
      // SoHo (medium activity)
      { lat: 40.7233, lng: -74.0030, weight: 0.9 },
      
      // East Village (medium-high activity)
      { lat: 40.7265, lng: -73.9815, weight: 1.0 },
      { lat: 40.7273, lng: -73.9822, weight: 0.95 }
    ];
    
    demoHotspots.forEach(spot => {
      heatmapData.push({
        location: new google.maps.LatLng(spot.lat, spot.lng),
        weight: spot.weight
      });
    });

    // EVENTU: Add internal heatmap data if enabled
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

    console.log('[EVENTU:MAP] Heatmap data points (demo + internal):', heatmapData.length); // EVENTU: Debug log

    // EVENTU: Create or update heatmap layer IMMEDIATELY
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setMap(null);
    }

    if (heatmapData.length > 0) {
      heatmapLayerRef.current = new google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: mapRef.current,
        radius: 50, // EVENTU: Larger radius for prominent blobs
        opacity: 0.7, // EVENTU: Good visibility on dark theme
        maxIntensity: 2, // EVENTU: Max intensity for hotspots
        gradient: [
          'rgba(0, 0, 0, 0)', // EVENTU: Transparent at edges
          'rgba(0, 51, 102, 0.6)', // EVENTU: Dark blue (low activity)
          'rgba(0, 102, 204, 0.8)', // EVENTU: Medium blue
          'rgba(16, 185, 129, 1)', // EVENTU: Cyan/teal (medium activity)
          'rgba(245, 158, 11, 1)', // EVENTU: Yellow/amber (high activity)
          'rgba(249, 115, 22, 1)', // EVENTU: Orange (very high)
          'rgba(239, 68, 68, 1)' // EVENTU: Red (hottest spots)
        ]
      });
      console.log('[EVENTU:MAP] ✅ Heatmap layer created successfully with demo data!'); // EVENTU: Debug log
    } else {
      console.warn('[EVENTU:MAP] No heatmap data to display'); // EVENTU: Debug log
    }

    // EVENTU: STEP 2 - Try Places API in background (optional enhancement)
    const center = mapRef.current.getCenter();
    const types = FILTER_TO_PLACES_TYPES[currentFilter] || FILTER_TO_PLACES_TYPES.all;
    
    const request = {
      location: center,
      radius: 5000, // 5km radius
      type: types
    };

    console.log('[EVENTU:MAP] Attempting Places API request (filter:', currentFilter, 'types:', types, ')'); // EVENTU: Debug log

    // EVENTU: Add timeout to detect if callback is blocked
    let callbackExecuted = false;
    const timeoutId = setTimeout(() => {
      if (!callbackExecuted) {
        console.warn('[EVENTU:MAP] ⚠️ Places API callback NOT executed after 5 seconds - using demo data only'); // EVENTU: Debug log
      }
    }, 5000);

    if (placesServiceRef.current) {
      placesServiceRef.current.nearbySearch(request, (results: any[], status: any) => {
        callbackExecuted = true;
        clearTimeout(timeoutId);
        try {
          console.log('[EVENTU:MAP] 🎉 Places API callback executed!'); // EVENTU: Debug log
          console.log('[EVENTU:MAP] Places API status:', status, 'Results:', results?.length || 0); // EVENTU: Debug log
          
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            console.log('[EVENTU:MAP] ✅ Places API working! Combining with demo data...'); // EVENTU: Debug log
            
            const combinedData = [...heatmapData];
          
            results.forEach((place: any) => {
              if (place.geometry?.location) {
                let weight = 0.5;
                
                if (place.rating) {
                  weight += (place.rating / 5) * 0.2;
                }
                
                if (place.user_ratings_total) {
                  const popularityScore = Math.min(place.user_ratings_total / 1000, 1);
                  weight += popularityScore * 0.3;
                }
                
                if (place.opening_hours?.open_now) {
                  weight += 0.3;
                }

                const boostedEvent = events?.find((e: any) => 
                  e.location?.googlePlaceId === place.place_id && 
                  e.isBoosted && 
                  (!e.boostUntil || new Date(e.boostUntil) > new Date())
                );
                
                if (boostedEvent) {
                  weight += 0.2 * (boostedEvent.boostLevel || 1);
                }

                combinedData.push({
                  location: place.geometry.location,
                  weight: Math.min(weight, 1.5)
                });
              }
            });

            console.log('[EVENTU:MAP] Combined data points:', combinedData.length); // EVENTU: Debug log

            // EVENTU: Update heatmap with combined data
            if (heatmapLayerRef.current) {
              heatmapLayerRef.current.setMap(null);
            }

            heatmapLayerRef.current = new google.maps.visualization.HeatmapLayer({
              data: combinedData,
              map: mapRef.current,
              radius: 50,
              opacity: 0.7,
              maxIntensity: 2,
              gradient: [
                'rgba(0, 0, 0, 0)',
                'rgba(0, 51, 102, 0.6)',
                'rgba(0, 102, 204, 0.8)',
                'rgba(16, 185, 129, 1)',
                'rgba(245, 158, 11, 1)',
                'rgba(249, 115, 22, 1)',
                'rgba(239, 68, 68, 1)'
              ]
            });
            console.log('[EVENTU:MAP] ✅ Heatmap updated with Places API data!'); // EVENTU: Debug log
          } else {
            console.warn('[EVENTU:MAP] Places API status:', status, '- keeping demo data only'); // EVENTU: Debug log
          }
        } catch (error) {
          console.error('[EVENTU:MAP] ERROR in Places API callback:', error); // EVENTU: Debug log
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

      // EVENTU: Create custom info window content
      const formatTime = (dateStr: string) => {
        try {
          const date = new Date(dateStr);
          return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch {
          return dateStr;
        }
      };

      const infoContent = `
        <div style="padding: 12px; max-width: 250px; font-family: system-ui, -apple-system, sans-serif; color: #111;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: ${markerColor};">
            ${event.title || 'Event'}
          </h3>
          ${event.description ? `
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #555; line-height: 1.4;">
              ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}
            </p>
          ` : ''}
          <div style="font-size: 13px; color: #666; margin-top: 8px;">
            ${event.location?.name ? `
              <div style="margin-bottom: 4px;">
                📍 <strong>${event.location.name}</strong>
              </div>
            ` : ''}
            ${event.startTime ? `
              <div style="margin-bottom: 4px;">
                🕒 ${formatTime(event.startTime)}${event.endTime ? ` - ${formatTime(event.endTime)}` : ''}
              </div>
            ` : ''}
            ${event.eventType ? `
              <div style="margin-bottom: 4px;">
                🎉 ${event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}
              </div>
            ` : ''}
            ${isBoosted ? `
              <div style="margin-top: 8px; padding: 4px 8px; background: ${markerColor}20; border-radius: 4px; font-weight: 600; color: ${markerColor};">
                ⭐ Boosted Event
              </div>
            ` : ''}
          </div>
        </div>
      `;

      // EVENTU: Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: infoContent,
      });

      // EVENTU: Add click listener to show info window
      marker.addListener("click", () => {
        // Close any open info windows
        markersRef.current.forEach((m: any) => {
          if (m.infoWindow) {
            m.infoWindow.close();
          }
        });
        
        // Open this info window
        infoWindow.open(mapRef.current, marker);
        
        // Optionally also trigger event selection
        if (onEventSelect) {
          onEventSelect(event);
        }
      });

      // EVENTU: Store info window reference with marker
      (marker as any).infoWindow = infoWindow;

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
