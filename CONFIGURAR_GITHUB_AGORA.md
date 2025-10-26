# 🐙 Configurar GitHub - Passo a Passo

## ✅ DEPLOY FEITO!

O site já está no ar:
**https://eventu-1b077.web.app**

Agora vamos configurar o GitHub para ter backup do código.

---

## 📋 PASSO A PASSO

### **1. Criar Repositório no GitHub** (2 minutos)

1. Acesse: **https://github.com/new**

2. Preencha:
   - **Repository name:** `EventEz` ou `eventu-app`
   - **Description:** `App para descobrir bares e eventos em Santos com mapa de calor`
   - **Visibilidade:** 
     - ☑️ **Private** (recomendado - só você vê)
     - ⬜ Public (qualquer um vê)
   - **NÃO** marque "Add a README file"
   - **NÃO** marque "Add .gitignore"
   - **NÃO** escolha license

3. Clique em **"Create repository"**

---

### **2. Copiar URL do Repositório**

Após criar, o GitHub mostrará uma página com comandos.

Copie a **URL HTTPS** que aparece no topo:
```
https://github.com/SEU_USUARIO/EventEz.git
```

**Exemplo:**
```
https://github.com/joaosilva/EventEz.git
```

---

### **3. Conectar Repositório Local**

No PowerShell, execute (substitua a URL pela sua):

```powershell
# Adicionar remote
git remote add origin https://github.com/SEU_USUARIO/EventEz.git

# Verificar se foi adicionado
git remote -v
```

**Você deve ver:**
```
origin  https://github.com/SEU_USUARIO/EventEz.git (fetch)
origin  https://github.com/SEU_USUARIO/EventEz.git (push)
```

---

### **4. Fazer Push dos Commits**

```powershell
# Enviar todos os commits para o GitHub
git push -u origin main
```

**O GitHub pedirá autenticação!**

---

### **5. Autenticação**

#### **Opção A: GitHub CLI (Mais Fácil)**

```powershell
# Instalar GitHub CLI
winget install GitHub.cli

# Fazer login
gh auth login

# Selecione:
# - GitHub.com
# - HTTPS
# - Yes (authenticate Git)
# - Login with a web browser

# Depois faça o push
git push -u origin main
```

#### **Opção B: Personal Access Token**

1. Crie um token: https://github.com/settings/tokens
2. Clique em **"Generate new token (classic)"**
3. Dê um nome: `EventEz Deploy`
4. Marque: ☑️ **repo** (Full control of private repositories)
5. Clique em **"Generate token"**
6. **COPIE O TOKEN** (você não verá ele novamente!)

Quando fizer `git push`, use:
- **Username:** seu username do GitHub
- **Password:** **cole o token** (não sua senha)

---

### **6. Verificar no GitHub**

1. Acesse: `https://github.com/SEU_USUARIO/EventEz`
2. Você deve ver:
   - ✅ Todos os arquivos
   - ✅ 6 commits
   - ✅ Última atualização: agora

---

## 🎯 COMMITS QUE SERÃO ENVIADOS

Você tem **6 commits** para enviar:

```
790b9ee - fix: Adiciona debug e autenticação (MAIS RECENTE)
a766ccd - feat: Melhora mapa de calor
777f985 - feat: Adiciona mapa de calor interativo
b13825c - feat: Integração Firebase e Google Places
ec8e025 - Add interactive map markers
5105a4a - Add interactive map markers (MAIS ANTIGO)
```

---

## 🔧 TROUBLESHOOTING

### **Erro: "remote origin already exists"**

```powershell
# Remover o remote antigo
git remote remove origin

# Adicionar novamente
git remote add origin https://github.com/SEU_USUARIO/EventEz.git
```

### **Erro: "Authentication failed"**

- Use GitHub CLI (`gh auth login`)
- Ou crie um Personal Access Token

### **Erro: "Permission denied"**

- Verifique se o repositório é seu
- Verifique se o token tem permissão `repo`

---

## 📊 DEPOIS DE CONFIGURAR

### **Comandos Úteis:**

```powershell
# Ver status
git status

# Ver commits
git log --oneline

# Ver remotes
git remote -v

# Fazer push de novos commits
git push
```

### **Workflow Normal:**

```powershell
# 1. Fazer alterações no código
# 2. Adicionar ao git
git add .

# 3. Fazer commit
git commit -m "feat: Nova funcionalidade"

# 4. Enviar para GitHub
git push

# 5. Deploy no Firebase
firebase deploy --only hosting
```

---

## 🎉 BENEFÍCIOS

Depois de configurar o GitHub:

- ✅ **Backup** do código na nuvem
- ✅ **Histórico** completo de alterações
- ✅ **Colaboração** (adicionar outros devs)
- ✅ **Versionamento** profissional
- ✅ **CI/CD** (automação futura)

---

## 📝 RESUMO

1. ✅ Deploy feito: https://eventu-1b077.web.app
2. ⏳ Criar repositório no GitHub
3. ⏳ Conectar: `git remote add origin URL`
4. ⏳ Autenticar: `gh auth login`
5. ⏳ Push: `git push -u origin main`
6. ✅ Pronto!

---

**Me avise quando criar o repositório e eu te ajudo com os próximos passos!** 🚀

