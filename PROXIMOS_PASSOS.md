# 🚀 Próximos Passos - EventEz

## ✅ O que já foi feito:

1. ✅ Projeto migrado para Firebase
2. ✅ Build configurado corretamente
3. ✅ Deploy inicial realizado em https://eventu-1b077.web.app
4. ✅ Firebase Auth integrado com Google
5. ✅ Firestore configurado
6. ✅ Regras de segurança criadas

## ❌ O que falta fazer:

### 1️⃣ Configurar Credenciais do Firebase (URGENTE)

**Problema:** O login com Google está dando erro porque faltam as credenciais.

**Solução:**

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/settings/general
2. Role até **"Seus aplicativos"**
3. Se não houver um app Web:
   - Clique em **"Adicionar app"** → Selecione **Web** (`</>`)
   - Dê um nome: **EventEz Web**
   - Clique em **"Registrar app"**
4. Copie as credenciais que aparecem

**Exemplo:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "eventu-1b077.firebaseapp.com",
  projectId: "eventu-1b077",
  storageBucket: "eventu-1b077.firebasestorage.app",
  messagingSenderId: "680153461859",
  appId: "1:680153461859:web:XXXXXXXXXXXXXXXXXX"
};
```

### 2️⃣ Criar arquivo .env.local

Crie o arquivo `.env.local` na raiz do projeto:

```env
VITE_FIREBASE_API_KEY=AIzaSy...COLE_AQUI
VITE_FIREBASE_AUTH_DOMAIN=eventu-1b077.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=eventu-1b077
VITE_FIREBASE_STORAGE_BUCKET=eventu-1b077.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=680153461859
VITE_FIREBASE_APP_ID=1:680153461859:web:...COLE_AQUI
VITE_GOOGLE_MAPS_API_KEY=sua-google-maps-key
```

**Atalho:** Execute no PowerShell:
```powershell
.\setup-env.example.ps1
```

### 3️⃣ Habilitar Google Authentication

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/authentication/providers
2. Clique em **"Google"**
3. Clique em **"Ativar"**
4. Preencha:
   - **Nome público**: EventEz
   - **E-mail de suporte**: seu-email@gmail.com
5. Clique em **"Salvar"**

### 4️⃣ Configurar Domínios Autorizados

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/authentication/settings
2. Em **"Domínios autorizados"**, adicione:
   - `eventu-1b077.web.app`
   - `eventu-1b077.firebaseapp.com`
   - `localhost`

### 5️⃣ Configurar OAuth Consent Screen

1. Acesse: https://console.cloud.google.com/apis/credentials/consent?project=eventu-1b077
2. Configure:
   - **Tipo**: Externo
   - **Nome**: EventEz
   - **E-mail de suporte**: seu-email@gmail.com
   - **Domínios autorizados**: 
     - `eventu-1b077.web.app`
     - `eventu-1b077.firebaseapp.com`
3. Salve

### 6️⃣ Rebuild e Deploy

```powershell
# Build
npm run build

# Deploy
firebase deploy --only hosting
```

### 7️⃣ Testar

1. Acesse: https://eventu-1b077.web.app
2. Clique em **"Entrar com Google"**
3. Faça login com sua conta Google
4. ✅ Sucesso!

## 📋 Checklist Rápido

- [ ] Credenciais do Firebase copiadas
- [ ] Arquivo `.env.local` criado e preenchido
- [ ] Google Auth habilitado no Firebase
- [ ] Domínios autorizados configurados
- [ ] OAuth Consent Screen configurado
- [ ] Build executado: `npm run build`
- [ ] Deploy executado: `firebase deploy --only hosting`
- [ ] Login testado e funcionando

## 🔗 Links Importantes

### Firebase Console
- **Projeto**: https://console.firebase.google.com/project/eventu-1b077
- **Configurações**: https://console.firebase.google.com/project/eventu-1b077/settings/general
- **Authentication**: https://console.firebase.google.com/project/eventu-1b077/authentication/providers
- **Firestore**: https://console.firebase.google.com/project/eventu-1b077/firestore

### Google Cloud Console
- **Credenciais**: https://console.cloud.google.com/apis/credentials?project=eventu-1b077
- **OAuth Consent**: https://console.cloud.google.com/apis/credentials/consent?project=eventu-1b077

### Seu Site
- **URL**: https://eventu-1b077.web.app

## 📚 Documentação Criada

1. `GOOGLE_AUTH_FIX.md` - Guia detalhado para corrigir o erro de autenticação
2. `FIREBASE_SETUP_GUIDE.md` - Guia completo de setup do Firebase
3. `DEPLOY_NOW.md` - Guia rápido de deploy
4. `CONFIGURE_GOOGLE_AUTH.md` - Configuração do Google Auth
5. `MIGRATION_TO_FIREBASE.md` - Documentação da migração

## 🆘 Precisa de Ajuda?

Se tiver algum erro, consulte:
- `GOOGLE_AUTH_FIX.md` - Solução de erros de autenticação
- Console do navegador (F12) - Veja os erros em tempo real
- Firebase Console - Logs e configurações

## 🎯 Depois que tudo funcionar:

1. Adicionar mais funcionalidades
2. Integrar Google Places API
3. Implementar heatmap
4. Adicionar eventos
5. Configurar notificações push

