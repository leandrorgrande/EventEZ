# 🐙 Como Subir o EventEz para o GitHub

## 📂 LOCALIZAÇÃO DOS ARQUIVOS

**Pasta do projeto:**
```
C:\Users\User\Downloads\EventEz\EventEz\
```

**Repositório Git local:**
```
C:\Users\User\Downloads\EventEz\EventEz\.git\
```

Você já tem **16 commits** prontos para enviar!

---

## 🚀 PASSO A PASSO

### **1. Criar Repositório no GitHub**

1. Acesse: **https://github.com/new**

2. Preencha:
   - **Repository name:** `EventEz`
   - **Description:** `App para descobrir bares e eventos em Santos com mapa de calor`
   - **Visibilidade:** Private (recomendado)
   - **NÃO** marque "Add a README file"
   - **NÃO** marque "Add .gitignore"
   - **NÃO** escolha license

3. Clique em **"Create repository"**

---

### **2. Copiar URL do Repositório**

Após criar, você verá uma página com comandos.

Copie a **URL HTTPS** que aparece:
```
https://github.com/SEU_USUARIO/EventEz.git
```

**Exemplo:**
```
https://github.com/joaosilva/EventEz.git
```

---

### **3. Abrir PowerShell na Pasta do Projeto**

**Opção A: Via Explorador de Arquivos**
1. Abra o Explorador de Arquivos
2. Navegue até: `C:\Users\User\Downloads\EventEz\EventEz\`
3. Na barra de endereço, digite: `powershell`
4. Pressione Enter

**Opção B: Via PowerShell**
```powershell
cd C:\Users\User\Downloads\EventEz\EventEz
```

---

### **4. Conectar ao GitHub**

Execute (substitua `SEU_USUARIO` pelo seu username do GitHub):

```powershell
git remote add origin https://github.com/SEU_USUARIO/EventEz.git
```

**Exemplo:**
```powershell
git remote add origin https://github.com/joaosilva/EventEz.git
```

**Verificar se foi adicionado:**
```powershell
git remote -v
```

Deve mostrar:
```
origin  https://github.com/SEU_USUARIO/EventEz.git (fetch)
origin  https://github.com/SEU_USUARIO/EventEz.git (push)
```

---

### **5. Autenticar no GitHub**

#### **Opção A: GitHub CLI (Mais Fácil)**

**Instalar:**
```powershell
winget install GitHub.cli
```

**Fazer login:**
```powershell
gh auth login
```

Siga as instruções:
- Selecione: **GitHub.com**
- Selecione: **HTTPS**
- Selecione: **Yes** (authenticate Git)
- Selecione: **Login with a web browser**
- Copie o código que aparece
- Pressione Enter
- Cole o código no navegador
- Autorize

#### **Opção B: Personal Access Token**

1. Crie um token: **https://github.com/settings/tokens**
2. Clique em **"Generate new token (classic)"**
3. Dê um nome: `EventEz Deploy`
4. Marque: ☑️ **repo** (Full control of private repositories)
5. Clique em **"Generate token"**
6. **COPIE O TOKEN** (você não verá ele novamente!)

Quando fizer `git push`, use:
- **Username:** seu username do GitHub
- **Password:** **cole o token** (não sua senha)

---

### **6. Fazer Push dos Commits**

```powershell
git push -u origin main
```

Se der erro dizendo que a branch é `master` e não `main`:
```powershell
git branch -M main
git push -u origin main
```

---

### **7. Verificar no GitHub**

1. Acesse: `https://github.com/SEU_USUARIO/EventEz`
2. Você deve ver:
   - ✅ Todos os arquivos
   - ✅ 16 commits
   - ✅ Última atualização: agora

---

## 📊 COMMITS QUE SERÃO ENVIADOS

Você tem **16 commits** para enviar:

```
c6708ed - feat: Adiciona botões de busca e evita duplicatas (MAIS RECENTE)
54b14a3 - feat: Melhora interface admin
6f005c7 - fix: Corrige JSON firestore.indexes
70e6377 - feat: Interface admin para popular times
6cb6bda - docs: Guia correção popularTimes
b5ca2b9 - fix: Adiciona popularTimes padrão
3aaa163 - fix: Logs detalhados
714d87f - fix: Permissões Firestore
afa7769 - fix: Firebase Functions v2
fd67a37 - docs: Guias
790b9ee - fix: Debug
a766ccd - feat: Melhora mapa de calor
777f985 - feat: Mapa de calor interativo
b13825c - feat: Integração Firebase
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

### **Erro: "Updates were rejected"**

```powershell
# Forçar push (apenas na primeira vez)
git push -u origin main --force
```

---

## 📝 DEPOIS DE CONFIGURAR

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

## 🎯 RESUMO RÁPIDO

```powershell
# 1. Criar repositório no GitHub (https://github.com/new)

# 2. Conectar
git remote add origin https://github.com/SEU_USUARIO/EventEz.git

# 3. Autenticar
gh auth login

# 4. Push
git push -u origin main
```

---

## 🎉 BENEFÍCIOS

Depois de configurar o GitHub:

- ✅ **Backup** do código na nuvem
- ✅ **Histórico** completo de alterações
- ✅ **Colaboração** (adicionar outros devs)
- ✅ **Versionamento** profissional
- ✅ **CI/CD** (automação futura)
- ✅ **Portfolio** (se público)

---

## 📞 PRECISA DE AJUDA?

Se tiver algum erro, me envie:
1. O comando que executou
2. A mensagem de erro completa
3. Print da tela (se possível)

---

**Boa sorte! 🚀**

