// Testes de isolamento multi-tenant (seção 24, TESTES A/B/E do
// pedido) para controllers/topografo/clientes.controller.js.
//
// Mesmo estilo dos demais testes do projeto (Node puro, sem
// framework): node src/controllers/topografo/__tests__/clientes-isolamento.test.cjs
// Sai com código != 0 se algo falhar.
//
// dbHelpers é substituído por um mock em memória via require.cache
// (não há Postgres disponível neste sandbox) -- o mock GRAVA quais
// SQLs/params foram usados, o que permite confirmar que toda query é
// filtrada por topografo_id, e nunca por um valor vindo do corpo da
// requisição.
require("dotenv").config();
const assert = require("assert");
const path = require("path");
const Module = require("module");

let passou = 0;
let falhou = 0;

async function testeAsync(nome, fn) {
  try {
    await fn();
    console.log(`✅ ${nome}`);
    passou++;
  } catch (err) {
    console.error(`❌ ${nome}`);
    console.error(`   ${err.message}`);
    falhou++;
  }
}

// ---- mock de dbHelpers injetado em require.cache -----------------
const dbHelpersPath = path.resolve(__dirname, "../../../database/dbHelpers.js");

// "Banco" fake: 2 topógrafos, cada um com 1 cliente.
const CLIENTES = [
  { id: 1, topografo_id: 10, nome: "Cliente do Topógrafo A", cpf_encrypted: null, email: null, telefone: null, criado_em: "2026-01-01" },
  { id: 2, topografo_id: 20, nome: "Cliente do Topógrafo B", cpf_encrypted: null, email: null, telefone: null, criado_em: "2026-01-01" },
];
let proximoId = 3;
const chamadas = [];

const dbHelpersMock = {
  async all(sql, params = []) {
    chamadas.push({ fn: "all", sql, params });
    if (/FROM clientes WHERE topografo_id = \?/.test(sql)) {
      return CLIENTES.filter((c) => c.topografo_id === params[0]);
    }
    return [];
  },
  async get(sql, params = []) {
    chamadas.push({ fn: "get", sql, params });
    if (/FROM clientes WHERE id = \? AND topografo_id = \?/.test(sql)) {
      return CLIENTES.find((c) => c.id === Number(params[0]) && c.topografo_id === params[1]);
    }
    if (/FROM clientes WHERE id = \?/.test(sql)) {
      return CLIENTES.find((c) => c.id === Number(params[0]));
    }
    return undefined;
  },
  async run(sql, params = []) {
    chamadas.push({ fn: "run", sql, params });
    if (/INSERT INTO clientes/.test(sql)) {
      const novo = {
        id: proximoId++,
        topografo_id: params[0],
        nome: params[1],
        cpf_encrypted: params[2],
        email: params[3],
        telefone: params[4],
        criado_em: "2026-01-01",
      };
      CLIENTES.push(novo);
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

// ---- res fake (captura status/json, sem precisar de express) ------
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

const ClientesController = require("../clientes.controller.js");

(async () => {
  // TESTE A -- topógrafo A lista só os clientes de A
  await testeAsync("listar() só retorna clientes do topógrafo autenticado", async () => {
    const req = { topografoId: 10, query: {} };
    const res = resFake();
    await ClientesController.listar(req, res);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].topografo_id, 10);
  });

  // TESTE B -- topógrafo A tentando obter cliente de B -> 404
  await testeAsync("obter() bloqueia (404) cliente de outro topógrafo", async () => {
    const req = { topografoId: 10, params: { clienteId: 2 } }; // cliente 2 é do topógrafo 20
    const res = resFake();
    await ClientesController.obter(req, res);
    assert.strictEqual(res.statusCode, 404);
  });

  await testeAsync("obter() permite cliente do próprio topógrafo", async () => {
    const req = { topografoId: 10, params: { clienteId: 1 } };
    const res = resFake();
    await ClientesController.obter(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.id, 1);
  });

  // TESTE E -- criar cliente sempre usa req.topografoId, mesmo se o
  // corpo da requisição tentar enviar um topografo_id diferente.
  await testeAsync("criar() ignora topografo_id enviado no corpo e usa o do token", async () => {
    const req = {
      topografoId: 10,
      body: { nome: "Novo Cliente", topografo_id: 999999 }, // tentativa de forjar
    };
    const res = resFake();
    await ClientesController.criar(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.topografo_id, 10);
    assert.notStrictEqual(res.body.topografo_id, 999999);

    const insertChamada = chamadas.find((c) => c.fn === "run" && /INSERT INTO clientes/.test(c.sql));
    assert.strictEqual(insertChamada.params[0], 10, "topografo_id passado ao INSERT deve ser o do token");
  });

  await testeAsync("criar() rejeita cliente sem nome", async () => {
    const req = { topografoId: 10, body: {} };
    const res = resFake();
    await ClientesController.criar(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  console.log(`\n${passou} passaram, ${falhou} falharam`);
  process.exit(falhou > 0 ? 1 : 0);
})();
