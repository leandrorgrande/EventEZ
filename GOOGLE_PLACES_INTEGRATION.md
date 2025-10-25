# Integração com Google Places API - Horários Populares

## Visão Geral

Esta funcionalidade permite buscar e armazenar dados de lugares (bares, baladas, restaurantes) em Santos usando a Google Places API, incluindo horários de funcionamento e outras informações relevantes.

## Funcionalidades Implementadas

### 1. Buscar Lugares em Santos

**Endpoint:** `POST /api/places/search-santos`

Busca lugares em Santos por tipo (bares, baladas, etc.) e salva automaticamente no banco de dados.

**Parâmetros:**
- `locationType`: Tipo de lugar ('bars', 'clubs', 'shows', 'food', 'fairs')
- `paginationToken`: Token para paginação (opcional)

**Exemplo de uso:**
```typescript
const response = await fetch('/api/places/search-santos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ locationType: 'bars' })
});
```

### 2. Buscar Detalhes de um Lugar

**Endpoint:** `POST /api/places/fetch-popular-times`

Busca informações detalhadas de um lugar específico, incluindo horários de funcionamento.

**Parâmetros:**
- `placeId`: ID do lugar no Google Places

**Exemplo de uso:**
```typescript
const response = await fetch('/api/places/fetch-popular-times', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' })
});
```

### 3. Listar Lugares Salvos

**Endpoint:** `GET /api/places`

Retorna todos os lugares salvos no banco de dados.

### 4. Buscar Horários de um Lugar

**Endpoint:** `GET /api/places/:placeId/popular-times`

Retorna horários de funcionamento de um lugar específico.

## Estrutura de Dados

### Tabela `places`

```typescript
{
  id: string;
  placeId: string;              // Google Place ID
  name: string;
  formattedAddress: string;
  latitude: string | null;
  longitude: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  isOpen: boolean | null;
  types: string[];              // Tipos do Google (ex: 'bar', 'night_club')
  regularOpeningHours: object;  // Horários de funcionamento
  createdAt: Date;
  updatedAt: Date;
}
```

### Horários de Funcionamento (regularOpeningHours)

```json
{
  "openNow": true,
  "weekdayDescriptions": [
    "Monday: 6:00 PM – 2:00 AM",
    "Tuesday: 6:00 PM – 2:00 AM",
    "..."
  ]
}
```

## Página PopularTimes

Foi criada uma página em `client/src/pages/PopularTimes.tsx` que permite:

1. **Buscar Bares**: Busca todos os bares em Santos
2. **Buscar Baladas**: Busca todas as baladas em Santos
3. **Exibir Informações**: Mostra nome, endereço, avaliações e horários
4. **Atualizar Dados**: Botão para atualizar horários de cada lugar

## Configuração Necessária

### Variáveis de Ambiente

Adicione a chave da API do Google Maps no arquivo `.env`:

```env
VITE_GOOGLE_MAPS_API_KEY=sua_chave_api_aqui
```

### Obter Chave da API

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Places API (New)**
4. Crie credenciais e obtenha a chave da API
5. Configure as restrições de API conforme necessário

### APIs Necessárias

- **Places API (New)**: Para buscar lugares e informações
- **Maps JavaScript API**: Para exibir mapas (já utilizado)

## Consumo de Dados

### Custo da API

A Google Places API cobra por:
- **Request de busca**: ~$0.017 por requisição
- **Request de detalhes**: ~$0.017 por requisição

**Dicas para economizar:**
- Cache os resultados no banco de dados (já implementado)
- Use paginação para limitar resultados
- Atualize dados apenas quando necessário

### Limites de Quota

- **Dia**: 60.000 requisições (cota gratuita: 1.000/dia)
- **Minuto**: 1.200 requisições
- **Segundo**: 50 requisições

## Fluxo de Uso

1. **Usuário acessa a página** `/popular-times`
2. **Clica em "Buscar Bares em Santos"** ou similar
3. **Sistema busca** lugares via Google Places API
4. **Salva no banco** de dados automaticamente
5. **Exibe resultados** com informações completas
6. **Usuário pode atualizar** horários individualmente

## Melhorias Futuras

- [ ] Cache mais inteligente (atualizar apenas dados antigos)
- [ ] Notificações quando horários mudam
- [ ] Integração com heatmap do mapa
- [ ] Análise de horários mais movimentados
- [ ] Comparação entre lugares
- [ ] Exportação de dados

## Exemplo de Resposta da API

```json
{
  "places": [
    {
      "id": "uuid",
      "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Bar do João",
      "formattedAddress": "Av. Ana Costa, 123, Santos - SP",
      "rating": 4.5,
      "userRatingsTotal": 127,
      "regularOpeningHours": {
        "weekdayDescriptions": [
          "Monday: 6:00 PM – 2:00 AM",
          "Tuesday: 6:00 PM – 2:00 AM",
          "..."
        ]
      }
    }
  ],
  "nextPageToken": "token_pagination"
}
```

## Troubleshooting

### Erro: "Google Maps API key not configured"
- Verifique se `VITE_GOOGLE_MAPS_API_KEY` está definida
- Reinicie o servidor após adicionar a variável

### Erro: "INVALID_REQUEST"
- Verifique se a Places API (New) está ativada
- Confirme que a chave tem permissão para a API

### Dados não aparecem
- Verifique a conexão com o banco de dados
- Confirme que a tabela `places` foi criada (execute `npm run db:push`)

## Suporte

Para mais informações sobre a API, consulte:
- [Google Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Places API (New)](https://developers.google.com/maps/documentation/places/web-service-new)
