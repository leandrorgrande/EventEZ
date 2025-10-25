import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import * as cors from "cors";

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Middleware de autenticação
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Helper functions
const db = admin.firestore();

// ============ USERS ============

app.get('/users/:id', authenticate, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const userDoc = await db.collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
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

app.post('/places/search-santos', authenticate, async (req: express.Request, res: express.Response) => {
  try {
    const { locationType = 'bar' } = req.body;
    
    const apiKey = functions.config().google?.maps_api_key;
    if (!apiKey) {
      return res.status(500).json({ message: "Google Maps API key not configured" });
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
      return res.status(response.status).json({ message: "Failed to search places" });
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
export const api = functions.region('us-central1').https.onRequest(app);
