#!/bin/bash

# Script para configurar variáveis de ambiente do EventEz
# Copie este arquivo para setup-env.sh e preencha com suas credenciais

echo "🔥 Configurando EventEz Firebase"
echo ""
echo "📋 Passo 1: Obtenha suas credenciais em:"
echo "https://console.firebase.google.com/project/eventu-1b077/settings/general"
echo ""

# Criar arquivo .env.local
cat > .env.local << 'EOF'
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
EOF

echo "✅ Arquivo .env.local criado!"
echo ""
echo "⚠️  IMPORTANTE: Edite o arquivo .env.local e preencha com suas credenciais reais"
echo ""
echo "📝 Próximos passos:"
echo "1. Edite .env.local com suas credenciais"
echo "2. Execute: npm run build"
echo "3. Execute: firebase deploy --only hosting"
echo ""

