# 🐛 Debug - Mapa de Calor "Carregando lugares..."

## ❌ PROBLEMA

O mapa fica travado em "Carregando lugares..." e não mostra os dados.

## 🔍 O QUE FOI FEITO

### **1. Adicionado Debug Logs**

Agora o código tem logs detalhados no console:

```typescript
console.log('[MapaCalor] Iniciando busca automática de lugares');
console.log('[MapaCalor] Buscando lugares do tipo:', type);
console.log('[MapaCalor] Response status:', response.status);
console.log('[MapaCalor] Dados recebidos:', data);
console.log('[MapaCalor] Places atualizados:', places?.length);
```

### **2. Adicionado Autenticação**

A requisição agora envia o token do Firebase:

```typescript
headers: { 
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
}
```

### **3. Melhor Tratamento de Erros**

```typescript
onError: (error) => {
  console.error('[MapaCalor] Erro na mutation:', error);
  toast({
    title: "Erro ao carregar lugares",
    description: error.message,
    variant: "destructive",
  });
}
```

---

## 🧪 COMO DEBUGAR

### **1. Abrir Console do Navegador**

1. Acesse: https://eventu-1b077.web.app
2. Pressione **F12**
3. Vá na aba **Console**

### **2. Ver os Logs**

Você verá mensagens como:

```
[MapaCalor] Iniciando busca automática de lugares
[MapaCalor] Buscando lugares do tipo: bars
[MapaCalor] Response status: 200
[MapaCalor] Dados recebidos: {places: Array(50), count: 50}
[MapaCalor] Places atualizados: 50 lugares
```

### **3. Identificar Erros**

Se houver erro, você verá:

```
[MapaCalor] Erro na resposta: Unauthorized
[MapaCalor] Erro ao buscar lugares: Failed to search places: 401
```

---

## 🔧 POSSÍVEIS CAUSAS E SOLUÇÕES

### **Causa 1: Não está logado**

**Sintoma:**
```
Error: 401 Unauthorized
```

**Solução:**
1. Faça logout
2. Faça login novamente
3. Recarregue a página

---

### **Causa 2: Backend não está rodando**

**Sintoma:**
```
Error: Failed to fetch
Error: Network error
```

**Solução:**

O site no Firebase Hosting só tem o frontend!
O backend precisa estar rodando localmente ou em outro servidor.

**Para rodar localmente:**
```powershell
npm run dev
```

Ou você precisa fazer deploy do backend também.

---

### **Causa 3: Google Places API não habilitada**

**Sintoma:**
```
Error: 403 Forbidden
Error: API key not valid
```

**Solução:**
1. Habilite Places API (New)
2. Configure domínios na API Key
3. Aguarde 10 minutos

---

### **Causa 4: Banco de dados vazio**

**Sintoma:**
```
[MapaCalor] Places atualizados: 0 lugares
```

**Solução:**

O backend está tentando buscar do Google, mas pode estar falhando.

**Teste manual:**
```bash
# No Postman ou curl
POST https://eventu-1b077.web.app/api/places/search-santos
Headers:
  Content-Type: application/json
  Authorization: Bearer SEU_TOKEN
Body:
  {
    "locationType": "bars",
    "maxResults": 50
  }
```

---

## 🚀 SOLUÇÃO TEMPORÁRIA

Se o backend não estiver funcionando, você pode:

### **Opção 1: Rodar Backend Localmente**

```powershell
# Terminal 1: Backend
npm run dev

# Terminal 2: Acessar
# http://localhost:5000
```

### **Opção 2: Adicionar Dados Manualmente**

Acesse `/places` e clique em "Atualizar Lugares"

---

## 📊 CHECKLIST DE DEBUG

- [ ] Console aberto (F12)
- [ ] Vejo logs `[MapaCalor]`?
- [ ] Qual é o erro que aparece?
- [ ] Status da requisição (200, 401, 403, 500)?
- [ ] Backend está rodando?
- [ ] Estou logado no Firebase Auth?
- [ ] Google Places API está habilitada?

---

## 🎯 PRÓXIMOS PASSOS

1. **Abra o console** (F12)
2. **Recarregue a página**
3. **Me envie os logs** que aparecem
4. Com os logs, posso identificar o problema exato

---

**Abra o console e me diga o que aparece!** 🔍

