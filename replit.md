# Event-U

## Overview

Event-U is a location-based social application focused on real-time event discovery and crowd tracking. The app provides live heatmaps showing activity hotspots across the city, event creation and management, and predictive analytics for future event attendance. Built as a full-stack web application, it targets users who want to discover popular local events and venues in real-time.

The application serves three main user types: regular users who discover and attend events, business owners who can create and manage locations/events, and administrators who oversee platform operations. The core value proposition is providing real-time insights into where people are gathering and predicting future activity based on confirmed event attendance and historical data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

**Frontend Architecture**
The client uses React 18 with Vite for fast development and building. The UI is built with shadcn/ui components and Tailwind CSS for responsive design with a dark theme optimized for nightlife/event discovery. State management is handled through TanStack Query for server state and React hooks for local state. The app uses Wouter for lightweight client-side routing.

**Backend Architecture**
The server is built with Express.js and follows a REST API pattern. The architecture separates concerns with dedicated modules for authentication (Replit Auth integration), database operations (storage layer), and route handling. The server uses TypeScript throughout and implements session-based authentication with PostgreSQL session storage.

**Database Design**
Uses Drizzle ORM with PostgreSQL for type-safe database operations. The schema includes core entities: users, locations, events, event attendees, check-ins, messages, and heatmap data. The database supports both real-time data collection and historical analytics through separate tables for live activity tracking and aggregated heatmap data. Events support boost/promotion features with fields for boost status, expiration date, and intensity level (1-3).

**Real-time Features**
The heatmap system collects anonymous location data from active users to generate live activity hotspots. The system implements both live mode (showing current activity) and prediction mode (forecasting based on confirmed event attendance and historical patterns). Data refreshes every 5 seconds for live updates.

**Authentication System**
Integrates with Replit's OpenID Connect authentication system. The auth system supports session management with PostgreSQL-backed session storage and includes middleware for protecting routes. User roles include regular users, business owners, and administrators with different permission levels.

**Map Integration**
Uses Google Maps JavaScript API with Places and Visualization libraries for interactive mapping and heatmap visualization. The map system displays event locations with custom markers, real-time activity heatmaps with color gradients (blue to red intensity), and supports filtering by event type and location categories. Heatmap data is generated from Google Places API using location density, ratings, popularity metrics, and business open status.

**Profile Features**
Users have access to comprehensive profile management including:
- Settings modal with email/password change, support contact form, and account deletion
- Event History modal with tabs for Created Events and Attending Events
- Business claim submission for location ownership verification
- Profile editing with personal information and preferences

**API Design**
RESTful API with endpoints organized by resource type: authentication, users, locations, events, check-ins, messages, and heatmap data. The API implements proper error handling, request validation using Zod schemas, and returns consistent JSON responses.

## External Dependencies

**Database Services**
- Neon Database (PostgreSQL) for primary data storage
- connect-pg-simple for PostgreSQL session storage
- Drizzle ORM for database operations and migrations

**Authentication**
- Replit Auth via OpenID Connect for user authentication
- express-session for session management
- passport for authentication middleware

**Mapping Services**
- Google Maps JavaScript API with Places and Visualization libraries for interactive maps and heatmap visualization
- Google Places API for location data, ratings, and popularity metrics

**UI Components**
- Radix UI primitives for accessible component foundation
- Tailwind CSS for utility-first styling
- Lucide React for consistent iconography

**Development Tools**
- Vite for fast development and optimized builds
- TypeScript for type safety across the stack
- TanStack Query for server state management and caching
- React Hook Form with Zod for form validation