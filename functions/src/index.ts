import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";

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

// ============ EVENTS ============

app.get('/events', async (req: express.Request, res: express.Response) => {
  try {
    const eventType = req.query.eventType as string;
    const isActive = req.query.isActive === 'true';
    
    let query: FirebaseFirestore.Query = db.collection('events');
    
    if (eventType) {
      query = query.where('eventType', '==', eventType);
    }
    
    if (isActive !== undefined) {
      query = query.where('isActive', '==', isActive);
    }
    
    const snapshot = await query.orderBy('startDateTime', 'desc').get();
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

app.post('/events', authenticate, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const eventData = {
      ...req.body,
      creatorId: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    const docRef = await db.collection('events').add(eventData);
    const newEvent = { id: docRef.id, ...eventData };
    
    res.json(newEvent);
  } catch (error) {
    res.status(400).json({ message: "Failed to create event" });
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
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: santosLat, longitude: santosLng },
          radius: 10000
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
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours,places.primaryType'
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const existingQuery = await db.collection('places')
        .where('placeId', '==', place.id)
        .get();

      if (!existingQuery.empty) {
        const docRef = existingQuery.docs[0].ref;
        await docRef.update({
          ...placeInfo,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        savedPlaces.push({ id: docRef.id, ...placeInfo });
      } else {
        const docRef = await db.collection('places').add(placeInfo);
        savedPlaces.push({ id: docRef.id, ...placeInfo });
      }
    }

    res.json({ places: savedPlaces });
  } catch (error) {
    res.status(500).json({ message: "Failed to search places" });
  }
});

// Export all functions
export const api = onRequest({ region: 'us-central1' }, app);
