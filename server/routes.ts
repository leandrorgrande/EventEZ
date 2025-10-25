import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateDefaultPopularTimes } from "./popularTimesGenerator";
import { 
  insertEventSchema, 
  insertLocationSchema, 
  insertMessageSchema,
  insertCheckinSchema,
  insertHeatmapDataSchema,
  insertBusinessClaimSchema,
  insertPlaceSchema
} from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { places } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Location routes
  app.post('/api/locations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const locationData = insertLocationSchema.parse({
        ...req.body,
        businessOwnerId: userId,
      });
      const location = await storage.createLocation(locationData);
      res.json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(400).json({ message: "Failed to create location" });
    }
  });

  app.get('/api/locations', async (req, res) => {
    try {
      const verified = req.query.verified === 'true' ? true : undefined;
      const locations = await storage.getLocationsByFilter({ verified });
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.get('/api/locations/:id', async (req, res) => {
    try {
      const location = await storage.getLocationById(req.params.id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      console.error("Error fetching location:", error);
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  // Event routes
  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // EVENTU: Convert ISO string dates to Date objects before validation
      const processedBody = {
        ...req.body,
        creatorId: userId,
        startDateTime: req.body.startDateTime ? new Date(req.body.startDateTime) : undefined,
        endDateTime: req.body.endDateTime ? new Date(req.body.endDateTime) : undefined,
      };
      
      // EVENTU: Validate end time is after start time
      if (processedBody.startDateTime && processedBody.endDateTime) {
        if (processedBody.endDateTime <= processedBody.startDateTime) {
          return res.status(400).json({ 
            message: "End date must be after start date" 
          });
        }
      }
      
      const eventData = insertEventSchema.parse(processedBody);
      const event = await storage.createEvent(eventData);
      res.json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(400).json({ message: "Failed to create event" });
    }
  });

  app.get('/api/events', async (req, res) => {
    try {
      const eventType = req.query.eventType as string;
      const isActive = req.query.isActive === 'true' ? true : undefined;
      const events = await storage.getEvents({ eventType, isActive });
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.get('/api/events/:id/attendees', async (req, res) => {
    try {
      const attendees = await storage.getEventAttendees(req.params.id);
      res.json(attendees);
    } catch (error) {
      console.error("Error fetching attendees:", error);
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  });

  app.post('/api/events/:id/attend', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      
      const attendee = await storage.addEventAttendee({
        eventId,
        userId,
        status: 'confirmed',
      });
      res.json(attendee);
    } catch (error) {
      console.error("Error joining event:", error);
      res.status(400).json({ message: "Failed to join event" });
    }
  });

  app.delete('/api/events/:id/attend', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      
      await storage.removeEventAttendee(eventId, userId);
      res.json({ message: "Left event successfully" });
    } catch (error) {
      console.error("Error leaving event:", error);
      res.status(400).json({ message: "Failed to leave event" });
    }
  });

  // Check-in routes
  app.post('/api/checkins', async (req, res) => {
    try {
      const checkinData = insertCheckinSchema.parse(req.body);
      const checkin = await storage.createCheckin(checkinData);
      
      // Update heatmap data based on check-in
      await storage.updateHeatmapIntensity(
        parseFloat(checkinData.latitude),
        parseFloat(checkinData.longitude),
        0.5 // Base intensity for a check-in
      );
      
      res.json(checkin);
    } catch (error) {
      console.error("Error creating check-in:", error);
      res.status(400).json({ message: "Failed to create check-in" });
    }
  });

  app.get('/api/checkins/recent', async (req, res) => {
    try {
      const minutes = parseInt(req.query.minutes as string) || 60;
      const checkins = await storage.getRecentCheckins(minutes);
      res.json(checkins);
    } catch (error) {
      console.error("Error fetching recent check-ins:", error);
      res.status(500).json({ message: "Failed to fetch recent check-ins" });
    }
  });

  // Message routes
  app.post('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId: userId,
      });
      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(400).json({ message: "Failed to send message" });
    }
  });

  app.get('/api/messages/:otherUserId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const otherUserId = req.params.otherUserId;
      const messages = await storage.getMessages(userId, otherUserId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Heatmap routes
  app.get('/api/heatmap/live', async (req, res) => {
    try {
      const heatmapData = await storage.getLiveHeatmapData();
      res.json(heatmapData);
    } catch (error) {
      console.error("Error fetching live heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch live heatmap data" });
    }
  });

  app.get('/api/heatmap/prediction', async (req, res) => {
    try {
      // Get upcoming events for prediction calculation
      const upcomingEvents = await storage.getEvents({ isActive: true });
      const currentTime = new Date();
      
      const predictionData = [];
      
      for (const event of upcomingEvents) {
        if (new Date(event.startDateTime) > currentTime) {
          // Get event attendees count
          const attendees = await storage.getEventAttendees(event.id);
          const confirmedCount = attendees.filter(a => a.status === 'confirmed').length;
          
          // Get location for coordinates
          const location = await storage.getLocationById(event.locationId);
          if (location) {
            // Calculate prediction score based on the specified formula
            const eventTypeWeights = {
              clubs: 2.0,
              bars: 1.5,
              shows: 1.0,
              fairs: 1.0,
              food: 0.5,
              other: 0.5
            };
            
            const eventWeight = eventTypeWeights[event.eventType as keyof typeof eventTypeWeights] || 0.5;
            const popularTimesScore = 0.6; // Mock popular times score
            
            const predictionScore = (confirmedCount * 1.0) + (popularTimesScore * 0.8) + eventWeight;
            const intensity = Math.min(predictionScore / 10, 1.0); // Normalize to 0-1
            
            predictionData.push({
              id: `prediction_${event.id}`,
              latitude: location.latitude,
              longitude: location.longitude,
              intensity,
              eventType: event.eventType,
              isLive: false,
              timestamp: new Date(),
            });
          }
        }
      }
      
      res.json(predictionData);
    } catch (error) {
      console.error("Error calculating prediction heatmap data:", error);
      res.status(500).json({ message: "Failed to calculate prediction heatmap data" });
    }
  });

  app.post('/api/heatmap', async (req, res) => {
    try {
      const heatmapEntry = insertHeatmapDataSchema.parse(req.body);
      const data = await storage.createHeatmapData(heatmapEntry);
      res.json(data);
    } catch (error) {
      console.error("Error creating heatmap data:", error);
      res.status(400).json({ message: "Failed to create heatmap data" });
    }
  });

  // User profile routes
  app.get('/api/users/:id/events', async (req, res) => {
    try {
      const events = await storage.getEventsByCreator(req.params.id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching user events:", error);
      res.status(500).json({ message: "Failed to fetch user events" });
    }
  });

  // Business claim routes
  app.post('/api/business-claims', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const claimData = insertBusinessClaimSchema.parse({
        ...req.body,
        userId,
      });
      const claim = await storage.createBusinessClaim(claimData);
      res.json(claim);
    } catch (error) {
      console.error("Error creating business claim:", error);
      res.status(400).json({ message: "Failed to create business claim" });
    }
  });

  app.get('/api/business-claims', isAuthenticated, async (req: any, res) => {
    try {
      const userType = req.user.claims.user_type || "regular";
      
      if (userType === "admin") {
        // Admins can see all claims
        const status = req.query.status as string;
        const claims = await storage.getBusinessClaims(status);
        res.json(claims);
      } else {
        // Regular users can only see their own claims
        const userId = req.user.claims.sub;
        const allClaims = await storage.getBusinessClaims();
        const userClaims = allClaims.filter(claim => claim.userId === userId);
        res.json(userClaims);
      }
    } catch (error) {
      console.error("Error fetching business claims:", error);
      res.status(500).json({ message: "Failed to fetch business claims" });
    }
  });

  app.patch('/api/business-claims/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userType = req.user.claims.user_type || "regular";
      
      if (userType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { status } = req.body;
      const claim = await storage.updateBusinessClaimStatus(req.params.id, status);
      
      if (!claim) {
        return res.status(404).json({ message: "Business claim not found" });
      }
      
      res.json(claim);
    } catch (error) {
      console.error("Error updating business claim:", error);
      res.status(400).json({ message: "Failed to update business claim" });
    }
  });

  // Google Places API routes - Buscar horários populares
  app.post('/api/places/fetch-popular-times', isAuthenticated, async (req: any, res) => {
    try {
      const { placeId } = req.body;
      
      if (!placeId) {
        return res.status(400).json({ message: "Place ID is required" });
      }

      const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Buscar detalhes do lugar incluindo horários populares
      const url = `https://places.googleapis.com/v1/places/${placeId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,googleMapsUri,regularOpeningHours,primaryType'
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Google Places API error:", errorData);
        return res.status(response.status).json({ message: "Failed to fetch place data" });
      }

      const placeData = await response.json();

      // Processar dados do lugar
      const placeInfo = {
        placeId: placeData.id || placeId,
        name: placeData.displayName?.text || 'Unknown',
        formattedAddress: placeData.formattedAddress || '',
        latitude: placeData.location?.latitude || null,
        longitude: placeData.location?.longitude || null,
        rating: placeData.rating || null,
        userRatingsTotal: placeData.userRatingCount || 0,
        isOpen: null, // Precisa de lógica adicional para verificar status atual
        types: placeData.primaryType ? [placeData.primaryType] : [],
        regularOpeningHours: placeData.regularOpeningHours || null,
      };

      // Verificar se o lugar já existe no banco
      const [existingPlace] = await db
        .select()
        .from(places)
        .where(eq(places.placeId, placeId));

      if (existingPlace) {
        // Atualizar dados existentes
        const [updatedPlace] = await db
          .update(places)
          .set({
            ...placeInfo,
            updatedAt: new Date(),
          })
          .where(eq(places.placeId, placeId))
          .returning();
        
        res.json(updatedPlace);
      } else {
        // Criar novo registro
        const [newPlace] = await db
          .insert(places)
          .values(placeInfo)
          .returning();
        
        res.json(newPlace);
      }
    } catch (error) {
      console.error("Error fetching place data:", error);
      res.status(500).json({ message: "Failed to fetch place data" });
    }
  });

  // Buscar lugares em Santos por tipo (bares, baladas, etc)
  app.post('/api/places/search-santos', isAuthenticated, async (req: any, res) => {
    try {
      const { locationType = 'bar', paginationToken } = req.body;
      
      const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Santos, São Paulo, Brasil - coordenadas aproximadas
      const santosLat = -23.9608;
      const santosLng = -46.3332;

      // Mapeamento de tipos de evento para tipos do Google Places
      const typeMapping: Record<string, string> = {
        bars: 'bar',
        clubs: 'night_club',
        shows: 'movie_theater',
        food: 'restaurant',
        fairs: 'amusement_park'
      };

      const placeType = typeMapping[locationType] || 'bar';

      // Buscar lugares em Santos
      const url = 'https://places.googleapis.com/v1/places:searchNearby';
      
      const requestBody: any = {
        includedTypes: [placeType],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: {
              latitude: santosLat,
              longitude: santosLng
            },
            radius: 10000 // 10km de raio
          }
        }
      };

      if (paginationToken) {
        requestBody.pageToken = paginationToken;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours,places.primaryType'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Google Places Search error:", errorData);
        return res.status(response.status).json({ message: "Failed to search places" });
      }

      const data = await response.json();

      // Salvar lugares no banco de dados
      const savedPlaces = [];
      for (const place of data.places || []) {
        const placeInfo = {
          placeId: place.id,
          name: place.displayName?.text || 'Unknown',
          formattedAddress: place.formattedAddress || '',
          latitude: place.location?.latitude || null,
          longitude: place.location?.longitude || null,
          rating: place.rating || null,
          userRatingsTotal: place.userRatingCount || 0,
          isOpen: null,
          types: place.primaryType ? [place.primaryType] : [],
        };

        try {
          const [existingPlace] = await db
            .select()
            .from(places)
            .where(eq(places.placeId, place.id));

          if (existingPlace) {
            const [updated] = await db
              .update(places)
              .set({ ...placeInfo, updatedAt: new Date() })
              .where(eq(places.placeId, place.id))
              .returning();
            savedPlaces.push(updated);
          } else {
            const [newPlace] = await db
              .insert(places)
              .values(placeInfo)
              .returning();
            savedPlaces.push(newPlace);
          }
        } catch (error) {
          console.error(`Error saving place ${place.id}:`, error);
        }
      }

      res.json({
        places: savedPlaces,
        nextPageToken: data.nextPageToken
      });
    } catch (error) {
      console.error("Error searching places:", error);
      res.status(500).json({ message: "Failed to search places" });
    }
  });

  // Listar lugares salvos no banco
  app.get('/api/places', async (req, res) => {
    try {
      const allPlaces = await db.select().from(places);
      res.json(allPlaces);
    } catch (error) {
      console.error("Error fetching places:", error);
      res.status(500).json({ message: "Failed to fetch places" });
    }
  });

  // Buscar horários populares de um lugar específico
  app.get('/api/places/:placeId/popular-times', async (req, res) => {
    try {
      const { placeId } = req.params;
      
      const [place] = await db
        .select()
        .from(places)
        .where(eq(places.placeId, placeId));

      if (!place) {
        return res.status(404).json({ message: "Place not found" });
      }

      // Retornar dados do lugar incluindo horários de funcionamento
      res.json({
        placeId: place.placeId,
        name: place.name,
        openingHours: place.regularOpeningHours || null,
        rating: place.rating,
        userRatingsTotal: place.userRatingsTotal
      });
    } catch (error) {
      console.error("Error fetching popular times:", error);
      res.status(500).json({ message: "Failed to fetch popular times" });
    }
  });

  // Admin routes - Visualizar tabelas e dados do banco
  app.get('/api/admin/tables', isAuthenticated, async (req: any, res) => {
    try {
      const userType = req.user.claims.user_type || "regular";
      
      if (userType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Listar todas as tabelas
      const tables = [
        'users', 'events', 'locations', 'places', 'event_attendees',
        'checkins', 'messages', 'heatmap_data', 'business_claims',
        'claims', 'owners', 'support_tickets', 'profiles'
      ];

      res.json({ tables });
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({ message: "Failed to fetch tables" });
    }
  });

  app.get('/api/admin/tables/:tableName', isAuthenticated, async (req: any, res) => {
    try {
      const userType = req.user.claims.user_type || "regular";
      
      if (userType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { tableName } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      // Query dinâmica baseada no nome da tabela
      let data;
      
      switch (tableName) {
        case 'users':
          data = await db.select().from(users).limit(limit).offset(offset);
          break;
        case 'events':
          data = await db.select().from(events).limit(limit).offset(offset);
          break;
        case 'locations':
          data = await db.select().from(locations).limit(limit).offset(offset);
          break;
        case 'places':
          data = await db.select().from(places).limit(limit).offset(offset);
          break;
        case 'event_attendees':
          data = await db.select().from(eventAttendees).limit(limit).offset(offset);
          break;
        case 'checkins':
          data = await db.select().from(checkins).limit(limit).offset(offset);
          break;
        case 'messages':
          data = await db.select().from(messages).limit(limit).offset(offset);
          break;
        case 'heatmap_data':
          data = await db.select().from(heatmapData).limit(limit).offset(offset);
          break;
        case 'business_claims':
          data = await db.select().from(businessClaims).limit(limit).offset(offset);
          break;
        default:
          return res.status(404).json({ message: "Table not found" });
      }

      // Contar total de registros
      const countResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM ${sql.raw(tableName)}`
      );

      res.json({
        table: tableName,
        data,
        pagination: {
          limit,
          offset,
          total: Number(countResult.rows[0]?.count || 0)
        }
      });
    } catch (error) {
      console.error("Error fetching table data:", error);
      res.status(500).json({ message: "Failed to fetch table data" });
    }
  });

  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userType = req.user.claims.user_type || "regular";
      
      if (userType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Estatísticas do banco
      const stats = {
        users: (await db.select().from(users)).length,
        events: (await db.select().from(events)).length,
        locations: (await db.select().from(locations)).length,
        places: (await db.select().from(places)).length,
        eventAttendees: (await db.select().from(eventAttendees)).length,
        checkins: (await db.select().from(checkins)).length,
        messages: (await db.select().from(messages)).length,
        heatmapData: (await db.select().from(heatmapData)).length,
        businessClaims: (await db.select().from(businessClaims)).length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ GOOGLE PLACES API ROUTES ============
  
  // Buscar lugares em Santos e salvar no Firestore
  app.post('/api/places/search-santos', isAuthenticated, async (req: any, res) => {
    try {
      const { locationType = 'bar', maxResults = 20 } = req.body;
      
      const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Coordenadas de Santos, SP
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

      // Google Places API (New) - Nearby Search
      const url = 'https://places.googleapis.com/v1/places:searchNearby';
      
      const requestBody = {
        includedTypes: [placeType],
        maxResultCount: maxResults,
        locationRestriction: {
          circle: {
            center: { latitude: santosLat, longitude: santosLng },
            radius: 10000 // 10km
          }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours,places.primaryType'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Places API error:', errorText);
        return res.status(response.status).json({ message: "Failed to search places", error: errorText });
      }

      const data = await response.json();
      const savedPlaces = [];

      // Salvar cada lugar no Firestore (PostgreSQL)
      for (const place of data.places || []) {
        const placeInfo = {
          placeId: place.id,
          name: place.displayName?.text || 'Unknown',
          formattedAddress: place.formattedAddress || '',
          latitude: place.location?.latitude?.toString() || null,
          longitude: place.location?.longitude?.toString() || null,
          rating: place.rating || null,
          userRatingsTotal: place.userRatingCount || 0,
          isOpen: null,
          types: place.primaryType ? [place.primaryType] : [],
          
          // Gerar horários populares padrão
          popularTimes: generateDefaultPopularTimes(place.primaryType || 'bar'),
          
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Verificar se já existe
        const existing = await db.select().from(places).where(eq(places.placeId, place.id)).limit(1);

        if (existing.length > 0) {
          // Atualizar existente
          await db.update(places)
            .set({
              ...placeInfo,
              updatedAt: new Date(),
            })
            .where(eq(places.placeId, place.id));
          
          savedPlaces.push({ id: existing[0].id, ...placeInfo });
        } else {
          // Inserir novo
          const [newPlace] = await db.insert(places).values(placeInfo).returning();
          savedPlaces.push(newPlace);
        }
      }

      res.json({ places: savedPlaces, count: savedPlaces.length });
    } catch (error) {
      console.error("Error searching places:", error);
      res.status(500).json({ message: "Failed to search places", error: error.message });
    }
  });

  // Listar lugares salvos
  app.get('/api/places', async (req, res) => {
    try {
      const { city = 'Santos', type } = req.query;
      
      let query = db.select().from(places).where(eq(places.isActive, true));
      
      // Filtrar por tipo se fornecido
      if (type) {
        // Nota: Firestore usa array-contains, PostgreSQL precisa de uma abordagem diferente
        // Por enquanto, retorna todos e filtra no frontend
      }
      
      const allPlaces = await query.limit(100);
      res.json(allPlaces);
    } catch (error) {
      console.error("Error fetching places:", error);
      res.status(500).json({ message: "Failed to fetch places" });
    }
  });

  // Buscar horários populares de um lugar específico
  app.get('/api/places/:placeId/popular-times', async (req, res) => {
    try {
      const { placeId } = req.params;
      
      const [place] = await db.select().from(places).where(eq(places.placeId, placeId)).limit(1);
      
      if (!place) {
        return res.status(404).json({ message: "Place not found" });
      }
      
      res.json({
        placeId: place.placeId,
        name: place.name,
        popularTimes: place.popularTimes,
        currentPopularity: getCurrentPopularityForPlace(place.popularTimes)
      });
    } catch (error) {
      console.error("Error fetching popular times:", error);
      res.status(500).json({ message: "Failed to fetch popular times" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Função auxiliar para calcular popularidade atual
function getCurrentPopularityForPlace(popularTimes: any): number {
  if (!popularTimes) return 50;
  
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[dayOfWeek];
  
  if (popularTimes[currentDay] && popularTimes[currentDay][hour] !== undefined) {
    return popularTimes[currentDay][hour];
  }
  
  return 50;
}
