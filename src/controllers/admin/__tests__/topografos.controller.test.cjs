// Teste de LÓGICA (mesmo estilo de src/__tests__/smoke-regressao.test.cjs
// e src/middleware/__tests__/topografoAuth.test.cjs -- este sandbox não
// tem acesso à rede/Postgres real) para o fluxo completo de
// POST /admin/topografos: adminAuth (autenticação/autorização) +
// controllers/admin/topografos.controller.js (regra de negócio).
//
// Simula a cadeia exata que o Express monta em routes/admin.routes.js
// (`router.use(adminAuth)` seguido de `TopografosController.criar`),
// chamando os dois em sequência com req/res fake, sem subir servidor.
//
// node src/controllers/admin/__tests__/topografos.controller.test.cjs
require("dotenv").config();
const assert = require("assert");
const path = require("path");
const Module = require("module");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

let passou = 0;
let falhou = 0;

async function testeAsync(nome, fn) {
  try {
    await fn();
    console.log(`✅ ${nome}`);
    passou++;
  } catch (err) {
    console.error(`❌ ${nome}`);
    console.error(`   ${err.stack || err.message}`);
    falhou++;
  }
}

function resFake() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// ---- mock de dbHelpers (estilo Promise, usado pelo controller) ----
const dbHelpersPath = path.resolve(__dirname, "../../../database/dbHelpers.js");

let TOPOGRAFOS = [
  {
    id: 1,
    nome: "Já Existente",
    email: "existente@vertent.com",
    senha_hash: bcrypt.hashSync("qualquer", 10),
    telefone: null,
    status: "ativo",
    plano: "standard",
    limite_terrenos: 50,
    criado_em: new Date().toISOString(),
  },
];
let proximoId = 2;
let ultimaSenhaHash = null; // capturada no INSERT, pra checar o hash (caso 7)

const dbHelpersMock = {
  async get(sql, params = []) {
    if (/FROM topografos WHERE email = \?/.test(sql)) {
      return TOPOGRAFOS.find((t) => t.email === params[0]);
    }
    if (/FROM topografos WHERE id = \?/.test(sql)) {
      return TOPOGRAFOS.find((t) => t.id === params[0]);
    }
    return undefined;
  },
  async all() {
    return [];
  },
  async run(sql, params = []) {
    if (/INSERT INTO topografos/.test(sql)) {
      const [nome, email, senha_hash, plano, limite_terrenos] = params;
      ultimaSenhaHash = senha_hash;
      const novo = {
        id: proximoId++,
        nome,
        email,
        senha_hash,
        telefone: null,
        status: "ativo",
        plano,
        limite_terrenos,
        criado_em: new Date().toISOString(),
      };
      TOPOGRAFOS.push(novo);
      return { lastID: novo.id, changes: 1 };
    }
    return { lastID: undefined, changes: 0 };
  },
};
Module._cache[dbHelpersPath] = {
  id: dbHelpersPath,
  filename: dbHelpersPath,
  loaded: true,
  exports: dbHelpersMock,
};

const adminAuth = require("../../../middleware/adminAuth.js");
const TopografosController = require("../topografos.controller.js");

// Simula exatamente `router.use(adminAuth)` seguido do controller,
// como está montado em routes/admin.routes.js.
async function chamarEndpoint(req) {
  const res = resFake();
  let next2Chamado = false;
  await new Promise((resolve) => {
    adminAuth(req, res, () => {
      next2Chamado = true;
      resolve();
    });
    // Se adminAuth já respondeu (401/403), não há próximo passo --
    // resolve imediatamente pra não travar o teste.
    if (res.body !== undefined) resolve();
  });
  if (next2Chamado) {
    await TopografosController.criar(req, res);
  }
  return res;
}

const BODY_VALIDO = {
  nome: "Analúcia Agrimensura",
  email: "analuciatopo50@gmail.com",
  senha: "senha-segura",
  plano: "standard",
  limite_terrenos: 50,
};

(async () => {
  // ---- Caso 1: admin cria topógrafo -> 201 ----
  await testeAsync("Admin autenticado cria topógrafo -> 201", async () => {
    const tokenAdmin = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${tokenAdmin}` },
      body: { ...BODY_VALIDO },
    };
    const totalAntes = TOPOGRAFOS.length;
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.email, BODY_VALIDO.email);
    assert.strictEqual(res.body.senha_hash, undefined); // nunca devolve o hash
    assert.strictEqual(TOPOGRAFOS.length, totalAntes + 1);
  });

  // ---- Caso 2: topógrafo tenta criar outro topógrafo -> 403 ----
  await testeAsync("Token de topógrafo (role: topografo) -> 403, nada criado", async () => {
    const tokenTopografo = jwt.sign({ id: 42, role: "topografo" }, process.env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${tokenTopografo}` },
      body: { nome: "Outro", email: "outro@vertent.com", senha: "123" },
    };
    const totalAntes = TOPOGRAFOS.length;
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(TOPOGRAFOS.length, totalAntes); // nenhum registro criado
  });

  // ---- Caso 3: usuário final tenta criar topógrafo -> 403 ----
  await testeAsync("Token de usuário final (role: user) -> 403", async () => {
    const tokenUser = jwt.sign({ id: 7, role: "user" }, process.env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${tokenUser}` },
      body: { nome: "Outro", email: "outro2@vertent.com", senha: "123" },
    };
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 403);
  });

  // ---- Caso 4: sem token -> 401 ----
  await testeAsync("Sem token -> 401", async () => {
    const req = { headers: {}, body: { ...BODY_VALIDO } };
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 401);
  });

  // ---- Caso 5: e-mail duplicado -> 409 ----
  await testeAsync("E-mail já cadastrado -> 409", async () => {
    const tokenAdmin = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${tokenAdmin}` },
      body: { nome: "Duplicado", email: "existente@vertent.com", senha: "123" },
    };
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 409);
  });

  // ---- Caso 6: dados obrigatórios ausentes -> 400 ----
  await testeAsync("Nome ausente -> 400", async () => {
    const tokenAdmin = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${tokenAdmin}` },
      body: { email: "sem-nome@vertent.com", senha: "123" },
    };
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 400);
  });

  await testeAsync("E-mail ausente -> 400", async () => {
    const tokenAdmin = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${tokenAdmin}` },
      body: { nome: "Sem Email", senha: "123" },
    };
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 400);
  });

  await testeAsync("Senha ausente -> 400", async () => {
    const tokenAdmin = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${tokenAdmin}` },
      body: { nome: "Sem Senha", email: "sem-senha@vertent.com" },
    };
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 400);
  });

  // ---- Caso 7: senha nunca é armazenada em texto puro ----
  await testeAsync("Senha armazenada é hash, não texto puro", async () => {
    const tokenAdmin = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);
    const senhaOriginal = "minhaSenhaSuperSecreta";
    const req = {
      headers: { authorization: `Bearer ${tokenAdmin}` },
      body: { nome: "Checagem de Hash", email: "hash-check@vertent.com", senha: senhaOriginal },
    };
    const res = await chamarEndpoint(req);
    assert.strictEqual(res.statusCode, 201);
    assert.notStrictEqual(ultimaSenhaHash, senhaOriginal);
    assert.ok(await bcrypt.compare(senhaOriginal, ultimaSenhaHash));
  });

  console.log(`\n${passou} passaram, ${falhou} falharam`);
  process.exit(falhou > 0 ? 1 : 0);
})();
