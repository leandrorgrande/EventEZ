# Onde Está Hospedado o PostgreSQL - EventEz

## 🗄️ Hospedagem: Neon Serverless PostgreSQL

O banco de dados PostgreSQL está hospedado no **Neon Database**, uma plataforma serverless que oferece PostgreSQL gerenciado.

### O que é Neon?
- **Plataforma**: Neon Database (https://neon.tech)
- **Tipo**: PostgreSQL Serverless
- **Modelo**: Database-as-a-Service (DBaaS)
- **Região**: Cloud (provavelmente AWS ou similar)

### Por que Neon?

✅ **Vantagens:**
- **Serverless**: Paga apenas pelo que usa
- **Scalável**: Escala automaticamente
- **Free Tier Generoso**: 
  - 0.5 GB storage
  - Projeto compartilhado grátis
  - Ideal para desenvolvimento
- **Connection Pooling**: Gerenciado automaticamente
- **Branches**: Cria branches de banco como Git
- **PostgreSQL Nativo**: Suporta todas as features do PostgreSQL

### Como Funciona no Projeto

#### 1. **Configuração** (`server/db.ts`)
```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

// Configura WebSocket para servidor
neonConfig.webSocketConstructor = ws;

// Conecta usando DATABASE_URL
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
```

#### 2. **Variável de Ambiente**
```bash
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```

#### 3. **Biblioteca Usada**
```json
"@neondatabase/serverless": "^0.10.4"
```

### Onde Está a Conexão?

O Neon é acessado via:
- **URL de conexão**: Armazenada em `DATABASE_URL`
- **Tipo**: PostgreSQL
- **Protocolo**: WebSocket ou HTTPS
- **Localização**: Cloud (não local)

### Como Obter o DATABASE_URL?

#### No Replit:
1. **Criar banco no Replit**
   - O Replit pode provisionar um banco Neon automaticamente
   - Vá em "Secrets" e adicione `DATABASE_URL`

#### Manualmente:
1. **Criar conta no Neon** (https://neon.tech)
2. **Criar um projeto**
3. **Copiar a connection string**
4. **Adicionar como variável de ambiente**

### Exemplo de DATABASE_URL do Neon
```
postgresql://username:password@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Alternativas de Hospedagem PostgreSQL

Se você quiser migrar, opções gratuitas/baratas:

| Serviço | Free Tier | Custo Mensal | Dificuldade |
|---------|-----------|--------------|-------------|
| **Neon** (Atual) | ✅ 0.5GB | $0-19 | ⭐ Fácil |
| **Supabase** | ✅ 500MB | $0-25 | ⭐⭐ Média |
| **Railway** | ✅ $5 crédito | $0-20 | ⭐⭐⭐ Média |
| **Render** | ❌ | $7+ | ⭐⭐ Média |
| **ElephantSQL** | ✅ 20MB | $0-19 | ⭐ Fácil |
| **Vercel Postgres** | ✅ | $0 | ⭐⭐ Média |
| **AWS RDS** | ❌ | $15+ | ⭐⭐⭐⭐ Difícil |
| **Heroku Postgres** | ❌ | $5+ | ⭐⭐ Média |

### Melhores Alternativas Gratuitas

#### 1. **Supabase** ⭐ Recomendado
```typescript
// Similar ao Neon, mas com mais features
// Inclui: Auth, Storage, Realtime
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
```

**Vantagens:**
- PostgreSQL gerenciado
- Free tier: 500MB
- Supabase Auth (opcional)
- Realtime subscriptions
- Storage incluído

#### 2. **Railway**
```typescript
// Plataforma simples e rápida
DATABASE_URL=postgresql://postgres:[PASSWORD]@xxx.railway.app:5432/railway
```

**Vantagens:**
- $5 de crédito grátis/mês
- Deploy fácil
- Logs integrados
- Escala automaticamente

### Como Migrar para Outro Banco?

Se quiser trocar de Neon:

#### 1. Exportar Dados do Neon
```sql
pg_dump DATABASE_URL > backup.sql
```

#### 2. Configurar Novo Banco
```bash
# Criar banco em novo serviço
# Copiar DATABASE_URL
```

#### 3. Importar Dados
```sql
psql DATABASE_URL < backup.sql
```

#### 4. Atualizar Variáveis
```bash
# Atualizar DATABASE_URL no .env
# Reiniciar aplicação
```

### Verificar se Está Funcionando

```bash
# Verificar conexão
npm run dev

# Verificar banco
npm run db:push

# Se der erro de DATABASE_URL:
# Variável não está configurada
```

### Troubleshooting

#### Erro: "DATABASE_URL must be set"
**Solução:**
```bash
# No Replit: Vá em Secrets e adicione
DATABASE_URL=sua_url_aqui

# Localmente: Crie .env
DATABASE_URL=sua_url_aqui
```

#### Erro: "Connection refused"
**Causa:** Banco não existe ou URL incorreta
**Solução:** Verificar se banco foi criado no Neon

#### Erro: "SSL required"
**Causa:** URL não tem `?sslmode=require`
**Solução:** Adicionar `?sslmode=require` na URL

### Status Atual

✅ **PostgreSQL Hospedado em**: Neon Database  
✅ **Tipo**: Serverless  
✅ **Localização**: Cloud (região variável)  
✅ **Free Tier**: Sim (0.5GB)  
✅ **Configuração**: Via DATABASE_URL  
✅ **Status**: Funcional  

### Próximos Passos

1. **Verificar se DATABASE_URL está configurada**
   ```bash
   echo $DATABASE_URL
   ```

2. **Testar conexão**
   ```bash
   npm run db:push
   ```

3. **Se não tiver banco**: Criar no Neon ou Replit

### Documentação Útil

- [Neon Docs](https://neon.tech/docs)
- [Neon Console](https://console.neon.tech)
- [Drizzle + Neon](https://neon.tech/docs/integrations/drizzle)
