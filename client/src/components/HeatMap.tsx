import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface HeatMapProps {
  data?: any[];
  events?: any[];
  isLoading?: boolean;
  onEventSelect?: (event: any) => void;
}

export default function HeatMap({ data, events, isLoading, onEventSelect }: HeatMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);

  // Load Mapbox GL JS
  useEffect(() => {
    const loadMapbox = async () => {
      if (typeof window !== "undefined") {
        // Load Mapbox CSS
        const link = document.createElement("link");
        link.href = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css";
        link.rel = "stylesheet";
        document.head.appendChild(link);

        // Load Mapbox JS
        const script = document.createElement("script");
        script.src = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js";
        script.onload = () => setMapboxLoaded(true);
        document.head.appendChild(script);
      }
    };

    if (!mapboxLoaded) {
      loadMapbox();
    }
  }, [mapboxLoaded]);

  // Initialize map
  useEffect(() => {
    if (!mapboxLoaded || !mapContainerRef.current || mapRef.current) return;

    // Use environment variable for Mapbox token or fallback
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || "pk.example_token";
    
    if (typeof (window as any).mapboxgl !== "undefined") {
      (window as any).mapboxgl.accessToken = mapboxToken;
      
      mapRef.current = new (window as any).mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v10",
        center: [-73.985, 40.748], // NYC
        zoom: 12,
        pitch: 45,
        bearing: 0,
      });

      mapRef.current.on("load", () => {
        addHeatmapLayer();
        if (events) {
          addEventMarkers();
        }
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxLoaded]);

  // Update heatmap data
  useEffect(() => {
    if (mapRef.current && data) {
      updateHeatmapData(data);
    }
  }, [data]);

  // Update event markers
  useEffect(() => {
    if (mapRef.current && events) {
      addEventMarkers();
    }
  }, [events]);

  const generateHeatmapGeoJSON = (heatData: any[]) => {
    if (!heatData || heatData.length === 0) {
      // Generate mock data for demonstration
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { intensity: 0.8 },
            geometry: { type: "Point", coordinates: [-73.9851, 40.7589] }
          },
          {
            type: "Feature",
            properties: { intensity: 0.6 },
            geometry: { type: "Point", coordinates: [-73.9934, 40.7505] }
          },
          {
            type: "Feature",
            properties: { intensity: 0.9 },
            geometry: { type: "Point", coordinates: [-73.9942, 40.7282] }
          },
          {
            type: "Feature",
            properties: { intensity: 0.7 },
            geometry: { type: "Point", coordinates: [-73.9776, 40.7614] }
          },
          {
            type: "Feature",
            properties: { intensity: 0.5 },
            geometry: { type: "Point", coordinates: [-73.9680, 40.7489] }
          },
        ],
      };
    }

    return {
      type: "FeatureCollection",
      features: heatData.map((point) => ({
        type: "Feature",
        properties: {
          intensity: point.intensity || 0.5,
        },
        geometry: {
          type: "Point",
          coordinates: [parseFloat(point.longitude), parseFloat(point.latitude)],
        },
      })),
    };
  };

  const addHeatmapLayer = () => {
    if (!mapRef.current) return;

    const heatmapData = generateHeatmapGeoJSON(data || []);

    if (mapRef.current.getSource("heatmap-data")) {
      mapRef.current.getSource("heatmap-data").setData(heatmapData);
      return;
    }

    mapRef.current.addSource("heatmap-data", {
      type: "geojson",
      data: heatmapData,
    });

    mapRef.current.addLayer({
      id: "heatmap-layer",
      type: "heatmap",
      source: "heatmap-data",
      paint: {
        "heatmap-weight": ["get", "intensity"],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(59, 130, 246, 0)",
          0.2, "rgba(59, 130, 246, 1)",
          0.4, "rgba(16, 185, 129, 1)",
          0.6, "rgba(245, 158, 11, 1)",
          0.8, "rgba(249, 115, 22, 1)",
          1, "rgba(239, 68, 68, 1)",
        ],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0.6],
      },
    });
  };

  const updateHeatmapData = (heatData: any[]) => {
    if (!mapRef.current || !mapRef.current.getSource("heatmap-data")) return;

    const geoJsonData = generateHeatmapGeoJSON(heatData);
    mapRef.current.getSource("heatmap-data").setData(geoJsonData);
  };

  const addEventMarkers = () => {
    if (!mapRef.current || !events) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll(".event-marker");
    existingMarkers.forEach(marker => marker.remove());

    events.forEach((event) => {
      // Mock coordinates for events if not provided
      const lng = event.location?.longitude || (-73.985 + (Math.random() - 0.5) * 0.02);
      const lat = event.location?.latitude || (40.748 + (Math.random() - 0.5) * 0.02);

      const markerColor = getEventColor(event.eventType);
      
      const marker = new (window as any).mapboxgl.Marker({
        color: markerColor,
        className: "event-marker",
      })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

      marker.getElement().addEventListener("click", () => {
        if (onEventSelect) {
          onEventSelect(event);
        }
      });
    });
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

  if (!mapboxLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        <div className="text-center">
          <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading Mapbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full"
      style={{ minHeight: "100vh" }}
      data-testid="map-container"
    />
  );
}
