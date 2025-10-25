# 🔑 Adicionar Domínios na API Key - Passo a Passo com Imagens

## 📍 Onde Adicionar os Domínios

### **Passo 1: Acessar Credenciais**

1. Acesse: https://console.cloud.google.com/apis/credentials?project=eventu-1b077

2. Você verá uma lista de credenciais. Procure por:
   - **"API key"** ou
   - **"Browser key"** ou
   - Algo com o nome que você deu

3. A chave será algo como: `AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg`

### **Passo 2: Editar a API Key**

1. Clique no **nome da chave** (não no ícone de copiar)
   - Ou clique nos **3 pontinhos** ⋮ e depois em **"Editar chave de API"**

2. Você será levado para a página de edição

### **Passo 3: Configurar Restrições de Aplicativo**

Na página de edição, você verá:

```
┌─────────────────────────────────────────────┐
│ Restrições de aplicativo                    │
├─────────────────────────────────────────────┤
│ ○ Nenhuma                                   │
│ ○ Endereços IP (servidores web, tarefas    │
│   cron, etc.)                               │
│ ● Referenciadores HTTP (sites)             │ ← SELECIONE ESTA
│ ○ Aplicativos Android                       │
│ ○ Aplicativos iOS                           │
└─────────────────────────────────────────────┘
```

1. Selecione: **● Referenciadores HTTP (sites)**

2. Aparecerá um campo de texto. Cole estes domínios (um por linha):

```
https://eventu-1b077.web.app/*
https://eventu-1b077.firebaseapp.com/*
http://localhost:*
http://127.0.0.1:*
```

### **Passo 4: Configurar Restrições de API**

Role para baixo até:

```
┌─────────────────────────────────────────────┐
│ Restrições de API                           │
├─────────────────────────────────────────────┤
│ ○ Não restringir a chave                   │
│ ● Restringir chave                         │ ← SELECIONE ESTA
└─────────────────────────────────────────────┘
```

1. Selecione: **● Restringir chave**

2. Marque estas APIs:
   - ☑️ **Maps JavaScript API**
   - ☑️ **Places API (New)**
   - ☑️ **Geocoding API**

### **Passo 5: Salvar**

1. Role até o final da página
2. Clique em **"SALVAR"**
3. Aguarde a mensagem de confirmação

---

## ⏱️ Aguardar Propagação

Após salvar, aguarde **5-10 minutos** para que as mudanças sejam aplicadas.

---

## 🧪 Testar se Funcionou

Após 10 minutos:

1. Acesse: https://eventu-1b077.web.app
2. Abra o Console do navegador (F12)
3. Veja se há erros relacionados ao Google Maps
4. O mapa deve aparecer!

---

## 🆘 Se Não Encontrar a API Key

Se você não encontrar nenhuma API key na lista:

### **Criar Nova API Key**

1. Na página de Credenciais, clique em **"+ CRIAR CREDENCIAIS"**
2. Selecione **"Chave de API"**
3. Uma nova chave será criada
4. Clique em **"RESTRINGIR CHAVE"**
5. Siga os passos 3, 4 e 5 acima
6. **IMPORTANTE:** Copie a nova chave e me envie para atualizar no código

---

## 📸 Referência Visual

A página deve parecer com isso:

```
Google Cloud Console
├── APIs e serviços
│   ├── Credenciais  ← VOCÊ ESTÁ AQUI
│   │   ├── Chaves de API
│   │   │   └── [Sua chave]  ← CLIQUE AQUI
│   │   │       ├── Restrições de aplicativo
│   │   │       │   └── ● Referenciadores HTTP
│   │   │       │       └── [Campo de texto para domínios]
│   │   │       └── Restrições de API
│   │   │           └── ● Restringir chave
│   │   │               └── [Lista de APIs]
```

---

**Me avise quando conseguir adicionar os domínios!** 🚀

