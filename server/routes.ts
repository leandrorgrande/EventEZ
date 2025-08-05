import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertEventSchema, 
  insertLocationSchema, 
  insertMessageSchema,
  insertCheckinSchema,
  insertHeatmapDataSchema 
} from "@shared/schema";
import { z } from "zod";

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
      const eventData = insertEventSchema.parse({
        ...req.body,
        creatorId: userId,
      });
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
      const heatmapData = await storage.getPredictionHeatmapData();
      res.json(heatmapData);
    } catch (error) {
      console.error("Error fetching prediction heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch prediction heatmap data" });
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

  const httpServer = createServer(app);
  return httpServer;
}
