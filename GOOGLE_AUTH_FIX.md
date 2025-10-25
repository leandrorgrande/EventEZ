# 🔧 Corrigir Erro de Autenticação Google - EventEz

## ❌ Erro Atual
```
Client ID: 680153461859-7s38qg5n8hvearaska5nvg7f8elpdbbs.apps.googleusercontent.com
```

Este erro ocorre porque o Firebase Auth precisa ser configurado corretamente.

## ✅ Solução Passo a Passo

### 1️⃣ Obter as Credenciais do Firebase

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/settings/general
2. Role até **"Seus aplicativos"**
3. Se não houver um app Web, clique em **"Adicionar app"** → Selecione **Web** (`</>`)
4. Dê um nome: **EventEz Web**
5. Clique em **"Registrar app"**
6. Você verá algo assim:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "eventu-1b077.firebaseapp.com",
  projectId: "eventu-1b077",
  storageBucket: "eventu-1b077.firebasestorage.app",
  messagingSenderId: "680153461859",
  appId: "1:680153461859:web:..."
};
```

### 2️⃣ Criar arquivo .env.local

Crie o arquivo `.env.local` na raiz do projeto com as credenciais:

```env
VITE_FIREBASE_API_KEY=AIzaSy...sua-api-key-aqui
VITE_FIREBASE_AUTH_DOMAIN=eventu-1b077.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=eventu-1b077
VITE_FIREBASE_STORAGE_BUCKET=eventu-1b077.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=680153461859
VITE_FIREBASE_APP_ID=1:680153461859:web:...seu-app-id-aqui
VITE_GOOGLE_MAPS_API_KEY=sua-google-maps-key
```

### 3️⃣ Habilitar Google Authentication

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/authentication/providers
2. Clique em **"Google"**
3. Clique no botão **"Ativar"**
4. Configure:
   - **Nome público do projeto**: EventEz
   - **E-mail de suporte**: seu-email@gmail.com
5. Clique em **"Salvar"**

### 4️⃣ Configurar Domínios Autorizados

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/authentication/settings
2. Na seção **"Domínios autorizados"**, adicione:
   - ✅ `eventu-1b077.web.app`
   - ✅ `eventu-1b077.firebaseapp.com`
   - ✅ `localhost` (para desenvolvimento)

### 5️⃣ Configurar OAuth Consent Screen (Google Cloud Console)

1. Acesse: https://console.cloud.google.com/apis/credentials/consent?project=eventu-1b077
2. Configure a tela de consentimento:
   - **Tipo de usuário**: Externo
   - **Nome do aplicativo**: EventEz
   - **E-mail de suporte**: seu-email@gmail.com
   - **Domínios autorizados**: 
     - `eventu-1b077.web.app`
     - `eventu-1b077.firebaseapp.com`
   - **E-mail do desenvolvedor**: seu-email@gmail.com
3. Clique em **"Salvar e continuar"**
4. Pule as seções de **Escopos** e **Usuários de teste**
5. Clique em **"Voltar ao painel"**

### 6️⃣ Verificar Credenciais OAuth

1. Acesse: https://console.cloud.google.com/apis/credentials?project=eventu-1b077
2. Você verá um **Client ID OAuth 2.0** criado automaticamente pelo Firebase
3. Clique nele para editar
4. Em **"URIs de redirecionamento autorizados"**, certifique-se que tem:
   - `https://eventu-1b077.firebaseapp.com/__/auth/handler`
   - `https://eventu-1b077.web.app/__/auth/handler`
   - `http://localhost/__/auth/handler` (para desenvolvimento)

### 7️⃣ Rebuild e Deploy

```bash
# Build com as novas variáveis
npm run build

# Deploy
firebase deploy --only hosting
```

### 8️⃣ Testar

1. Acesse: https://eventu-1b077.web.app
2. Clique em **"Entrar com Google"**
3. Selecione sua conta
4. Autorize o app
5. Você deve ser redirecionado para a página principal

## 🔍 Verificar Configuração Atual

Para verificar se as variáveis estão corretas, você pode adicionar um console.log temporário:

```typescript
// Em client/src/lib/firebase.ts
console.log('Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? '✅ Configurado' : '❌ Faltando',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId ? '✅ Configurado' : '❌ Faltando',
});
```

## ⚠️ Erros Comuns

### "This domain is not authorized"
- Adicione o domínio em: Authentication > Settings > Authorized domains

### "API key not valid"
- Verifique se copiou a API key correta do Firebase Console
- Certifique-se que o arquivo `.env.local` está na raiz do projeto

### "Invalid OAuth client"
- Configure a tela de consentimento OAuth no Google Cloud Console
- Adicione os URIs de redirecionamento corretos

### "App not configured"
- Certifique-se que criou um Web App no Firebase Console
- Copie todas as credenciais para o `.env.local`

## 📋 Checklist Final

- [ ] Web App criado no Firebase Console
- [ ] Credenciais copiadas para `.env.local`
- [ ] Google Auth habilitado no Firebase
- [ ] Domínios autorizados configurados
- [ ] OAuth Consent Screen configurado
- [ ] URIs de redirecionamento configurados
- [ ] Build executado: `npm run build`
- [ ] Deploy executado: `firebase deploy --only hosting`
- [ ] Login testado em https://eventu-1b077.web.app

## 🎯 Links Úteis

- Firebase Console: https://console.firebase.google.com/project/eventu-1b077
- Google Cloud Console: https://console.cloud.google.com/apis/credentials?project=eventu-1b077
- OAuth Consent: https://console.cloud.google.com/apis/credentials/consent?project=eventu-1b077
- Site: https://eventu-1b077.web.app

