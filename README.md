# Correio de Nós Dois

Um calendário de cartas, como um calendário do advento: quem escreve prepara uma carta para cada dia
de um período (uma viagem, uma contagem regressiva, um mês longe) e entrega a quem vai ler um envelope
físico numerado para cada dia. Dentro de cada envelope há só um QR code.

Ao escanear o QR, a carta daquele dia aparece no app, com texto e foto opcional. Antes da hora, o app diz
quando o envelope libera. Uma carta já aberta pode ser relida a qualquer momento na aba de envelopes,
sem precisar do papel. O app é um PWA em React com visual pixel art: funciona no navegador do celular e
pode ser instalado na tela inicial, sem loja de apps e sem conta.

## Como a trava funciona

Cada carta tem **duas chaves**:

- **o papel**: uma chave AES impressa no QR do envelope (fica só no fragmento `#` da URL, que nunca vai ao servidor);
- **o tempo**: uma fechadura timelock sobre a [drand](https://drand.love) quicknet, que só libera no dia do envelope.

Para ler é preciso ter o envelope na mão **e** já ser o dia. Nem o servidor nem o autor conseguem abrir antes:
a trava do tempo é criptográfica, não um `if` no código. Por isso as cartas cifradas podem ficar publicadas
num site estático desde o começo, sem back-end.

## Começando

Requisitos: Node 22+ e npm. Python 3 com `reportlab` só se for gerar etiquetas.

```bash
npm install
npm run dev          # app em http://localhost:5173 e painel admin em /admin.html
```

## Escrevendo e lacrando cartas

1. `npm run dev` e abra **http://localhost:5173/admin.html**.
2. Escolha o envelope, escreva a carta e, se quiser, anexe uma foto (é comprimida para até 600 KB).
3. Clique em **Lacrar**. A carta cifrada vai para `public/letters/NN.json`.
4. Commit de `public/letters/` e push: a Vercel publica.

Pode lacrar todas com antecedência: nenhuma abre antes do dia dela. Mudou o texto ou a data
de um envelope? Lacre de novo (o painel avisa quando o rascunho mudou depois do lacre).

Sem o painel: escreva `secrets/cartas/09.txt` (+ `09.webp`/`09.jpg` opcional) e rode `npm run seal -- 9`.

O painel só existe no `npm run dev`. Ele não entra no build, e a API dele só aceita
conexões da própria máquina vindas da própria página.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | app em desenvolvimento + painel admin em `/admin.html` |
| `npm test` | testes (sem rede) |
| `npm run test:net` | testes que falam com a drand de verdade |
| `npm run typecheck` | checagem de tipos de app, config e scripts |
| `npm run lint` | ESLint |
| `npm run build` | build de produção em `dist/` |
| `npm run seal -- 9` | lacra `secrets/cartas/09.txt` em `public/letters/09.json` |
| `npm run poc:timelock` | prova de conceito: tranca por 30 s e tenta abrir antes e depois |
| `npm run keys` | gera as chaves do papel (**uma vez só**; recusa sobrescrever) |
| `npm run push:keys` | gera as chaves das notificações push em `secrets/push.env` (uma vez só) |
| `python scripts/make-labels.py` | gera `secrets/etiquetas.pdf` com os QR para imprimir |

## Deploy (Vercel)

- Root directory: `correio-de-nos-dois` · framework: Vite · build: `npm run build` · output: `dist`.
- `vercel.json` reescreve `/abrir` para o app (é o caminho impresso nos QR).
- O endereço `PUBLIC_ORIGIN` em `src/config/trip.ts` está impresso nas etiquetas: não pode mudar depois.

## Notificações das 08:00

Quem lê pode ligar, na aba Hoje, um aviso no celular quando o envelope do dia libera
(“💌 O envelope 7 chegou!”). O aviso não contém nada da carta.

Como funciona: o app inscreve o aparelho em `POST /api/push` ([api/push.ts](api/push.ts)), que guarda a inscrição
no Upstash Redis. Às 08:00 um cron chama `GET /api/push`, que descobre qual envelope liberou e envia o push.
Dois gatilhos, um de reserva do outro: o [cron-job.org](https://cron-job.org) (pontual) e a Vercel Cron
(`vercel.json`, no plano grátis dispara em algum momento entre 08:00 e 08:59). O Redis garante um aviso por envelope.

Configuração (uma vez):

1. `npm run push:keys` gera `secrets/push.env` e mostra a chave pública para `PUSH_PUBLIC_KEY` em `src/config/trip.ts`.
2. Vercel → Storage → crie um Upstash Redis e conecte ao projeto (cria `KV_REST_API_URL` e `KV_REST_API_TOKEN`).
3. Vercel → Settings → Environment Variables: `VAPID_PRIVATE_KEY` e `CRON_SECRET` (de `secrets/push.env`). Faça um redeploy.
4. cron-job.org: `GET https://<site>/api/push`, todo dia às 08:00 no fuso America/Fortaleza,
   com o header `Authorization: Bearer <CRON_SECRET>`.
5. Teste: ligue o aviso no celular e chame `GET /api/push?teste=1` com o mesmo header.

Mudou as datas em `src/config/trip.ts`? Copie para `SCHEDULE` em `api/push.ts` (o `npm test` acusa se esquecer).

## Segurança

| Onde | O que é | Pode ser público? |
|---|---|---|
| `secrets/paper-keys.json` | chave do papel de cada envelope | **Não**. Abre as cartas no dia certo |
| `secrets/etiquetas.pdf`, `labels-config.json` | os QR com as chaves | **Não** |
| `secrets/cartas/` | rascunhos em texto puro e fotos | **Não** |
| `secrets/push.env` | chave privada VAPID e segredo do cron | **Não**. Vai só nas variáveis da Vercel |
| `public/letters/NN.json` | cartas lacradas (cifradas + timelock) | Sim |
| código, datas em `src/config/trip.ts` | | Sim |

- `secrets/`, `.env*`, `.vercel/` e os arquivos do Claude Code estão no `.gitignore` (aqui e na raiz do repositório).
- A chave do papel só existe no QR: o link usa `#`, então ela não aparece nos logs da Vercel.
  No aparelho de quem lê, ela fica guardada localmente para reler as cartas depois.
- Uma carta lacrada é segura mesmo publicada antes do dia: sem a rodada da drand ninguém tira a chave do timelock,
  e sem o papel ninguém decifra o corpo.
- **Se uma chave do papel vazar**: aquele envelope continua trancado até o dia, mas depois disso quem tiver a chave lê.
  As chaves estão impressas, então não dá para trocar; o jeito é não publicar aquela carta e entregar outro envelope.
- Nunca rode `npm run keys` de novo depois de imprimir: as etiquetas impressas deixariam de abrir as cartas novas.

## Arquitetura

```
src/
  domain/          regras puras: Envelope, Trip (calendário), Letter, erros
  application/     casos de uso (lacrar, abrir) + portas (interfaces) + formato da carta lacrada
  infrastructure/  adaptadores: Web Crypto, drand, fetch das cartas, link do QR
  shared/          utilitários de bytes (base64url, UTF-8)
  config/          calendário dos envelopes e domínio público
  app/             composition root (liga portas aos adaptadores)
  ui/              React (pixel art + cena 3D de fundo carregada sob demanda)
  admin/           painel admin (só no dev server)
  test/            adaptadores falsos para testes
scripts/           rodam só no seu PC: chaves, lacre, etiquetas, API do painel
secrets/           chaves do papel e rascunhos (ignorado pelo git)
public/letters/    cartas lacradas publicadas (seguro ser público)
```

Regra: dependências só apontam para dentro. `ui`/`infrastructure` → `application` → `domain`.

### Formato do QR (v1, irreversível após imprimir)

```
https://<site>/abrir#v=1&e=<envelope>&k=<chave do papel, base64url>
```

### Carta lacrada (v1)

```
corpo:  AES-GCM(chaveDaCarta, conteúdo)
chave:  AES-GCM(chaveDoPapel, chaveDaCarta)
tempo:  timelock(iv || chave cifrada, rodada da drand no horário do envelope)
```

Mudanças no formato só subindo `v` (o app precisa continuar lendo as cartas já publicadas).
