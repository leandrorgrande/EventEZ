# Migração para Firebase/Firestore - EventEz

## 🎯 Objetivo

Migrar o projeto EventEz do Replit para Firebase usando:
- **Firestore** (banco de dados NoSQL)
- **Firebase Auth** (autenticação)
- **Firebase Hosting** (deploy)
- **Google Cloud Functions** (backend/serverless)

## 📋 Plano de Migração

### Fase 1: Setup Inicial
- [x] Criar projeto no Firebase
- [ ] Instalar Firebase SDK
- [ ] Configurar Firebase CLI
- [ ] Configurar variáveis de ambiente

### Fase 2: Backend (Express → Cloud Functions)
- [ ] Converter Express para Cloud Functions
- [ ] Migrar rotas para HTTP Functions
- [ ] Configurar CORS
- [ ] Migrar storage layer

### Fase 3: Banco de Dados (PostgreSQL → Firestore)
- [ ] Criar collections no Firestore
- [ ] Migrar schema
- [ ] Adaptar queries
- [ ] Criar regras de segurança

### Fase 4: Autenticação (Replit Auth → Firebase Auth)
- [ ] Configurar Firebase Auth
- [ ] Atualizar frontend
- [ ] Migrar middleware de auth

### Fase 5: Frontend
- [ ] Instalar Firebase SDK no frontend
- [ ] Atualizar hooks de auth
- [ ] Configurar build para hosting

### Fase 6: Deploy
- [ ] Configurar Firebase Hosting
- [ ] Deploy Cloud Functions
- [ ] Deploy frontend
- [ ] Testar produção

## 🔥 Vantagens da Migração

✅ **Escalabilidade automática**
✅ **Custo-benefício** (Free tier generoso)
✅ **Integração Google** (Places API, Maps, etc)
✅ **Deploy simples** (firebase deploy)
✅ **Tempo real** (Firestore listeners)
✅ **Auth completo** (Google, Email, etc)
