// Serviço para integração com Google Places API
import { googleMapsApiKey } from './firebase';

export interface Place {
  id: string;
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  rating?: number;
  userRatingsTotal?: number;
  types?: string[];
  regularOpeningHours?: any;
  currentPopularity?: number;
}

// Coordenadas de Santos, SP
export const SANTOS_CENTER = {
  lat: -23.9608,
  lng: -46.3332
};

// Tipos de locais para buscar
export const PLACE_TYPES = {
  bars: 'bar',
  clubs: 'night_club',
  restaurants: 'restaurant',
  cafes: 'cafe'
};

/**
 * Busca lugares próximos em Santos usando Google Places API (New)
 */
export async function searchNearbyPlaces(
  locationType: string = 'bar',
  maxResults: number = 20
): Promise<Place[]> {
  try {
    const response = await fetch('/api/places/search-santos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locationType,
        maxResults
      })
    });

    if (!response.ok) {
      throw new Error('Failed to search places');
    }

    const data = await response.json();
    return data.places || [];
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
}

/**
 * Busca horários populares de um lugar específico
 */
export async function getPlacePopularTimes(placeId: string): Promise<any> {
  try {
    const response = await fetch(`/api/places/${placeId}/popular-times`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch popular times');
    }

    const data = await response.json();
    return data.regularOpeningHours;
  } catch (error) {
    console.error('Error fetching popular times:', error);
    return null;
  }
}

/**
 * Lista todos os lugares salvos no banco de dados
 */
export async function getSavedPlaces(): Promise<Place[]> {
  try {
    const response = await fetch('/api/places');
    
    if (!response.ok) {
      throw new Error('Failed to fetch saved places');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching saved places:', error);
    return [];
  }
}

/**
 * Gera dados de heatmap baseado nos lugares e suas popularidades
 */
export function generateHeatmapData(places: Place[]): google.maps.LatLngLiteral[] {
  const heatmapData: google.maps.LatLngLiteral[] = [];
  
  places.forEach(place => {
    if (place.latitude && place.longitude) {
      // Adiciona múltiplos pontos baseado na popularidade
      const weight = place.currentPopularity || place.userRatingsTotal || 1;
      const intensity = Math.min(Math.ceil(weight / 10), 10);
      
      for (let i = 0; i < intensity; i++) {
        heatmapData.push({
          lat: place.latitude,
          lng: place.longitude
        });
      }
    }
  });
  
  return heatmapData;
}

/**
 * Calcula a popularidade atual baseado no horário
 */
export function getCurrentPopularity(place: Place): number {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Horários de pico para bares em Santos
  // Quinta a Sábado: 20h-2h
  // Outros dias: 18h-23h
  
  const isWeekend = currentDay === 5 || currentDay === 6; // Sexta ou Sábado
  const isThursday = currentDay === 4;
  
  if (isWeekend || isThursday) {
    if (currentHour >= 20 || currentHour <= 2) {
      return 90 + Math.random() * 10; // 90-100% de popularidade
    } else if (currentHour >= 18 && currentHour < 20) {
      return 60 + Math.random() * 20; // 60-80% de popularidade
    }
  } else {
    if (currentHour >= 18 && currentHour <= 23) {
      return 50 + Math.random() * 30; // 50-80% de popularidade
    }
  }
  
  return 10 + Math.random() * 20; // 10-30% de popularidade em outros horários
}

/**
 * Carrega o script do Google Maps
 */
export function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
}

