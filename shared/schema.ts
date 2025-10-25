import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  userType: varchar("user_type").default("regular"), // regular, business, admin
  phone: varchar("phone"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  googlePlaceId: varchar("google_place_id"),
  category: varchar("category"), // restaurant, bar, club, venue, etc.
  businessOwnerId: varchar("business_owner_id").references(() => users.id),
  verified: boolean("verified").default(false),
  popularTimes: jsonb("popular_times"), // Google Places popular times data
  createdAt: timestamp("created_at").defaultNow(),
});

// EVENTU: P1 - Places table for Google Places data
export const places = pgTable("places", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  placeId: varchar("place_id").notNull().unique(), // Google Place ID
  name: varchar("name").notNull(),
  formattedAddress: text("formatted_address"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  rating: decimal("rating", { precision: 2, scale: 1 }),
  userRatingsTotal: integer("user_ratings_total"),
  isOpen: boolean("is_open"), // Current open/closed status
  types: text("types").array(), // Place types from Google (e.g., "restaurant", "bar")
  regularOpeningHours: jsonb("regular_opening_hours"), // Horários de funcionamento do Google
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  locationId: varchar("location_id").references(() => locations.id).notNull(),
  placeId: varchar("place_id").references(() => places.placeId), // EVENTU: P1 - Google Place ID reference with FK constraint
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  eventType: varchar("event_type").notNull(), // clubs, bars, shows, fairs, food, other
  startDateTime: timestamp("start_date_time").notNull(),
  endDateTime: timestamp("end_date_time"),
  mediaUrl: varchar("media_url"), // URL for uploaded images/videos
  mediaType: varchar("media_type"), // image or video
  isActive: boolean("is_active").default(true),
  isBoosted: boolean("is_boosted").default(false), // EVENTU: Event promotion/boost status
  boostUntil: timestamp("boost_until"), // EVENTU: When boost expires (optional)
  boostLevel: integer("boost_level").default(1), // EVENTU: Boost intensity level (1-3)
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventAttendees = pgTable("event_attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: varchar("status").default("confirmed"), // confirmed, maybe, declined
  createdAt: timestamp("created_at").defaultNow(),
});

export const checkins = pgTable("checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  locationId: varchar("location_id").references(() => locations.id),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  sessionId: varchar("session_id"), // for anonymous users
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  receiverId: varchar("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const heatmapData = pgTable("heatmap_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  intensity: real("intensity").notNull(),
  eventType: varchar("event_type"),
  isLive: boolean("is_live").default(true),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const businessClaims = pgTable("business_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  locationId: varchar("location_id").references(() => locations.id).notNull(),
  contactPhone: varchar("contact_phone").notNull(),
  contactName: varchar("contact_name").notNull(),
  status: varchar("status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// EVENTU: P3 - Claims table with place_id and evidence
export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  placeId: varchar("place_id").notNull(), // Google Place ID
  requesterUserId: varchar("requester_user_id").references(() => users.id).notNull(),
  method: varchar("method"), // e.g., "email", "phone", "documents"
  evidence: text("evidence"), // Description/proof of ownership
  status: varchar("status").default("pending"), // pending, approved, rejected
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// EVENTU: P3 - Owners table linking users to places
export const owners = pgTable("owners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  placeId: varchar("place_id").notNull(), // Google Place ID
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// EVENTU: P2 - Support tickets (fallback when SMTP not configured)
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status").default("open"), // open, sent, error
  createdAt: timestamp("created_at").defaultNow(),
});

// EVENTU: P4 - Profiles for chat search
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  displayName: varchar("display_name").notNull(),
  email: varchar("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  events: many(events),
  eventAttendees: many(eventAttendees),
  checkins: many(checkins),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  ownedLocations: many(locations),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  businessOwner: one(users, {
    fields: [locations.businessOwnerId],
    references: [users.id],
  }),
  events: many(events),
  checkins: many(checkins),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  location: one(locations, {
    fields: [events.locationId],
    references: [locations.id],
  }),
  place: one(places, { // EVENTU: P1 - Relation to places table
    fields: [events.placeId],
    references: [places.placeId],
  }),
  creator: one(users, {
    fields: [events.creatorId],
    references: [users.id],
  }),
  attendees: many(eventAttendees),
}));

// EVENTU: P1 - Places relations
export const placesRelations = relations(places, ({ many }) => ({
  events: many(events),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendees.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventAttendees.userId],
    references: [users.id],
  }),
}));

export const checkinsRelations = relations(checkins, ({ one }) => ({
  user: one(users, {
    fields: [checkins.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [checkins.locationId],
    references: [locations.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertEventAttendeeSchema = createInsertSchema(eventAttendees).omit({
  id: true,
  createdAt: true,
});

export const insertCheckinSchema = createInsertSchema(checkins).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertHeatmapDataSchema = createInsertSchema(heatmapData).omit({
  id: true,
  timestamp: true,
});

export const insertBusinessClaimSchema = createInsertSchema(businessClaims).omit({
  id: true,
  createdAt: true,
});

// EVENTU: P3 - Claims insert schema
export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  createdAt: true,
  reviewedBy: true,
  reviewedAt: true,
});

// EVENTU: P3 - Owners insert schema
export const insertOwnerSchema = createInsertSchema(owners).omit({
  id: true,
  createdAt: true,
});

// EVENTU: P2 - Support tickets insert schema
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
});

// EVENTU: P4 - Profiles insert schema
export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// EVENTU: P1 - Places insert schema
export const insertPlaceSchema = createInsertSchema(places).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Relations for business claims
export const businessClaimsRelations = relations(businessClaims, ({ one }) => ({
  user: one(users, {
    fields: [businessClaims.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [businessClaims.locationId],
    references: [locations.id],
  }),
}));

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEventAttendee = z.infer<typeof insertEventAttendeeSchema>;
export type EventAttendee = typeof eventAttendees.$inferSelect;
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;
export type Checkin = typeof checkins.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertHeatmapData = z.infer<typeof insertHeatmapDataSchema>;
export type HeatmapData = typeof heatmapData.$inferSelect;
export type InsertBusinessClaim = z.infer<typeof insertBusinessClaimSchema>;
export type BusinessClaim = typeof businessClaims.$inferSelect;

// EVENTU: New types for P1, P2, P3, P4
export type InsertPlace = z.infer<typeof insertPlaceSchema>;
export type Place = typeof places.$inferSelect;
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claims.$inferSelect;
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Owner = typeof owners.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;
