# 🔑 Como Obter o App ID do Firebase

## ⚠️ IMPORTANTE

Você já tem a API Key: `AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg`

Agora precisamos do **App ID** para completar a configuração.

## 📋 Passo a Passo

### Opção 1: Usar App Existente

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/settings/general
2. Role até **"Seus aplicativos"**
3. Se já houver um app Web (ícone `</>`), clique nele
4. Você verá o **App ID** no formato: `1:680153461859:web:XXXXXXXXXX`
5. Copie esse App ID

### Opção 2: Criar Novo App Web

Se não houver nenhum app Web:

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/settings/general
2. Role até **"Seus aplicativos"**
3. Clique em **"Adicionar app"**
4. Selecione **Web** (ícone `</>`)
5. Dê um nome: **EventEz Web**
6. **NÃO** marque "Configurar Firebase Hosting"
7. Clique em **"Registrar app"**
8. Você verá um código JavaScript com todas as credenciais:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg",
  authDomain: "eventu-1b077.firebaseapp.com",
  projectId: "eventu-1b077",
  storageBucket: "eventu-1b077.firebasestorage.app",
  messagingSenderId: "680153461859",
  appId: "1:680153461859:web:XXXXXXXXXX" // ← COPIE ESTE
};
```

9. Copie o **appId** completo

## 🔄 Depois de Obter o App ID

### Método 1: Atualizar o arquivo `firebase.ts`

Edite o arquivo `client/src/lib/firebase.ts` e substitua:

```typescript
appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:680153461859:web:placeholder"
```

Por:

```typescript
appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:680153461859:web:SEU_APP_ID_AQUI"
```

### Método 2: Criar arquivo .env.local (Recomendado)

Crie manualmente o arquivo `.env.local` na raiz do projeto:

```env
VITE_FIREBASE_API_KEY=AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg
VITE_FIREBASE_AUTH_DOMAIN=eventu-1b077.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=eventu-1b077
VITE_FIREBASE_STORAGE_BUCKET=eventu-1b077.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=680153461859
VITE_FIREBASE_APP_ID=1:680153461859:web:SEU_APP_ID_AQUI
VITE_GOOGLE_MAPS_API_KEY=AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg
```

## 🚀 Depois de Configurar

```powershell
# Build
npm run build

# Deploy
firebase deploy --only hosting
```

## ✅ Verificar se Funcionou

Acesse: https://eventu-1b077.web.app

Se aparecer a tela de login com o botão "Entrar com Google", está funcionando!

## 📝 Nota sobre o Client Secret

O arquivo `client_secret_2_680153461859-7s38qg5n8hvearaska5nvg7f8elpdbbs.apps.googleusercontent.com.json` é para **OAuth 2.0** do Google Cloud Console.

Para o Firebase Web, precisamos das credenciais do **Firebase Console**, não do Google Cloud Console OAuth.

O Firebase gerencia o OAuth automaticamente quando você:
1. Habilita o provedor Google em Authentication
2. Usa o SDK do Firebase Auth no frontend

Então você **NÃO** precisa configurar o client secret manualmente! 🎉

