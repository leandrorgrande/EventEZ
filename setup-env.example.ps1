# Script PowerShell para configurar variáveis de ambiente do EventEz
# Execute este script no PowerShell para criar o arquivo .env.local

Write-Host "🔥 Configurando EventEz Firebase" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Passo 1: Obtenha suas credenciais em:" -ForegroundColor Yellow
Write-Host "https://console.firebase.google.com/project/eventu-1b077/settings/general"
Write-Host ""

# Criar arquivo .env.local
$envContent = @"
# Firebase Configuration
# Obtenha em: https://console.firebase.google.com/project/eventu-1b077/settings/general
VITE_FIREBASE_API_KEY=AIzaSy...COLE_SUA_API_KEY_AQUI
VITE_FIREBASE_AUTH_DOMAIN=eventu-1b077.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=eventu-1b077
VITE_FIREBASE_STORAGE_BUCKET=eventu-1b077.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=680153461859
VITE_FIREBASE_APP_ID=1:680153461859:web:...COLE_SEU_APP_ID_AQUI

# Google Maps API Key
# Obtenha em: https://console.cloud.google.com/google/maps-apis/credentials?project=eventu-1b077
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...COLE_SUA_MAPS_KEY_AQUI
"@

$envContent | Out-File -FilePath ".env.local" -Encoding UTF8

Write-Host "✅ Arquivo .env.local criado!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Edite o arquivo .env.local e preencha com suas credenciais reais" -ForegroundColor Red
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Edite .env.local com suas credenciais"
Write-Host "2. Execute: npm run build"
Write-Host "3. Execute: firebase deploy --only hosting"
Write-Host ""

# Abrir o arquivo no editor padrão
Write-Host "Abrindo .env.local no editor..." -ForegroundColor Yellow
Start-Process notepad.exe -ArgumentList ".env.local"

