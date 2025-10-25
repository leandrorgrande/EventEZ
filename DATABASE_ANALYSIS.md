# Análise do Banco de Dados - EventEz

## Uso Atual: PostgreSQL + Neon

### Stack Tecnológica
- **ORM**: Drizzle ORM
- **Banco**: PostgreSQL (Neon Serverless)
- **Schema**: Arquivo `shared/schema.ts` com TypeScript
- **Migrations**: Drizzle Kit (`npm run db:push`)

### Tabelas no Banco de Dados

#### 1. **sessions** (Obrigatória - Replit Auth)
```typescript
- sid: PK
- sess: JSONB
- expire: timestamp
```
**Uso**: Sessões de autenticação do Replit

#### 2. **users** (Obrigatória - Replit Auth)
```typescript
- id: PK
- email, firstName, lastName, profileImageUrl
- userType: regular | business | admin
- phone, bio
- createdAt, updatedAt
```
**Uso**: Gerenciamento de usuários e perfis

#### 3. **locations**
```typescript
- id: PK
- name, address
- latitude, longitude
- googlePlaceId
- category
- businessOwnerId (FK -> users)
- verified
- popularTimes: JSONB
```
**Uso**: Locais físicos no mapa, eventos

#### 4. **places** ⭐ **NOVA**
```typescript
- id: PK
- placeId: Google Place ID (unique)
- name, formattedAddress
- latitude, longitude
- rating, userRatingsTotal
- isOpen
- types: array
- regularOpeningHours: JSONB ⭐
- createdAt, updatedAt
```
**Uso**: Dados do Google Places API, horários populares

#### 5. **events**
```typescript
- id: PK
- title, description
- locationId (FK -> locations)
- placeId (FK -> places) ⭐
- creatorId (FK -> users)
- eventType: clubs | bars | shows | fairs | food | other
- startDateTime, endDateTime
- mediaUrl, mediaType
- isActive, isBoosted, boostUntil, boostLevel
- createdAt
```
**Uso**: Eventos criados pelos usuários

#### 6. **eventAttendees**
```typescript
- id: PK
- eventId (FK -> events)
- userId (FK -> users)
- status: confirmed | maybe | declined
```
**Uso**: Participantes dos eventos

#### 7. **checkins**
```typescript
- id: PK
- userId (FK -> users) - nullable
- locationId (FK -> locations) - nullable
- latitude, longitude
- isAnonymous
- sessionId (usuários anônimos)
```
**Uso**: Dados para heatmap em tempo real

#### 8. **messages**
```typescript
- id: PK
- senderId (FK -> users)
- receiverId (FK -> users)
- content
- isRead
```
**Uso**: Sistema de mensagens

#### 9. **heatmapData**
```typescript
- id: PK
- latitude, longitude, intensity
- eventType
- isLive
- timestamp
```
**Uso**: Dados agregados para visualização do heatmap

#### 10. **businessClaims**
```typescript
- id: PK
- userId (FK -> users)
- locationId (FK -> locations)
- contactPhone, contactName
- status: pending | approved | rejected
```

#### 11. **claims** (P3)
```typescript
- id: PK
- placeId
- requesterUserId (FK -> users)
- method, evidence
- status: pending | approved | rejected
- reviewedBy, reviewedAt
```

#### 12. **owners** (P3)
```typescript
- id: PK
- placeId
- userId (FK -> users)
```

#### 13. **supportTickets** (P2)
```typescript
- id: PK
- userId (FK -> users)
- subject, message
- status: open | sent | error
```

#### 14. **profiles** (P4)
```typescript
- id: PK
- userId (FK -> users) - unique
- displayName, email
```

### Onde o Banco é Usado

1. **server/storage.ts**: Todas as operações de CRUD
2. **server/routes.ts**: Endpoints da API
3. **server/db.ts**: Conexão/configuração

---

## Firestore vs PostgreSQL

### ✅ Vantagens do Firestore

1. **Escalabilidade Automática**
   - Sem gerenciamento de servidor
   - Escala automaticamente

2. **Tempo Real**
   - Listeners nativos
   - Ideal para chat e atualizações em tempo real

3. **Custo Inicial**
   - Free tier: 1GB, 50K reads/dia
   - Pay-as-you-go

4. **Integração com Firebase**
   - Auth, Storage, Analytics
   - Ecossistema unificado

5. **Mobile-Friendly**
   - SDKs nativos iOS/Android
   - Funciona offline

### ❌ Desvantagens do Firestore

1. **Queries Limitadas**
   - Máximo 1 `WHERE` por query
   - Joins não suportados
   - Pagination complexa

2. **Denormalização Necessária**
   - Dados duplicados
   - Mais complexo de manter

3. **Custo em Escala**
   - Custa por documento lido
   - Pode ser caro com muitos reads

4. **Migração Complexa**
   - Reescrever todo o schema
   - Perder relações SQL
   - Reescrever queries

5. **Menos Maduro para Backend Web**
   - Voltado para mobile
   - PostgreSQL é padrão para web

---

## Análise de Migração para Firestore

### Complexidade da Migração: **ALTA** 🔴

#### Mudanças Necessárias:

1. **Schema** ⚠️
   - Reescrever 14 tabelas como collections
   - Desnormalizar dados (users em events, locations, etc.)
   - Criar subcollections

2. **Queries** ⚠️⚠️
   - Reescrever joins complexos
   - Usar múltiplas queries
   - Implementar denormalização

3. **Storage Layer** ⚠️⚠️⚠️
   - Reescrever `server/storage.ts`
   - Implementar novas operações
   - Perder type-safety do Drizzle

4. **Features** ⚠️⚠️
   - Migrar sessões do Replit Auth
   - Adaptar query complexas do heatmap
   - Reimplementar mensagens

---

## Recomendação: **NÃO MIGRAR** ❌

### Por que manter PostgreSQL:

1. ✅ **Replit Auth Requer PostgreSQL**
   - Sistema de sessões depende de PostgreSQL
   - `connect-pg-simple` não funciona com Firestore

2. ✅ **Queries Complexas**
   - Sistema de busca, filtros e joins
   - Queries agregadas (heatmap)
   - Mais simples em SQL

3. ✅ **Estrutura Atual Funciona**
   - Drizzle ORM é excelente
   - TypeScript type-safe
   - Schema bem definido

4. ✅ **Custo Neutro**
   - Neon tem free tier
   - Custo similar ao Firestore

5. ✅ **Time de Desenvolvimento**
   - 2-3 semanas para migrar
   - Riscos altos
   - Benefício marginal

---

## Alternativas Recomendadas

### 1. Otimizar PostgreSQL Atual (Recomendado) ⭐

```typescript
// Adicionar índices para performance
// Adicionar cache com Redis
// Usar connection pooling
```

**Vantagens:**
- Zero migração
- Melhor performance
- Menor risco

### 2. Híbrido: PostgreSQL + Firestore

```typescript
// PostgreSQL: Dados relacionais (users, events, etc.)
// Firestore: Dados em tempo real (chat, notificações)
```

**Quando usar:**
- Sistema de mensagens em tempo real
- Notificações push
- Features mobile-first

### 3. Prisma + PostgreSQL

```typescript
// Migrar de Drizzle para Prisma
// Melhor DX e tooling
```

---

## Conclusão

### ❌ NÃO migrar para Firestore porque:
1. Replit Auth depende de PostgreSQL
2. Queries complexas são difíceis em Firestore
3. Custo-benefício negativo
4. Risco alto, benefício baixo

### ✅ Recomendações:
1. **Manter PostgreSQL + Drizzle**
2. Adicionar Redis para cache
3. Otimizar queries com índices
4. Considerar Prisma se migrar ORM (opcional)

### 📊 Comparação Rápida

| Aspecto | PostgreSQL (Atual) | Firestore |
|---------|-------------------|-----------|
| **Migração** | Já funciona | 3 semanas |
| **Queries** | Complexas | Limitadas |
| **Custo** | Baixo (Neon) | Variável |
| **Escala** | Excelente | Automática |
| **Type Safety** | ✅ Drizzle | ⚠️ Manual |
| **Relacionamentos** | ✅ SQL Joins | ❌ Denormalizar |

**Decisão: Manter PostgreSQL + Neon** ✅
