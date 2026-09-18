// ⚠️ SMOKE TEST DE LÓGICA, NÃO DE HTTP -- este sandbox não tem acesso
// ao Postgres real (rede de saída bloqueada; ver relatório da etapa),
// então não é possível subir `node src/server.cjs` de verdade e bater
// requisições HTTP nele. O que este arquivo faz é chamar os
// controllers das rotas ANTIGAS diretamente (exatamente como o
// Express chamaria), com `db.cjs`/`dbHelpers` mockados em memória, só
// pra confirmar que a LÓGICA deles continua funcionando exatamente
// como antes -- útil porque poderia ter havido algum erro de digitação
// ao mexer em arquivos vizinhos (server.cjs, schema.sql), mas os
// arquivos dos controllers/rotas testados aqui (auth.controller.cjs,
// userTerrenos.controller.js, admin/auth.controller.js) NÃO foram
// tocados nesta etapa (confirmado por diff byte-a-byte contra o zip
// original -- ver relatório).
//
// node src/__tests__/smoke-regressao.test.cjs
require("dotenv").config();
const assert = require("assert");
const path = require("path");
const Module = require("module");
const bcrypt = require("bcryptjs");

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

// ---- mock de db.cjs (estilo callback, usado por auth.controller.cjs
// e admin/auth.controller.js) ----------------------------------------
const dbCjsPath = path.resolve(__dirname, "../database/db.cjs");

const CPF_LIMPO = "12345678900";
const CPF_HASH = bcrypt.hashSync(CPF_LIMPO, 10);
const SENHA_ADMIN_HASH = bcrypt.hashSync("senhaAdmin123", 10);

const USERS = [
  { id: 1, nome: "Fulano de Tal", matricula: "1930", cpf_hash: CPF_HASH, status: "ativo" },
  { id: 2, nome: "Inativo", matricula: "9999", cpf_hash: CPF_HASH, status: "inativo" },
];
const TERRENOS = [{ id: 100, matricula: "1930", url_terreno: "https://exemplo/terreno.glb" }];
const PONTOS = [{ numero: 1, x: 10, y: 20 }];
const CONFRONTANTES_MOCK = [{ nome: "Vizinho", matricula: "1931", ponto_inicio: 1, ponto_fim: 2, ordem: 1 }];
const ADMINS = [{ id: 1, email: "admin@vertent.com", senha_hash: SENHA_ADMIN_HASH }];

const dbCjsMock = {
  get(sql, params, cb) {
    if (/FROM users WHERE matricula = \?/.test(sql)) {
      return cb(null, USERS.find((u) => u.matricula === params[0]));
    }
    if (/FROM terrenos WHERE matricula = \?/.test(sql)) {
      return cb(null, TERRENOS.find((t) => t.matricula === params[0]));
    }
    if (/FROM admins WHERE email = \?/.test(sql)) {
      return cb(null, ADMINS.find((a) => a.email === params[0]));
    }
    return cb(null, undefined);
  },
  all(sql, params, cb) {
    if (/FROM pontos_terreno WHERE terreno_id = \?/.test(sql)) {
      return cb(null, PONTOS);
    }
    if (/FROM confrontantes WHERE terreno_id = \?/.test(sql)) {
      return cb(null, CONFRONTANTES_MOCK);
    }
    return cb(null, []);
  },
  run(sql, params, cb) {
    return cb.call({ lastID: undefined, changes: 0 }, null);
  },
};

Module._cache[dbCjsPath] = { id: dbCjsPath, filename: dbCjsPath, loaded: true, exports: dbCjsMock };

// ---- mock de dbHelpers (estilo Promise, usado por
// userTerrenos.controller.js) -----------------------------------------
const dbHelpersPath = path.resolve(__dirname, "../database/dbHelpers.js");
const USER_TERRENOS = [{ user_id: 1, terreno_id: 100 }];

const dbHelpersMock = {
  async all(sql, params = []) {
    if (/FROM user_terrenos ut\s+JOIN terrenos t/.test(sql)) {
      const idsDoUsuario = USER_TERRENOS.filter((ut) => ut.user_id === params[0]).map((ut) => ut.terreno_id);
      return TERRENOS.filter((t) => idsDoUsuario.includes(t.id));
    }
    return [];
  },
  async get(sql, params = []) {
    if (/FROM terrenos WHERE matricula = \?/.test(sql)) {
      return TERRENOS.find((t) => t.matricula === params[0]);
    }
    if (/FROM user_terrenos WHERE user_id = \? AND terreno_id = \?/.test(sql)) {
      return USER_TERRENOS.find((ut) => ut.user_id === params[0] && ut.terreno_id === params[1]);
    }
    return undefined;
  },
  async run() {
    return { lastID: undefined, changes: 1 };
  },
};
Module._cache[dbHelpersPath] = { id: dbHelpersPath, filename: dbHelpersPath, loaded: true, exports: dbHelpersMock };

const AuthController = require("../controllers/auth.controller.cjs");
const AdminAuthController = require("../controllers/admin/auth.controller.js");
const UserTerrenosController = require("../controllers/userTerrenos.controller.js");

(async () => {
  // ---- /auth/login (login mobile por CPF + matrícula) ----
  await testeAsync("/auth/login: CPF+matrícula corretos -> token + terreno com pontos/confrontantes", async () => {
    const req = { body: { cpf: "123.456.789-00", matricula: "1930" } };
    const res = resFake();
    await new Promise((resolve) => {
      const origJson = res.json.bind(res);
      res.json = (p) => {
        origJson(p);
        resolve();
      };
      AuthController.login(req, res);
    });
    assert.strictEqual(res.body.usuario.matricula, "1930");
    assert.ok(res.body.token, "deve emitir token (ETAPA 3A, aditivo)");
    assert.strictEqual(res.body.terreno.pontos.length, 1);
    assert.strictEqual(res.body.terreno.confrontantes.length, 1);
  });

  await testeAsync("/auth/login: matrícula inexistente -> 401", async () => {
    const req = { body: { cpf: "123.456.789-00", matricula: "0000" } };
    const res = resFake();
    await new Promise((resolve) => {
      res.json = (p) => {
        res.body = p;
        resolve();
      };
      AuthController.login(req, res);
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await testeAsync("/auth/login: usuário inativo -> 403", async () => {
    const req = { body: { cpf: "123.456.789-00", matricula: "9999" } };
    const res = resFake();
    await new Promise((resolve) => {
      res.json = (p) => {
        res.body = p;
        resolve();
      };
      AuthController.login(req, res);
    });
    assert.strictEqual(res.statusCode, 403);
  });

  // ---- /users/me/terrenos ----
  await testeAsync("GET /users/me/terrenos: retorna só os terrenos associados ao req.userId", async () => {
    const req = { userId: 1 };
    const res = resFake();
    await UserTerrenosController.listarMeusTerrenos(req, res);
    assert.strictEqual(res.body.terrenos.length, 1);
    assert.strictEqual(res.body.terrenos[0].matricula, "1930");
  });

  await testeAsync("GET /users/me/terrenos: usuário sem terrenos associados -> lista vazia", async () => {
    const req = { userId: 999 };
    const res = resFake();
    await UserTerrenosController.listarMeusTerrenos(req, res);
    assert.deepStrictEqual(res.body.terrenos, []);
  });

  // ---- /admin/login ----
  await testeAsync("/admin/login: e-mail/senha corretos -> token role admin", async () => {
    const req = { body: { email: "admin@vertent.com", senha: "senhaAdmin123" } };
    const res = resFake();
    await new Promise((resolve) => {
      res.json = (p) => {
        res.body = p;
        resolve();
      };
      AdminAuthController.login(req, res);
    });
    assert.ok(res.body.token);
  });

  await testeAsync("/admin/login: senha errada -> 401", async () => {
    const req = { body: { email: "admin@vertent.com", senha: "errada" } };
    const res = resFake();
    await new Promise((resolve) => {
      res.json = (p) => {
        res.body = p;
        resolve();
      };
      AdminAuthController.login(req, res);
    });
    assert.strictEqual(res.statusCode, 401);
  });

  console.log(`\n${passou} passaram, ${falhou} falharam`);
  process.exit(falhou > 0 ? 1 : 0);
})();
