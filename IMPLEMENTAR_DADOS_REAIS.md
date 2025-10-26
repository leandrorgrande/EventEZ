# 🔥 Implementar Popularidade com Dados Reais

## 📊 SITUAÇÃO ATUAL

**Dados Simulados:**
- ✅ Funcionam para demonstração
- ✅ Padrões realistas (bares cheios à noite)
- ❌ Não refletem realidade
- ❌ Todos os bares têm o mesmo padrão

---

## 🎯 OPÇÕES PARA DADOS REAIS

### **OPÇÃO 1: Check-ins dos Usuários (Recomendado)**

#### **Como Funciona:**
1. Usuários fazem check-in no local
2. Sistema conta check-ins por hora/dia
3. Calcula popularidade baseada em:
   - Número de check-ins
   - Horário do check-in
   - Histórico de 30 dias

#### **Vantagens:**
- ✅ Dados reais dos seus usuários
- ✅ Dentro dos Termos de Serviço
- ✅ Você controla os dados
- ✅ Pode gamificar (pontos, badges)

#### **Desvantagens:**
- ❌ Precisa de base de usuários
- ❌ Dados iniciais vazios
- ❌ Depende de engajamento

---

### **OPÇÃO 2: Integração com Estabelecimentos**

#### **Como Funciona:**
1. Parceria com bares/baladas
2. Eles fornecem dados via:
   - API própria
   - Sistema de reservas
   - Contagem de pessoas

#### **Vantagens:**
- ✅ Dados muito precisos
- ✅ Tempo real
- ✅ Confiável

#### **Desvantagens:**
- ❌ Precisa de parcerias
- ❌ Cada local é diferente
- ❌ Pode ter custo

---

### **OPÇÃO 3: Scraping Google Maps (NÃO Recomendado)**

#### **Como Funciona:**
1. Usar biblioteca `populartimes` (Python)
2. Fazer scraping do Google Maps
3. Extrair dados de popularidade

#### **Vantagens:**
- ✅ Dados do Google
- ✅ Cobertura ampla

#### **Desvantagens:**
- ❌ **VIOLA Termos de Serviço**
- ❌ Pode bloquear sua API Key
- ❌ Dados não confiáveis
- ❌ Pode parar de funcionar
- ❌ **NÃO RECOMENDADO**

---

### **OPÇÃO 4: Híbrido (Melhor Solução)**

#### **Como Funciona:**
1. **Início:** Dados simulados (como agora)
2. **Crescimento:** Check-ins dos usuários
3. **Maduro:** Dados reais + parcerias

#### **Implementação:**
```typescript
const calculatePopularity = (place, day, hour) => {
  // 1. Buscar check-ins reais
  const realCheckins = getCheckinsCount(place.id, day, hour);
  
  // 2. Se tem dados reais suficientes (> 10 check-ins)
  if (realCheckins > 10) {
    return calculateFromCheckins(realCheckins);
  }
  
  // 3. Senão, usar dados simulados
  return place.popularTimes[day][hour];
};
```

---

## 🚀 IMPLEMENTAÇÃO: Sistema de Check-ins

### **1. Schema do Firestore**

```typescript
// Coleção: checkins
{
  id: string;
  userId: string;
  placeId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  timestamp: Timestamp;
  dayOfWeek: string; // "monday", "tuesday", ...
  hour: number; // 0-23
  isAnonymous: boolean;
}

// Coleção: placeStats (agregado)
{
  placeId: string;
  popularTimes: {
    monday: [10, 15, 20, ...], // Calculado dos check-ins
    tuesday: [12, 18, 25, ...],
    // ...
  },
  totalCheckins: number;
  lastUpdated: Timestamp;
}
```

### **2. Backend: Endpoint de Check-in**

```typescript
// functions/src/index.ts

app.post('/checkin', authenticate, async (req, res) => {
  try {
    const { placeId, latitude, longitude } = req.body;
    const userId = req.user.uid;
    
    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const hour = now.getHours();
    
    // Buscar dados do lugar
    const placeQuery = await db.collection('places')
      .where('placeId', '==', placeId)
      .get();
    
    if (placeQuery.empty) {
      return res.status(404).json({ message: "Place not found" });
    }
    
    const place = placeQuery.docs[0];
    
    // Criar check-in
    const checkin = {
      userId,
      placeId,
      placeName: place.data().name,
      latitude,
      longitude,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      dayOfWeek,
      hour,
      isAnonymous: false
    };
    
    await db.collection('checkins').add(checkin);
    
    // Atualizar estatísticas do lugar (em background)
    updatePlaceStats(placeId);
    
    res.json({ 
      message: "Check-in realizado com sucesso",
      points: 10 // Gamificação
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to check-in" });
  }
});

// Função para atualizar estatísticas
async function updatePlaceStats(placeId: string) {
  // Buscar todos os check-ins dos últimos 30 dias
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const checkinsSnapshot = await db.collection('checkins')
    .where('placeId', '==', placeId)
    .where('timestamp', '>=', thirtyDaysAgo)
    .get();
  
  // Calcular popularidade por dia/hora
  const stats: any = {
    monday: Array(24).fill(0),
    tuesday: Array(24).fill(0),
    wednesday: Array(24).fill(0),
    thursday: Array(24).fill(0),
    friday: Array(24).fill(0),
    saturday: Array(24).fill(0),
    sunday: Array(24).fill(0)
  };
  
  checkinsSnapshot.forEach(doc => {
    const data = doc.data();
    stats[data.dayOfWeek][data.hour]++;
  });
  
  // Normalizar para 0-100
  const maxCheckins = Math.max(...Object.values(stats).flat());
  Object.keys(stats).forEach(day => {
    stats[day] = stats[day].map((count: number) => 
      Math.round((count / maxCheckins) * 100)
    );
  });
  
  // Salvar no Firestore
  await db.collection('placeStats').doc(placeId).set({
    placeId,
    popularTimes: stats,
    totalCheckins: checkinsSnapshot.size,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

### **3. Frontend: Botão de Check-in**

```tsx
// client/src/components/CheckinButton.tsx

export function CheckinButton({ place }: { place: Place }) {
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();
  
  const handleCheckin = async () => {
    setIsChecking(true);
    
    try {
      // Pegar localização do usuário
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      
      const response = await fetch('https://api-xxx.cloudfunctions.net/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          placeId: place.placeId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Check-in realizado!",
          description: `+${data.points} pontos 🎉`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao fazer check-in",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  return (
    <Button 
      onClick={handleCheckin}
      disabled={isChecking}
      className="w-full"
    >
      {isChecking ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Fazendo check-in...
        </>
      ) : (
        <>
          <MapPin className="mr-2 h-4 w-4" />
          Fazer Check-in
        </>
      )}
    </Button>
  );
}
```

### **4. Frontend: Usar Dados Reais**

```typescript
// client/src/pages/MapaCalor.tsx

// Buscar estatísticas reais se disponíveis
const { data: placeStats } = useQuery({
  queryKey: [`/api/places/${place.id}/stats`],
  queryFn: async () => {
    const response = await fetch(`${API_URL}/places/${place.placeId}/stats`);
    if (!response.ok) return null;
    return response.json();
  }
});

// Usar dados reais se disponíveis, senão usar simulados
const popularTimes = placeStats?.popularTimes || place.popularTimes;
const popularity = popularTimes[selectedDay][selectedHour];
```

---

## 📊 ESTRATÉGIA DE TRANSIÇÃO

### **Fase 1: MVP (Atual)**
- ✅ Dados simulados
- ✅ Interface funcionando
- ✅ Demonstração do conceito

### **Fase 2: Check-ins Básicos**
- Implementar botão de check-in
- Coletar dados dos usuários
- Manter dados simulados como fallback

### **Fase 3: Dados Híbridos**
- Usar dados reais onde houver check-ins
- Dados simulados para lugares novos
- Indicador visual (real vs simulado)

### **Fase 4: Gamificação**
- Pontos por check-in
- Badges (frequentador, explorador)
- Ranking de usuários
- Descontos/benefícios

### **Fase 5: Parcerias**
- Integração com estabelecimentos
- Dados em tempo real
- Eventos ao vivo

---

## 💰 CUSTO vs BENEFÍCIO

### **Dados Simulados (Atual)**
- 💰 Custo: $0
- ⏱️ Tempo: 0h (já implementado)
- 📊 Precisão: 30%
- 👥 Engajamento: Baixo

### **Check-ins + Dados Reais**
- 💰 Custo: ~$10-50/mês (Firestore)
- ⏱️ Tempo: 8-16h desenvolvimento
- 📊 Precisão: 80-90%
- 👥 Engajamento: Alto

### **Scraping (NÃO Recomendado)**
- 💰 Custo: $0-100/mês
- ⏱️ Tempo: 4-8h
- 📊 Precisão: 70%
- ⚠️ Risco: **ALTO** (viola ToS)

---

## 🎯 RECOMENDAÇÃO

**Para o EventU, recomendo:**

1. **Curto Prazo (1-2 semanas):**
   - Manter dados simulados
   - Adicionar disclaimer: "Dados estimados"
   - Focar em outras features

2. **Médio Prazo (1-2 meses):**
   - Implementar sistema de check-ins
   - Gamificar (pontos, badges)
   - Coletar dados reais

3. **Longo Prazo (3-6 meses):**
   - Híbrido (real + simulado)
   - Parcerias com estabelecimentos
   - Dados em tempo real

---

## 📝 RESUMO

**Pergunta:** "Como está buscando o quanto está cheio?"

**Resposta:** 
- 🔴 **Atualmente:** Dados **simulados** gerados pelo backend
- 🟡 **Padrões:** Baseados em comportamento típico (bares cheios à noite)
- 🟢 **Futuro:** Check-ins dos usuários + parcerias

**Dados estão no Firestore:**
```
places/{placeId}/popularTimes
```

**Quer implementar check-ins reais agora?** 🚀

