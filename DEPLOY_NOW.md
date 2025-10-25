# 🚀 Deploy Imediato - EventEz

## ✅ Passo a Passo Simplificado

### 1️⃣ Login no Firebase (no seu terminal)
```bash
firebase login
```
Você será redirecionado para o navegador para fazer login com sua conta Google.

### 2️⃣ Inicializar Firebase no Projeto
```bash
firebase init
```

Quando perguntar, selecione:
- ✅ **Use an existing project**
- Escolha: **eventu-1b077**

Quando perguntar o que deseja configurar:
- ✅ **Hosting**
- ❌ Functions (não necessário agora)
- ❌ Firestore (já está configurado)

Quando perguntar sobre o diretório público:
- Digite: `dist/client`

Quando perguntar sobre single-page app:
- Digite: **Yes**

Quando perguntar sobre GitHub:
- Digite: **No**

### 3️⃣ Deploy
```bash
firebase deploy --only hosting
```

### 4️⃣ Acessar
Depois do deploy, acesse:
```
https://eventu-1b077.web.app
```

## 🔧 Se der erro:

### Erro: "Firebase project not found"
Execute:
```bash
firebase use eventu-1b077
firebase deploy --only hosting
```

### Erro: "Build not found"
Execute:
```bash
npm run build
firebase deploy --only hosting
```

## 📋 Checklist Rápido:

- [ ] `firebase login` executado
- [ ] `firebase init` executado
- [ ] `npm run build` executado
- [ ] `firebase deploy --only hosting` executado
- [ ] Site acessível em https://eventu-1b077.web.app

## ⚠️ Importante:

1. **Certifique-se que o build está correto:**
   - Verifique se existe a pasta `dist/client`
   - Dentro deve ter: `index.html` e pasta `assets`

2. **Se não estiver logado:**
   - Execute `firebase logout` e depois `firebase login`

3. **Se o projeto não existir no Firebase:**
   - Acesse: https://console.firebase.google.com
   - Crie um novo projeto chamado "eventu-1b077"
   - Ou selecione um projeto existente
