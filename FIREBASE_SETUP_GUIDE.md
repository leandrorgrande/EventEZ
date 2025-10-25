# 🔥 Guia de Setup e Deploy no Firebase - EventEz

## 📋 Pré-requisitos

1. Conta Google com projeto Firebase criado (eventu-1b077)
2. Node.js 20+ instalado
3. Firebase CLI instalado globalmente

```bash
npm install -g firebase-tools
```

## 🚀 Passo 1: Login no Firebase

```bash
firebase login
```

## 🚀 Passo 2: Inicializar Firebase no Projeto

```bash
firebase init
```

Selecione:
- ✅ **Hosting**: Configure files for Firebase Hosting
- ✅ **Functions**: Configure a Cloud Functions directory
- ✅ **Firestore**: Configure security rules and indexes
- ✅ Projeto existente: **eventu-1b077**

### Configurações Hosting:
- **What do you want to use as your public directory?** → `dist/client`
- **Configure as a single-page app?** → **Yes**
- **Set up automatic builds and deploys with GitHub?** → **No**

### Configurações Functions:
- **What language would you like to use?** → **TypeScript**
- **Do you want to use ESLint?** → **Yes**
- **Do you want to install dependencies?** → **Yes**

## 🔑 Passo 3: Configurar Variáveis de Ambiente

### 3.1 Configurar API Key do Google Maps nas Functions:

```bash
firebase functions:config:set google.maps_api_key="SUA_GOOGLE_MAPS_API_KEY"
```

### 3.2 Criar arquivo `.env.local` na raiz do projeto:

```env
VITE_FIREBASE_API_KEY=sua-api-key
VITE_FIREBASE_AUTH_DOMAIN=eventu-1b077.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=eventu-1b077
VITE_FIREBASE_STORAGE_BUCKET=eventu-1b077.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
VITE_FIREBASE_APP_ID=seu-app-id
VITE_GOOGLE_MAPS_API_KEY=sua-google-maps-api-key
```

### 3.3 Obter credenciais do Firebase:

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/settings/general
2. Role até "Seus aplicativos"
3. Clique no ícone da Web (`</>`)
4. Copie as credenciais para o arquivo `.env.local`

## 📦 Passo 4: Instalar Dependências

```bash
# Dependências do projeto principal
npm install

# Dependências das Cloud Functions
cd functions
npm install
cd ..
```

## 🗄️ Passo 5: Configurar Firestore

### 5.1 Deploy das regras de segurança:

```bash
firebase deploy --only firestore:rules
```

### 5.2 Deploy dos índices:

```bash
firebase deploy --only firestore:indexes
```

## 🧪 Passo 6: Testar Localmente (Opcional)

```bash
# Iniciar emuladores do Firebase
firebase emulators:start

# Em outro terminal, iniciar o frontend
npm run dev
```

## 🚢 Passo 7: Build e Deploy

### 7.1 Build do Frontend:

```bash
npm run build
```

### 7.2 Deploy Completo:

```bash
firebase deploy
```

### 7.3 Deploy Parcial:

```bash
# Apenas Hosting (frontend)
firebase deploy --only hosting

# Apenas Functions (backend)
firebase deploy --only functions

# Apenas Firestore (banco de dados)
firebase deploy --only firestore
```

## 📍 Acessar o Projeto

Após o deploy, acesse:
- **Frontend**: https://eventu-1b077.web.app
- **Admin**: https://console.firebase.google.com/project/eventu-1b077

## 🔐 Passo 8: Configurar Firebase Auth

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/authentication/providers
2. Habilite **Google** como provedor de login
3. Configure domínios autorizados:
   - `eventu-1b077.web.app`
   - `eventu-1b077.firebaseapp.com`
   - `localhost` (para desenvolvimento)

## 📊 Estrutura de Collections no Firestore

O projeto criará automaticamente:

### Collections:
- ✅ `users` - Dados dos usuários
- ✅ `events` - Eventos criados
- ✅ `places` - Lugares do Google Places
- ✅ `eventAttendees` - Participantes de eventos
- ✅ `messages` - Mensagens entre usuários
- ✅ `checkins` - Check-ins em eventos
- ✅ `heatmapData` - Dados para heatmap
- ✅ `businessClaims` - Reivindicações de negócios

## 🔧 Troubleshooting

### Erro: "Missing or insufficient permissions"
- Verifique as regras do Firestore
- Execute: `firebase deploy --only firestore:rules`

### Erro: "API key not valid"
- Verifique se configurou: `firebase functions:config:set google.maps_api_key="..."`

### Build falha
- Limpe e reinstale: `rm -rf node_modules && npm install`

## 📝 Comandos Úteis

```bash
# Ver logs das Functions
firebase functions:log

# Ver logs em tempo real
firebase functions:log --tail

# Listar configurações
firebase functions:config:get

# Abrir console do Firebase
firebase open
```

## 🎯 Próximos Passos

1. ✅ Configurar domínio personalizado (opcional)
2. ✅ Habilitar Analytics
3. ✅ Configurar notificações push (FCM)
4. ✅ Adicionar mais provedores de login (Email, Facebook, etc)

## 📚 Documentação

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions](https://firebase.google.com/docs/functions)
