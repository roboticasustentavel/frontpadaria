# Frontend — Padaria do Amor

Frontend responsivo feito apenas com HTML, CSS e JavaScript, sem framework ou build.

## Arquivos
- `index.html`: estrutura da aplicação e tela de login.
- `styles.css`: layout responsivo.
- `app.js`: autenticação, chamadas REST e renderização.

## Executar localmente
1. Inicie a API backend na porta 3000.
2. Sirva esta pasta por um servidor estático (não abra `index.html` diretamente):
   - `npx serve .`
   - ou extensão Live Server do VS Code.
3. Abra o endereço local fornecido pelo servidor.
4. Faça login com o administrador configurado no backend.

A URL padrão da API é `http://localhost:3000`. Para outra URL, edite `app.js` e altere o valor padrão de `state.api`, ou ajuste o campo no código antes de publicar.

## Deploy separado na Vercel
1. Crie um projeto Vercel separado apontando para esta pasta/repositório.
2. Framework Preset: Other.
3. Build Command: vazio.
4. Output Directory: `.`.
5. Deploy.
6. No backend, configure `CORS_ORIGIN` com a URL HTTPS exata deste frontend.
7. Em `app.js`, altere o valor padrão da API para a URL de produção, por exemplo `https://sua-api.vercel.app`.

## Segurança
- O frontend guarda o JWT em `localStorage` para persistir a sessão. Em aplicações com requisitos de segurança mais elevados, prefira autenticação por cookie `HttpOnly`, `Secure`, `SameSite` implementada pelo backend.
- Nunca adicione `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` ou qualquer segredo do servidor ao frontend.
- O frontend não acessa Supabase diretamente; todas as operações passam pela API Express.
