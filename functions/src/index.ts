import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import * as cheerio from "cheerio";

admin.initializeApp();

// Secret para SerpApi (injetado como variável de ambiente)
const SERPAPI_API_KEY = defineSecret('SERPAPI_API_KEY');
const OUTSCRAPER_API_KEY = defineSecret('OUTSCRAPER_API_KEY');

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

// Buscar places com filtros e paginação
app.get('/places', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const {
      name,
      type,
      hasType,
      city,
      district
    } = req.query as any;

    const snap = await db.collection('places').get();
    let places = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    // Filtros em memória (simplificado)
    if (name) {
      const q = String(name).toLowerCase();
      places = places.filter(p => (p.name || p.displayName?.text || '').toLowerCase().includes(q));
    }
    if (type) {
      const t = String(type).toLowerCase();
      places = places.filter(p => Array.isArray(p.types) && p.types.some((x: string) => (x || '').toLowerCase() === t));
    }
    if (typeof hasType !== 'undefined') {
      const want = String(hasType) === 'true';
      places = places.filter(p => want ? Array.isArray(p.types) && p.types.length > 0 : !(Array.isArray(p.types) && p.types.length > 0));
    }
    if (city) {
      const q = String(city).toLowerCase();
      places = places.filter(p => (p.city || p.formattedAddress || '').toLowerCase().includes(q));
    }
    if (district) {
      const q = String(district).toLowerCase();
      places = places.filter(p => (p.district || p.neighborhood || p.formattedAddress || '').toLowerCase().includes(q));
    }

    // Retornar array direto para compatibilidade com frontend existente
    res.json(places);
  } catch (error: any) {
    console.error('[API] Erro ao buscar places com filtros:', error);
    res.status(500).json({ message: 'Failed to fetch places' });
  }
});

// Preview (sem update): coleta dados dos provedores e retorna normalização para inspeção
app.get('/places/:docId/popular-times/preview', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const ref = db.collection('places').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ message: 'Place não encontrado' });
      return;
    }
    const place = { id: docId, ...(snap.data() as any) } as any;
    const latNum = typeof place.latitude === 'string' ? parseFloat(place.latitude) : (typeof place.latitude === 'number' ? place.latitude : null);
    const lngNum = typeof place.longitude === 'string' ? parseFloat(place.longitude) : (typeof place.longitude === 'number' ? place.longitude : null);
    const out: any = { place: { id: docId, name: place.name || place.displayName?.text || '', placeId: place.placeId || null, formattedAddress: place.formattedAddress || null } };
    try {
      const s = await fetchPopularTimesFromSerpApi(place.name || place.displayName?.text || '', place.formattedAddress, place.placeId || null, latNum, lngNum);
      out.serpapi = s ? { popularTimes: s.popularTimes, openingHours: s.openingHours, isOpen: s.isOpen, price: s.price } : null;
    } catch (e: any) { out.serpapi = { error: e?.message || String(e) }; }
    try {
      const o = await fetchPopularTimesFromOutscraper(place.name || place.displayName?.text || '', place.formattedAddress, place.placeId || null, place.googleMapsUri || null);
      out.outscraper = o ? { popularTimes: o.popularTimes, openingHours: o.openingHours, isOpen: o.isOpen, price: o.price } : null;
    } catch (e: any) { out.outscraper = { error: e?.message || String(e) }; }
    try {
      // usar mesma rotina inline de tasks usada no import (sem update)
      const resultsTasks = await (async () => {
        try {
          const axios = require('axios');
          const apiKey = process.env.OUTSCRAPER_API_KEY;
          if (!apiKey) return null;
          const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } as any;
          const base = 'https://api.outscraper.cloud';
          const buildLocation = (addr?: string): string => {
            const a = (addr || '').toLowerCase();
            if (a.includes('santos')) return 'BR^>Sao Paulo^>Santos';
            if (a.includes('são vicente') || a.includes('sao vicente')) return 'BR^>Sao Paulo^>Sao Vicente';
            if (a.includes('guarujá') || a.includes('guaruja')) return 'BR^>Sao Paulo^>Guaruja';
            if (a.includes('praia grande')) return 'BR^>Sao Paulo^>Praia Grande';
            return 'BR';
          };
          const payload: any = {
            service_name: 'google_maps_service_v2',
            title: 'popular_times_preview',
            language: 'en',
            region: 'BR',
            categories: [place.name || ''],
            locations: [buildLocation(place.formattedAddress)],
            limit: 1,
            exactMatch: false,
            enrich: false,
            UISettings: { isCustomQueries: false, isCustomCategories: false, isCustomLocations: false },
            settings: { output_columns: [], output_extension: 'json' },
            tags: place.name || ''
          };
          const createRes = await axios.post(`${base}/tasks`, payload, { headers, timeout: 20000 });
          const taskId = createRes?.data?.id || createRes?.data?.task_id || createRes?.data?.data?.id;
          if (!taskId) return { createRes: createRes?.data };
          const poll = async (): Promise<any> => {
            const starts = Date.now();
            while (Date.now() - starts < 60000) {
              try { const g1 = await axios.get(`${base}/tasks/get`, { headers, params: { id: taskId }, timeout: 15000 }); const st = g1?.data?.status || g1?.data?.data?.status; if (st && String(st).toLowerCase() === 'finished') return g1?.data; } catch {}
              try { const g2 = await axios.get(`${base}/tasks/get`, { headers, params: { task_id: taskId }, timeout: 15000 }); const st2 = g2?.data?.status || g2?.data?.data?.status; if (st2 && String(st2).toLowerCase() === 'finished') return g2?.data; } catch {}
              await new Promise(r => setTimeout(r, 3000));
            }
            return { timeout: true };
          };
          const rs = await poll();
          return rs;
        } catch { return null; }
      })();
      // extrair item e normalizações
      const findWithPopularTimes = (node: any): any | null => {
        if (!node) return null;
        if (Array.isArray(node)) { for (const el of node) { const f = findWithPopularTimes(el); if (f) return f; } return null; }
        if (typeof node === 'object') {
          if (node.popular_times && Array.isArray(node.popular_times)) return node;
          for (const k of Object.keys(node)) { const f = findWithPopularTimes(node[k]); if (f) return f; }
        }
        return null;
      };
      const item = resultsTasks ? findWithPopularTimes(resultsTasks) : null;
      const normalized = item ? normalizePopularTimes(item) : null;
      const open = item ? (normalizeOpeningHoursGeneric(item) || normalizeOpeningHoursGeneric(item?.opening_hours) || null) : null;
      out.outscraper_tasks = { raw: resultsTasks || null, item: item || null, popularTimes: normalized, openingHours: open };
    } catch (e: any) { out.outscraper_tasks = { error: e?.message || String(e) }; }

    res.json(out);
  } catch (error: any) {
    res.status(500).json({ message: error?.message || 'Falha no preview' });
  }
});

// Inserir um novo lugar por nome + cidade via Outscraper Tasks
app.post('/places/insert-from-outscraper', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { name, city, address } = (req.body as any) || {};
    if (!name || !city) {
      res.status(400).json({ message: 'Parâmetros obrigatórios: name, city' });
      return;
    }
    const mapCityToLocation = (c: string): string => {
      const s = String(c || '').toLowerCase();
      if (s.includes('santos')) return 'BR^>Sao Paulo^>Santos';
      if (s.includes('são vicente') || s.includes('sao vicente')) return 'BR^>Sao Paulo^>Sao Vicente';
      if (s.includes('guarujá') || s.includes('guaruja')) return 'BR^>Sao Paulo^>Guaruja';
      if (s.includes('praia grande')) return 'BR^>Sao Paulo^>Praia Grande';
      return 'BR';
    };
    // Criar task
    const axios = require('axios');
    const apiKey = process.env.OUTSCRAPER_API_KEY;
    if (!apiKey) {
      res.status(500).json({ message: 'OUTSCRAPER_API_KEY ausente' });
      return;
    }
    const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } as any;
    const base = 'https://api.outscraper.cloud';
    const payload: any = {
      service_name: 'google_maps_service_v2',
      title: 'insert_place_single',
      language: 'en',
      region: 'BR',
      categories: [name],
      locations: [mapCityToLocation(city)],
      limit: 1,
      exactMatch: false,
      enrich: false,
      UISettings: { isCustomQueries: false, isCustomCategories: false, isCustomLocations: false },
      settings: { output_columns: [], output_extension: 'json' },
      tags: name
    };
    const createRes = await axios.post(`${base}/tasks`, payload, { headers, timeout: 20000 });
    const taskId = createRes?.data?.id || createRes?.data?.task_id || createRes?.data?.data?.id;
    if (!taskId) {
      res.status(502).json({ message: 'Falha ao criar task Outscraper', data: createRes?.data });
      return;
    }
    // Polling
    const poll = async (): Promise<any> => {
      const starts = Date.now();
      while (Date.now() - starts < 60000) {
        try {
          const g1 = await axios.get(`${base}/tasks/get`, { headers, params: { id: taskId }, timeout: 15000 });
          const st = g1?.data?.status || g1?.data?.data?.status;
          if (st && String(st).toLowerCase() === 'finished') return g1?.data?.results || g1?.data?.data || g1?.data;
        } catch {}
        try {
          const g2 = await axios.get(`${base}/tasks/get`, { headers, params: { task_id: taskId }, timeout: 15000 });
          const st2 = g2?.data?.status || g2?.data?.data?.status;
          if (st2 && String(st2).toLowerCase() === 'finished') return g2?.data?.results || g2?.data?.data || g2?.data;
        } catch {}
        await new Promise(r => setTimeout(r, 3000));
      }
      return null;
    };
    const results = await poll();
    if (!results) {
      res.status(502).json({ message: 'Task não retornou resultado em tempo hábil' });
      return;
    }
    // Encontrar o item
    const findWithPopularTimes = (node: any): any | null => {
      if (!node) return null;
      if (Array.isArray(node)) { for (const el of node) { const f = findWithPopularTimes(el); if (f) return f; } return null; }
      if (typeof node === 'object') {
        if (node.popular_times && Array.isArray(node.popular_times)) return node;
        for (const k of Object.keys(node)) { const f = findWithPopularTimes(node[k]); if (f) return f; }
      }
      return null;
    };
    const candidate = findWithPopularTimes(results);
    const item = candidate || (Array.isArray(results) ? results[0] : (results?.[0] || results?.result?.[0] || results?.data?.[0] || results || {}));
    if (!item || typeof item !== 'object') {
      res.status(404).json({ message: 'Nenhum item encontrado para inserir' });
      return;
    }
    // Normalizar
    const popularTimes = normalizePopularTimes(item);
    const openingHours = normalizeOpeningHoursGeneric(item) || normalizeOpeningHoursGeneric(item?.opening_hours) || null;
    const subtypes = (typeof item?.subtypes === 'string' ? item.subtypes.split(/\s*,\s*/) : (Array.isArray(item?.subtypes) ? item.subtypes : []));
    const doc: any = {
      placeId: item?.place_id || item?.google_id || null,
      name: item?.name || name,
      formattedAddress: item?.full_address || address || null,
      latitude: item?.latitude != null ? String(item.latitude) : null,
      longitude: item?.longitude != null ? String(item.longitude) : null,
      rating: typeof item?.rating === 'number' ? item.rating : null,
      userRatingsTotal: typeof item?.reviews === 'number' ? item.reviews : 0,
      types: subtypes || [],
      openingHours: openingHours || null,
      popularTimes: popularTimes || null,
      website: item?.site || item?.website || null,
      instagram: item?.instagram || null,
      description: item?.description || null,
      logoUrl: item?.logo || item?.photo || null,
      price: item?.price_level || item?.price || null,
      googleMapsUri: item?.location_link || null,
      city: city,
      dataSource: 'outscraper_tasks',
      popularityProvider: popularTimes ? 'outscraper_tasks' : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Dedup por placeId
    let docId: string | null = null;
    if (doc.placeId) {
      const snap = await db.collection('places').where('placeId', '==', doc.placeId).limit(1).get();
      if (!snap.empty) {
        const ref = snap.docs[0].ref;
        await ref.update({ ...doc, createdAt: snap.docs[0].data().createdAt || admin.firestore.FieldValue.serverTimestamp() });
        docId = ref.id;
        res.json({ success: true, id: docId, action: 'updated', source: 'outscraper_tasks' });
        return;
      }
    }
    // Inserir
    const refNew = await db.collection('places').add(doc);
    res.json({ success: true, id: refNew.id, action: 'inserted', source: 'outscraper_tasks' });
  } catch (error: any) {
    console.error('[Insert-From-Outscraper] erro:', error?.message || error);
    res.status(500).json({ message: error?.message || 'Falha ao inserir lugar' });
  }
});

// Get all users (admin only)
app.get('/users', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`[API] Retornando ${users.length} usuários`);
    res.json(users);
  } catch (error) {
    console.error('[API] Erro ao buscar usuários:', error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

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

// Update user role (admin/regular)
app.patch('/users/:id/role', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userType } = req.body as { userType?: 'admin' | 'regular' | 'business' };
    if (!userType || !['admin', 'regular', 'business'].includes(userType)) {
      res.status(400).json({ message: "userType inválido" });
      return;
    }
    const ref = db.collection('users').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    await ref.update({ userType, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true, id, userType });
  } catch (error) {
    console.error('[API] Erro ao atualizar role do usuário:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// ============ EVENTS ============

// Rota de DEBUG para listar TODOS os eventos sem filtro
app.get('/events/debug', authenticate, async (req: express.Request, res: express.Response) => {
  try {
    console.log('[DEBUG] Iniciando busca de eventos no Firestore...');
    
    const snapshot = await db.collection('events').get();
    console.log('[DEBUG] Snapshot obtido. Vazio?', snapshot.empty);
    console.log('[DEBUG] Número de documentos:', snapshot.size);
    
    const events = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('[DEBUG] Documento ID:', doc.id);
      console.log('[DEBUG] Dados completos:', JSON.stringify(data, null, 2));
      return { id: doc.id, ...data };
    });
    
    console.log('[DEBUG] Total de eventos mapeados:', events.length);
    
    res.json({
      total: events.length,
      snapshotEmpty: snapshot.empty,
      snapshotSize: snapshot.size,
      events: events,
      collectionPath: 'events',
      message: 'Debug completo - todos os eventos sem filtro'
    });
  } catch (error: any) {
    console.error('[DEBUG] ERRO:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      message: "Erro ao buscar eventos (debug)" 
    });
  }
});

app.get('/events', authenticate, async (req: express.Request, res: express.Response) => {
  try {
    const eventType = req.query.eventType as string;
    // Corrigir: só considerar isActive quando o parâmetro existir na query
    const hasIsActiveParam = typeof req.query.isActive !== 'undefined';
    const isActive = hasIsActiveParam ? (req.query.isActive === 'true') : undefined;
    const approvalStatus = req.query.approvalStatus as string;
    const user = (req as any).user;
    
    console.log('[API] GET /events - Query params:', { eventType, isActive, approvalStatus });
    console.log('[API] User UID:', user?.uid);
    
    // Buscar TODOS os eventos primeiro
    const snapshot = await db.collection('events').get();
    let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log('[API] Total de eventos no Firestore:', events.length);
    
    // Log detalhado dos eventos
    if (events.length > 0) {
      console.log('[API] Primeiro evento:', JSON.stringify(events[0], null, 2));
      events.forEach((e: any, idx: number) => {
        console.log(`[API] Evento ${idx + 1}:`, {
          id: e.id,
          title: e.title,
          approvalStatus: e.approvalStatus,
          startDateTime: e.startDateTime
        });
      });
    }
    
    // Aplicar filtros em memória
    if (eventType) {
      events = events.filter((e: any) => e.eventType === eventType);
    }
    
    if (hasIsActiveParam) {
      events = events.filter((e: any) => e.isActive === isActive);
    }
    
    // Ordenar por data
    events = events.sort((a: any, b: any) => {
      const dateA = new Date(a.startDateTime).getTime();
      const dateB = new Date(b.startDateTime).getTime();
      return dateB - dateA; // Ordem decrescente (mais recente primeiro)
    });
    
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
    
    // Anexar contagem de participantes
    const eventsWithCount = events.map((e: any) => ({
      ...e,
      attendeesCount: Array.isArray(e.attendeeIds) ? e.attendeeIds.length : 0
    }));

    console.log('[API] Eventos retornados:', eventsWithCount.length);
    res.json(eventsWithCount);
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
    const { approvalStatus, join, ...otherData } = req.body;
    
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

    // Participação no evento (join=true adiciona, join=false remove)
    if (typeof join === 'boolean') {
      const userId = (req as any).user.uid;
      if (join) {
        updateData.attendeeIds = admin.firestore.FieldValue.arrayUnion(userId);
      } else {
        updateData.attendeeIds = admin.firestore.FieldValue.arrayRemove(userId);
      }
    }
    
    if (otherData && Object.keys(otherData).length > 0) {
      Object.assign(updateData, otherData);
    }
    
    await eventRef.update(updateData);
    
    // Buscar documento atualizado
    const updatedSnap = await eventRef.get();
    const updatedEvent = { id: updatedSnap.id, ...updatedSnap.data() } as any;
    
    // Garantir que attendeeIds seja um array
    if (!Array.isArray(updatedEvent.attendeeIds)) {
      updatedEvent.attendeeIds = [];
    }
    
    // Calcular contagem corretamente
    updatedEvent.attendeesCount = updatedEvent.attendeeIds.length;
    
    console.log('[API] Event updated - attendeeIds:', updatedEvent.attendeeIds, 'attendeesCount:', updatedEvent.attendeesCount);
    
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
    const { locationType = 'bar', center, radiusMeters, rank = 'DISTANCE' } = req.body;
    
    // Use hardcoded API key (temporary for debugging)
    const apiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
    
    console.log('[API] Buscando lugares do tipo:', locationType);
    console.log('[API] API Key configurada:', apiKey ? 'SIM' : 'NÃO');
    
    if (!apiKey) {
      res.status(500).json({ message: "Google Maps API key not configured" });
      return;
    }

    // Santos coordinates (defaults), podem ser sobrescritos por center
    const santosLat = -23.9608;
    const santosLng = -46.3332;

    // Tipos ampliados por categoria
    // Mapeamento sem sobreposição entre categorias
    const typeMapping: Record<string, string[]> = {
      bars: ['bar'],
      clubs: ['night_club'],
      shows: ['movie_theater'],
      food: ['restaurant'],
      cafe: ['cafe', 'bakery'],
      fairs: ['amusement_park']
    };
    const includedTypes = typeMapping[locationType] || ['bar'];

    // Palavras‑chave de fallback por categoria para SearchText (pt-BR)
    const textQueryMapping: Record<string, string[]> = {
      bars: ['bar', 'pub', 'choperia'],
      clubs: ['balada', 'boate', 'night club'],
      shows: ['cinema'],
      food: ['restaurante'],
      cafe: ['café', 'padaria', 'coffee shop'],
      fairs: ['parque de diversões']
    };
    const textQueries = textQueryMapping[locationType] || [];

    const url = 'https://places.googleapis.com/v1/places:searchNearby';
    
    const requestBody: any = {
      includedTypes,
      maxResultCount: 20, // Google limita a 20 por requisição
      rankPreference: (rank === 'DISTANCE' || rank === 'POPULARITY') ? rank : 'DISTANCE',
      locationRestriction: {
        circle: {
          center: { 
            latitude: typeof center?.latitude === 'number' ? center.latitude : santosLat, 
            longitude: typeof center?.longitude === 'number' ? center.longitude : santosLng 
          },
          radius: typeof radiusMeters === 'number' ? radiusMeters : 15000 // 15km
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
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.types,places.businessStatus'
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
    const allPlaces: any[] = [...(data.places || [])];
    console.log('[API] Lugares recebidos da Google (Nearby):', allPlaces.length);

    // Fallback: SearchText por palavras‑chave para cobrir locais não retornados pelo ranking
    if (textQueries.length > 0) {
      const textUrl = 'https://places.googleapis.com/v1/places:searchText';
      const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.types,places.businessStatus';
      for (const q of textQueries) {
        try {
          const textBody: any = {
            textQuery: q,
            languageCode: 'pt-BR',
            regionCode: 'BR',
            maxResultCount: 20,
            locationBias: {
              circle: {
                center: {
                  latitude: requestBody.locationRestriction.circle.center.latitude,
                  longitude: requestBody.locationRestriction.circle.center.longitude
                },
                radius: requestBody.locationRestriction.circle.radius
              }
            }
          };
          const textResp = await fetch(textUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify(textBody)
          });
          if (!textResp.ok) {
            const errText = await textResp.text();
            console.warn('[API] SearchText falhou para query', q, errText);
            continue;
          }
          const textData = await textResp.json();
          let pagePlaces = textData.places || [];
          let totalAdded = 0;
          let page = 1;
          // Dedup primeira página
          let pageNew = pagePlaces.filter((p: any) => !allPlaces.some((e: any) => e.id === p.id));
          allPlaces.push(...pageNew);
          totalAdded += pageNew.length;
          // Paginação do SearchText (sem incluir nextPageToken no FieldMask; token é top-level)
          let pt = textData.nextPageToken;
          while (pt && page < 3) {
            await new Promise(res => setTimeout(res, 1600));
            const pageResp = await fetch(textUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': fieldMask
              },
              body: JSON.stringify({ pageToken: pt })
            });
            if (!pageResp.ok) {
              const errT = await pageResp.text();
              console.warn('[API] SearchText paginação falhou:', errT);
              break;
            }
            const pageData = await pageResp.json();
            pagePlaces = pageData.places || [];
            pageNew = pagePlaces.filter((p: any) => !allPlaces.some((e: any) => e.id === p.id));
            allPlaces.push(...pageNew);
            totalAdded += pageNew.length;
            pt = pageData.nextPageToken;
            page++;
          }
          console.log(`[API] SearchText("${q}") adicionou ${totalAdded} novos lugares após dedupe (páginas: ${page}).`);
        } catch (err) {
          console.warn('[API] Erro no SearchText para query', q, err);
        }
      }
    }

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

    for (const place of allPlaces || []) {
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
      
      const mergedTypes = Array.from(new Set([...(place.types || []), place.primaryType].filter(Boolean)));
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
        types: mergedTypes,
        businessStatus: place.businessStatus || null,
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
    console.log('[API] Total processado:', allPlaces.length || 0);

    res.json({ 
      places: savedPlaces,
      count: savedPlaces.length,
      newPlaces: newPlacesCount,
      existingPlaces: existingPlacesCount,
      totalProcessed: allPlaces.length || 0,
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
    const { popularTimes, dataSource = 'manual' } = req.body || {};

    console.log('[API] Atualizando popular times para:', placeId);

    // Sanitiza o payload para o formato aceito no Firestore:
    // popularTimes: { monday..sunday: number[24] }, 0..100
    const dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const sanitized: any = {
      monday: Array(24).fill(0),
      tuesday: Array(24).fill(0),
      wednesday: Array(24).fill(0),
      thursday: Array(24).fill(0),
      friday: Array(24).fill(0),
      saturday: Array(24).fill(0),
      sunday: Array(24).fill(0)
    };
    if (popularTimes && typeof popularTimes === 'object') {
      for (const k of dayKeys) {
        const arr = Array.isArray(popularTimes[k]) ? popularTimes[k] : [];
        for (let i = 0; i < 24; i++) {
          const raw = arr[i] ?? 0;
          const n = Math.max(0, Math.min(100, Math.floor(Number(raw) || 0)));
          sanitized[k][i] = n;
        }
      }
    }

    // Encontrar o documento de forma robusta:
    // 1) Tenta por ID do documento
    let docRef = db.collection('places').doc(placeId);
    let docSnap = await docRef.get();

    // 2) Fallback: procurar por campo placeId (Google Place ID)
    if (!docSnap.exists) {
      const qByPlaceId = await db.collection('places')
        .where('placeId', '==', placeId)
        .limit(1)
        .get();
      if (!qByPlaceId.empty) {
        docRef = qByPlaceId.docs[0].ref;
        docSnap = qByPlaceId.docs[0];
      }
    }

    // 3) Fallback extra (legado): campo 'id'
    if (!docSnap.exists) {
      const qByIdField = await db.collection('places')
        .where('id', '==', placeId)
        .limit(1)
        .get();
      if (!qByIdField.empty) {
        docRef = qByIdField.docs[0].ref;
        docSnap = qByIdField.docs[0];
      }
    }

    if (!docSnap.exists) {
      res.status(404).json({ message: 'Place not found' });
      return;
    }

    // Atualiza com metadados que o front usa para exibição
    await docRef.update({
      popularTimes: sanitized,
      dataSource,
      popularityProvider: 'manual',
      popularityManualUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('[API] Popular times atualizado com sucesso');

    res.json({
      message: 'Popular times updated successfully',
      placeId,
      updatedFields: ['popularTimes','dataSource','popularityProvider','popularityManualUpdatedAt','updatedAt']
    });
  } catch (error: any) {
    console.error('[API] Erro ao atualizar popular times:', error);
    res.status(500).json({ message: 'Failed to update popular times' });
  }
});

// Import popular times (one-time) using external provider (SerpApi)
const normalizePopularTimes = (raw: any): any | null => {
  if (!raw) return null;
  const dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const out: any = {
    monday: Array(24).fill(0),
    tuesday: Array(24).fill(0),
    wednesday: Array(24).fill(0),
    thursday: Array(24).fill(0),
    friday: Array(24).fill(0),
    saturday: Array(24).fill(0),
    sunday: Array(24).fill(0)
  };

  const mapDayName = (name: any): string | null => {
    if (name === undefined || name === null) return null;
    // Suporte a numérico (1..7) vindo do Outscraper: 1=Mon .. 7=Sun
    if (typeof name === 'number') {
      const mapNum: Record<number, string> = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday', 7: 'sunday' };
      return mapNum[name] || null;
    }
    const n = String(name).toLowerCase();
    if (n.startsWith('mon')) return 'monday';
    if (n.startsWith('tue')) return 'tuesday';
    if (n.startsWith('wed')) return 'wednesday';
    if (n.startsWith('thu')) return 'thursday';
    if (n.startsWith('fri')) return 'friday';
    if (n.startsWith('sat')) return 'saturday';
    if (n.startsWith('sun')) return 'sunday';
    if (n.startsWith('seg')) return 'monday';
    if (n.startsWith('ter')) return 'tuesday';
    if (n.startsWith('qua')) return 'wednesday';
    if (n.startsWith('qui')) return 'thursday';
    if (n.startsWith('sex')) return 'friday';
    if (n.startsWith('sáb') || n.startsWith('sab')) return 'saturday';
    if (n.startsWith('dom')) return 'sunday';
    return null;
  };

  const setHour = (day: string, hour: number, value: number) => {
    const h = Math.max(0, Math.min(23, Math.floor(hour)));
    const v = Math.max(0, Math.min(100, Math.floor(value || 0)));
    out[day][h] = v;
  };

  // Helper para converter string de hora (e.g. "7 AM", "18:00") para 0..23
  const parseHour = (v: any, fallbackIndex: number): number => {
    if (typeof v === 'number') return Math.max(0, Math.min(23, Math.floor(v)));
    if (typeof v !== 'string') return fallbackIndex;
    const s = v.trim();
    // 24h "18:00"
    let m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (m) {
      const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
      return h;
    }
    // 12h "7 AM"
    m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const ap = (m[3] || '').toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return Math.max(0, Math.min(23, h));
    }
    return fallbackIndex;
  };

  // setHour já definido acima

  // 1) Novo formato SerpApi (Place Results)
  //    a) detail.place_results.popular_times.graph_results.{day} = [{ time, busyness_score, ... }]
  //    b) detail.place_results.popular_times.{day} = [...]
  const placeResults = raw.place_results || undefined;
  const prPopularTimes = placeResults?.popular_times || undefined;
  const prGraph = prPopularTimes?.graph_results || undefined;
  if (prGraph && typeof prGraph === 'object') {
    for (const key of Object.keys(prGraph)) {
      const day = mapDayName(key) as string | null;
      if (!day || !dayKeys.includes(day)) continue;
      const arr: any[] = Array.isArray(prGraph[key]) ? prGraph[key] : [];
      arr.forEach((entry, idx) => {
        const hour = parseHour(entry?.time, idx);
        const value = typeof entry?.busyness_score === 'number' ? entry.busyness_score
          : (typeof entry?.busy_percent === 'number' ? entry.busy_percent
            : (typeof entry?.value === 'number' ? entry.value : 0));
        setHour(day, hour, value);
      });
    }
    return out;
  }
  if (prPopularTimes && typeof prPopularTimes === 'object') {
    for (const key of Object.keys(prPopularTimes)) {
      const day = mapDayName(key) as string | null;
      if (!day || !dayKeys.includes(day)) continue;
      const arr: any[] = Array.isArray(prPopularTimes[key]) ? prPopularTimes[key] : [];
      arr.forEach((entry, idx) => {
        const hour = parseHour(entry?.time, idx);
        const value = typeof entry?.busyness_score === 'number' ? entry.busyness_score
          : (typeof entry?.busy_percent === 'number' ? entry.busy_percent
            : (typeof entry?.value === 'number' ? entry.value : 0));
        setHour(day, hour, value);
      });
    }
    return out;
  }

  // 2) Alternativo: raw.popular_times como objeto { monday: [...], ... }
  if (raw.popular_times && typeof raw.popular_times === 'object' && !Array.isArray(raw.popular_times)) {
    for (const key of Object.keys(raw.popular_times)) {
      const day = mapDayName(key) as string | null;
      if (!day || !dayKeys.includes(day)) continue;
      const arr: any[] = Array.isArray(raw.popular_times[key]) ? raw.popular_times[key] : [];
      arr.forEach((entry, idx) => {
        const hour = parseHour(entry?.time, idx);
        const value = typeof entry?.busyness_score === 'number' ? entry.busyness_score
          : (typeof entry?.busy_percent === 'number' ? entry.busy_percent
            : (typeof entry?.value === 'number' ? entry.value : 0));
        setHour(day, hour, value);
      });
    }
    return out;
  }

  const arr = raw.popular_times || raw.populartimes || raw;
  if (Array.isArray(arr)) {
    arr.forEach((dayObj: any) => {
      const key = mapDayName(dayObj?.day_text || dayObj?.name || dayObj?.weekday || dayObj?.day) as string;
      if (!key || !dayKeys.includes(key)) return;
      const data = dayObj?.popular_times || dayObj?.data || dayObj?.hours || dayObj?.popularity || [];
      if (Array.isArray(data)) {
        data.forEach((entry: any, idx: number) => {
          if (typeof entry === 'number') { setHour(key, idx, entry); return; }
          const hour = typeof entry?.hour === 'number' ? entry.hour : parseHour(entry?.time, idx);
          const value = typeof entry?.busyness_score === 'number' ? entry.busyness_score
            : (typeof entry?.busy_percent === 'number' ? entry.busy_percent
              : (typeof entry?.value === 'number' ? entry.value : (typeof entry?.percentage === 'number' ? entry.percentage : 0)));
          setHour(key, hour as number, value as number);
        });
      }
    });
    return out;
  }
  // 5) Alternativo: raw.popular_times.graph_results
  const rawGraph = raw?.popular_times?.graph_results;
  if (rawGraph && typeof rawGraph === 'object') {
    for (const key of Object.keys(rawGraph)) {
      const day = mapDayName(key) as string | null;
      if (!day || !dayKeys.includes(day)) continue;
      const arr: any[] = Array.isArray(rawGraph[key]) ? rawGraph[key] : [];
      arr.forEach((entry, idx) => {
        const hour = parseHour(entry?.time, idx);
        const value = typeof entry?.busyness_score === 'number' ? entry.busyness_score
          : (typeof entry?.busy_percent === 'number' ? entry.busy_percent
            : (typeof entry?.value === 'number' ? entry.value : 0));
        setHour(day, hour, value);
      });
    }
    return out;
  }
  return null;
};

const normalizeOpeningHoursFromSerpApi = (detail: any): any | null => {
  try {
    const weekday = detail?.opening_hours?.weekday_text;
    if (!weekday || !Array.isArray(weekday)) return null;
    const result: any = {
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    };
    const mapDay = (d: string): string | null => {
      const s = d.toLowerCase();
      if (s.startsWith('mon')) return 'monday';
      if (s.startsWith('tue')) return 'tuesday';
      if (s.startsWith('wed')) return 'wednesday';
      if (s.startsWith('thu')) return 'thursday';
      if (s.startsWith('fri')) return 'friday';
      if (s.startsWith('sat')) return 'saturday';
      if (s.startsWith('sun')) return 'sunday';
      if (s.startsWith('seg')) return 'monday';
      if (s.startsWith('ter')) return 'tuesday';
      if (s.startsWith('qua')) return 'wednesday';
      if (s.startsWith('qui')) return 'thursday';
      if (s.startsWith('sex')) return 'friday';
      if (s.startsWith('sáb') || s.startsWith('sab')) return 'saturday';
      if (s.startsWith('dom')) return 'sunday';
      return null;
    };
    const to24 = (txt: string): string | null => {
      if (!txt) return null;
      const m = txt.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
      if (!m) return null;
      let h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const ap = (m[3] || '').toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };
    for (const line of weekday) {
      const parts = String(line).split(':');
      const dayKey = mapDay(parts[0] || '');
      if (!dayKey) continue;
      const hoursText = parts.slice(1).join(':').trim();
      if (!hoursText || /fechad|closed/i.test(hoursText)) {
        result[dayKey] = { open: null, close: null, closed: true };
        continue;
      }
      const rng = hoursText.match(/([\d: ]+(?:AM|PM)?)\s*[–-]\s*([\d: ]+(?:AM|PM)?)/i);
      if (rng) {
        const open = to24(rng[1]);
        const close = to24(rng[2]);
        result[dayKey] = { open, close, closed: false };
      }
    }
    return result;
  } catch {
    // Fallback: Place Results -> hours: [{ monday: "6:30AM–5PM" }, ...]
    try {
      const hoursArr = detail?.place_results?.hours || detail?.hours;
      if (!Array.isArray(hoursArr)) return null;
      const result: any = {
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
      };
      const to24 = (s: string): string | null => {
        if (!s) return null;
        const m1 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
        if (m1) {
          let h = parseInt(m1[1], 10);
          const min = m1[2] ? parseInt(m1[2], 10) : 0;
          const ap = m1[3].toUpperCase();
          if (ap === 'PM' && h !== 12) h += 12;
          if (ap === 'AM' && h === 12) h = 0;
          return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        }
        const m2 = s.match(/^(\d{1,2}):(\d{2})$/);
        if (m2) return `${m2[1].padStart(2, '0')}:${m2[2]}`;
        return null;
      };
      const mapDay = (d: string): string | null => {
        const s = d.toLowerCase();
        if (s.startsWith('mon')) return 'monday';
        if (s.startsWith('tue')) return 'tuesday';
        if (s.startsWith('wed')) return 'wednesday';
        if (s.startsWith('thu')) return 'thursday';
        if (s.startsWith('fri')) return 'friday';
        if (s.startsWith('sat')) return 'saturday';
        if (s.startsWith('sun')) return 'sunday';
        return null;
      };
      for (const obj of hoursArr) {
        if (!obj || typeof obj !== 'object') continue;
        const dayKey = Object.keys(obj)[0];
        if (!dayKey) continue;
        const normDay = mapDay(dayKey);
        if (!normDay) continue;
        const txt = String(obj[dayKey] || '').trim();
        if (!txt || /fechad|closed/i.test(txt)) {
          result[normDay] = { open: null, close: null, closed: true };
          continue;
        }
        const m = txt.match(/([\d: ]+(?:AM|PM)?)\s*[–-]\s*([\d: ]+(?:AM|PM)?)/i);
        if (m) {
          const open = to24(m[1]);
          const close = to24(m[2]);
          result[normDay] = { open, close, closed: false };
        }
      }
      return result;
    } catch {
      return null;
    }
  }
};

// Normalizar horários de funcionamento de provedores alternativos (e.g., Outscraper)
const normalizeOpeningHoursGeneric = (raw: any): any | null => {
  try {
    const hoursSource = raw?.working_hours || raw?.hours || raw?.opening_hours || null;
    if (!hoursSource) return null;
    const entries: Array<[string, string]> = Array.isArray(hoursSource)
      ? hoursSource.map((o: any) => [Object.keys(o)[0], o[Object.keys(o)[0]]])
      : Object.keys(hoursSource).map((k: string) => [k, hoursSource[k]] as [string, string]);
    const result: any = { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null };
    const mapDay = (d: string): string | null => {
      const s = (d || '').toLowerCase();
      if (s.startsWith('mon')) return 'monday';
      if (s.startsWith('tue')) return 'tuesday';
      if (s.startsWith('wed')) return 'wednesday';
      if (s.startsWith('thu')) return 'thursday';
      if (s.startsWith('fri')) return 'friday';
      if (s.startsWith('sat')) return 'saturday';
      if (s.startsWith('sun')) return 'sunday';
      if (s.startsWith('seg')) return 'monday';
      if (s.startsWith('ter')) return 'tuesday';
      if (s.startsWith('qua')) return 'wednesday';
      if (s.startsWith('qui')) return 'thursday';
      if (s.startsWith('sex')) return 'friday';
      if (s.startsWith('sáb') || s.startsWith('sab')) return 'saturday';
      if (s.startsWith('dom')) return 'sunday';
      return null;
    };
    const to24 = (txt: string): string | null => {
      if (!txt) return null;
      const m = txt.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
      if (!m) return null;
      let h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const ap = (m[3] || '').toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };
    for (const [dayKey, value] of entries) {
      const normDay = mapDay(dayKey);
      if (!normDay) continue;
      const txt = String(value || '').trim();
      if (!txt || /fechad|closed/i.test(txt)) { result[normDay] = { open: null, close: null, closed: true }; continue; }
      const m = txt.match(/([\d: ]+(?:AM|PM)?)\s*[–-]\s*([\d: ]+(?:AM|PM)?)/i);
      if (m) {
        const open = to24(m[1]);
        const close = to24(m[2]);
        result[normDay] = { open, close, closed: false };
      }
    }
    return result;
  } catch {
    return null;
  }
};

// Provedor alternativo: Outscraper
const fetchPopularTimesFromOutscraper = async (
  name: string,
  address?: string,
  placeIdRaw?: string | null,
  googleMapsUri?: string | null,
): Promise<{ popularTimes: any | null; openingHours: any | null; isOpen: boolean | null; price?: string | null } | null> => {
  try {
    const axios = require('axios');
    const apiKey = process.env.OUTSCRAPER_API_KEY;
    if (!apiKey) return null;
    const headers = { 'X-API-KEY': apiKey } as any;
    const baseUrl = 'https://api.app.outscraper.com/maps/places-details';
    const params: any = {};
    const placeId = (placeIdRaw || '').startsWith('places/') ? (placeIdRaw as string).slice(7) : (placeIdRaw || '');
    // Conforme docs: popular_times funciona em buscas individuais (place_id ou ID/URL);
    // Estratégia: tentar por place_id; se não, por URL do Google Maps; se não, por "name + address"
    if (placeId) {
      params.place_id = placeId;
    } else if (googleMapsUri) {
      params.query = googleMapsUri;
      params.plain = true;
    } else {
      params.query = address ? `${name} ${address}` : name;
    }
    params.language = 'pt-BR';
    params.region = 'BR';
    params.limit = 1;
    params.async = false;
    params.fields = 'name,place_id,working_hours,opening_hours,popular_times,rating,reviews,subtypes,full_address,latitude,longitude';
    const resp = await axios.get(baseUrl, { headers, params, timeout: 25000 });
    const item = Array.isArray(resp?.data) ? resp.data[0] : (resp?.data?.data?.[0] || resp?.data || {});
    const normalized = normalizePopularTimes(item?.popular_times || item?.popularTimes || item);
    const openingHours = normalizeOpeningHoursGeneric(item) || normalizeOpeningHoursGeneric(item?.opening_hours) || null;
    // isOpen nem sempre vem; deixar null se não houver
    const isOpen = typeof item?.opening_hours?.open_now === 'boolean' ? !!item?.opening_hours?.open_now : null;
    const price = item?.price_level || item?.price || null;
    if (normalized || openingHours) {
      return { popularTimes: normalized, openingHours, isOpen, price };
    }
    // Fallback extra: tentar via URL construída por place_id (plain)
    if (placeId) {
      try {
        const params2: any = { language: 'en', region: 'BR', limit: 1, async: false, fields: params.fields };
        params2.query = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
        params2.plain = true;
        const resp2 = await axios.get(baseUrl, { headers, params: params2, timeout: 25000 });
        const item2 = Array.isArray(resp2?.data) ? resp2.data[0] : (resp2?.data?.data?.[0] || resp2?.data || {});
        const norm2 = normalizePopularTimes(item2?.popular_times || item2?.popularTimes || item2);
        const open2 = normalizeOpeningHoursGeneric(item2) || normalizeOpeningHoursGeneric(item2?.opening_hours) || null;
        const isOpen2 = typeof item2?.opening_hours?.open_now === 'boolean' ? !!item2?.opening_hours?.open_now : null;
        const price2 = item2?.price_level || item2?.price || null;
        if (norm2 || open2) return { popularTimes: norm2, openingHours: open2, isOpen: isOpen2, price: price2 };
      } catch (e) {
        // ignora e cai para erro geral
      }
    }
    return { popularTimes: null, openingHours: null, isOpen: isOpen, price };
  } catch (e: any) {
    console.warn('[Outscraper] erro:', e?.response?.status, e?.response?.data || e?.message || e);
    return null;
  }
};
const fetchPopularTimesFromSerpApi = async (
  name: string,
  address?: string,
  placeIdRaw?: string | null,
  lat?: number | null,
  lng?: number | null,
): Promise<{ popularTimes: any | null; openingHours: any | null; isOpen: boolean | null; price?: string | null } | null> => {
  try {
    const axios = require('axios');
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return null;
    // 1) Preferir chamada direta ao google_maps_place com place_id (quando tivermos do Places API v1: "places/{place_id}")
    let detail = null;
    let firstLocal: any = null;
    const placeId = (placeIdRaw || '').startsWith('places/') ? (placeIdRaw as string).slice(7) : (placeIdRaw || '');
    if (placeId) {
      const detailUrl = 'https://serpapi.com/search.json';
      const detailParams = { engine: 'google_maps_place', place_id: placeId, hl: 'pt-BR', gl: 'br', api_key: apiKey } as any;
      const detailRes = await axios.get(detailUrl, { params: detailParams, timeout: 20000 });
      console.log('[SerpApi] google_maps_place by place_id status:', detailRes.status, 'keys:', Object.keys(detailRes?.data || {}));
      detail = detailRes?.data;
    }

    // 2) Fallback: buscar pelo nome/endereço com google_maps search e, se vier data_id, pedir o place
    if (!detail) {
      const q = address ? `${name} ${address}` : name;
      const searchUrl = 'https://serpapi.com/search.json';
      const searchParams: any = { engine: 'google_maps', q, hl: 'pt-BR', gl: 'br', type: 'search', api_key: apiKey };
      // Se tivermos coordenadas, ajudar a contextualizar a busca
      if (typeof lat === 'number' && typeof lng === 'number') {
        // formato aceito: ll: @lat,lng,14z
        searchParams.ll = `@${lat},${lng},14z`;
      }
      const searchRes = await axios.get(searchUrl, { params: searchParams, timeout: 20000 });
      console.log('[SerpApi] google_maps search status:', searchRes.status, 'has local_results?', Array.isArray(searchRes?.data?.local_results), 'length:', searchRes?.data?.local_results?.length || 0);
      firstLocal = searchRes?.data?.local_results?.[0];
      if (!firstLocal) {
        const normalized = normalizePopularTimes(searchRes?.data?.popular_times || searchRes?.data?.place_results?.popular_times || searchRes?.data);
        if (normalized) return { popularTimes: normalized, openingHours: null, isOpen: null };
        return null;
      }
      const dataId = firstLocal?.data_id;
      if (dataId) {
        const detailUrl = 'https://serpapi.com/search.json';
        // Preferido: engine=google_maps com type=place e data codificado
        const dLat = (typeof lat === 'number') ? lat : (firstLocal?.gps_coordinates?.latitude ?? undefined);
        const dLng = (typeof lng === 'number') ? lng : (firstLocal?.gps_coordinates?.longitude ?? undefined);
        const dataParam = (typeof dLat === 'number' && typeof dLng === 'number')
          ? `!4m5!3m4!1s${dataId}!8m2!3d${dLat}!4d${dLng}`
          : `!4m5!3m4!1s${dataId}!8m2`;
        const detailParams: any = { engine: 'google_maps', type: 'place', data: dataParam, hl: 'pt-BR', gl: 'br', api_key: apiKey };
        if (typeof dLat === 'number' && typeof dLng === 'number') {
          detailParams.ll = `@${dLat},${dLng},14z`;
        }
        const detailRes = await axios.get(detailUrl, { params: detailParams, timeout: 20000 });
        console.log('[SerpApi] google_maps type=place by data param status:', detailRes.status, 'has place_results?', !!detailRes?.data?.place_results);
        detail = detailRes?.data?.place_results ? detailRes?.data : detailRes?.data;
        // Fallback para google_maps_place com data_id
        if (!detail?.place_results) {
          const fallbackParams = { engine: 'google_maps_place', data_id: dataId, hl: 'pt-BR', gl: 'br', api_key: apiKey } as any;
          const fbRes = await axios.get(detailUrl, { params: fallbackParams, timeout: 20000 });
          console.log('[SerpApi][fallback] google_maps_place by data_id status:', fbRes.status);
          detail = fbRes?.data;
        }
      }
    }
    let normalized = normalizePopularTimes(detail || firstLocal);
    let openingHours = normalizeOpeningHoursFromSerpApi(detail) || normalizeOpeningHoursFromSerpApi(detail?.place_results);
    let isOpen = typeof detail?.opening_hours?.open_now === 'boolean'
      ? !!detail?.opening_hours?.open_now
      : (typeof detail?.place_results?.opening_hours?.open_now === 'boolean' ? !!detail?.place_results?.opening_hours?.open_now : null);
    let price = (detail?.place_results?.price ?? firstLocal?.price) || null;

    // Fallback: tentar novamente com hl='en' se popularTimes/horários não vierem
    if (!normalized || !openingHours) {
      try {
        const retryParams: any = { hl: 'en', gl: 'br', api_key: apiKey };
        const dataId2 = firstLocal?.data_id;
        if (dataId2) {
          const dLat = (typeof lat === 'number') ? lat : (firstLocal?.gps_coordinates?.latitude ?? undefined);
          const dLng = (typeof lng === 'number') ? lng : (firstLocal?.gps_coordinates?.longitude ?? undefined);
          const dataParam = (typeof dLat === 'number' && typeof dLng === 'number')
            ? `!4m5!3m4!1s${dataId2}!8m2!3d${dLat}!4d${dLng}`
            : `!4m5!3m4!1s${dataId2}!8m2`;
          retryParams.engine = 'google_maps';
          retryParams.type = 'place';
          retryParams.data = dataParam;
          if (typeof dLat === 'number' && typeof dLng === 'number') retryParams.ll = `@${dLat},${dLng},14z`;
          const retryRes = await axios.get('https://serpapi.com/search.json', { params: retryParams, timeout: 20000 });
          const d2 = retryRes?.data;
          const n2 = normalizePopularTimes(d2 || d2?.place_results || {});
          const o2 = normalizeOpeningHoursFromSerpApi(d2) || normalizeOpeningHoursFromSerpApi(d2?.place_results);
          if (!normalized && n2) normalized = n2;
          if (!openingHours && o2) openingHours = o2;
          if (!price) price = d2?.place_results?.price || price;
          if (isOpen === null) {
            if (typeof d2?.opening_hours?.open_now === 'boolean') isOpen = !!d2?.opening_hours?.open_now;
            else if (typeof d2?.place_results?.opening_hours?.open_now === 'boolean') isOpen = !!d2?.place_results?.opening_hours?.open_now;
          }
        }
      } catch {}
    }

    return { popularTimes: normalized, openingHours, isOpen, price };
  } catch (e: any) {
    console.error('[Import] SerpApi error:', e?.response?.status, e?.response?.data || e?.message || e);
    return null;
  }
};

app.post('/places/popular-times/import-once', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const body = (req.body as any) || {};
    const limit = Math.min(parseInt(body.limit || '1000', 10) || 1000, 1000);
    const typeFilter: string | undefined = body.type;
    const areaIncludes: string | undefined = body.areaIncludes;
    const nameIncludes: string | undefined = body.nameIncludes;
    const overrideApiKey: string | undefined = body.apiKey; // opcional para testes
    const logMessages: string[] = [];
    const log = (m: string) => { console.log('[Import]', m); logMessages.push(m); };
    log(`Iniciando import popularTimes (one-time) limit=${limit} type=${typeFilter || '-'} area=${areaIncludes || '-'} name=${nameIncludes || '-'}`);

    const snap = await db.collection('places').get();
    let places = snap.docs.map(d => ({ docRef: d.ref, id: d.id, ...(d.data() as any) }));
    // Filtros opcionais
    if (typeFilter) {
      const t = typeFilter.toLowerCase();
      places = places.filter(p => Array.isArray(p.types) && p.types.some((x: string) => (x || '').toLowerCase() === t));
    }
    if (areaIncludes) {
      const q = areaIncludes.toLowerCase();
      places = places.filter(p => (p.formattedAddress || p.address || '').toLowerCase().includes(q)
        || (p.name || p.displayName?.text || '').toLowerCase().includes(q));
    }
    if (nameIncludes) {
      const q = nameIncludes.toLowerCase();
      places = places.filter(p => (p.name || p.displayName?.text || '').toLowerCase().includes(q));
    }
    // Selecionar apenas os que ainda não foram processados automaticamente
    // Ordenar por popularityAutoUpdatedAt (nulos primeiro), depois updatedAt
    const pending = places.filter((p: any) => !p.popularityAutoDone);
    const sorted = pending.sort((a: any, b: any) => {
      const aTs = a.popularityAutoUpdatedAt?.toMillis ? a.popularityAutoUpdatedAt.toMillis() : (a.popularityAutoUpdatedAt?._seconds ? a.popularityAutoUpdatedAt._seconds * 1000 : 0);
      const bTs = b.popularityAutoUpdatedAt?.toMillis ? b.popularityAutoUpdatedAt.toMillis() : (b.popularityAutoUpdatedAt?._seconds ? b.popularityAutoUpdatedAt._seconds * 1000 : 0);
      if (!aTs && bTs) return -1;
      if (aTs && !bTs) return 1;
      if (aTs !== bTs) return aTs - bTs;
      const aUp = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?._seconds ? a.updatedAt._seconds * 1000 : 0);
      const bUp = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?._seconds ? b.updatedAt._seconds * 1000 : 0);
      return aUp - bUp;
    });
    places = sorted.slice(0, limit);
    log(`Selecionados ${places.length} lugares pendentes (ordem por popularityAutoUpdatedAt).`);

    let updated = 0; let failed = 0; const results: any[] = [];

    for (const place of places) {
      try {
        log(`Processando: ${place.name || place.displayName?.text || place.id}`);
        let popularTimes: any | null = null;
        let openingHours: any | null = null;
        let isOpen: boolean | null = null;
        // Permitir override de API key somente nesta chamada, sem persistir
    if (overrideApiKey) {
      (process as any).env.SERPAPI_API_KEY = overrideApiKey;
      log(`Override SERPAPI_API_KEY recebido (tamanho=${overrideApiKey.length}).`);
    }
    if (!process.env.SERPAPI_API_KEY) {
      log('SERPAPI_API_KEY ausente. Configure nas Functions (env var) ou envie apiKey no corpo.');
    } else {
      log('SERPAPI_API_KEY presente.');
    }
        const latNum = typeof place.latitude === 'string' ? parseFloat(place.latitude) : (typeof place.latitude === 'number' ? place.latitude : null);
        const lngNum = typeof place.longitude === 'string' ? parseFloat(place.longitude) : (typeof place.longitude === 'number' ? place.longitude : null);
        const fromSerp = await fetchPopularTimesFromSerpApi(
          place.name || place.displayName?.text || '',
          place.formattedAddress,
          place.placeId || null,
          latNum,
          lngNum,
        );
        if (fromSerp) {
          popularTimes = fromSerp.popularTimes;
          openingHours = fromSerp.openingHours;
          isOpen = fromSerp.isOpen;
          log(`SerpApi retornou popularTimes=${!!popularTimes}, openingHours=${!!openingHours}, isOpen=${isOpen}`);
        } else {
          log('SerpApi não retornou dados (fromSerp=null).');
        }
        // Fallback: Outscraper, se SerpApi falhar
        if (!popularTimes || !openingHours) {
          const fromOut = await fetchPopularTimesFromOutscraper(
            place.name || place.displayName?.text || '',
            place.formattedAddress,
            place.placeId || null,
            place.googleMapsUri || null,
          );
          if (fromOut) {
            if (!popularTimes) popularTimes = fromOut.popularTimes;
            if (!openingHours) openingHours = fromOut.openingHours;
            if (isOpen === null) isOpen = fromOut.isOpen ?? null;
            log(`Outscraper retornou popularTimes=${!!fromOut.popularTimes}, openingHours=${!!fromOut.openingHours}`);
          }
        }
        if (!popularTimes && place.googleMapsUri) {
          popularTimes = await scrapePopularTimes(place.name || place.displayName?.text || '', place.googleMapsUri);
          log(`Fallback scraping: popularTimes=${!!popularTimes}`);
        }
        // Considerar sucesso apenas se for SERPAPI e vierem ambos popularTimes e openingHours
        const success = !!(fromSerp && (fromSerp.popularTimes || fromSerp.openingHours));
        if (success) {
          await place.docRef.update({
            ...(fromSerp!.popularTimes ? { popularTimes: fromSerp!.popularTimes } : {}),
            ...(fromSerp!.openingHours ? { openingHours: fromSerp!.openingHours } : {}),
            ...(isOpen !== null ? { isOpen } : {}),
            ...(fromSerp?.price ? { price: fromSerp.price } : {}),
            dataSource: 'serpapi',
            popularityProvider: 'serpapi',
            popularityUpdatedBy: 'auto',
            popularityAutoDone: true,
            popularityAutoUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          updated++; results.push({ id: place.id, name: place.name || place.displayName?.text || '', ok: true, source: 'serpapi' });
        } else { failed++; results.push({ id: place.id, name: place.name || place.displayName?.text || '', ok: false }); }

        // Respeitar limites - aguardar 1.2s entre chamadas
        await new Promise(resolve => setTimeout(resolve, 1200));
      } catch (err: any) {
        console.error('[Import] erro por lugar:', err?.message || err);
        failed++; results.push({ id: place.id, ok: false, error: err?.message });
      }
    }

    res.json({ total: places.length, updated, failed, provider: 'serpapi', results, logs: logMessages });
  } catch (error: any) {
    console.error('[Import] erro geral:', error);
    res.status(500).json({ message: 'Failed to import popular times', error: error?.message });
  }
});

// Import popular times para um único lugar (manual)
app.post('/places/:docId/popular-times/import', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const overrideApiKey: string | undefined = (req.body as any)?.apiKey;
    const providerPref: string | undefined = (req.query as any)?.provider || (req.body as any)?.provider;
    const logMessages: string[] = [];
    const log = (m: string) => { console.log('[Import-One]', m); logMessages.push(m); };

    const ref = db.collection('places').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ message: 'Place não encontrado' });
      return;
    }
    const place = { id: docId, ...(snap.data() as any) } as any;
    log(`Processando (manual): ${place.name || place.displayName?.text || place.id}`);

    if (overrideApiKey) (process as any).env.SERPAPI_API_KEY = overrideApiKey;

    const latNum = typeof place.latitude === 'string' ? parseFloat(place.latitude) : (typeof place.latitude === 'number' ? place.latitude : null);
    const lngNum = typeof place.longitude === 'string' ? parseFloat(place.longitude) : (typeof place.longitude === 'number' ? place.longitude : null);
    let popularTimes: any | null = null;
    let openingHours: any | null = null;
    let isOpen: boolean | null = null;
    let providerUsed: 'serpapi' | 'outscraper' | null = null;
    let priceVal: string | null = null;
    if (providerPref === 'outscraper') {
      log(`Provider forçado: outscraper`);
      log(`Params: name="${place.name || place.displayName?.text || ''}", address="${place.formattedAddress || ''}", placeId="${place.placeId || ''}"`);
      const fromOut = await fetchPopularTimesFromOutscraper(
        place.name || place.displayName?.text || '',
        place.formattedAddress,
        place.placeId || null,
        place.googleMapsUri || null,
      );
      if (fromOut) {
        popularTimes = fromOut.popularTimes;
        openingHours = fromOut.openingHours;
        isOpen = fromOut.isOpen ?? null;
        priceVal = fromOut.price ?? null;
        providerUsed = 'outscraper';
        log(`Outscraper (forçado): popularTimes=${!!fromOut.popularTimes}, openingHours=${!!fromOut.openingHours}`);
      }
    } else {
      log(`Provider primário: serpapi`);
      log(`Params: name="${place.name || place.displayName?.text || ''}", address="${place.formattedAddress || ''}", placeId="${place.placeId || ''}", lat=${latNum}, lng=${lngNum}`);
      const fromSerp = await fetchPopularTimesFromSerpApi(
        place.name || place.displayName?.text || '',
        place.formattedAddress,
        place.placeId || null,
        latNum,
        lngNum,
      );
      if (fromSerp) {
        popularTimes = fromSerp.popularTimes;
        openingHours = fromSerp.openingHours;
        isOpen = fromSerp.isOpen;
        priceVal = fromSerp.price ?? null;
        providerUsed = 'serpapi';
        log(`SerpApi: popularTimes=${!!popularTimes}, openingHours=${!!openingHours}, isOpen=${isOpen}`);
      }
      if (!popularTimes || !openingHours) {
        log('Fallback: outscraper');
          const fromOut = await fetchPopularTimesFromOutscraper(
          place.name || place.displayName?.text || '',
          place.formattedAddress,
            place.placeId || null,
            place.googleMapsUri || null,
        );
        if (fromOut) {
          if (!popularTimes) popularTimes = fromOut.popularTimes;
          if (!openingHours) openingHours = fromOut.openingHours;
          if (isOpen === null) isOpen = fromOut.isOpen ?? null;
          if (!priceVal && fromOut.price) priceVal = fromOut.price;
          if (!providerUsed) providerUsed = 'outscraper';
          log(`Outscraper (fallback): popularTimes=${!!fromOut.popularTimes}, openingHours=${!!fromOut.openingHours}`);
        }
      }
    }
    const success = !!(popularTimes || openingHours);
    if (!success) {
      // Tentar Outscraper Cloud Tasks (consulta individual por nome/local) como último recurso
      const buildLocation = (addr?: string): string => {
        const a = (addr || '').toLowerCase();
        if (a.includes('santos')) return 'BR^>Sao Paulo^>Santos';
        if (a.includes('são vicente') || a.includes('sao vicente')) return 'BR^>Sao Paulo^>Sao Vicente';
        if (a.includes('guarujá') || a.includes('guaruja')) return 'BR^>Sao Paulo^>Guaruja';
        if (a.includes('praia grande')) return 'BR^>Sao Paulo^>Praia Grande';
        return 'BR';
      };
      const taskRes = await (async () => {
        // Implementação inline do task fetcher, evitando refs externas
        try {
          const axios = require('axios');
          const apiKey = process.env.OUTSCRAPER_API_KEY;
          if (!apiKey) return null;
          const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } as any;
          const base = 'https://api.outscraper.cloud';
          const payload: any = {
            service_name: 'google_maps_service_v2',
            title: 'popular_times_single',
            language: 'en',
            region: 'BR',
            categories: [place.name || place.displayName?.text || ''],
            locations: [buildLocation(place.formattedAddress)],
            limit: 1,
            exactMatch: false,
            enrich: false,
            UISettings: { isCustomQueries: false, isCustomCategories: false, isCustomLocations: false },
            settings: { output_columns: [], output_extension: 'json' },
            tags: place.name || ''
          };
          const createRes = await axios.post(`${base}/tasks`, payload, { headers, timeout: 20000 });
          const taskId = createRes?.data?.id || createRes?.data?.task_id || createRes?.data?.data?.id;
          if (!taskId) return null;
          const poll = async (): Promise<any> => {
            const starts = Date.now();
            while (Date.now() - starts < 60000) {
              try {
                const g1 = await axios.get(`${base}/tasks/get`, { headers, params: { id: taskId }, timeout: 15000 });
                const st = g1?.data?.status || g1?.data?.data?.status;
                if (st && String(st).toLowerCase() === 'finished') return g1?.data?.results || g1?.data?.data || g1?.data;
              } catch {}
              try {
                const g2 = await axios.get(`${base}/tasks/get`, { headers, params: { task_id: taskId }, timeout: 15000 });
                const st2 = g2?.data?.status || g2?.data?.data?.status;
                if (st2 && String(st2).toLowerCase() === 'finished') return g2?.data?.results || g2?.data?.data || g2?.data;
              } catch {}
              await new Promise(r => setTimeout(r, 3000));
            }
            return null;
          };
          const results = await poll();
          // Encontrar o primeiro objeto que contenha 'popular_times' dentro do retorno
          const findWithPopularTimes = (node: any): any | null => {
            if (!node) return null;
            if (Array.isArray(node)) {
              for (const el of node) {
                const found = findWithPopularTimes(el);
                if (found) return found;
              }
              return null;
            }
            if (typeof node === 'object') {
              if (node.popular_times && Array.isArray(node.popular_times)) return node;
              const keys = Object.keys(node);
              for (const k of keys) {
                const found = findWithPopularTimes(node[k]);
                if (found) return found;
              }
            }
            return null;
          };
          const candidate = findWithPopularTimes(results);
          const item = candidate || (Array.isArray(results) ? results[0] : (results?.[0] || results?.result?.[0] || results?.data?.[0] || results || {}));
          if (!item || typeof item !== 'object') return null;
          const normalized = normalizePopularTimes(item?.popular_times || item?.popularTimes || item);
          const openingHours = normalizeOpeningHoursGeneric(item) || normalizeOpeningHoursGeneric(item?.opening_hours) || null;
          const fields: any = {
            website: item?.site || item?.website || null,
            instagram: item?.instagram || (Array.isArray(item?.socials) ? (item.socials.find((s: string) => /instagram\.com/i.test(s)) || null) : null),
            reservationLinks: item?.reservation_links || item?.booking_appointment_link || null,
            price: item?.price_level || item?.price || null,
            description: item?.description || null,
            logoUrl: item?.logo || item?.photo || null,
            rating: typeof item?.rating === 'number' ? item.rating : null,
            userRatingsTotal: typeof item?.reviews === 'number' ? item.reviews : null,
            formattedAddress: item?.full_address || null,
            city: item?.city || null,
            googleMapsUri: item?.location_link || null,
            placeId: item?.place_id || null,
            types: (typeof item?.subtypes === 'string' ? item.subtypes.split(/\s*,\s*/) : (Array.isArray(item?.subtypes) ? item.subtypes : null)) || null
          };
          return { popularTimes: normalized, openingHours, fields };
        } catch (e) { return null; }
      })();
      if (taskRes) {
        if (!popularTimes) popularTimes = taskRes.popularTimes;
        if (!openingHours) openingHours = taskRes.openingHours;
        log(`Outscraper tasks: popularTimes=${!!taskRes.popularTimes}, openingHours=${!!taskRes.openingHours}`);
        // Mesmo sem popularTimes/openingHours, podemos aproveitar campos ricos
        // Atualizar com campos ricos
        const updates: any = {
          ...(popularTimes ? { popularTimes } : {}),
          ...(openingHours ? { openingHours } : {}),
          ...(isOpen !== null ? { isOpen } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          popularityProvider: 'outscraper_tasks',
          dataSource: 'outscraper_tasks',
          popularityUpdatedBy: 'manual',
          popularityManualUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const f = taskRes.fields || {};
        if (f.website) updates.website = f.website;
        if (f.instagram) updates.instagram = f.instagram;
        if (f.reservationLinks) updates.reservationLinks = f.reservationLinks;
        if (f.price && !updates.price) updates.price = f.price;
        if (f.description) updates.description = f.description;
        if (f.logoUrl) updates.logoUrl = f.logoUrl;
        if (typeof f.rating === 'number') updates.rating = f.rating;
        if (typeof f.userRatingsTotal === 'number') updates.userRatingsTotal = f.userRatingsTotal;
        if (f.formattedAddress) updates.formattedAddress = f.formattedAddress;
        if (f.city) updates.city = f.city;
        if (f.googleMapsUri) updates.googleMapsUri = f.googleMapsUri;
        if (f.placeId && !place.placeId) updates.placeId = f.placeId;
        if (Array.isArray(f.types) && f.types.length) updates.types = f.types;
        if (Object.keys(updates).length > 0) {
          await ref.update(updates);
        }
        res.json({ success: true, id: docId, source: 'outscraper_tasks', logs: logMessages, updatedFields: Object.keys(updates) });
        return;
      } else {
        // Sem dados novos: não tratar como erro; apenas informar no-op
        log('Sem dados novos das APIs (no-op). Mantido o que já existia.');
        res.json({ success: true, id: docId, source: 'none', logs: logMessages, updatedFields: [] });
        return;
      }
    }

    await ref.update({
      ...(popularTimes ? { popularTimes } : {}),
      ...(openingHours ? { openingHours } : {}),
      ...(isOpen !== null ? { isOpen } : {}),
      ...(priceVal ? { price: priceVal } : {}),
      ...(providerUsed ? { dataSource: providerUsed, popularityProvider: providerUsed } : {}),
      popularityUpdatedBy: 'manual',
      popularityManualUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, id: docId, source: providerUsed || 'unknown', logs: logMessages });
  } catch (error: any) {
    console.error('[Import-One] erro:', error);
    res.status(500).json({ message: error?.message || 'Falha na importação manual' });
  }
});

// Atualizar horários/avaliações de um único lugar (Google Places Details)
app.post('/places/:docId/update-hours', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { docId } = req.params;
    if (!docId) {
      res.status(400).json({ message: 'docId é obrigatório' });
      return;
    }
    const ref = db.collection('places').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ message: 'Place não encontrado' });
      return;
    }
    const place = { id: docId, ...(snap.data() as any) } as any;
    if (!place.placeId) {
      res.status(400).json({ message: 'Este documento não possui placeId' });
      return;
    }

    const apiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
    const fieldMask = 'regularOpeningHours,currentOpeningHours,displayName,rating,userRatingCount';
    const resourceName = String(place.placeId || '').startsWith('places/') ? String(place.placeId) : `places/${place.placeId}`;
    const detailsUrl = `https://places.googleapis.com/v1/${resourceName}`;
    const detailsResponse = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask
      }
    });
    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text().catch(() => '');
      res.status(502).json({ message: `Google Places error ${detailsResponse.status}`, error: errorText });
      return;
    }
    const details = await detailsResponse.json();

    const extractOpeningHoursLocal = (regularOpeningHours: any) => {
      if (!regularOpeningHours?.weekdayDescriptions) return null;
      const hours: any = { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null };
      const dayMapping: Record<string, string> = {
        'Segunda-feira': 'monday','Terça-feira': 'tuesday','Quarta-feira': 'wednesday','Quinta-feira': 'thursday','Sexta-feira': 'friday','Sábado': 'saturday','Domingo': 'sunday',
        'Monday': 'monday','Tuesday': 'tuesday','Wednesday': 'wednesday','Thursday': 'thursday','Friday': 'friday','Saturday': 'saturday','Sunday': 'sunday'
      };
      regularOpeningHours.weekdayDescriptions.forEach((desc: string) => {
        const parts = desc.split(':');
        if (parts.length < 2) return;
        const dayName = parts[0].trim();
        const hoursText = parts.slice(1).join(':').trim();
        const dayKey = dayMapping[dayName];
        if (!dayKey) return;
        if (hoursText.toLowerCase().includes('fechado') || hoursText.toLowerCase().includes('closed')) {
          hours[dayKey] = { open: null, close: null, closed: true };
        } else {
          const m = hoursText.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
          if (m) {
            hours[dayKey] = { open: `${m[1].padStart(2,'0')}:${m[2]}`, close: `${m[3].padStart(2,'0')}:${m[4]}`, closed: false };
          }
        }
      });
      return hours;
    };

    const openingHours = extractOpeningHoursLocal(details.regularOpeningHours);
    const isOpenValue = details.currentOpeningHours ? (details.currentOpeningHours.openNow || null) : null;
    const newRating = typeof details.rating === 'number' ? details.rating : (place.rating ?? null);
    const newUserRatingCount = typeof details.userRatingCount === 'number' ? details.userRatingCount : (place.userRatingsTotal ?? 0);

    const updates: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    const logs: string[] = [];
    if (openingHours) {
      updates.openingHours = openingHours;
      const sample = openingHours.monday || openingHours.tuesday || openingHours.friday || null;
      logs.push(`Horários de funcionamento atualizados${sample ? ` (ex: ${sample.closed ? 'fechado' : `${sample.open}–${sample.close}`})` : ''}`);
    }
    if (isOpenValue !== null) {
      updates.isOpen = isOpenValue;
      logs.push(`Status atual: ${isOpenValue ? 'aberto' : 'fechado'}`);
    }
    if (newRating !== null && newRating !== undefined) {
      const prev = place.rating ?? '—';
      updates.rating = newRating;
      logs.push(`Rating: ${prev} → ${newRating}`);
    }
    if (typeof newUserRatingCount === 'number') {
      const prev = typeof place.userRatingsTotal === 'number' ? place.userRatingsTotal : 0;
      updates.userRatingsTotal = newUserRatingCount;
      logs.push(`Qtd avaliações: ${prev} → ${newUserRatingCount}`);
    }
    if (details.displayName?.text) {
      updates.name = details.displayName.text;
    }

    await ref.update(updates);

    res.json({
      success: true,
      id: docId,
      updated: {
        openingHours: !!openingHours,
        rating: typeof newRating === 'number',
        userRatingsTotal: typeof newUserRatingCount === 'number'
      },
      logs
    });
  } catch (error: any) {
    console.error('[Update-One-Hours] erro:', error);
    res.status(500).json({ message: error?.message || 'Falha ao atualizar horários/avaliações' });
  }
});

// Atualizar horários de todos os lugares existentes
app.post('/places/update-all-hours', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const apiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
    
    console.log('[API] Buscando todos os lugares do Firestore...');
    
    // Buscar todos os lugares
    const placesSnapshot = await db.collection('places').get();
    let places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    console.log(`[API] Encontrados ${places.length} lugares no Firestore`);
    
    // Filtro para evitar repetir os mesmos registros
    const maxAgeHours = Math.max(0, Math.min(720, parseInt(String((req.body as any)?.maxAgeHours ?? '24'), 10) || 24));
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const toMillis = (ts: any): number => ts?.toMillis ? ts.toMillis() : (ts?._seconds ? ts._seconds * 1000 : 0);
    places = places.filter((p: any) => {
      const last = toMillis(p.hoursUpdatedAt);
      return !last || last < cutoff; // só processa quem nunca foi atualizado ou está "antigo"
    })
    // ordenar para pegar os mais antigos primeiro
    .sort((a: any, b: any) => (toMillis(a.hoursUpdatedAt) || 0) - (toMillis(b.hoursUpdatedAt) || 0));

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
        const resourceName = String(place.placeId || '').startsWith('places/') ? String(place.placeId) : `places/${place.placeId}`;
        const placeDetailsUrl = `https://places.googleapis.com/v1/${resourceName}`;
        
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
        
        // Enriquecer nota e contagem de avaliações
        const rating = typeof placeDetails.rating === 'number' ? placeDetails.rating : (place.rating ?? null);
        const userRatingCount = typeof placeDetails.userRatingCount === 'number' ? placeDetails.userRatingCount : (place.userRatingsTotal ?? 0);
        
        // Atualizar no Firestore
        const placeRef = db.collection('places').doc(place.id);
        await placeRef.update({
          openingHours,
          isOpen: isOpenValue,
          rating,
          userRatingsTotal: userRatingCount,
          // opcional: atualizar nome se vier do details
          ...(placeDetails.displayName?.text ? { name: placeDetails.displayName.text } : {}),
          hoursUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          hoursUpdatedBy: 'auto',
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

// Atualizar horários/avaliações com logs em tempo real (SSE) e suporte a cancelamento
app.post('/places/update-all-hours-stream', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    // Configurar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const apiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";

    // Buscar todos os lugares
    const placesSnapshot = await db.collection('places').get();
    let places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    // Aplicar filtro de "não repetir" baseado em hoursUpdatedAt
    const toMillis = (ts: any): number => ts?.toMillis ? ts.toMillis() : (ts?._seconds ? ts._seconds * 1000 : 0);
    const body = (req.body as any) || {};
    const query = (req.query as any) || {};
    const maxAgeHours = Math.max(0, Math.min(720, parseInt(String(body.maxAgeHours ?? query.maxAgeHours ?? '24'), 10) || 24));
    const limit = Math.max(0, Math.min(2000, parseInt(String(body.limit ?? query.limit ?? '0'), 10) || 0));
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
    let pending = places.filter((p: any) => {
      const last = toMillis(p.hoursUpdatedAt);
      return !last || last < cutoff; // só processa quem nunca foi atualizado ou está antigo
    }).sort((a: any, b: any) => (toMillis(a.hoursUpdatedAt) || 0) - (toMillis(b.hoursUpdatedAt) || 0));
    if (limit > 0) pending = pending.slice(0, limit);

    send({ type: 'start', total: pending.length });

    let updatedCount = 0;
    let errorCount = 0;
    let cancelled = false;
    req.on('close', () => { cancelled = true; });

    const fieldMask = 'regularOpeningHours,currentOpeningHours,displayName,rating,userRatingCount';

    for (let i = 0; i < pending.length; i++) {
      if (cancelled) {
        send({ type: 'cancelled', updated: updatedCount, errors: errorCount, total: pending.length });
        res.end();
        return;
      }
      const place = pending[i];
      const placeName = place.name;
      const placeId = place.placeId;
      try {
        if (!placeId) {
          send({ type: 'progress', index: i + 1, total: places.length, placeName, status: 'skipped', reason: 'no_placeId' });
          continue;
        }

        const resourceName = String(placeId || '').startsWith('places/') ? String(placeId) : `places/${placeId}`;
        const detailsUrl = `https://places.googleapis.com/v1/${resourceName}`;
        const detailsResponse = await fetch(detailsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': fieldMask
          }
        });
        if (!detailsResponse.ok) {
          const msg = `details ${detailsResponse.status}`;
          errorCount++;
          send({ type: 'progress', index: i + 1, total: places.length, placeName, status: 'error', reason: msg });
          continue;
        }
        const placeDetails = await detailsResponse.json();

        const extractOpeningHoursLocal = (regularOpeningHours: any) => {
          if (!regularOpeningHours?.weekdayDescriptions) return null;
          const hours: any = { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null };
          const dayMapping: Record<string, string> = { 'Segunda-feira': 'monday','Terça-feira': 'tuesday','Quarta-feira': 'wednesday','Quinta-feira': 'thursday','Sexta-feira': 'friday','Sábado': 'saturday','Domingo': 'sunday','Monday': 'monday','Tuesday': 'tuesday','Wednesday': 'wednesday','Thursday': 'thursday','Friday': 'friday','Saturday': 'saturday','Sunday': 'sunday' };
          regularOpeningHours.weekdayDescriptions.forEach((desc: string) => {
            const parts = desc.split(':');
            if (parts.length < 2) return;
            const dayName = parts[0].trim();
            const hoursText = parts.slice(1).join(':').trim();
            const dayKey = dayMapping[dayName];
            if (!dayKey) return;
            if (hoursText.toLowerCase().includes('fechado') || hoursText.toLowerCase().includes('closed')) {
              hours[dayKey] = { open: null, close: null, closed: true };
            } else {
              const m = hoursText.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
              if (m) {
                hours[dayKey] = { open: `${m[1].padStart(2,'0')}:${m[2]}`, close: `${m[3].padStart(2,'0')}:${m[4]}`, closed: false };
              }
            }
          });
          return hours;
        };

        const openingHours = extractOpeningHoursLocal(placeDetails.regularOpeningHours);
        const isOpenValue = placeDetails.currentOpeningHours ? (placeDetails.currentOpeningHours.openNow || null) : null;
        const rating = typeof placeDetails.rating === 'number' ? placeDetails.rating : (place.rating ?? null);
        const userRatingCount = typeof placeDetails.userRatingCount === 'number' ? placeDetails.userRatingCount : (place.userRatingsTotal ?? 0);

        const placeRef = db.collection('places').doc(place.id);
        await placeRef.update({
          openingHours,
          isOpen: isOpenValue,
          rating,
          userRatingsTotal: userRatingCount,
          ...(placeDetails.displayName?.text ? { name: placeDetails.displayName.text } : {}),
          hoursUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          hoursUpdatedBy: 'auto-stream',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        updatedCount++;
        send({ type: 'progress', index: i + 1, total: pending.length, placeName, status: 'updated' });
        await new Promise(resolve => setTimeout(resolve, 400));
      } catch (err: any) {
        errorCount++;
        send({ type: 'progress', index: i + 1, total: pending.length, placeName, status: 'error', reason: err?.message || String(err) });
      }
    }

    send({ type: 'end', updated: updatedCount, errors: errorCount, total: pending.length });
    res.end();
  } catch (error) {
    console.error('[API] Erro geral (stream):', error);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: (error as any)?.message || 'unknown' })}\n\n`); } catch {}
    res.end();
  }
});

// Excluir um lugar por docId (admin)
app.delete('/places/:docId', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { docId } = req.params;
    if (!docId) {
      res.status(400).json({ message: 'docId é obrigatório' });
      return;
    }
    const ref = db.collection('places').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ message: 'Place não encontrado' });
      return;
    }
    await ref.delete();
    res.json({ success: true, deletedId: docId });
  } catch (error: any) {
    console.error('[API] Erro ao excluir place:', error);
    res.status(500).json({ message: error.message || 'Failed to delete place' });
  }
});

// Atualizar tipos do lugar (admin)
app.patch('/places/:docId/types', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const { types } = req.body as { types?: string[] };
    if (!docId) {
      res.status(400).json({ message: 'docId é obrigatório' });
      return;
    }
    if (!Array.isArray(types) || types.length === 0) {
      res.status(400).json({ message: 'types (string[]) é obrigatório' });
      return;
    }
    const allowed = new Set(['bar', 'night_club', 'restaurant', 'cafe', 'bakery', 'movie_theater', 'amusement_park']);
    const sanitized = Array.from(new Set(types.filter((t: string) => allowed.has(t))));
    if (sanitized.length === 0) {
      res.status(400).json({ message: 'Nenhum tipo válido informado' });
      return;
    }
    const ref = db.collection('places').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ message: 'Place não encontrado' });
      return;
    }
    await ref.update({ types: sanitized, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true, id: docId, types: sanitized });
  } catch (error: any) {
    console.error('[API] Erro ao atualizar types do place:', error);
    res.status(500).json({ message: error.message || 'Failed to update place types' });
  }
});

// Endpoint para atualizar googleMapsUri de um place
app.patch('/places/:placeId/googlemaps', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { placeId } = req.params;
    const { googleMapsUri } = req.body;
    
    if (!googleMapsUri) {
      res.status(400).json({ message: "googleMapsUri é obrigatório" });
      return;
    }
    
    const placeDoc = await db.collection('places').doc(placeId);
    const placeData = await placeDoc.get();
    
    if (!placeData.exists) {
      res.status(404).json({ message: "Place not found" });
      return;
    }
    
    await placeDoc.update({
      googleMapsUri,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    res.json({
      success: true,
      message: `googleMapsUri atualizado para ${placeData.data()?.name}`,
    });
  } catch (error: any) {
    console.error('[API] Erro ao atualizar googleMapsUri:', error);
    res.status(500).json({ message: error.message });
  }
});

// Endpoint para atualizar um place individual
app.post('/places/:placeId/scrape', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { placeId } = req.params;
    
    const placeDoc = await db.collection('places').doc(placeId).get();
    
    if (!placeDoc.exists) {
      res.status(404).json({ message: "Place not found" });
      return;
    }
    
    const place = { id: placeDoc.id, ...placeDoc.data() } as any;
    
    if (!place.googleMapsUri) {
      res.status(400).json({ message: "Place não tem googleMapsUri" });
      return;
    }
    
    const scrapedPopularTimes = await scrapePopularTimes(place.name, place.googleMapsUri);
    
    if (scrapedPopularTimes) {
      await placeDoc.ref.update({
        popularTimes: scrapedPopularTimes,
        dataSource: 'scraped',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      res.json({
        success: true,
        message: `Popular times atualizados para ${place.name}`,
        placeName: place.name,
        data: {
          hasData: true,
          totalDays: Object.keys(scrapedPopularTimes).length,
        }
      });
    } else {
      res.status(400).json({ message: "Não foi possível extrair popular times" });
    }
  } catch (error: any) {
    console.error('[API] Erro ao atualizar place:', error);
    res.status(500).json({ message: error.message });
  }
});

// Endpoint para fazer scraping de Popular Times com logs detalhados - VERSÃO COM RESULTADOS EM TEMPO REAL
app.post('/places/scrape-popular-times', authenticate, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    // Configurar streaming de resposta
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    console.log('[Scraping] Iniciando scraping de Popular Times...');
    
    // Buscar todos os lugares
    const placesSnapshot = await db.collection('places').limit(50).get();
    const places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    console.log(`[Scraping] Encontrados ${places.length} lugares para processar`);
    
    // Enviar início
    res.write(`data: ${JSON.stringify({ type: 'start', total: places.length })}\n\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const allResults: any[] = [];
    
    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      const result: any = {
        index: i + 1,
        total: places.length,
        placeName: place.name,
        placeId: place.id,
        googleMapsUri: place.googleMapsUri || null,
        status: 'processing',
        logs: [],
        data: null,
        error: null,
        duration: 0
      };
      
      const startTime = Date.now();
      
      try {
        result.logs.push(`🔍 [${i + 1}/${places.length}] Iniciando scraping: ${place.name}`);
        console.log(`[Scraping] [${i + 1}/${places.length}] Processando: ${place.name}`);
        
        // Enviar progresso
        res.write(`data: ${JSON.stringify({ type: 'progress', result: { ...result, status: 'started' } })}\n\n`);
        
        // Buscar googleMapsUri no Firestore
        if (!place.googleMapsUri) {
          result.status = 'skipped';
          result.logs.push('⚠️ Place sem googleMapsUri, pulando');
          result.error = 'Sem URL do Google Maps';
          result.duration = Date.now() - startTime;
          result.logs.push(`⏱️ Duração: ${result.duration}ms`);
          skippedCount++;
        } else {
          result.logs.push(`📍 URL: ${place.googleMapsUri.substring(0, 50)}...`);
          
          // Fazer scraping
          const scrapedPopularTimes = await scrapePopularTimes(place.name, place.googleMapsUri);
          
          if (scrapedPopularTimes) {
            result.logs.push('✅ Dados extraídos com sucesso!');
            result.status = 'success';
            result.data = {
              hasData: true,
              totalDays: Object.keys(scrapedPopularTimes).length,
              sample: {
                monday: scrapedPopularTimes.monday?.slice(0, 5) || [],
                friday: scrapedPopularTimes.friday?.slice(0, 5) || []
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
        }
        
        result.duration = Date.now() - startTime;
        result.logs.push(`⏱️ Duração total: ${result.duration}ms`);
        allResults.push(result);
        
        // Enviar resultado
        res.write(`data: ${JSON.stringify({ type: 'result', result })}\n\n`);
        
        // Aguardar 2 segundos entre requisições para evitar bloqueio
        if (i < places.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error: any) {
        result.status = 'error';
        result.error = error.message;
        result.logs.push(`❌ Erro: ${error.message}`);
        result.duration = Date.now() - startTime;
        console.error(`[Scraping] Erro ao processar ${place.name}:`, error);
        errorCount++;
        allResults.push(result);
        
        // Enviar erro
        res.write(`data: ${JSON.stringify({ type: 'result', result })}\n\n`);
      }
    }
    
    console.log('[Scraping] Scraping concluído');
    
    // Enviar finalização
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      summary: {
        total: places.length,
        success: successCount,
        errors: errorCount,
        skipped: skippedCount
      }
    })}\n\n`);
    
    res.end();
    
  } catch (error: any) {
    console.error('[Scraping] Erro geral:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// Export all functions
export const api = onRequest({ region: 'us-central1', timeoutSeconds: 540, secrets: [SERPAPI_API_KEY, OUTSCRAPER_API_KEY] }, app);
