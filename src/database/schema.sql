-- src/database/schema.sql
--
-- Equivalente PostgreSQL do schema original do projeto (antes em
-- src/database/init.sql, SQLite, + colunas aditivas de
-- src/database/migrate.js). Volta a ser aplicado a cada início do
-- servidor (ver database/migrate.js) -- por isso tudo aqui é
-- IDEMPOTENTE (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS). Nunca usa
-- DROP TABLE nem qualquer instrução destrutiva.

-- 👤 TABELA DE USUÁRIOS (clientes do app mobile)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nome TEXT,
  cpf_hash TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ativo',
  cpf_encrypted TEXT
);

-- 🌍 TABELA DE TERRENOS
-- `matricula` NÃO tem uma FOREIGN KEY de verdade aqui de propósito: no
-- schema SQLite original ela existia só na declaração, mas nunca foi
-- de fato aplicada (o projeto nunca ligou `PRAGMA foreign_keys = ON`,
-- que é desligado por padrão no SQLite) -- e o controller de usuários
-- (`usuarios.controller.js:atualizar`) atualiza `users.matricula` e
-- `terrenos.matricula` em dois passos separados; com uma FK de verdade
-- (aplicada por padrão no PostgreSQL), o primeiro passo quebraria com
-- "violates foreign key constraint". Manter sem FK aqui preserva o
-- comportamento exatamente como já era.
CREATE TABLE IF NOT EXISTS terrenos (
  id SERIAL PRIMARY KEY,
  matricula TEXT NOT NULL,
  url_terreno TEXT NOT NULL,

  area DOUBLE PRECISION,
  perimetro DOUBLE PRECISION,
  altura_max DOUBLE PRECISION,
  altura_min DOUBLE PRECISION,

  pdf_confrontantes_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 🔑 TABELA DE ADMINISTRADORES (painel Vertente Admin - separada de "users")
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colunas adicionadas depois da versão original (ver histórico em
-- src/database/migrate.js do schema SQLite) -- redundante logo após um
-- CREATE TABLE novo, mas necessário para quando essas tabelas já
-- existirem de uma execução anterior desta mesma migração.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo';
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf_encrypted TEXT;
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS pdf_confrontantes_url TEXT;
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- 📄 Memorial descritivo (PDF avulso, sem interpretação de conteúdo).
-- `pdf_confrontantes_url` (acima) já existia desde o schema original,
-- preparada exatamente para a "planta do imóvel" -- reaproveitada aqui
-- como tal, sem renomear (o nome da coluna continua
-- `pdf_confrontantes_url`, mas semanticamente é a "planta").
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS memorial_pdf_url TEXT;

-- 📏 UNIDADE da área (`terrenos.area` continua NUMÉRICA -- DOUBLE
-- PRECISION -- e NÃO foi convertida para TEXT). O memorial escreve a
-- área como "5,7985 ha", mas `parseNumero()` (utils/numero.js), que é
-- quem alimenta a coluna numérica, descarta o sufixo por construção.
-- Esta coluna guarda esse sufixo em forma canônica ("ha", "m²", "km²",
-- "alqueire" -- ver utils/areaUnidade.js), para que o Admin e o
-- Vertente Web possam exibir a área com a unidade correta em vez de
-- assumir hectare.
-- Fica NULL para terrenos antigos (cadastrados antes desta coluna
-- existir) e para cadastros manuais em que só o número foi informado
-- -- nenhum dos dois casos deixa de funcionar por causa disso.
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS area_unidade TEXT;

-- 📐 ORIGIN do GLB (deslocamento local aplicado pelo Topo Textura --
-- ver terrain/mesh.py:_compute_origin do projeto Topo Textura). O GLB
-- guarda vértices em coordenadas LOCAIS, relativas a este offset, não
-- nas coordenadas UTM originais dos pontos cadastrados. Sem isto, o
-- Vertente Web não tem como converter um ponto cadastrado (UTM) para
-- a posição equivalente dentro do GLB.
-- Extraído automaticamente dos `extras` do node "Terreno" dentro do
-- próprio arquivo .glb no momento do upload (ver
-- controllers/admin/terrenos.controller.js + utils/glbOrigin.js) --
-- NUNCA recalculado aqui. Fica NULL para terrenos cujo GLB não tem
-- esses metadados (gerados antes desta funcionalidade existir no Topo
-- Textura, ou de outra origem).
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS origin_x DOUBLE PRECISION;
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS origin_y DOUBLE PRECISION;
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS origin_z DOUBLE PRECISION;
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS origin_epsg INTEGER;

-- 📍 PONTOS/VÉRTICES do levantamento (extraídos da planta em PDF, ou
-- cadastrados/corrigidos manualmente na tela de conferência do admin).
-- `numero` é a numeração usada na planta (1, 2, 3...) -- a referência
-- espacial pedida, não um id interno. `x`/`y` ficam no mesmo sistema
-- de coordenadas em que foram extraídos (ex.: UTM) -- a conversão para
-- o sistema de coordenadas do GLB acontece no Vertente Web, não aqui.
CREATE TABLE IF NOT EXISTS pontos_terreno (
  id SERIAL PRIMARY KEY,
  terreno_id INTEGER NOT NULL REFERENCES terrenos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  x DOUBLE PRECISION,
  y DOUBLE PRECISION,
  UNIQUE (terreno_id, numero)
);

-- 🧑‍🤝‍🧑 CONFRONTANTES -- cada linha é UM SEGMENTO da divisa (um
-- confrontante com uma divisa em vários trechos gera uma linha por
-- trecho, todas com o mesmo nome/matrícula e `ordem` crescente,
-- evitando duplicar nome/matrícula em uma estrutura à parte).
-- `ponto_inicio`/`ponto_fim` referenciam `pontos_terreno.numero`
-- (não `id`) -- são "soltos" (sem FK composta) de propósito: a tela de
-- conferência do admin precisa poder salvar uma numeração de ponto que
-- ainda não tem coordenada cadastrada (extração parcial, ver
-- FUNCIONALIDADE 1 do pedido), sem travar o cadastro nesse caso.
CREATE TABLE IF NOT EXISTS confrontantes (
  id SERIAL PRIMARY KEY,
  terreno_id INTEGER NOT NULL REFERENCES terrenos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  matricula TEXT,
  ponto_inicio INTEGER NOT NULL,
  ponto_fim INTEGER NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

-- 🔗 ETAPA 3A — relação N:N entre usuários e terrenos (1 usuário pode
-- ter várias propriedades). `users.matricula`/`terrenos.matricula`
-- CONTINUAM existindo e funcionando exatamente como antes (login por
-- CPF+matrícula, cadastro/edição no Admin) -- esta tabela é a forma
-- NOVA de associação, adicional, não uma substituição. A migração dos
-- dados antigos (users.matricula = terrenos.matricula) acontece em
-- JS, em database/migrate.js, não aqui em SQL puro -- lá dá pra
-- registrar quantas associações foram migradas e quais usuários
-- ficaram sem terreno correspondente, sem apagar/inventar nada.
CREATE TABLE IF NOT EXISTS user_terrenos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terreno_id INTEGER NOT NULL REFERENCES terrenos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, terreno_id)
);

CREATE INDEX IF NOT EXISTS idx_user_terrenos_user_id ON user_terrenos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_terrenos_terreno_id ON user_terrenos(terreno_id);

-- ============================================================================
-- MULTI-TENANCY (TOPÓGRAFOS) -- nova camada ACIMA de clientes/terrenos.
--
--   ADMIN VERTENT (tabela `admins`, já existia -- continua com acesso
--   global, sem isolamento nenhum aplicado a ela)
--         │
--   TOPOGRAFO (tabela nova `topografos`)
--         │
--   CLIENTE (tabela nova `clientes`, pertence a UM topógrafo)
--         │
--   TERRENO (tabela `terrenos`, já existia -- ganha só a coluna
--            `cliente_id`, opcional/nullable)
--         │
--   USUÁRIO FINAL (tabela `users` + `user_terrenos`, já existiam --
--                  login por CPF+matrícula do app mobile, INTOCADOS)
--
-- `cliente` (dono/contato do topógrafo) é um conceito NOVO, diferente
-- de `users` (usuário final que loga no app mobile) -- ver seção 3 do
-- pedido. Um mesmo terreno pode ter um `cliente` (dono, cadastrado
-- pelo topógrafo) e, separadamente, um ou mais `users` com acesso via
-- `user_terrenos` -- as duas coisas não se confundem nem se
-- substituem.
-- ============================================================================

-- 🧑‍💼 TOPÓGRAFOS -- cada um é um tenant. Sem cadastro público (mesmo
-- padrão de `admins`: só é criado via script de servidor, ver
-- scripts/createTopografo.cjs) -- login próprio, reaproveitando
-- bcrypt+JWT exatamente como admins/usuários já fazem (`role:
-- "topografo"`, ver controllers/topografo/auth.controller.js).
CREATE TABLE IF NOT EXISTS topografos (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  telefone TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  -- Preparo para cobrança futura (seção 17/18 do pedido) -- só os
  -- campos, SEM lógica de pagamento nenhuma. `limite_terrenos` NULL
  -- significa "sem limite" (nunca bloqueia por padrão).
  plano TEXT,
  limite_terrenos INTEGER,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 👥 CLIENTES -- os donos/contatos de terreno DE UM topógrafo. CPF
-- criptografado com o mesmo utils/crypto.js já usado por
-- `users.cpf_encrypted` (reaproveitado, não duplicado) -- não é hash
-- de login (cliente não loga em lugar nenhum nesta etapa), é só pra
-- não guardar CPF em texto puro.
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  topografo_id INTEGER NOT NULL REFERENCES topografos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf_encrypted TEXT,
  email TEXT,
  telefone TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_topografo_id ON clientes(topografo_id);

-- 🌍 TERRENOS ganha o vínculo com `clientes` -- NULLABLE de propósito:
-- todo terreno cadastrado antes desta etapa não tem (e não pode
-- GANHAR automaticamente, ver seção 23 do pedido -- não inventamos
-- associação nenhuma) nenhum cliente/topógrafo associado, e continua
-- funcionando normalmente (login mobile, Vertente Web, Admin) do jeito
-- que já funcionava, exatamente como se essa coluna não existisse. Só
-- passa a ser preenchida para terrenos NOVOS, criados a partir de
-- agora pela rota do topógrafo (POST /topografo/me/clientes/:id/terrenos).
ALTER TABLE terrenos ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id);

CREATE INDEX IF NOT EXISTS idx_terrenos_cliente_id ON terrenos(cliente_id);
