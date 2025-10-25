# 🏗️ Proposta de Arquitetura - Dados Google Places API

## 📊 Problema Atual

- Google Places API tem **limite de requisições** e **custo por chamada**
- Dados de horários populares mudam ao longo do dia
- Precisamos de performance para exibir no mapa em tempo real
- Usuários consultam os mesmos lugares repetidamente

## 🎯 Solução Proposta: Sistema de Cache Inteligente

### **Arquitetura em 3 Camadas**

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  - Exibe dados em tempo real                            │
│  - Cache local (5 minutos)                              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              FIRESTORE (Cache Intermediário)             │
│  - Dados dos lugares (permanente)                       │
│  - Snapshots de popularidade (1 hora)                   │
│  - Histórico agregado (diário)                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│            GOOGLE PLACES API (Fonte de Dados)            │
│  - Atualização sob demanda                              │
│  - Cloud Function agendada (a cada hora)                │
└─────────────────────────────────────────────────────────┘
```

## 📦 Estrutura de Dados no Firestore

### **Collection: `places`**
Dados permanentes dos lugares (não mudam frequentemente)

```typescript
{
  id: "auto-generated",
  placeId: "ChIJ...", // Google Place ID
  name: "Bar do João",
  formattedAddress: "Av. Ana Costa, 123 - Santos",
  location: {
    lat: -23.9608,
    lng: -46.3332
  },
  rating: 4.5,
  userRatingsTotal: 1234,
  types: ["bar", "restaurant"],
  priceLevel: 2, // 0-4
  phoneNumber: "+55 13 1234-5678",
  website: "https://...",
  photos: ["url1", "url2"],
  
  // Metadados
  createdAt: Timestamp,
  lastUpdated: Timestamp,
  updateCount: 10,
  
  // Índices para busca
  city: "Santos",
  neighborhood: "Gonzaga",
  isActive: true
}
```

### **Collection: `popularitySnapshots`**
Snapshots de popularidade por horário (cache de 1 hora)

```typescript
{
  id: "auto-generated",
  placeId: "ChIJ...",
  
  // Dados de popularidade
  currentPopularity: 85, // 0-100
  popularTimes: {
    monday: [10, 15, 20, 30, 45, 60, 75, 85, 90, 85, 70, 50, ...], // 24 valores
    tuesday: [...],
    wednesday: [...],
    thursday: [...],
    friday: [...],
    saturday: [...],
    sunday: [...]
  },
  
  // Metadados
  timestamp: Timestamp, // Quando foi capturado
  dayOfWeek: 5, // 0-6 (Domingo-Sábado)
  hour: 20, // 0-23
  
  // TTL (Time To Live)
  expiresAt: Timestamp, // timestamp + 1 hora
  
  // Índices
  city: "Santos",
  placeType: "bar"
}
```

### **Collection: `popularityHistory`**
Histórico agregado para análise e predição

```typescript
{
  id: "placeId_date", // Ex: "ChIJ..._2025-10-25"
  placeId: "ChIJ...",
  date: "2025-10-25",
  
  // Dados agregados do dia
  hourlyPopularity: {
    "0": 10,  // 0h
    "1": 8,
    "2": 5,
    // ...
    "23": 15
  },
  
  // Estatísticas
  avgPopularity: 45,
  peakHour: 22,
  peakPopularity: 95,
  totalCheckins: 150,
  
  // Metadados
  dayOfWeek: 5,
  isWeekend: true,
  isHoliday: false,
  
  createdAt: Timestamp
}
```

## 🔄 Fluxo de Dados

### **1. Busca Inicial (Primeira vez)**

```typescript
// 1. Usuário acessa /places e clica em "Bares"
// 2. Frontend verifica cache local (localStorage)
const cachedData = localStorage.getItem('santos_bars');
if (cachedData && !isExpired(cachedData)) {
  return JSON.parse(cachedData);
}

// 3. Frontend consulta Firestore
const placesSnapshot = await db.collection('places')
  .where('city', '==', 'Santos')
  .where('types', 'array-contains', 'bar')
  .where('isActive', '==', true)
  .get();

// 4. Se não houver dados ou estiverem desatualizados
if (placesSnapshot.empty || needsUpdate(placesSnapshot)) {
  // Chama Cloud Function para buscar no Google Places API
  await fetch('/api/places/search-santos', {
    method: 'POST',
    body: JSON.stringify({ locationType: 'bars' })
  });
}

// 5. Retorna dados do Firestore
return placesSnapshot.docs.map(doc => doc.data());
```

### **2. Atualização de Popularidade (Tempo Real)**

```typescript
// Cloud Function executada a cada hora
export const updatePopularitySnapshots = functions
  .pubsub
  .schedule('0 * * * *') // A cada hora
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    const now = new Date();
    const currentHour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Busca todos os lugares ativos em Santos
    const places = await db.collection('places')
      .where('city', '==', 'Santos')
      .where('isActive', '==', true)
      .get();
    
    // Para cada lugar, cria/atualiza snapshot
    const batch = db.batch();
    
    for (const placeDoc of places.docs) {
      const place = placeDoc.data();
      
      // Calcula popularidade atual
      const popularity = calculatePopularity(place, currentHour, dayOfWeek);
      
      // Cria snapshot
      const snapshotRef = db.collection('popularitySnapshots').doc();
      batch.set(snapshotRef, {
        placeId: place.placeId,
        currentPopularity: popularity,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        dayOfWeek,
        hour: currentHour,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // +1 hora
        city: place.city,
        placeType: place.types[0]
      });
      
      // Atualiza histórico
      const historyId = `${place.placeId}_${now.toISOString().split('T')[0]}`;
      const historyRef = db.collection('popularityHistory').doc(historyId);
      
      batch.set(historyRef, {
        [`hourlyPopularity.${currentHour}`]: popularity
      }, { merge: true });
    }
    
    await batch.commit();
    console.log(`Updated ${places.size} places`);
  });
```

### **3. Consulta Otimizada (Frontend)**

```typescript
// Hook personalizado para buscar lugares com popularidade
export function usePlacesWithPopularity(locationType: string) {
  return useQuery({
    queryKey: ['places', locationType, 'with-popularity'],
    queryFn: async () => {
      const now = new Date();
      const currentHour = now.getHours();
      
      // 1. Busca lugares
      const placesSnapshot = await getDocs(
        query(
          collection(db, 'places'),
          where('city', '==', 'Santos'),
          where('types', 'array-contains', locationType),
          where('isActive', '==', true)
        )
      );
      
      const places = placesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 2. Busca snapshots de popularidade (últimos 1 hora)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const popularitySnapshot = await getDocs(
        query(
          collection(db, 'popularitySnapshots'),
          where('city', '==', 'Santos'),
          where('placeType', '==', locationType),
          where('timestamp', '>=', oneHourAgo),
          orderBy('timestamp', 'desc')
        )
      );
      
      // 3. Mapeia popularidade para cada lugar
      const popularityMap = new Map();
      popularitySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!popularityMap.has(data.placeId)) {
          popularityMap.set(data.placeId, data.currentPopularity);
        }
      });
      
      // 4. Combina dados
      return places.map(place => ({
        ...place,
        currentPopularity: popularityMap.get(place.placeId) || 
                          calculatePopularity(place, currentHour, now.getDay())
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache de 5 minutos
    cacheTime: 10 * 60 * 1000, // Mantém em cache por 10 minutos
  });
}
```

## 💰 Otimização de Custos

### **Estratégia de Cache**

| Nível | TTL | Objetivo |
|-------|-----|----------|
| **Frontend (React Query)** | 5 min | Evitar requisições desnecessárias |
| **Firestore Snapshots** | 1 hora | Reduzir chamadas à Google API |
| **Firestore Places** | Permanente | Dados estáticos |
| **Firestore History** | 90 dias | Análise e predição |

### **Economia Estimada**

**Sem cache:**
- 1000 usuários/dia
- 10 consultas/usuário
- 10.000 chamadas/dia à Google API
- Custo: ~$170/mês

**Com cache proposto:**
- 24 atualizações/dia (1x por hora)
- 100 lugares em Santos
- 2.400 chamadas/dia à Google API
- Custo: ~$40/mês
- **Economia: 76%** 💰

## 🚀 Implementação em Fases

### **Fase 1: Cache Básico** (1-2 dias)
✅ Já implementado parcialmente
- [x] Salvar lugares no Firestore
- [x] Buscar do Firestore antes da API
- [ ] Adicionar TTL nos documentos
- [ ] Implementar limpeza de dados expirados

### **Fase 2: Snapshots de Popularidade** (2-3 dias)
- [ ] Criar collection `popularitySnapshots`
- [ ] Cloud Function para atualização horária
- [ ] Consulta otimizada no frontend
- [ ] Índices compostos no Firestore

### **Fase 3: Histórico e Predição** (3-4 dias)
- [ ] Criar collection `popularityHistory`
- [ ] Agregação diária de dados
- [ ] Algoritmo de predição baseado em histórico
- [ ] Dashboard de analytics

### **Fase 4: Otimizações Avançadas** (2-3 dias)
- [ ] Cache distribuído (Redis/Memcached)
- [ ] Pré-carregamento inteligente
- [ ] Compressão de dados
- [ ] CDN para imagens

## 📝 Código de Exemplo

### **Cloud Function: Atualização Horária**

```typescript
// functions/src/updatePopularity.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const updatePopularityHourly = functions
  .region('us-central1')
  .pubsub
  .schedule('0 * * * *') // A cada hora
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    
    // Busca lugares ativos
    const placesSnapshot = await db.collection('places')
      .where('city', '==', 'Santos')
      .where('isActive', '==', true)
      .limit(100)
      .get();
    
    const batch = db.batch();
    let count = 0;
    
    for (const doc of placesSnapshot.docs) {
      const place = doc.data();
      const popularity = calculateCurrentPopularity(place);
      
      // Cria snapshot
      const snapshotRef = db.collection('popularitySnapshots').doc();
      batch.set(snapshotRef, {
        placeId: place.placeId,
        currentPopularity: popularity,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(now.getTime() + 3600000), // +1h
        city: place.city,
        placeType: place.types[0]
      });
      
      count++;
      
      // Firestore batch limit: 500
      if (count % 500 === 0) {
        await batch.commit();
      }
    }
    
    if (count % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`Updated ${count} places`);
  });

function calculateCurrentPopularity(place: any): number {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  
  // Lógica de cálculo baseada em padrões
  // (pode ser melhorada com ML no futuro)
  
  const isWeekend = day === 0 || day === 6;
  const isNight = hour >= 20 || hour <= 2;
  
  if (isWeekend && isNight) {
    return 80 + Math.random() * 20;
  } else if (isNight) {
    return 60 + Math.random() * 20;
  } else {
    return 20 + Math.random() * 30;
  }
}
```

### **Frontend: Hook Otimizado**

```typescript
// client/src/hooks/usePlacesWithPopularity.ts
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function usePlacesWithPopularity(locationType: string) {
  return useQuery({
    queryKey: ['places', locationType, 'popularity'],
    queryFn: async () => {
      // 1. Busca lugares
      const placesQuery = query(
        collection(db, 'places'),
        where('city', '==', 'Santos'),
        where('types', 'array-contains', locationType),
        where('isActive', '==', true),
        limit(50)
      );
      
      const placesSnapshot = await getDocs(placesQuery);
      const places = placesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 2. Busca popularidade recente
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      
      const popularityQuery = query(
        collection(db, 'popularitySnapshots'),
        where('city', '==', 'Santos'),
        where('timestamp', '>=', oneHourAgo),
        orderBy('timestamp', 'desc')
      );
      
      const popularitySnapshot = await getDocs(popularityQuery);
      
      // 3. Mapeia popularidade
      const popularityMap = new Map();
      popularitySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!popularityMap.has(data.placeId)) {
          popularityMap.set(data.placeId, data.currentPopularity);
        }
      });
      
      // 4. Combina dados
      return places.map(place => ({
        ...place,
        currentPopularity: popularityMap.get(place.placeId) || 50
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false
  });
}
```

## 📊 Índices do Firestore

```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "places",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "city", "order": "ASCENDING" },
        { "fieldPath": "types", "arrayConfig": "CONTAINS" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "popularitySnapshots",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "city", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "popularitySnapshots",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "placeId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## 🎯 Benefícios da Proposta

### **Performance**
- ⚡ Resposta < 100ms (vs 2-3s da API)
- 📊 Dados sempre disponíveis
- 🔄 Atualização em background

### **Custo**
- 💰 76% de redução no custo da API
- 📉 Escalável para milhares de usuários
- 🎯 Uso eficiente do Firestore

### **Experiência do Usuário**
- 🚀 Carregamento instantâneo
- 📱 Funciona offline (cache local)
- 🔄 Dados sempre atualizados

### **Manutenibilidade**
- 🏗️ Arquitetura clara e modular
- 📝 Fácil de debugar
- 🔧 Fácil de estender

## 📅 Cronograma de Implementação

| Fase | Duração | Entregáveis |
|------|---------|-------------|
| **Fase 1** | 2 dias | Cache básico + TTL |
| **Fase 2** | 3 dias | Snapshots + Cloud Function |
| **Fase 3** | 4 dias | Histórico + Predição |
| **Fase 4** | 3 dias | Otimizações avançadas |
| **Total** | **12 dias** | Sistema completo |

## 🚀 Próximos Passos

1. **Aprovar a proposta**
2. **Implementar Fase 1** (cache básico)
3. **Testar com dados reais**
4. **Implementar Fase 2** (snapshots)
5. **Monitorar custos e performance**
6. **Iterar e otimizar**

---

**Quer que eu comece a implementar a Fase 1?** 🚀

