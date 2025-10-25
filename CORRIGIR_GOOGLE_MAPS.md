# 🗺️ Corrigir Google Maps - Passo a Passo

## ❌ Problema Atual

O mapa não está abrindo no site porque:
1. As APIs do Google Maps não estão habilitadas
2. Falta configurar restrições da API key

## ✅ Solução Completa

### **Passo 1: Habilitar APIs Necessárias** (5 minutos)

Acesse o Google Cloud Console:
👉 https://console.cloud.google.com/apis/library?project=eventu-1b077

Habilite estas 3 APIs (clique em cada uma e depois em "ATIVAR"):

1. **Maps JavaScript API**
   - https://console.cloud.google.com/apis/library/maps-backend.googleapis.com?project=eventu-1b077
   - Clique em **"ATIVAR"**

2. **Places API (New)**
   - https://console.cloud.google.com/apis/library/places-backend.googleapis.com?project=eventu-1b077
   - Clique em **"ATIVAR"**

3. **Geocoding API**
   - https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com?project=eventu-1b077
   - Clique em **"ATIVAR"**

### **Passo 2: Configurar Restrições da API Key** (3 minutos)

1. Acesse: https://console.cloud.google.com/apis/credentials?project=eventu-1b077

2. Encontre sua API Key: `AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg`

3. Clique nela para editar

4. Em **"Restrições de aplicativo"**, selecione:
   - ✅ **Referenciadores HTTP (sites)**
   
5. Adicione estes domínios:
   ```
   https://eventu-1b077.web.app/*
   https://eventu-1b077.firebaseapp.com/*
   http://localhost:*
   http://127.0.0.1:*
   ```

6. Em **"Restrições de API"**, selecione:
   - ✅ **Restringir chave**
   
7. Selecione estas APIs:
   - ✅ Maps JavaScript API
   - ✅ Places API (New)
   - ✅ Geocoding API

8. Clique em **"SALVAR"**

### **Passo 3: Ativar Faturamento** (se necessário)

1. Acesse: https://console.cloud.google.com/billing?project=eventu-1b077

2. Se não tiver faturamento ativo:
   - Clique em **"Vincular uma conta de faturamento"**
   - Crie uma nova conta de faturamento
   - Adicione um cartão de crédito

**⚠️ Não se preocupe com custos:**
- Google oferece **$200 de crédito grátis/mês**
- Você tem **28.000 carregamentos de mapa grátis/mês**
- Com cache, você usará muito menos que isso

### **Passo 4: Aguardar Propagação** (5-10 minutos)

Após habilitar as APIs, aguarde 5-10 minutos para que as mudanças sejam propagadas.

### **Passo 5: Testar**

1. Limpe o cache do navegador (Ctrl + Shift + Delete)
2. Acesse: https://eventu-1b077.web.app
3. Faça login
4. O mapa deve aparecer! 🎉

---

## 🔍 Verificar se as APIs estão Ativas

Execute este comando no console do navegador (F12):

```javascript
// Verificar se o Google Maps está carregado
console.log('Google Maps:', typeof google !== 'undefined' && google.maps ? '✅ Carregado' : '❌ Não carregado');

// Verificar a API key
console.log('API Key configurada:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? '✅ Sim' : '❌ Não');
```

---

## 🆘 Troubleshooting

### Erro: "This API project is not authorized to use this API"

**Solução:** Habilite a API correspondente no Google Cloud Console

### Erro: "RefererNotAllowedMapError"

**Solução:** Adicione o domínio nas restrições da API key

### Erro: "ApiNotActivatedMapError"

**Solução:** Ative o faturamento no projeto

### Mapa aparece cinza

**Solução:** 
1. Verifique se a API key está correta
2. Aguarde 10 minutos para propagação
3. Limpe o cache do navegador

---

## 📊 Custos Estimados

Com **1.000 usuários/dia**:

| Serviço | Uso Mensal | Custo |
|---------|------------|-------|
| **Maps JavaScript API** | ~30.000 carregamentos | **$0** (dentro do free tier) |
| **Places API (New)** | ~400 chamadas | **$0** (dentro do free tier) |
| **Geocoding API** | ~100 chamadas | **$0** (dentro do free tier) |
| **Total** | | **$0/mês** 🎉 |

**Free Tier do Google Maps:**
- $200 de crédito/mês
- 28.000 carregamentos de mapa grátis
- 100.000 chamadas de Places API grátis

---

## ✅ Checklist

- [ ] Maps JavaScript API habilitada
- [ ] Places API (New) habilitada
- [ ] Geocoding API habilitada
- [ ] Restrições da API key configuradas
- [ ] Domínios autorizados adicionados
- [ ] Faturamento ativo (se necessário)
- [ ] Aguardado 10 minutos
- [ ] Cache do navegador limpo
- [ ] Testado no site

---

## 🚀 Depois que Funcionar

1. **Faça o deploy atualizado:**
   ```powershell
   firebase deploy --only hosting
   ```

2. **Teste a página de lugares:**
   - Acesse: https://eventu-1b077.web.app/places
   - Clique em "🍺 Bares"
   - Veja a lista de bares!

3. **Teste o mapa:**
   - Acesse: https://eventu-1b077.web.app
   - O mapa deve carregar com Santos centralizado

---

**Siga os passos acima e me avise quando o mapa estiver funcionando!** 🗺️

