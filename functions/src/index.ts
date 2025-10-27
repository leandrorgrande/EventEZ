import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import * as cheerio from "cheerio";

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Middleware de autenticação
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// Helper functions
const db = admin.firestore();

// ============ USERS ============

app.get('/users/:id', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    res.json({ id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// Make users admin by email (one-time setup endpoint)
app.post('/users/make-admin', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }
    
    // Buscar usuário pelo email na coleção users
    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    
    if (usersSnapshot.empty) {
      res.status(404).json({ message: `User with email ${email} not found` });
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    await userDoc.ref.update({
      userType: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ 
      message: `User ${email} is now an admin`,
      userId: userDoc.id,
      email: email
    });
  } catch (error) {
    console.error('Error making user admin:', error);
    res.status(500).json({ message: "Failed to make user admin" });
  }
});

// ============ EVENTS ============

app.get('/events', async (req: express.Request, res: express.Response) => {
  try {
    const eventType = req.query.eventType as string;
    const isActive = req.query.isActive === 'true';
    const approvalStatus = req.query.approvalStatus as string;
    
    console.log('[API] GET /events - Query params:', { eventType, isActive, approvalStatus });
    
    let query: FirebaseFirestore.Query = db.collection('events');
    
    if (eventType) {
      query = query.where('eventType', '==', eventType);
    }
    
    if (isActive !== undefined) {
      query = query.where('isActive', '==', isActive);
    }
    
    const snapshot = await query.orderBy('startDateTime', 'desc').get();
    let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log('[API] Total de eventos no Firestore:', events.length);
    
    // Filtrar por approvalStatus (se não especificado, retorna apenas aprovados por padrão)
    if (approvalStatus) {
      if (approvalStatus === 'all') {
        console.log('[API] Retornando TODOS os eventos (admin)');
        // Retornar TODOS os eventos (admin)
        // Não aplicar filtro
      } else {
        console.log('[API] Filtrando por approvalStatus:', approvalStatus);
        events = events.filter((e: any) => e.approvalStatus === approvalStatus);
      }
    } else {
      console.log('[API] Padrão: retornando apenas eventos aprovados');
      // Por padrão, retornar apenas eventos aprovados
      events = events.filter((e: any) => e.approvalStatus === 'approved');
    }
    
    console.log('[API] Eventos após filtro:', events.length);
    
    // Buscar coordenadas dos lugares se necessário
    for (const event of events) {
      if ((event as any).locationId && (event as any).locationId !== 'unknown') {
        try {
          const locationDoc = await db.collection('locations').doc((event as any).locationId).get();
          if (locationDoc.exists) {
            (event as any).location = { ...locationDoc.data() };
          }
        } catch (err) {
          console.error('[API] Erro ao buscar location:', err);
        }
      }
    }
    
    console.log('[API] Eventos retornados:', events.length);
    res.json(events);
  } catch (error) {
    console.error('[API] Erro ao buscar eventos:', error);
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

app.post('/events', authenticate, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { locationName, locationAddress, googlePlaceId, ...eventData } = req.body;
    
    console.log('[API] Criando evento - User UID:', user.uid);
    console.log('[API] Event Data recebido:', JSON.stringify(eventData, null, 2));
    console.log('[API] Location Info:', { locationName, locationAddress, googlePlaceId });
    
    // Buscar lugar existente no Firestore pelo placeId
    let locationRef = null;
    
    if (googlePlaceId) {
      console.log('[API] Buscando lugar no Firestore pelo placeId:', googlePlaceId);
      const placeQuery = await db.collection('places')
        .where('placeId', '==', googlePlaceId)
        .limit(1)
        .get();
      
      if (!placeQuery.empty) {
        const placeData = placeQuery.docs[0].data();
        console.log('[API] Lugar encontrado no Firestore:', placeData.name);
        
        // Criar localização se não existir
        const locationData = {
          name: locationName || placeData.name,
          address: locationAddress || placeData.formattedAddress,
          latitude: placeData.latitude,
          longitude: placeData.longitude,
          googlePlaceId,
          category: placeData.types?.[0],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        
        locationRef = await db.collection('locations').add(locationData);
        console.log('[API] Location criada:', locationRef.id);
      } else {
        console.log('[API] Lugar NÃO encontrado no Firestore pelo placeId:', googlePlaceId);
      }
    }
    
    // Se não encontrou lugar, criar nova localização
    if (!locationRef && locationName && locationAddress) {
      console.log('[API] Criando nova location sem placeId');
      const newLocation = {
        name: locationName,
        address: locationAddress,
        latitude: eventData.latitude || null,
        longitude: eventData.longitude || null,
        googlePlaceId: googlePlaceId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      locationRef = await db.collection('locations').add(newLocation);
      console.log('[API] Location criada:', locationRef.id);
    }
    
    // Criar evento
    const finalEventData = {
      ...eventData,
      creatorId: user.uid,
      locationId: locationRef?.id || 'unknown',
      placeId: googlePlaceId || null,
      approvalStatus: 'pending', // EVENTU: Eventos precisam de aprovação
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    console.log('[API] Dados finais do evento:', JSON.stringify(finalEventData, null, 2));
    
    const docRef = await db.collection('events').add(finalEventData);
    const newEvent = { id: docRef.id, ...finalEventData };
    
    console.log('[API] Evento criado com sucesso! ID:', docRef.id);
    console.log('[API] Evento completo:', JSON.stringify(newEvent, null, 2));
    
    res.json(newEvent);
  } catch (error) {
    console.error('[API] Erro ao criar evento:', error);
    res.status(400).json({ message: "Failed to create event" });
  }
});

app.patch('/events/:eventId', authenticate, async (req: express.Request, res: express.Response) => {
  try {
    const { eventId } = req.params;
    const { approvalStatus, ...otherData } = req.body;
    
    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (approvalStatus) {
      updateData.approvalStatus = approvalStatus;
      updateData.reviewedBy = (req as any).user.uid;
      updateData.reviewedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    if (otherData && Object.keys(otherData).length > 0) {
      Object.assign(updateData, otherData);
    }
    
    await eventRef.update(updateData);
    
    const updatedEvent = { id: eventDoc.id, ...eventDoc.data(), ...updateData };
    
    res.json(updatedEvent);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(400).json({ message: "Failed to update event" });
  }
});

// ============ PLACES ============

app.get('/places', async (req: express.Request, res: express.Response) => {
  try {
    const snapshot = await db.collection('places').get();
    const places = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(places);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch places" });
  }
});

app.post('/places/search-santos', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { locationType = 'bar' } = req.body;
    
    // Use hardcoded API key (temporary for debugging)
    const apiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
    
    console.log('[API] Buscando lugares do tipo:', locationType);
    console.log('[API] API Key configurada:', apiKey ? 'SIM' : 'NÃO');
    
    if (!apiKey) {
      res.status(500).json({ message: "Google Maps API key not configured" });
      return;
    }

    // Santos coordinates
    const santosLat = -23.9608;
    const santosLng = -46.3332;

    const typeMapping: Record<string, string> = {
      bars: 'bar',
      clubs: 'night_club',
      shows: 'movie_theater',
      food: 'restaurant',
      fairs: 'amusement_park'
    };

    const placeType = typeMapping[locationType] || 'bar';

    const url = 'https://places.googleapis.com/v1/places:searchNearby';
    
    const requestBody: any = {
      includedTypes: [placeType],
      maxResultCount: 20, // Google limita a 20 por requisição
      locationRestriction: {
        circle: {
          center: { latitude: santosLat, longitude: santosLng },
          radius: 15000 // Aumentado para 15km (cobrir toda Santos)
        }
      }
    };

    console.log('[API] Fazendo requisição para:', url);
    console.log('[API] Body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours,places.currentOpeningHours,places.primaryType'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('[API] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Erro da Google Places API:', errorText);
      res.status(response.status).json({ 
        message: "Failed to search places", 
        error: errorText,
        apiKey: apiKey.substring(0, 10) + '...' // Log parcial da key
      });
      return;
    }

    const data = await response.json();
    const savedPlaces = [];
    let newPlacesCount = 0;
    let existingPlacesCount = 0;
    
    console.log('[API] Lugares recebidos da Google:', data.places?.length || 0);

    // Função para extrair horários de funcionamento
    const extractOpeningHours = (regularOpeningHours: any) => {
      console.log('[API] extractOpeningHours chamada com:', JSON.stringify(regularOpeningHours, null, 2));
      
      if (!regularOpeningHours) {
        console.log('[API] regularOpeningHours é null/undefined');
        return null;
      }
      
      if (!regularOpeningHours.weekdayDescriptions) {
        console.log('[API] weekdayDescriptions não existe em regularOpeningHours');
        console.log('[API] Keys disponíveis:', Object.keys(regularOpeningHours));
        return null;
      }
      
      const hours: any = {
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null
      };
      
      const dayMapping: Record<string, string> = {
        'Segunda-feira': 'monday',
        'Terça-feira': 'tuesday',
        'Quarta-feira': 'wednesday',
        'Quinta-feira': 'thursday',
        'Sexta-feira': 'friday',
        'Sábado': 'saturday',
        'Domingo': 'sunday',
        'Monday': 'monday',
        'Tuesday': 'tuesday',
        'Wednesday': 'wednesday',
        'Thursday': 'thursday',
        'Friday': 'friday',
        'Saturday': 'saturday',
        'Sunday': 'sunday'
      };
      
      console.log('[API] weekdayDescriptions:', regularOpeningHours.weekdayDescriptions);
      
      regularOpeningHours.weekdayDescriptions.forEach((desc: string, index: number) => {
        console.log(`[API] Processando descrição ${index}:`, desc);
        
        // Exemplo: "Segunda-feira: 18:00 – 02:00"
        const parts = desc.split(':');
        console.log(`[API] Parts split por ':' :`, parts);
        
        if (parts.length < 2) {
          console.log(`[API] Descrição tem menos de 2 partes, pulando`);
          return;
        }
        
        const dayName = parts[0].trim();
        const hoursText = parts.slice(1).join(':').trim();
        
        console.log(`[API] Day name: ${dayName}, Hours text: ${hoursText}`);
        
        const dayKey = dayMapping[dayName];
        console.log(`[API] Day key mapeado: ${dayKey}`);
        
        if (dayKey) {
          if (hoursText.toLowerCase().includes('fechado') || hoursText.toLowerCase().includes('closed')) {
            hours[dayKey] = { open: null, close: null, closed: true };
            console.log(`[API] ${dayKey}: FECHADO`);
          } else {
            // Extrair horários (ex: "18:00 – 02:00")
            const timeMatch = hoursText.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              hours[dayKey] = {
                open: `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`,
                close: `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}`,
                closed: false
              };
              console.log(`[API] ${dayKey}: ${hours[dayKey].open} - ${hours[dayKey].close}`);
            } else {
              console.log(`[API] ${dayKey}: Não conseguiu extrair horários da string "${hoursText}"`);
            }
          }
        } else {
          console.log(`[API] Day key ${dayName} não encontrado no mapping`);
        }
      });
      
      console.log('[API] Horários extraídos:', JSON.stringify(hours, null, 2));
      
      return hours;
    };

    // Função para gerar horários populares baseados no horário de funcionamento
    const generateDefaultPopularTimes = (placeType: string, openingHours: any) => {
      const isNightlife = ['bar', 'night_club'].includes(placeType);
      
      const weekdayPattern = isNightlife 
        ? [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 85, 80, 75, 70, 65, 85, 90, 95, 90, 80]
        : [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30];
      
      const weekendPattern = isNightlife
        ? [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 85, 90, 90, 85, 80, 75, 80, 90, 95, 100, 95, 85]
        : [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40];

      const popularTimes: any = {
        monday: [...weekdayPattern],
        tuesday: [...weekdayPattern],
        wednesday: [...weekdayPattern],
        thursday: weekdayPattern.map(v => Math.min(100, v + 10)),
        friday: [...weekendPattern],
        saturday: [...weekendPattern],
        sunday: [...weekdayPattern]
      };
      
      // Ajustar baseado nos horários de funcionamento
      if (openingHours) {
        Object.keys(popularTimes).forEach(day => {
          const dayHours = openingHours[day];
          
          if (!dayHours || dayHours.closed) {
            // Fechado o dia todo
            popularTimes[day] = Array(24).fill(0);
            console.log(`[API] ${day}: FECHADO o dia todo`);
          } else if (dayHours.open && dayHours.close) {
            // Zerar horários fora do funcionamento
            const openHour = parseInt(dayHours.open.split(':')[0]);
            const closeHour = parseInt(dayHours.close.split(':')[0]);
            
            let zeroedHours = 0;
            for (let hour = 0; hour < 24; hour++) {
              if (closeHour > openHour) {
                // Horário normal (ex: 10:00 - 22:00)
                if (hour < openHour || hour >= closeHour) {
                  popularTimes[day][hour] = 0;
                  zeroedHours++;
                }
              } else {
                // Cruza meia-noite (ex: 18:00 - 02:00)
                if (hour >= closeHour && hour < openHour) {
                  popularTimes[day][hour] = 0;
                  zeroedHours++;
                }
              }
            }
            console.log(`[API] ${day}: ${dayHours.open} - ${dayHours.close} (zerou ${zeroedHours} horas)`);
          }
        });
      }
      
      return popularTimes;
    };

    for (const place of data.places || []) {
      const placeType = place.primaryType || 'bar';
      
      console.log('[API] Processando lugar:', place.displayName?.text);
      console.log('[API] regularOpeningHours disponível:', !!place.regularOpeningHours);
      console.log('[API] currentOpeningHours disponível:', !!place.currentOpeningHours);
      
      // Extrair horários de funcionamento
      const openingHours = extractOpeningHours(place.regularOpeningHours);
      
      // Calcular isOpen baseado no currentOpeningHours
      let isOpenValue = null;
      if (place.currentOpeningHours) {
        isOpenValue = place.currentOpeningHours.openNow || null;
      }
      
      console.log('[API] isOpen calculado:', isOpenValue);
      console.log('[API] openingHours extraído:', openingHours ? 'SIM' : 'NÃO');
      if (openingHours) {
        console.log('[API] Exemplo de horário (monday):', openingHours.monday);
      }
      
      // Gerar popularTimes baseado nos horários de funcionamento
      const popularTimes = generateDefaultPopularTimes(placeType, openingHours);
      
      const placeInfo = {
        placeId: place.id,
        name: place.displayName?.text || 'Unknown',
        formattedAddress: place.formattedAddress || '',
        latitude: place.location?.latitude?.toString() || null,
        longitude: place.location?.longitude?.toString() || null,
        rating: place.rating || null,
        userRatingsTotal: place.userRatingCount || 0,
        googleMapsUri: place.googleMapsUri || null, // ⭐ URL DO GOOGLE MAPS PARA SCRAPING
        isOpen: isOpenValue, // ⭐ STATUS ATUAL (aberto/fechado AGORA)
        types: place.primaryType ? [place.primaryType] : [],
        openingHours: openingHours, // ⭐ HORÁRIOS DE FUNCIONAMENTO POR DIA
        popularTimes: popularTimes, // ⭐ POPULAR TIMES AJUSTADOS
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      console.log('[API] Salvando lugar:', place.displayName?.text);
      console.log('[API] Horários extraídos:', openingHours ? JSON.stringify(openingHours, null, 2) : 'NÃO');
      console.log('[API] Popular Times gerados:', popularTimes ? 'SIM' : 'NÃO');

      const existingQuery = await db.collection('places')
        .where('placeId', '==', place.id)
        .get();

      if (!existingQuery.empty) {
        // Lugar já existe, SEMPRE atualizar para pegar horários de funcionamento
        existingPlacesCount++;
        const docRef = existingQuery.docs[0].ref;
        
        // SEMPRE atualiza para garantir que horários de funcionamento e isOpen estão atualizados
        await docRef.update({
          ...placeInfo,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('[API] Atualizado lugar existente com novos horários:', place.displayName?.text);
      } else {
        // Lugar novo, adicionar
        newPlacesCount++;
        const docRef = await db.collection('places').add(placeInfo);
        savedPlaces.push({ id: docRef.id, ...placeInfo });
        console.log('[API] Novo lugar adicionado:', place.displayName?.text);
      }
    }
    
    console.log('[API] Novos lugares:', newPlacesCount);
    console.log('[API] Lugares já existentes:', existingPlacesCount);
    console.log('[API] Total processado:', data.places?.length || 0);

    res.json({ 
      places: savedPlaces,
      count: savedPlaces.length,
      newPlaces: newPlacesCount,
      existingPlaces: existingPlacesCount,
      totalProcessed: data.places?.length || 0,
      message: newPlacesCount > 0 
        ? `${newPlacesCount} novos lugares adicionados! (${existingPlacesCount} já existiam)`
        : `Nenhum lugar novo encontrado. Todos os ${existingPlacesCount} já estavam no banco.`,
      note: 'Google Places API limita a 20 resultados por requisição. Clique novamente para buscar mais lugares diferentes.'
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to search places" });
  }
});

// Função para fazer scraping de Popular Times do Google Maps
const scrapePopularTimes = async (placeName: string, googleMapsUri: string): Promise<any | null> => {
  try {
    console.log(`[Scraping] 🔍 Iniciando scraping para: ${placeName}`);
    console.log(`[Scraping] 📍 URL: ${googleMapsUri}`);
    
    // Usar axios para fazer requisição HTTP
    const axios = require('axios');
    console.log(`[Scraping] ⏳ Fazendo requisição HTTP...`);
    
    const response = await axios.get(googleMapsUri, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log(`[Scraping] ✅ Resposta recebida. Status: ${response.status}`);
    console.log(`[Scraping] 📄 Tamanho do HTML: ${response.data.length} caracteres`);
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Tentar extrair popular times do HTML
    const popularTimes: any = {
      monday: Array(24).fill(0),
      tuesday: Array(24).fill(0),
      wednesday: Array(24).fill(0),
      thursday: Array(24).fill(0),
      friday: Array(24).fill(0),
      saturday: Array(24).fill(0),
      sunday: Array(24).fill(0)
    };
    
    // Procurar por scripts que contenham dados de popular times
    const scripts = $('script[type="application/ld+json"]');
    console.log(`[Scraping] 📜 Scripts JSON-LD encontrados: ${scripts.length}`);
    
    let dataExtracted = false;
    
    scripts.each((i: number, elem: any) => {
      try {
        const scriptContent = $(elem).html();
        if (scriptContent) {
          console.log(`[Scraping] 📝 Processando script ${i + 1}...`);
          const data = JSON.parse(scriptContent);
          
          console.log(`[Scraping] 🔑 Chaves no script: ${Object.keys(data).join(', ')}`);
          
          // Tentar extrair popular times de diferentes formatos
          if (data.popularTimes && Array.isArray(data.popularTimes)) {
            console.log(`[Scraping] 🎯 popularTimes encontrado!`);
            data.popularTimes.forEach((day: any, index: number) => {
              const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
              const dayName = dayNames[index];
              
              if (day.popularity && Array.isArray(day.popularity)) {
                popularTimes[dayName] = day.popularity.map((hour: any) => {
                  // Normalizar para 0-100
                  return Math.min(100, Math.max(0, hour.value || hour || 0));
                });
                console.log(`[Scraping] ✅ ${dayName}: ${day.popularity.length} horários extraídos`);
                dataExtracted = true;
              }
            });
          }
        }
      } catch (parseError) {
        console.log(`[Scraping] ⚠️ Erro ao processar script ${i + 1}:`, parseError);
      }
    });
    
    if (dataExtracted) {
      console.log(`[Scraping] ✅ Popular times extraídos com sucesso para: ${placeName}`);
      console.log(`[Scraping] 📊 Exemplo (monday): [${popularTimes.monday.slice(0, 5).join(', ')}, ...]`);
      return popularTimes;
    } else {
      console.log(`[Scraping] ⚠️ Nenhum dado extraído para: ${placeName}`);
      return null;
    }
    
  } catch (error) {
    console.error(`[Scraping] ❌ Erro ao fazer scraping para ${placeName}:`, error);
    return null;
  }
};

// Update popular times (admin)
app.put('/places/:placeId/popular-times', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { placeId } = req.params;
    const { popularTimes, dataSource = 'manual' } = req.body;
    
    console.log('[API] Atualizando popular times para:', placeId);
    
    // Buscar lugar no Firestore
    const placesQuery = await db.collection('places')
      .where('id', '==', placeId)
      .limit(1)
      .get();
    
    if (placesQuery.empty) {
      res.status(404).json({ message: "Place not found" });
      return;
    }
    
    const placeDoc = placesQuery.docs[0];
    
    // Atualizar
    await placeDoc.ref.update({
      popularTimes,
      dataSource,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('[API] Popular times atualizado com sucesso');
    
    res.json({ 
      message: "Popular times updated successfully",
      placeId,
      dataSource
    });
  } catch (error: any) {
    console.error('[API] Erro ao atualizar popular times:', error);
    res.status(500).json({ message: "Failed to update popular times" });
  }
});

// Atualizar horários de todos os lugares existentes
app.post('/places/update-all-hours', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const apiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
    
    console.log('[API] Buscando todos os lugares do Firestore...');
    
    // Buscar todos os lugares
    const placesSnapshot = await db.collection('places').get();
    const places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    console.log(`[API] Encontrados ${places.length} lugares no Firestore`);
    
    // Função helper para extrair horários (reutilizar do código acima)
    const extractOpeningHoursLocal = (regularOpeningHours: any) => {
      if (!regularOpeningHours?.weekdayDescriptions) return null;
      
      const hours: any = {
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null
      };
      
      const dayMapping: Record<string, string> = {
        'Segunda-feira': 'monday',
        'Terça-feira': 'tuesday',
        'Quarta-feira': 'wednesday',
        'Quinta-feira': 'thursday',
        'Sexta-feira': 'friday',
        'Sábado': 'saturday',
        'Domingo': 'sunday',
        'Monday': 'monday',
        'Tuesday': 'tuesday',
        'Wednesday': 'wednesday',
        'Thursday': 'thursday',
        'Friday': 'friday',
        'Saturday': 'saturday',
        'Sunday': 'sunday'
      };
      
      regularOpeningHours.weekdayDescriptions.forEach((desc: string) => {
        const parts = desc.split(':');
        if (parts.length < 2) return;
        
        const dayName = parts[0].trim();
        const hoursText = parts.slice(1).join(':').trim();
        
        const dayKey = dayMapping[dayName];
        if (dayKey) {
          if (hoursText.toLowerCase().includes('fechado') || hoursText.toLowerCase().includes('closed')) {
            hours[dayKey] = { open: null, close: null, closed: true };
          } else {
            const timeMatch = hoursText.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              hours[dayKey] = {
                open: `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`,
                close: `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}`,
                closed: false
              };
            }
          }
        }
      });
      
      return hours;
    };
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const place of places) {
      try {
        if (!place.placeId) {
          console.log(`[API] Place sem placeId, pulando: ${place.name}`);
          continue;
        }
        
        console.log(`[API] Atualizando: ${place.name} (${place.placeId})`);
        
        // Buscar detalhes do lugar na Google Places API
        const placeDetailsUrl = `https://places.googleapis.com/v1/places/${place.placeId}`;
        
        const detailsResponse = await fetch(placeDetailsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'regularOpeningHours,currentOpeningHours,displayName,rating,userRatingCount'
          }
        });
        
        if (!detailsResponse.ok) {
          console.error(`[API] Erro ao buscar detalhes: ${detailsResponse.status}`);
          errorCount++;
          continue;
        }
        
        const placeDetails = await detailsResponse.json();
        
        // Extrair horários
        const openingHours = extractOpeningHoursLocal(placeDetails.regularOpeningHours);
        let isOpenValue = null;
        if (placeDetails.currentOpeningHours) {
          isOpenValue = placeDetails.currentOpeningHours.openNow || null;
        }
        
        // Atualizar no Firestore
        const placeRef = db.collection('places').doc(place.id);
        await placeRef.update({
          openingHours,
          isOpen: isOpenValue,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        updatedCount++;
        console.log(`[API] ✅ Atualizado: ${place.name}`);
        
        // Aguardar 500ms entre requisições para não exceder rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`[API] Erro ao atualizar ${place.name}:`, error);
        errorCount++;
      }
    }
    
    res.json({
      message: 'Atualização concluída',
      total: places.length,
      updated: updatedCount,
      errors: errorCount
    });
    
  } catch (error) {
    console.error('[API] Erro geral:', error);
    res.status(500).json({ message: "Failed to update places" });
  }
});

// Endpoint para fazer scraping de Popular Times com logs detalhados
app.post('/places/scrape-popular-times', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const results: any[] = [];
    
    console.log('[Scraping] Iniciando scraping de Popular Times...');
    
    // Buscar todos os lugares
    const placesSnapshot = await db.collection('places').limit(10).get(); // Limitar para teste
    const places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    console.log(`[Scraping] Encontrados ${places.length} lugares para processar`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      const result: any = {
        placeName: place.name,
        placeId: place.id,
        status: 'processing',
        logs: [],
        data: null,
        error: null
      };
      
      try {
        result.logs.push(`🔍 Iniciando scraping para: ${place.name}`);
        console.log(`[Scraping] [${i + 1}/${places.length}] Processando: ${place.name}`);
        
        // Buscar googleMapsUri no Firestore
        if (!place.googleMapsUri) {
          result.status = 'skipped';
          result.logs.push('⚠️ Place sem googleMapsUri, pulando');
          result.error = 'Sem URL do Google Maps';
          results.push(result);
          errorCount++;
          continue;
        }
        
        result.logs.push(`📍 URL: ${place.googleMapsUri.substring(0, 50)}...`);
        
        // Fazer scraping
        const scrapedPopularTimes = await scrapePopularTimes(place.name, place.googleMapsUri);
        
        if (scrapedPopularTimes) {
          result.logs.push('✅ Dados extraídos com sucesso!');
          result.status = 'success';
          result.data = {
            hasData: true,
            sample: {
              monday: scrapedPopularTimes.monday.slice(0, 5),
              friday: scrapedPopularTimes.friday.slice(0, 5)
            }
          };
          
          // Atualizar no Firestore
          const placeRef = db.collection('places').doc(place.id);
          await placeRef.update({
            popularTimes: scrapedPopularTimes,
            dataSource: 'scraped',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          result.logs.push('💾 Dados salvos no Firestore');
          successCount++;
          console.log(`[Scraping] ✅ Popular times atualizado para: ${place.name}`);
        } else {
          result.status = 'no_data';
          result.error = 'Não foi possível extrair popular times';
          result.logs.push('⚠️ Nenhum dado extraído');
          errorCount++;
          console.log(`[Scraping] ❌ Não foi possível extrair popular times para: ${place.name}`);
        }
        
        results.push(result);
        
        // Aguardar 2 segundos entre requisições para evitar bloqueio
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        result.status = 'error';
        result.error = error.message;
        result.logs.push(`❌ Erro: ${error.message}`);
        console.error(`[Scraping] Erro ao processar ${place.name}:`, error);
        errorCount++;
        results.push(result);
      }
    }
    
    console.log('[Scraping] Scraping concluído');
    
    res.json({
      message: 'Scraping concluído',
      total: places.length,
      success: successCount,
      errors: errorCount,
      results: results
    });
    
  } catch (error) {
    console.error('[Scraping] Erro geral:', error);
    res.status(500).json({ message: "Failed to scrape popular times" });
  }
});

// Export all functions
export const api = onRequest({ region: 'us-central1' }, app);
