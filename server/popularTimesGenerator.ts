// Gerador de horários populares padrão baseado no tipo de estabelecimento

export interface PopularTimes {
  monday: number[];
  tuesday: number[];
  wednesday: number[];
  thursday: number[];
  friday: number[];
  saturday: number[];
  sunday: number[];
}

/**
 * Gera horários populares padrão baseado no tipo de lugar
 * Cada array tem 24 valores (0-23h), cada valor de 0-100
 */
export function generateDefaultPopularTimes(placeType: string): PopularTimes {
  const patterns: Record<string, { weekday: number[]; weekend: number[] }> = {
    // Bares: pico à noite, especialmente fins de semana
    bar: {
      weekday: [5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 70, 60, 50, 40],
      weekend: [10, 10, 5, 5, 5, 10, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95, 100, 95, 90, 85, 80, 75, 70, 60]
    },
    
    // Baladas: pico muito tarde, especialmente fins de semana
    night_club: {
      weekday: [5, 5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 95, 90, 80],
      weekend: [20, 20, 15, 10, 5, 5, 5, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100, 100, 95, 90, 85, 80]
    },
    
    // Restaurantes: pico no almoço e jantar
    restaurant: {
      weekday: [5, 5, 5, 5, 5, 10, 20, 30, 40, 50, 60, 70, 80, 75, 70, 60, 50, 40, 70, 80, 75, 60, 40, 20],
      weekend: [10, 5, 5, 5, 5, 10, 25, 40, 55, 70, 80, 85, 90, 85, 80, 75, 70, 65, 80, 85, 80, 70, 50, 30]
    },
    
    // Cafés: pico pela manhã e tarde
    cafe: {
      weekday: [5, 5, 5, 5, 10, 20, 40, 60, 80, 90, 85, 70, 60, 50, 55, 60, 70, 75, 65, 50, 35, 20, 10, 5],
      weekend: [5, 5, 5, 5, 10, 20, 35, 50, 70, 85, 90, 85, 75, 65, 60, 65, 70, 65, 55, 40, 25, 15, 10, 5]
    },
    
    // Teatros/Cinemas: pico à noite
    movie_theater: {
      weekday: [5, 5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 85, 70, 50, 30],
      weekend: [10, 5, 5, 5, 5, 10, 15, 25, 35, 45, 55, 65, 75, 85, 90, 95, 95, 90, 85, 80, 70, 55, 35, 20]
    }
  };

  // Usa o padrão de bar como fallback
  const pattern = patterns[placeType] || patterns.bar;

  return {
    monday: pattern.weekday,
    tuesday: pattern.weekday,
    wednesday: pattern.weekday,
    thursday: pattern.weekday.map(v => Math.min(Math.round(v * 1.1), 100)), // 10% mais cheio
    friday: pattern.weekend,
    saturday: pattern.weekend,
    sunday: pattern.weekday.map(v => Math.round(v * 0.8)) // 20% mais vazio
  };
}

/**
 * Obtém a popularidade atual baseado no dia e hora
 */
export function getCurrentPopularity(popularTimes: PopularTimes, date: Date = new Date()): number {
  const dayOfWeek = date.getDay(); // 0-6 (Domingo-Sábado)
  const hour = date.getHours(); // 0-23

  const dayNames: (keyof PopularTimes)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  const currentDay = dayNames[dayOfWeek];
  const popularityArray = popularTimes[currentDay];

  if (!popularityArray || !popularityArray[hour]) {
    return 50; // Valor padrão
  }

  return popularityArray[hour];
}

/**
 * Obtém o horário de pico (hora com maior popularidade)
 */
export function getPeakHour(popularTimes: PopularTimes, dayOfWeek: keyof PopularTimes): number {
  const dayPopularity = popularTimes[dayOfWeek];
  if (!dayPopularity) return 20; // Padrão: 20h

  let maxPopularity = 0;
  let peakHour = 20;

  dayPopularity.forEach((popularity, hour) => {
    if (popularity > maxPopularity) {
      maxPopularity = popularity;
      peakHour = hour;
    }
  });

  return peakHour;
}

/**
 * Obtém a popularidade média do dia
 */
export function getAveragePopularity(popularTimes: PopularTimes, dayOfWeek: keyof PopularTimes): number {
  const dayPopularity = popularTimes[dayOfWeek];
  if (!dayPopularity) return 50;

  const sum = dayPopularity.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / dayPopularity.length);
}

/**
 * Determina o status baseado na popularidade
 */
export function getPopularityStatus(popularity: number): string {
  if (popularity >= 80) return 'Muito Cheio';
  if (popularity >= 60) return 'Movimentado';
  if (popularity >= 40) return 'Moderado';
  return 'Tranquilo';
}

/**
 * Determina a cor baseada na popularidade
 */
export function getPopularityColor(popularity: number): string {
  if (popularity >= 80) return 'red';
  if (popularity >= 60) return 'orange';
  if (popularity >= 40) return 'yellow';
  return 'green';
}

