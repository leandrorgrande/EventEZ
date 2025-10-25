# 🔐 Configurar Google Authentication - EventEz

## ✅ Passo 1: Habilitar Google Auth no Firebase Console

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/authentication/providers
2. Clique em **"Google"** na lista de provedores
3. Clique no botão **"Ativar"**
4. Configure:
   - **Nome público do projeto**: EventEz
   - **E-mail de suporte**: seu-email@gmail.com
5. Clique em **"Salvar"**

## ✅ Passo 2: Obter as Credenciais do Firebase

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/settings/general
2. Role até **"Seus aplicativos"**
3. Se não tiver um app Web, clique em **"Adicionar app"** → Selecione **Web** (`</>`)
4. Dê um nome: **EventEz Web**
5. **NÃO** marque "Configurar o Firebase Hosting"
6. Clique em **"Registrar app"**
7. Copie as credenciais que aparecem

## ✅ Passo 3: Configurar as Variáveis de Ambiente

Edite o arquivo `.env.local` na raiz do projeto e preencha com suas credenciais:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIza...sua-api-key-aqui
VITE_FIREBASE_AUTH_DOMAIN=eventu-1b077.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=eventu-1b077
VITE_FIREBASE_STORAGE_BUCKET=eventu-1b077.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=680153461859
VITE_FIREBASE_APP_ID=1:680153461859:web:...seu-app-id-aqui

# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=AIza...sua-google-maps-key-aqui
```

## ✅ Passo 4: Adicionar Domínios Autorizados

1. Acesse: https://console.firebase.google.com/project/eventu-1b077/authentication/settings
2. Role até **"Domínios autorizados"**
3. Certifique-se que estes domínios estão na lista:
   - ✅ `eventu-1b077.web.app`
   - ✅ `eventu-1b077.firebaseapp.com`
   - ✅ `localhost` (para desenvolvimento)

Se não estiverem, clique em **"Adicionar domínio"** e adicione-os.

## ✅ Passo 5: Rebuild e Deploy

```bash
# Build do projeto com as novas variáveis
npm run build

# Deploy no Firebase
firebase deploy --only hosting
```

## ✅ Passo 6: Testar

1. Acesse: https://eventu-1b077.web.app
2. Clique no botão **"Entrar com Google"**
3. Selecione sua conta Google
4. Autorize o app
5. Você deve ser redirecionado para a página principal

## 🔧 Troubleshooting

### Erro: "This domain is not authorized"
- Verifique se o domínio está na lista de domínios autorizados
- Adicione: https://console.firebase.google.com/project/eventu-1b077/authentication/settings

### Erro: "API key not valid"
- Verifique se copiou a API key corretamente no `.env.local`
- Certifique-se que a API key do Firebase está habilitada

### Login não funciona
- Abra o console do navegador (F12) e veja os erros
- Verifique se o Firebase Auth está habilitado
- Certifique-se que fez o rebuild após adicionar as variáveis

## 📋 Checklist Final

- [ ] Google Auth habilitado no Firebase Console
- [ ] Credenciais copiadas para `.env.local`
- [ ] Domínios autorizados configurados
- [ ] `npm run build` executado
- [ ] `firebase deploy --only hosting` executado
- [ ] Login testado em https://eventu-1b077.web.app

## 🎯 Próximos Passos

Depois que o login estiver funcionando:
1. Criar perfil de usuário no Firestore automaticamente
2. Adicionar mais provedores (Email, Facebook, etc)
3. Implementar logout
4. Adicionar foto de perfil do Google

