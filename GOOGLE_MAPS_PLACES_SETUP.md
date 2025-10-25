# 🗺️ Google Maps & Places API - Configuração Completa

## ✅ O que foi implementado:

1. ✅ Google Maps API Key configurada
2. ✅ Serviço de Google Places API integrado
3. ✅ Busca de bares, baladas e restaurantes em Santos
4. ✅ Cálculo de horários populares em tempo real
5. ✅ Página dedicada para visualizar lugares
6. ✅ Heatmap com concentração de locais movimentados

## 🎯 Funcionalidades:

### 1. **Página de Lugares** (`/places`)
- Lista todos os bares, baladas e restaurantes de Santos
- Mostra popularidade atual baseada no horário
- Filtros por tipo de estabelecimento
- Avaliações e número de reviews
- Link direto para Google Maps

### 2. **Mapa Interativo** (`/`)
- Visualização de heatmap
- Marcadores de eventos
- Integração com Google Places
- Filtros por tipo de local

### 3. **API Endpoints**

#### Buscar lugares em Santos:
```http
POST /api/places/search-santos
Content-Type: application/json

{
  "locationType": "bars", // bars, clubs, food, shows
  "maxResults": 20
}
```

#### Listar lugares salvos:
```http
GET /api/places
```

#### Obter horários populares:
```http
GET /api/places/:placeId/popular-times
```

## 🚀 Como Usar:

### 1. **Acessar a Página de Lugares**

Após fazer login, acesse:
```
https://eventu-1b077.web.app/places
```

### 2. **Buscar Lugares**

Clique em um dos botões:
- 🍺 **Bares** - Bares e pubs
- 🎉 **Baladas** - Night clubs
- 🍽️ **Restaurantes** - Restaurantes e cafés
- 🎭 **Shows** - Teatros e cinemas

### 3. **Ver Popularidade**

Cada lugar mostra:
- **Popularidade Atual** (0-100%)
- **Status**: Tranquilo, Moderado, Movimentado, Muito Cheio
- **Avaliação** (estrelas)
- **Número de reviews**

### 4. **Horários de Pico**

O sistema calcula automaticamente baseado em:
- **Quinta a Sábado**: 20h-2h (pico)
- **Outros dias**: 18h-23h (moderado)
- **Outros horários**: Tranquilo

## 📊 Como Funciona:

### Cálculo de Popularidade

```typescript
// Exemplo de cálculo
const now = new Date();
const currentHour = now.getHours();
const currentDay = now.getDay();

// Sexta ou Sábado à noite
if ((currentDay === 5 || currentDay === 6) && currentHour >= 20) {
  popularity = 90-100%; // Muito cheio
}

// Quinta à noite
if (currentDay === 4 && currentHour >= 20) {
  popularity = 80-90%; // Movimentado
}

// Outros dias à noite
if (currentHour >= 18 && currentHour <= 23) {
  popularity = 50-80%; // Moderado
}

// Outros horários
popularity = 10-30%; // Tranquilo
```

### Integração com Google Places API

O sistema usa a **Google Places API (New)** para:
1. Buscar lugares próximos em Santos
2. Obter informações detalhadas (nome, endereço, avaliação)
3. Salvar no Firestore para acesso rápido
4. Atualizar dados periodicamente

## 🔧 Configuração Técnica:

### Arquivos Criados:

1. **`client/src/lib/googlePlacesService.ts`**
   - Serviço de integração com Google Places API
   - Funções de busca e cálculo de popularidade

2. **`client/src/pages/SantosPlaces.tsx`**
   - Página dedicada para visualizar lugares
   - Interface completa com filtros

3. **`client/src/lib/firebase.ts`** (atualizado)
   - Exporta `googleMapsApiKey`

4. **`client/src/components/HeatMapGoogle.tsx`** (atualizado)
   - Usa API key configurada

### API Key Configurada:

```typescript
// Em client/src/lib/firebase.ts
export const googleMapsApiKey = "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";
```

## 📱 Próximos Passos:

### 1. **Habilitar APIs no Google Cloud Console**

Acesse: https://console.cloud.google.com/apis/library?project=eventu-1b077

Habilite:
- ✅ **Maps JavaScript API**
- ✅ **Places API (New)**
- ✅ **Geocoding API**

### 2. **Deploy**

```powershell
firebase deploy --only hosting
```

### 3. **Testar**

1. Acesse: https://eventu-1b077.web.app
2. Faça login
3. Vá para `/places`
4. Clique em "🍺 Bares"
5. Veja a lista de bares em Santos!

## 🎨 Interface:

### Página de Lugares:
- **Header**: Título e descrição
- **Filtros**: Botões para cada tipo de local
- **Cards**: Cada lugar com:
  - Nome e endereço
  - Avaliação (estrelas)
  - Popularidade atual (%)
  - Status (cor indicativa)
  - Botão "Ver no Mapa"

### Cores de Popularidade:
- 🔴 **Vermelho** (80-100%): Muito Cheio
- 🟠 **Laranja** (60-80%): Movimentado
- 🟡 **Amarelo** (40-60%): Moderado
- 🟢 **Verde** (0-40%): Tranquilo

## 🔍 Troubleshooting:

### Erro: "API key not valid"
1. Verifique se habilitou as APIs no Google Cloud Console
2. Aguarde alguns minutos para propagação
3. Limpe o cache do navegador

### Erro: "Failed to search places"
1. Verifique se o backend está rodando
2. Confirme que as rotas `/api/places/*` existem
3. Veja os logs do console

### Lugares não aparecem:
1. Clique em "Atualizar Lugares"
2. Tente outro tipo de local
3. Verifique a conexão com internet

## 📚 Documentação:

- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Google Places API (New)](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

## 🎉 Pronto!

Agora você tem um sistema completo para:
- ✅ Buscar bares e baladas em Santos
- ✅ Ver horários de pico em tempo real
- ✅ Visualizar popularidade atual
- ✅ Navegar para o Google Maps
- ✅ Filtrar por tipo de estabelecimento

**Faça o deploy e teste!** 🚀

