#!/usr/bin/env bash
# ============================================================
#  JUBIG — criação do projeto
#  Uso:  bash criar-site.sh [nome-da-pasta]
#  Requer: Node 18+ e npm
# ============================================================
set -euo pipefail

PASTA="${1:-jubig}"
AQUI="$(cd "$(dirname "$0")" && pwd)"

echo "==> Criando projeto Next.js em ./$PASTA"
npx --yes create-next-app@latest "$PASTA" \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --no-turbopack --use-npm

cd "$PASTA"

echo "==> Instalando dependências"
npm install @supabase/supabase-js @supabase/ssr resend libphonenumber-js zod

echo "==> Copiando arquivos da JUBIG"
mkdir -p src/lib/supabase src/emails src/components src/app/api public/juca supabase
cp -r "$AQUI/src/." src/
cp -r "$AQUI/public/juca/." public/juca/
cp "$AQUI/supabase/schema.sql" supabase/
cp "$AQUI/.env.example" .env.local

cat >> .gitignore <<'IGN'

# ambiente
.env.local
IGN

echo ""
echo "============================================"
echo " Pronto. Agora, na ordem:"
echo ""
echo " 1. Crie o projeto em supabase.com e rode"
echo "    supabase/schema.sql no SQL Editor."
echo " 2. Storage > New bucket: 'comprovantes' (PRIVADO)"
echo "    e 'fotos' (público, para a galeria)."
echo " 3. Preencha .env.local com as chaves do Supabase"
echo "    e do Resend."
echo " 4. Authentication > Providers > Email:"
echo "    ligue 'Confirm email'."
echo " 5. npm run dev"
echo ""
echo " Deploy: vercel --prod (ou conecte o repo na Vercel)"
echo "============================================"
