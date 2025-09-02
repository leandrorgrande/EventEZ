import {
  users,
  locations,
  events,
  eventAttendees,
  checkins,
  messages,
  heatmapData,
  businessClaims,
  type User,
  type UpsertUser,
  type InsertLocation,
  type Location,
  type InsertEvent,
  type Event,
  type InsertEventAttendee,
  type EventAttendee,
  type InsertCheckin,
  type Checkin,
  type InsertMessage,
  type Message,
  type InsertHeatmapData,
  type HeatmapData,
  type InsertBusinessClaim,
  type BusinessClaim,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Location operations
  createLocation(location: InsertLocation): Promise<Location>;
  getLocationById(id: string): Promise<Location | undefined>;
  getLocationsByFilter(filter?: { verified?: boolean }): Promise<Location[]>;
  
  // Event operations
  createEvent(event: InsertEvent): Promise<Event>;
  getEventById(id: string): Promise<Event | undefined>;
  getEvents(filter?: { eventType?: string; isActive?: boolean }): Promise<Event[]>;
  getEventsByCreator(creatorId: string): Promise<Event[]>;
  updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined>;
  
  // Event attendee operations
  addEventAttendee(attendee: InsertEventAttendee): Promise<EventAttendee>;
  getEventAttendees(eventId: string): Promise<EventAttendee[]>;
  removeEventAttendee(eventId: string, userId: string): Promise<void>;
  
  // Check-in operations
  createCheckin(checkin: InsertCheckin): Promise<Checkin>;
  getRecentCheckins(minutes?: number): Promise<Checkin[]>;
  
  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(userId: string, otherUserId: string): Promise<Message[]>;
  getUserConversations(userId: string): Promise<{ user: User; lastMessage: Message }[]>;
  
  // Heatmap operations
  createHeatmapData(data: InsertHeatmapData): Promise<HeatmapData>;
  getLiveHeatmapData(): Promise<HeatmapData[]>;
  getPredictionHeatmapData(): Promise<HeatmapData[]>;
  updateHeatmapIntensity(latitude: number, longitude: number, intensity: number): Promise<void>;
  
  // Business claim operations
  createBusinessClaim(claim: InsertBusinessClaim): Promise<BusinessClaim>;
  getBusinessClaims(status?: string): Promise<BusinessClaim[]>;
  updateBusinessClaimStatus(id: string, status: string): Promise<BusinessClaim | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Location operations
  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async getLocationById(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async getLocationsByFilter(filter?: { verified?: boolean }): Promise<Location[]> {
    let query = db.select().from(locations);
    if (filter?.verified !== undefined) {
      query = query.where(eq(locations.verified, filter.verified));
    }
    return await query;
  }

  // Event operations
  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEvents(filter?: { eventType?: string; isActive?: boolean }): Promise<Event[]> {
    let query = db.select().from(events);
    const conditions = [];
    
    if (filter?.eventType) {
      conditions.push(eq(events.eventType, filter.eventType));
    }
    if (filter?.isActive !== undefined) {
      conditions.push(eq(events.isActive, filter.isActive));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(events.startDateTime));
  }

  async getEventsByCreator(creatorId: string): Promise<Event[]> {
    return await db.select().from(events)
      .where(eq(events.creatorId, creatorId))
      .orderBy(desc(events.createdAt));
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updatedEvent] = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  // Event attendee operations
  async addEventAttendee(attendee: InsertEventAttendee): Promise<EventAttendee> {
    const [newAttendee] = await db.insert(eventAttendees).values(attendee).returning();
    return newAttendee;
  }

  async getEventAttendees(eventId: string): Promise<EventAttendee[]> {
    return await db.select().from(eventAttendees)
      .where(eq(eventAttendees.eventId, eventId));
  }

  async removeEventAttendee(eventId: string, userId: string): Promise<void> {
    await db.delete(eventAttendees)
      .where(and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.userId, userId)
      ));
  }

  // Check-in operations
  async createCheckin(checkin: InsertCheckin): Promise<Checkin> {
    const [newCheckin] = await db.insert(checkins).values(checkin).returning();
    return newCheckin;
  }

  async getRecentCheckins(minutes: number = 60): Promise<Checkin[]> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return await db.select().from(checkins)
      .where(sql`${checkins.createdAt} > ${cutoffTime}`)
      .orderBy(desc(checkins.createdAt));
  }

  // Message operations
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getMessages(userId: string, otherUserId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(
        and(
          sql`(${messages.senderId} = ${userId} AND ${messages.receiverId} = ${otherUserId}) OR (${messages.senderId} = ${otherUserId} AND ${messages.receiverId} = ${userId})`
        )
      )
      .orderBy(messages.createdAt);
  }

  async getUserConversations(userId: string): Promise<{ user: User; lastMessage: Message }[]> {
    // This is a complex query that would need raw SQL or multiple queries
    // For now, returning empty array - can be implemented later
    return [];
  }

  // Heatmap operations
  async createHeatmapData(data: InsertHeatmapData): Promise<HeatmapData> {
    const [newData] = await db.insert(heatmapData).values(data).returning();
    return newData;
  }

  async getLiveHeatmapData(): Promise<HeatmapData[]> {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes for live data
    return await db.select().from(heatmapData)
      .where(and(
        eq(heatmapData.isLive, true),
        sql`${heatmapData.timestamp} > ${cutoffTime}`
      ));
  }

  async getPredictionHeatmapData(): Promise<HeatmapData[]> {
    return await db.select().from(heatmapData)
      .where(eq(heatmapData.isLive, false));
  }

  async updateHeatmapIntensity(latitude: number, longitude: number, intensity: number): Promise<void> {
    await db.insert(heatmapData).values({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      intensity,
      isLive: true,
    });
  }

  // Business claim operations
  async createBusinessClaim(claim: InsertBusinessClaim): Promise<BusinessClaim> {
    const [newClaim] = await db.insert(businessClaims).values(claim).returning();
    return newClaim;
  }

  async getBusinessClaims(status?: string): Promise<BusinessClaim[]> {
    let query = db.select().from(businessClaims);
    if (status) {
      query = query.where(eq(businessClaims.status, status));
    }
    return await query.orderBy(desc(businessClaims.createdAt));
  }

  async updateBusinessClaimStatus(id: string, status: string): Promise<BusinessClaim | undefined> {
    const [updatedClaim] = await db
      .update(businessClaims)
      .set({ status })
      .where(eq(businessClaims.id, id))
      .returning();
    return updatedClaim;
  }
}

export const storage = new DatabaseStorage();
