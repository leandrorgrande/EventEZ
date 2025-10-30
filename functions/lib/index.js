"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cheerio = __importStar(require("cheerio"));
admin.initializeApp();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// Middleware de autenticação
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    }
    catch (error) {
        res.status(401).json({ message: "Unauthorized" });
    }
};
// Helper functions
const db = admin.firestore();
// ============ USERS ============
// Buscar places com filtros e paginação
app.get('/places', async (req, res) => {
    try {
        const { name, type, hasType, city, district, page = '1', pageSize = '10' } = req.query;
        const p = Math.max(1, parseInt(page, 10) || 1);
        const ps = Math.max(1, Math.min(50, parseInt(pageSize, 10) || 10));
        const snap = await db.collection('places').get();
        let places = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Filtros em memória (simplificado)
        if (name) {
            const q = String(name).toLowerCase();
            places = places.filter(p => (p.name || p.displayName?.text || '').toLowerCase().includes(q));
        }
        if (type) {
            const t = String(type).toLowerCase();
            places = places.filter(p => Array.isArray(p.types) && p.types.some((x) => (x || '').toLowerCase() === t));
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
        const total = places.length;
        const start = (p - 1) * ps;
        const pageItems = places.slice(start, start + ps);
        res.json({ total, page: p, pageSize: ps, items: pageItems });
    }
    catch (error) {
        console.error('[API] Erro ao buscar places com filtros:', error);
        res.status(500).json({ message: 'Failed to fetch places' });
    }
});
// Get all users (admin only)
app.get('/users', authenticate, async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[API] Retornando ${users.length} usuários`);
        res.json(users);
    }
    catch (error) {
        console.error('[API] Erro ao buscar usuários:', error);
        res.status(500).json({ message: "Failed to fetch users" });
    }
});
app.get('/users/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userDoc = await db.collection('users').doc(id).get();
        if (!userDoc.exists) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json({ id: userDoc.id, ...userDoc.data() });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch user" });
    }
});
// Make users admin by email (one-time setup endpoint)
app.post('/users/make-admin', async (req, res) => {
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
    }
    catch (error) {
        console.error('Error making user admin:', error);
        res.status(500).json({ message: "Failed to make user admin" });
    }
});
// Update user role (admin/regular)
app.patch('/users/:id/role', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { userType } = req.body;
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
    }
    catch (error) {
        console.error('[API] Erro ao atualizar role do usuário:', error);
        res.status(500).json({ message: 'Failed to update user role' });
    }
});
// ============ EVENTS ============
// Rota de DEBUG para listar TODOS os eventos sem filtro
app.get('/events/debug', authenticate, async (req, res) => {
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
    }
    catch (error) {
        console.error('[DEBUG] ERRO:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack,
            message: "Erro ao buscar eventos (debug)"
        });
    }
});
app.get('/events', authenticate, async (req, res) => {
    try {
        const eventType = req.query.eventType;
        // Corrigir: só considerar isActive quando o parâmetro existir na query
        const hasIsActiveParam = typeof req.query.isActive !== 'undefined';
        const isActive = hasIsActiveParam ? (req.query.isActive === 'true') : undefined;
        const approvalStatus = req.query.approvalStatus;
        const user = req.user;
        console.log('[API] GET /events - Query params:', { eventType, isActive, approvalStatus });
        console.log('[API] User UID:', user?.uid);
        // Buscar TODOS os eventos primeiro
        const snapshot = await db.collection('events').get();
        let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[API] Total de eventos no Firestore:', events.length);
        // Log detalhado dos eventos
        if (events.length > 0) {
            console.log('[API] Primeiro evento:', JSON.stringify(events[0], null, 2));
            events.forEach((e, idx) => {
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
            events = events.filter((e) => e.eventType === eventType);
        }
        if (hasIsActiveParam) {
            events = events.filter((e) => e.isActive === isActive);
        }
        // Ordenar por data
        events = events.sort((a, b) => {
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
            }
            else {
                console.log('[API] Filtrando por approvalStatus:', approvalStatus);
                events = events.filter((e) => e.approvalStatus === approvalStatus);
            }
        }
        else {
            console.log('[API] Padrão: retornando apenas eventos aprovados');
            // Por padrão, retornar apenas eventos aprovados
            events = events.filter((e) => e.approvalStatus === 'approved');
        }
        console.log('[API] Eventos após filtro:', events.length);
        // Buscar coordenadas dos lugares se necessário
        for (const event of events) {
            if (event.locationId && event.locationId !== 'unknown') {
                try {
                    const locationDoc = await db.collection('locations').doc(event.locationId).get();
                    if (locationDoc.exists) {
                        event.location = { ...locationDoc.data() };
                    }
                }
                catch (err) {
                    console.error('[API] Erro ao buscar location:', err);
                }
            }
        }
        // Anexar contagem de participantes
        const eventsWithCount = events.map((e) => ({
            ...e,
            attendeesCount: Array.isArray(e.attendeeIds) ? e.attendeeIds.length : 0
        }));
        console.log('[API] Eventos retornados:', eventsWithCount.length);
        res.json(eventsWithCount);
    }
    catch (error) {
        console.error('[API] Erro ao buscar eventos:', error);
        res.status(500).json({ message: "Failed to fetch events" });
    }
});
app.post('/events', authenticate, async (req, res) => {
    try {
        const user = req.user;
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
            }
            else {
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
    }
    catch (error) {
        console.error('[API] Erro ao criar evento:', error);
        res.status(400).json({ message: "Failed to create event" });
    }
});
app.patch('/events/:eventId', authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { approvalStatus, join, ...otherData } = req.body;
        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) {
            res.status(404).json({ message: "Event not found" });
            return;
        }
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (approvalStatus) {
            updateData.approvalStatus = approvalStatus;
            updateData.reviewedBy = req.user.uid;
            updateData.reviewedAt = admin.firestore.FieldValue.serverTimestamp();
        }
        // Participação no evento (join=true adiciona, join=false remove)
        if (typeof join === 'boolean') {
            const userId = req.user.uid;
            if (join) {
                updateData.attendeeIds = admin.firestore.FieldValue.arrayUnion(userId);
            }
            else {
                updateData.attendeeIds = admin.firestore.FieldValue.arrayRemove(userId);
            }
        }
        if (otherData && Object.keys(otherData).length > 0) {
            Object.assign(updateData, otherData);
        }
        await eventRef.update(updateData);
        // Buscar documento atualizado
        const updatedSnap = await eventRef.get();
        const updatedEvent = { id: updatedSnap.id, ...updatedSnap.data() };
        // Garantir que attendeeIds seja um array
        if (!Array.isArray(updatedEvent.attendeeIds)) {
            updatedEvent.attendeeIds = [];
        }
        // Calcular contagem corretamente
        updatedEvent.attendeesCount = updatedEvent.attendeeIds.length;
        console.log('[API] Event updated - attendeeIds:', updatedEvent.attendeeIds, 'attendeesCount:', updatedEvent.attendeesCount);
        res.json(updatedEvent);
    }
    catch (error) {
        console.error('Error updating event:', error);
        res.status(400).json({ message: "Failed to update event" });
    }
});
// ============ PLACES ============
app.get('/places', async (req, res) => {
    try {
        const snapshot = await db.collection('places').get();
        const places = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(places);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch places" });
    }
});
app.post('/places/search-santos', authenticate, async (req, res) => {
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
        const typeMapping = {
            bars: ['bar'],
            clubs: ['night_club'],
            shows: ['movie_theater'],
            food: ['restaurant'],
            cafe: ['cafe', 'bakery'],
            fairs: ['amusement_park']
        };
        const includedTypes = typeMapping[locationType] || ['bar'];
        // Palavras‑chave de fallback por categoria para SearchText (pt-BR)
        const textQueryMapping = {
            bars: ['bar', 'pub', 'choperia'],
            clubs: ['balada', 'boate', 'night club'],
            shows: ['cinema'],
            food: ['restaurante'],
            cafe: ['café', 'padaria', 'coffee shop'],
            fairs: ['parque de diversões']
        };
        const textQueries = textQueryMapping[locationType] || [];
        const url = 'https://places.googleapis.com/v1/places:searchNearby';
        const requestBody = {
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
        const allPlaces = [...(data.places || [])];
        console.log('[API] Lugares recebidos da Google (Nearby):', allPlaces.length);
        // Fallback: SearchText por palavras‑chave para cobrir locais não retornados pelo ranking
        if (textQueries.length > 0) {
            const textUrl = 'https://places.googleapis.com/v1/places:searchText';
            const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.types,places.businessStatus';
            for (const q of textQueries) {
                try {
                    const textBody = {
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
                    let pageNew = pagePlaces.filter((p) => !allPlaces.some((e) => e.id === p.id));
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
                        pageNew = pagePlaces.filter((p) => !allPlaces.some((e) => e.id === p.id));
                        allPlaces.push(...pageNew);
                        totalAdded += pageNew.length;
                        pt = pageData.nextPageToken;
                        page++;
                    }
                    console.log(`[API] SearchText("${q}") adicionou ${totalAdded} novos lugares após dedupe (páginas: ${page}).`);
                }
                catch (err) {
                    console.warn('[API] Erro no SearchText para query', q, err);
                }
            }
        }
        // Função para extrair horários de funcionamento
        const extractOpeningHours = (regularOpeningHours) => {
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
            const hours = {
                monday: null,
                tuesday: null,
                wednesday: null,
                thursday: null,
                friday: null,
                saturday: null,
                sunday: null
            };
            const dayMapping = {
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
            regularOpeningHours.weekdayDescriptions.forEach((desc, index) => {
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
                    }
                    else {
                        // Extrair horários (ex: "18:00 – 02:00")
                        const timeMatch = hoursText.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
                        if (timeMatch) {
                            hours[dayKey] = {
                                open: `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`,
                                close: `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}`,
                                closed: false
                            };
                            console.log(`[API] ${dayKey}: ${hours[dayKey].open} - ${hours[dayKey].close}`);
                        }
                        else {
                            console.log(`[API] ${dayKey}: Não conseguiu extrair horários da string "${hoursText}"`);
                        }
                    }
                }
                else {
                    console.log(`[API] Day key ${dayName} não encontrado no mapping`);
                }
            });
            console.log('[API] Horários extraídos:', JSON.stringify(hours, null, 2));
            return hours;
        };
        // Função para gerar horários populares baseados no horário de funcionamento
        const generateDefaultPopularTimes = (placeType, openingHours) => {
            const isNightlife = ['bar', 'night_club'].includes(placeType);
            const weekdayPattern = isNightlife
                ? [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 85, 80, 75, 70, 65, 85, 90, 95, 90, 80]
                : [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30];
            const weekendPattern = isNightlife
                ? [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 85, 90, 90, 85, 80, 75, 80, 90, 95, 100, 95, 85]
                : [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40];
            const popularTimes = {
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
                    }
                    else if (dayHours.open && dayHours.close) {
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
                            }
                            else {
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
            }
            else {
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
    }
    catch (error) {
        res.status(500).json({ message: "Failed to search places" });
    }
});
// Função para fazer scraping de Popular Times do Google Maps
const scrapePopularTimes = async (placeName, googleMapsUri) => {
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
        const popularTimes = {
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
        scripts.each((i, elem) => {
            try {
                const scriptContent = $(elem).html();
                if (scriptContent) {
                    console.log(`[Scraping] 📝 Processando script ${i + 1}...`);
                    const data = JSON.parse(scriptContent);
                    console.log(`[Scraping] 🔑 Chaves no script: ${Object.keys(data).join(', ')}`);
                    // Tentar extrair popular times de diferentes formatos
                    if (data.popularTimes && Array.isArray(data.popularTimes)) {
                        console.log(`[Scraping] 🎯 popularTimes encontrado!`);
                        data.popularTimes.forEach((day, index) => {
                            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                            const dayName = dayNames[index];
                            if (day.popularity && Array.isArray(day.popularity)) {
                                popularTimes[dayName] = day.popularity.map((hour) => {
                                    // Normalizar para 0-100
                                    return Math.min(100, Math.max(0, hour.value || hour || 0));
                                });
                                console.log(`[Scraping] ✅ ${dayName}: ${day.popularity.length} horários extraídos`);
                                dataExtracted = true;
                            }
                        });
                    }
                }
            }
            catch (parseError) {
                console.log(`[Scraping] ⚠️ Erro ao processar script ${i + 1}:`, parseError);
            }
        });
        if (dataExtracted) {
            console.log(`[Scraping] ✅ Popular times extraídos com sucesso para: ${placeName}`);
            console.log(`[Scraping] 📊 Exemplo (monday): [${popularTimes.monday.slice(0, 5).join(', ')}, ...]`);
            return popularTimes;
        }
        else {
            console.log(`[Scraping] ⚠️ Nenhum dado extraído para: ${placeName}`);
            return null;
        }
    }
    catch (error) {
        console.error(`[Scraping] ❌ Erro ao fazer scraping para ${placeName}:`, error);
        return null;
    }
};
// Update popular times (admin)
app.put('/places/:placeId/popular-times', async (req, res) => {
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
    }
    catch (error) {
        console.error('[API] Erro ao atualizar popular times:', error);
        res.status(500).json({ message: "Failed to update popular times" });
    }
});
// Import popular times (one-time) using external provider (SerpApi)
const normalizePopularTimes = (raw) => {
    if (!raw)
        return null;
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const out = {
        monday: Array(24).fill(0),
        tuesday: Array(24).fill(0),
        wednesday: Array(24).fill(0),
        thursday: Array(24).fill(0),
        friday: Array(24).fill(0),
        saturday: Array(24).fill(0),
        sunday: Array(24).fill(0)
    };
    const mapDayName = (name) => {
        if (!name)
            return null;
        const n = name.toLowerCase();
        if (n.startsWith('mon'))
            return 'monday';
        if (n.startsWith('tue'))
            return 'tuesday';
        if (n.startsWith('wed'))
            return 'wednesday';
        if (n.startsWith('thu'))
            return 'thursday';
        if (n.startsWith('fri'))
            return 'friday';
        if (n.startsWith('sat'))
            return 'saturday';
        if (n.startsWith('sun'))
            return 'sunday';
        if (n.startsWith('seg'))
            return 'monday';
        if (n.startsWith('ter'))
            return 'tuesday';
        if (n.startsWith('qua'))
            return 'wednesday';
        if (n.startsWith('qui'))
            return 'thursday';
        if (n.startsWith('sex'))
            return 'friday';
        if (n.startsWith('sáb') || n.startsWith('sab'))
            return 'saturday';
        if (n.startsWith('dom'))
            return 'sunday';
        return null;
    };
    const setHour = (day, hour, value) => {
        const h = Math.max(0, Math.min(23, Math.floor(hour)));
        const v = Math.max(0, Math.min(100, Math.floor(value || 0)));
        out[day][h] = v;
    };
    // Helper para converter string de hora (e.g. "7 AM", "18:00") para 0..23
    const parseHour = (v, fallbackIndex) => {
        if (typeof v === 'number')
            return Math.max(0, Math.min(23, Math.floor(v)));
        if (typeof v !== 'string')
            return fallbackIndex;
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
            if (ap === 'PM' && h !== 12)
                h += 12;
            if (ap === 'AM' && h === 12)
                h = 0;
            return Math.max(0, Math.min(23, h));
        }
        return fallbackIndex;
    };
    // setHour já definido acima
    // 1) Novo formato SerpApi (Place Results): detail.place_results.popular_times.{day} = [{ time, busyness_score, ... }]
    const placeResults = raw.place_results || undefined;
    const prPopularTimes = placeResults?.popular_times || undefined;
    if (prPopularTimes && typeof prPopularTimes === 'object') {
        for (const key of Object.keys(prPopularTimes)) {
            const day = mapDayName(key);
            if (!day || !dayKeys.includes(day))
                continue;
            const arr = Array.isArray(prPopularTimes[key]) ? prPopularTimes[key] : [];
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
            const day = mapDayName(key);
            if (!day || !dayKeys.includes(day))
                continue;
            const arr = Array.isArray(raw.popular_times[key]) ? raw.popular_times[key] : [];
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
        arr.forEach((dayObj) => {
            const key = mapDayName(dayObj?.name || dayObj?.day || dayObj?.weekday);
            if (!key || !dayKeys.includes(key))
                return;
            const data = dayObj?.data || dayObj?.hours || dayObj?.popularity || [];
            if (Array.isArray(data)) {
                data.forEach((entry, idx) => {
                    if (typeof entry === 'number') {
                        setHour(key, idx, entry);
                        return;
                    }
                    const hour = typeof entry?.hour === 'number' ? entry.hour : parseHour(entry?.time, idx);
                    const value = typeof entry?.busyness_score === 'number' ? entry.busyness_score
                        : (typeof entry?.busy_percent === 'number' ? entry.busy_percent
                            : (typeof entry?.value === 'number' ? entry.value : (typeof entry?.percentage === 'number' ? entry.percentage : 0)));
                    setHour(key, hour, value);
                });
            }
        });
        return out;
    }
    return null;
};
const normalizeOpeningHoursFromSerpApi = (detail) => {
    try {
        const weekday = detail?.opening_hours?.weekday_text;
        if (!weekday || !Array.isArray(weekday))
            return null;
        const result = {
            monday: null,
            tuesday: null,
            wednesday: null,
            thursday: null,
            friday: null,
            saturday: null,
            sunday: null,
        };
        const mapDay = (d) => {
            const s = d.toLowerCase();
            if (s.startsWith('mon'))
                return 'monday';
            if (s.startsWith('tue'))
                return 'tuesday';
            if (s.startsWith('wed'))
                return 'wednesday';
            if (s.startsWith('thu'))
                return 'thursday';
            if (s.startsWith('fri'))
                return 'friday';
            if (s.startsWith('sat'))
                return 'saturday';
            if (s.startsWith('sun'))
                return 'sunday';
            if (s.startsWith('seg'))
                return 'monday';
            if (s.startsWith('ter'))
                return 'tuesday';
            if (s.startsWith('qua'))
                return 'wednesday';
            if (s.startsWith('qui'))
                return 'thursday';
            if (s.startsWith('sex'))
                return 'friday';
            if (s.startsWith('sáb') || s.startsWith('sab'))
                return 'saturday';
            if (s.startsWith('dom'))
                return 'sunday';
            return null;
        };
        const to24 = (txt) => {
            if (!txt)
                return null;
            const m = txt.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
            if (!m)
                return null;
            let h = parseInt(m[1], 10);
            const min = m[2] ? parseInt(m[2], 10) : 0;
            const ap = (m[3] || '').toUpperCase();
            if (ap === 'PM' && h !== 12)
                h += 12;
            if (ap === 'AM' && h === 12)
                h = 0;
            return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        };
        for (const line of weekday) {
            const parts = String(line).split(':');
            const dayKey = mapDay(parts[0] || '');
            if (!dayKey)
                continue;
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
    }
    catch {
        return null;
    }
};
const fetchPopularTimesFromSerpApi = async (name, address, placeIdRaw, lat, lng) => {
    try {
        const axios = require('axios');
        const apiKey = process.env.SERPAPI_API_KEY;
        if (!apiKey)
            return null;
        // 1) Preferir chamada direta ao google_maps_place com place_id (quando tivermos do Places API v1: "places/{place_id}")
        let detail = null;
        let firstLocal = null;
        const placeId = (placeIdRaw || '').startsWith('places/') ? placeIdRaw.slice(7) : (placeIdRaw || '');
        if (placeId) {
            const detailUrl = 'https://serpapi.com/search.json';
            const detailParams = { engine: 'google_maps_place', place_id: placeId, hl: 'pt-BR', gl: 'br', api_key: apiKey };
            const detailRes = await axios.get(detailUrl, { params: detailParams, timeout: 20000 });
            console.log('[SerpApi] google_maps_place by place_id status:', detailRes.status, 'keys:', Object.keys(detailRes?.data || {}));
            detail = detailRes?.data;
        }
        // 2) Fallback: buscar pelo nome/endereço com google_maps search e, se vier data_id, pedir o place
        if (!detail) {
            const q = address ? `${name} ${address}` : name;
            const searchUrl = 'https://serpapi.com/search.json';
            const searchParams = { engine: 'google_maps', q, hl: 'pt-BR', gl: 'br', type: 'search', api_key: apiKey };
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
                if (normalized)
                    return { popularTimes: normalized, openingHours: null, isOpen: null };
                return null;
            }
            const dataId = firstLocal?.data_id;
            if (dataId) {
                const detailUrl = 'https://serpapi.com/search.json';
                const detailParams = { engine: 'google_maps_place', data_id: dataId, hl: 'pt-BR', gl: 'br', api_key: apiKey };
                const detailRes = await axios.get(detailUrl, { params: detailParams, timeout: 20000 });
                console.log('[SerpApi] google_maps_place by data_id status:', detailRes.status, 'keys:', Object.keys(detailRes?.data || {}));
                detail = detailRes?.data;
            }
        }
        const normalized = normalizePopularTimes(detail || firstLocal);
        const openingHours = normalizeOpeningHoursFromSerpApi(detail);
        const isOpen = typeof detail?.opening_hours?.open_now === 'boolean' ? !!detail?.opening_hours?.open_now : null;
        return { popularTimes: normalized, openingHours, isOpen };
    }
    catch (e) {
        console.error('[Import] SerpApi error:', e?.response?.status, e?.response?.data || e?.message || e);
        return null;
    }
};
app.post('/places/popular-times/import-once', authenticate, async (req, res) => {
    try {
        const body = req.body || {};
        const limit = Math.min(parseInt(body.limit || '1000', 10) || 1000, 1000);
        const typeFilter = body.type;
        const areaIncludes = body.areaIncludes;
        const nameIncludes = body.nameIncludes;
        const overrideApiKey = body.apiKey; // opcional para testes
        const logMessages = [];
        const log = (m) => { console.log('[Import]', m); logMessages.push(m); };
        log(`Iniciando import popularTimes (one-time) limit=${limit} type=${typeFilter || '-'} area=${areaIncludes || '-'} name=${nameIncludes || '-'}`);
        const snap = await db.collection('places').get();
        let places = snap.docs.map(d => ({ docRef: d.ref, id: d.id, ...d.data() }));
        // Filtros opcionais
        if (typeFilter) {
            const t = typeFilter.toLowerCase();
            places = places.filter(p => Array.isArray(p.types) && p.types.some((x) => (x || '').toLowerCase() === t));
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
        const pending = places.filter((p) => !p.popularityAutoDone);
        const sorted = pending.sort((a, b) => {
            const aTs = a.popularityAutoUpdatedAt?.toMillis ? a.popularityAutoUpdatedAt.toMillis() : (a.popularityAutoUpdatedAt?._seconds ? a.popularityAutoUpdatedAt._seconds * 1000 : 0);
            const bTs = b.popularityAutoUpdatedAt?.toMillis ? b.popularityAutoUpdatedAt.toMillis() : (b.popularityAutoUpdatedAt?._seconds ? b.popularityAutoUpdatedAt._seconds * 1000 : 0);
            if (!aTs && bTs)
                return -1;
            if (aTs && !bTs)
                return 1;
            if (aTs !== bTs)
                return aTs - bTs;
            const aUp = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?._seconds ? a.updatedAt._seconds * 1000 : 0);
            const bUp = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?._seconds ? b.updatedAt._seconds * 1000 : 0);
            return aUp - bUp;
        });
        places = sorted.slice(0, limit);
        log(`Selecionados ${places.length} lugares pendentes (ordem por popularityAutoUpdatedAt).`);
        let updated = 0;
        let failed = 0;
        const results = [];
        for (const place of places) {
            try {
                log(`Processando: ${place.name || place.displayName?.text || place.id}`);
                let popularTimes = null;
                let openingHours = null;
                let isOpen = null;
                // Permitir override de API key somente nesta chamada, sem persistir
                if (overrideApiKey) {
                    process.env.SERPAPI_API_KEY = overrideApiKey;
                    log(`Override SERPAPI_API_KEY recebido (tamanho=${overrideApiKey.length}).`);
                }
                if (!process.env.SERPAPI_API_KEY) {
                    log('SERPAPI_API_KEY ausente. Configure nas Functions (env var) ou envie apiKey no corpo.');
                }
                else {
                    log('SERPAPI_API_KEY presente.');
                }
                const latNum = typeof place.latitude === 'string' ? parseFloat(place.latitude) : (typeof place.latitude === 'number' ? place.latitude : null);
                const lngNum = typeof place.longitude === 'string' ? parseFloat(place.longitude) : (typeof place.longitude === 'number' ? place.longitude : null);
                const fromSerp = await fetchPopularTimesFromSerpApi(place.name || place.displayName?.text || '', place.formattedAddress, place.placeId || null, latNum, lngNum);
                if (fromSerp) {
                    popularTimes = fromSerp.popularTimes;
                    openingHours = fromSerp.openingHours;
                    isOpen = fromSerp.isOpen;
                    log(`SerpApi retornou popularTimes=${!!popularTimes}, openingHours=${!!openingHours}, isOpen=${isOpen}`);
                }
                else {
                    log('SerpApi não retornou dados (fromSerp=null).');
                }
                if (!popularTimes && place.googleMapsUri) {
                    popularTimes = await scrapePopularTimes(place.name || place.displayName?.text || '', place.googleMapsUri);
                    log(`Fallback scraping: popularTimes=${!!popularTimes}`);
                }
                // Considerar sucesso apenas se for SERPAPI e vierem ambos popularTimes e openingHours
                const success = !!(fromSerp && fromSerp.popularTimes && fromSerp.openingHours);
                if (success) {
                    await place.docRef.update({
                        popularTimes: fromSerp.popularTimes,
                        openingHours: fromSerp.openingHours,
                        ...(isOpen !== null ? { isOpen } : {}),
                        dataSource: 'serpapi',
                        popularityProvider: 'serpapi',
                        popularityUpdatedBy: 'auto',
                        popularityAutoDone: true,
                        popularityAutoUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    updated++;
                    results.push({ id: place.id, name: place.name || place.displayName?.text || '', ok: true, source: 'serpapi' });
                }
                else {
                    failed++;
                    results.push({ id: place.id, name: place.name || place.displayName?.text || '', ok: false });
                }
                // Respeitar limites - aguardar 1.2s entre chamadas
                await new Promise(resolve => setTimeout(resolve, 1200));
            }
            catch (err) {
                console.error('[Import] erro por lugar:', err?.message || err);
                failed++;
                results.push({ id: place.id, ok: false, error: err?.message });
            }
        }
        res.json({ total: places.length, updated, failed, provider: 'serpapi', results, logs: logMessages });
    }
    catch (error) {
        console.error('[Import] erro geral:', error);
        res.status(500).json({ message: 'Failed to import popular times', error: error?.message });
    }
});
// Import popular times para um único lugar (manual)
app.post('/places/:docId/popular-times/import', authenticate, async (req, res) => {
    try {
        const { docId } = req.params;
        const overrideApiKey = req.body?.apiKey;
        const logMessages = [];
        const log = (m) => { console.log('[Import-One]', m); logMessages.push(m); };
        const ref = db.collection('places').doc(docId);
        const snap = await ref.get();
        if (!snap.exists) {
            res.status(404).json({ message: 'Place não encontrado' });
            return;
        }
        const place = { id: docId, ...snap.data() };
        log(`Processando (manual): ${place.name || place.displayName?.text || place.id}`);
        if (overrideApiKey)
            process.env.SERPAPI_API_KEY = overrideApiKey;
        const latNum = typeof place.latitude === 'string' ? parseFloat(place.latitude) : (typeof place.latitude === 'number' ? place.latitude : null);
        const lngNum = typeof place.longitude === 'string' ? parseFloat(place.longitude) : (typeof place.longitude === 'number' ? place.longitude : null);
        const fromSerp = await fetchPopularTimesFromSerpApi(place.name || place.displayName?.text || '', place.formattedAddress, place.placeId || null, latNum, lngNum);
        let popularTimes = null;
        let openingHours = null;
        let isOpen = null;
        if (fromSerp) {
            popularTimes = fromSerp.popularTimes;
            openingHours = fromSerp.openingHours;
            isOpen = fromSerp.isOpen;
            log(`SerpApi: popularTimes=${!!popularTimes}, openingHours=${!!openingHours}, isOpen=${isOpen}`);
        }
        // Somente considerar SUCESSO se vierem popularTimes E openingHours do SerpApi
        const success = !!(fromSerp && fromSerp.popularTimes && fromSerp.openingHours);
        if (!success) {
            log('Falha: API não retornou conjunto completo (popularTimes + openingHours). Nenhuma atualização foi aplicada.');
            res.status(502).json({ message: 'API não retornou dados suficientes', logs: logMessages });
            return;
        }
        await ref.update({
            popularTimes: fromSerp.popularTimes,
            openingHours: fromSerp.openingHours,
            ...(isOpen !== null ? { isOpen } : {}),
            dataSource: 'serpapi',
            popularityProvider: 'serpapi',
            popularityUpdatedBy: 'manual',
            popularityManualUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ success: true, id: docId, source: 'serpapi', logs: logMessages });
    }
    catch (error) {
        console.error('[Import-One] erro:', error);
        res.status(500).json({ message: error?.message || 'Falha na importação manual' });
    }
});
// Atualizar horários de todos os lugares existentes
app.post('/places/update-all-hours', authenticate, async (req, res) => {
    try {
        const apiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
        console.log('[API] Buscando todos os lugares do Firestore...');
        // Buscar todos os lugares
        const placesSnapshot = await db.collection('places').get();
        const places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[API] Encontrados ${places.length} lugares no Firestore`);
        // Função helper para extrair horários (reutilizar do código acima)
        const extractOpeningHoursLocal = (regularOpeningHours) => {
            if (!regularOpeningHours?.weekdayDescriptions)
                return null;
            const hours = {
                monday: null,
                tuesday: null,
                wednesday: null,
                thursday: null,
                friday: null,
                saturday: null,
                sunday: null
            };
            const dayMapping = {
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
            regularOpeningHours.weekdayDescriptions.forEach((desc) => {
                const parts = desc.split(':');
                if (parts.length < 2)
                    return;
                const dayName = parts[0].trim();
                const hoursText = parts.slice(1).join(':').trim();
                const dayKey = dayMapping[dayName];
                if (dayKey) {
                    if (hoursText.toLowerCase().includes('fechado') || hoursText.toLowerCase().includes('closed')) {
                        hours[dayKey] = { open: null, close: null, closed: true };
                    }
                    else {
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
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                updatedCount++;
                console.log(`[API] ✅ Atualizado: ${place.name}`);
                // Aguardar 500ms entre requisições para não exceder rate limit
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('[API] Erro geral:', error);
        res.status(500).json({ message: "Failed to update places" });
    }
});
// Atualizar horários/avaliações com logs em tempo real (SSE) e suporte a cancelamento
app.post('/places/update-all-hours-stream', authenticate, async (req, res) => {
    try {
        // Configurar SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        const apiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
        // Buscar todos os lugares
        const placesSnapshot = await db.collection('places').get();
        const places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        send({ type: 'start', total: places.length });
        let updatedCount = 0;
        let errorCount = 0;
        let cancelled = false;
        req.on('close', () => { cancelled = true; });
        const fieldMask = 'regularOpeningHours,currentOpeningHours,displayName,rating,userRatingCount';
        for (let i = 0; i < places.length; i++) {
            if (cancelled) {
                send({ type: 'cancelled', updated: updatedCount, errors: errorCount, total: places.length });
                res.end();
                return;
            }
            const place = places[i];
            const placeName = place.name;
            const placeId = place.placeId;
            try {
                if (!placeId) {
                    send({ type: 'progress', index: i + 1, total: places.length, placeName, status: 'skipped', reason: 'no_placeId' });
                    continue;
                }
                const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;
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
                const extractOpeningHoursLocal = (regularOpeningHours) => {
                    if (!regularOpeningHours?.weekdayDescriptions)
                        return null;
                    const hours = { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null };
                    const dayMapping = { 'Segunda-feira': 'monday', 'Terça-feira': 'tuesday', 'Quarta-feira': 'wednesday', 'Quinta-feira': 'thursday', 'Sexta-feira': 'friday', 'Sábado': 'saturday', 'Domingo': 'sunday', 'Monday': 'monday', 'Tuesday': 'tuesday', 'Wednesday': 'wednesday', 'Thursday': 'thursday', 'Friday': 'friday', 'Saturday': 'saturday', 'Sunday': 'sunday' };
                    regularOpeningHours.weekdayDescriptions.forEach((desc) => {
                        const parts = desc.split(':');
                        if (parts.length < 2)
                            return;
                        const dayName = parts[0].trim();
                        const hoursText = parts.slice(1).join(':').trim();
                        const dayKey = dayMapping[dayName];
                        if (!dayKey)
                            return;
                        if (hoursText.toLowerCase().includes('fechado') || hoursText.toLowerCase().includes('closed')) {
                            hours[dayKey] = { open: null, close: null, closed: true };
                        }
                        else {
                            const m = hoursText.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
                            if (m) {
                                hours[dayKey] = { open: `${m[1].padStart(2, '0')}:${m[2]}`, close: `${m[3].padStart(2, '0')}:${m[4]}`, closed: false };
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
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                updatedCount++;
                send({ type: 'progress', index: i + 1, total: places.length, placeName, status: 'updated' });
                await new Promise(resolve => setTimeout(resolve, 400));
            }
            catch (err) {
                errorCount++;
                send({ type: 'progress', index: i + 1, total: places.length, placeName, status: 'error', reason: err?.message || String(err) });
            }
        }
        send({ type: 'end', updated: updatedCount, errors: errorCount, total: places.length });
        res.end();
    }
    catch (error) {
        console.error('[API] Erro geral (stream):', error);
        try {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error?.message || 'unknown' })}\n\n`);
        }
        catch { }
        res.end();
    }
});
// Excluir um lugar por docId (admin)
app.delete('/places/:docId', authenticate, async (req, res) => {
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
    }
    catch (error) {
        console.error('[API] Erro ao excluir place:', error);
        res.status(500).json({ message: error.message || 'Failed to delete place' });
    }
});
// Atualizar tipos do lugar (admin)
app.patch('/places/:docId/types', authenticate, async (req, res) => {
    try {
        const { docId } = req.params;
        const { types } = req.body;
        if (!docId) {
            res.status(400).json({ message: 'docId é obrigatório' });
            return;
        }
        if (!Array.isArray(types) || types.length === 0) {
            res.status(400).json({ message: 'types (string[]) é obrigatório' });
            return;
        }
        const allowed = new Set(['bar', 'night_club', 'restaurant', 'cafe', 'bakery', 'movie_theater', 'amusement_park']);
        const sanitized = Array.from(new Set(types.filter((t) => allowed.has(t))));
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
    }
    catch (error) {
        console.error('[API] Erro ao atualizar types do place:', error);
        res.status(500).json({ message: error.message || 'Failed to update place types' });
    }
});
// Endpoint para atualizar googleMapsUri de um place
app.patch('/places/:placeId/googlemaps', authenticate, async (req, res) => {
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
    }
    catch (error) {
        console.error('[API] Erro ao atualizar googleMapsUri:', error);
        res.status(500).json({ message: error.message });
    }
});
// Endpoint para atualizar um place individual
app.post('/places/:placeId/scrape', authenticate, async (req, res) => {
    try {
        const { placeId } = req.params;
        const placeDoc = await db.collection('places').doc(placeId).get();
        if (!placeDoc.exists) {
            res.status(404).json({ message: "Place not found" });
            return;
        }
        const place = { id: placeDoc.id, ...placeDoc.data() };
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
        }
        else {
            res.status(400).json({ message: "Não foi possível extrair popular times" });
        }
    }
    catch (error) {
        console.error('[API] Erro ao atualizar place:', error);
        res.status(500).json({ message: error.message });
    }
});
// Endpoint para fazer scraping de Popular Times com logs detalhados - VERSÃO COM RESULTADOS EM TEMPO REAL
app.post('/places/scrape-popular-times', authenticate, async (req, res) => {
    try {
        // Configurar streaming de resposta
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        console.log('[Scraping] Iniciando scraping de Popular Times...');
        // Buscar todos os lugares
        const placesSnapshot = await db.collection('places').limit(50).get();
        const places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Scraping] Encontrados ${places.length} lugares para processar`);
        // Enviar início
        res.write(`data: ${JSON.stringify({ type: 'start', total: places.length })}\n\n`);
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        const allResults = [];
        for (let i = 0; i < places.length; i++) {
            const place = places[i];
            const result = {
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
                }
                else {
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
                    }
                    else {
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
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('[Scraping] Erro geral:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});
// Export all functions
exports.api = (0, https_1.onRequest)({ region: 'us-central1' }, app);
//# sourceMappingURL=index.js.map