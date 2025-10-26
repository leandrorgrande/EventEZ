# 🗺️ Habilitar Google Places API (New) - Passo a Passo

## ❌ ERRO ATUAL: 403 FORBIDDEN

O erro `403` significa que a **Google Places API (New)** não está habilitada ou a API Key não tem permissão.

---

## ✅ SOLUÇÃO: HABILITAR PLACES API (NEW)

### **PASSO 1: Acessar Google Cloud Console**

1. Acesse: **https://console.cloud.google.com/**
2. No topo, selecione o projeto: **eventu-1b077**
3. Se não aparecer, clique no dropdown e selecione

---

### **PASSO 2: Habilitar Places API (New)**

#### **Opção A: Link Direto**
Clique aqui: **https://console.cloud.google.com/apis/library/places-backend.googleapis.com?project=eventu-1b077**

Depois clique em **"ATIVAR"** ou **"ENABLE"**

#### **Opção B: Buscar Manualmente**

1. No menu lateral, vá em: **APIs e Serviços** > **Biblioteca**
2. Na busca, digite: **"Places API (New)"**
3. Clique no resultado: **Places API (New)**
4. Clique em **"ATIVAR"** ou **"ENABLE"**

---

### **PASSO 3: Verificar APIs Habilitadas**

Certifique-se de que estas APIs estão **ATIVAS**:

1. **Places API (New)** ✅
2. **Maps JavaScript API** ✅
3. **Geocoding API** ✅

**Link para verificar:**
https://console.cloud.google.com/apis/dashboard?project=eventu-1b077

---

### **PASSO 4: Configurar Restrições da API Key**

1. Acesse: **https://console.cloud.google.com/apis/credentials?project=eventu-1b077**
2. Clique na sua API Key: **AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg**
3. Em **"Restrições de aplicativo"**:
   - Selecione: **"Referenciadores HTTP (sites)"**
   - Adicione:
     ```
     https://eventu-1b077.web.app/*
     https://eventu-1b077.firebaseapp.com/*
     https://*.cloudfunctions.net/*
     https://*.run.app/*
     http://localhost:5000/*
     http://localhost:*
     ```

4. Em **"Restrições de API"**:
   - Selecione: **"Restringir chave"**
   - Marque:
     - ☑️ **Places API (New)**
     - ☑️ **Maps JavaScript API**
     - ☑️ **Geocoding API**

5. Clique em **"SALVAR"**

---

### **PASSO 5: Aguardar Propagação**

Após habilitar/configurar, aguarde **5-10 minutos** para as mudanças propagarem.

---

## 🧪 TESTAR DEPOIS DE HABILITAR

### **1. Ver Logs da Cloud Function**

```powershell
firebase functions:log
```

Ou acesse:
https://console.firebase.google.com/project/eventu-1b077/functions/logs

### **2. Recarregar o Site**

```
https://eventu-1b077.web.app
```

Pressione **Ctrl + Shift + R** (hard reload)

### **3. Ver Console (F12)**

Deve mostrar:
```
[MapaCalor] Buscando lugares do tipo: bars
[MapaCalor] Response status: 200
[MapaCalor] Dados recebidos: {places: Array(50)}
```

---

## 📊 CHECKLIST

- [ ] Acessei Google Cloud Console
- [ ] Selecionei projeto **eventu-1b077**
- [ ] Habilitei **Places API (New)**
- [ ] Verifiquei que está **ATIVA**
- [ ] Configurei restrições da API Key
- [ ] Adicionei domínios autorizados
- [ ] Aguardei 5-10 minutos
- [ ] Recarreguei o site (Ctrl + Shift + R)
- [ ] Testei no console (F12)

---

## 🔍 COMO SABER SE DEU CERTO

### **✅ SUCESSO:**
```
Console do navegador:
[MapaCalor] Response status: 200
[MapaCalor] Places atualizados: 50 lugares

Mapa:
- Heatmap aparece
- Marcadores aparecem
- InfoWindows funcionam
```

### **❌ AINDA COM ERRO:**

Se ainda aparecer `403`:
1. Verifique se a API está **realmente ativa**
2. Aguarde mais 5 minutos
3. Limpe o cache do navegador (Ctrl + Shift + Delete)
4. Tente em aba anônima

Se aparecer `429`:
- Significa que atingiu o limite de requisições
- Aguarde alguns minutos

---

## 💰 CUSTO

**Places API (New)** tem os seguintes custos:

- **Nearby Search:** $32.00 por 1.000 requisições
- **Crédito gratuito:** $200/mês

Para desenvolvimento, você tem **$200 grátis por mês**, o que equivale a:
- **~6.250 buscas por mês**
- **~208 buscas por dia**

O app faz **1 busca automática** ao carregar, então está seguro.

---

## 🚨 SE CONTINUAR COM ERRO 403

Me envie:

1. **Print da página de APIs habilitadas:**
   https://console.cloud.google.com/apis/dashboard?project=eventu-1b077

2. **Print das configurações da API Key:**
   https://console.cloud.google.com/apis/credentials?project=eventu-1b077

3. **Logs da Cloud Function:**
   ```powershell
   firebase functions:log
   ```

---

## 📝 RESUMO

1. ✅ Backend atualizado com logs
2. ⏳ Habilitar Places API (New) no Google Cloud
3. ⏳ Configurar restrições da API Key
4. ⏳ Aguardar 5-10 minutos
5. ⏳ Testar novamente

---

**Siga os passos acima e me avise quando terminar!** 🚀

