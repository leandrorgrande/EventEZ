# Como Acessar e Visualizar o Banco de Dados

## 🎯 Métodos para Visualizar Tabelas e Dados

### 1. **API Admin (Novo)** ⭐ Recomendado

Endpoints criados para visualizar dados via API:

#### Listar Todas as Tabelas
```bash
GET /api/admin/tables
```
**Resposta:**
```json
{
  "tables": [
    "users", "events", "locations", "places", 
    "event_attendees", "checkins", "messages",
    "heatmap_data", "business_claims", "claims",
    "owners", "support_tickets", "profiles"
  ]
}
```

#### Visualizar Dados de uma Tabela
```bash
GET /api/admin/tables/:tableName?limit=100&offset=0
```

**Exemplo:**
```bash
# Ver usuários
GET /api/admin/tables/users

# Ver eventos
GET /api/admin/tables/events

# Ver lugares (places)
GET /api/admin/tables/places
```

**Resposta:**
```json
{
  "table": "users",
  "data": [...],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 50
  }
}
```

#### Estatísticas Gerais
```bash
GET /api/admin/stats
```
**Resposta:**
```json
{
  "users": 10,
  "events": 25,
  "locations": 15,
  "places": 50,
  "eventAttendees": 80,
  "checkins": 150,
  "messages": 45,
  "heatmapData": 200,
  "businessClaims": 3
}
```

⚠️ **Requisito**: Você precisa ser admin para acessar essas rotas.

### 2. **Neon Console** (Web Interface)

Acesse o painel web do Neon:

1. **Acesse**: [console.neon.tech](https://console.neon.tech)
2. **Faça login** com sua conta
3. **Selecione o projeto**
4. **Vá em "SQL Editor"**
5. **Execute queries SQL**

**Exemplos de Queries:**

```sql
-- Ver todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Ver todos os usuários
SELECT * FROM users;

-- Ver todos os eventos
SELECT * FROM events;

-- Ver lugares do Google Places
SELECT * FROM places;

-- Contar registros
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM events) as events,
  (SELECT COUNT(*) FROM places) as places;
```

### 3. **DBeaver** (Desktop App) ⭐ Melhor UX

DBeaver é um cliente SQL grátis e poderoso:

1. **Download**: [dbeaver.io](https://dbeaver.io)
2. **Instalar**
3. **Criar Nova Conexão** → PostgreSQL
4. **Configurar:**
   - Host: `ep-xxx.us-east-2.aws.neon.tech`
   - Port: `5432`
   - Database: `neondb`
   - Username: `username`
   - Password: `password`
   - SSL: habilitado
5. **Conectar**
6. **Navegar** pelas tabelas na sidebar

### 4. **pgAdmin** (Alternativa)

Similar ao DBeaver:

1. **Download**: [pgadmin.org](https://www.pgadmin.org)
2. **Instalar**
3. **Adicionar servidor**
4. **Configurar conexão** com DATABASE_URL do Neon

### 5. **Via Terminal** (psql)

Se tiver PostgreSQL instalado:

```bash
# Conectar
psql "postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require"

# Listar tabelas
\dt

# Ver dados
SELECT * FROM users;

# Sair
\q
```

### 6. **TablePlus** (Mac/Windows)

Interface moderna e elegante:

1. **Download**: [tableplus.com](https://tableplus.com)
2. **Adicionar conexão PostgreSQL**
3. **Configurar com DATABASE_URL**
4. **Visualizar tabelas**

## 🔐 Como Obter Suas Credenciais

### No Replit:

1. Vá em **Secrets** (ícone de cadeado)
2. Procure por `DATABASE_URL`
3. Copie a URL completa

Exemplo:
```
postgresql://user:password@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### No Neon Console:

1. Acesse [console.neon.tech](https://console.neon.tech)
2. Selecione seu projeto
3. Vá em **Connection Details**
4. Copie a **Connection String**

## 📊 Query SQL Úteis

### Ver Dados Específicos

```sql
-- Últimos usuários criados
SELECT * FROM users 
ORDER BY created_at DESC 
LIMIT 10;

-- Eventos ativos
SELECT * FROM events 
WHERE is_active = true;

-- Lugares em Santos (aproximado)
SELECT * FROM places 
WHERE latitude BETWEEN -24 AND -23 
AND longitude BETWEEN -47 AND -46;

-- Ver horários populares dos bares
SELECT name, regular_opening_hours 
FROM places 
WHERE types @> ARRAY['bar'];

-- Estatísticas por tipo de evento
SELECT event_type, COUNT(*) as total
FROM events 
GROUP BY event_type;
```

### Exportar Dados

```sql
-- Exportar para CSV (no DBeaver)
-- Clicar com botão direito na tabela → Export Data

-- Exportar via psql
\copy users TO 'users.csv' CSV HEADER;
```

## 🎨 Interface Visual (Recomendado)

Para a melhor experiência, recomendo:

1. **DBeaver** - Grátis, open-source, poderoso
2. **TablePlus** - Pagamento, mas lindo
3. **Neon Console** - Web, sempre disponível

## 🚀 Quick Start

### Opção 1: Neon Console (Mais Rápido)
1. Acesse: https://console.neon.tech
2. Login
3. SQL Editor
4. Digite: `SELECT * FROM users;`
5. Execute

### Opção 2: DBeaver (Melhor UX)
1. Instale DBeaver
2. Crie conexão PostgreSQL
3. Cole DATABASE_URL
4. Explore as tabelas

### Opção 3: API Admin (Programático)
1. Certifique-se de ser admin
2. Acesse: `/api/admin/tables`
3. Veja JSON com dados

## 📝 Exemplos Práticos

### Ver Horários Populares dos Bares

```sql
SELECT 
  name, 
  formatted_address,
  rating,
  regular_opening_hours
FROM places
WHERE types @> ARRAY['bar'];
```

### Ver Eventos do Próximo Fim de Semana

```sql
SELECT * FROM events
WHERE start_date_time BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY start_date_time;
```

### Ver Check-ins Recentes

```sql
SELECT * FROM checkins
ORDER BY created_at DESC
LIMIT 50;
```

## 🔍 Troubleshooting

### Erro: "connection refused"
- Verifique se DATABASE_URL está correta
- Confirme que o banco está ativo no Neon

### Erro: "SSL required"
- Adicione `?sslmode=require` na URL
- No DBeaver, habilite SSL

### Erro: "permission denied"
- Verifique usuário e senha
- Confirme que o usuário tem permissão de leitura

## 📚 Ferramentas Recomendadas

| Ferramenta | Plataforma | Grátis | Dificuldade |
|------------|-----------|--------|-------------|
| **DBeaver** | Win/Mac/Linux | ✅ | ⭐ Fácil |
| **TablePlus** | Mac/Win | ⚠️ Pago | ⭐ Fácil |
| **Neon Console** | Web | ✅ | ⭐ Fácil |
| **pgAdmin** | Win/Mac/Linux | ✅ | ⭐⭐ Média |
| **psql** | Terminal | ✅ | ⭐⭐⭐ Avançado |

## ✅ Recomendação Final

Para **começar rápido**: Use **Neon Console**  
Para **melhor experiência**: Use **DBeaver**  
Para **API programática**: Use **/api/admin/tables**
