// Testes de isolamento multi-tenant (seção 24, TESTES C/D/F/J do
// pedido) para controllers/topografo/terrenos.controller.js.
//
// node src/controllers/topografo/__tests__/terrenos-isolamento.test.cjs
//
// Mesma técnica do clientes-isolamento.test.cjs: dbHelpers mockado via
// require.cache. Os casos aqui testam especificamente o CURTO-CIRCUITO
// que acontece ANTES de qualquer upload/GLB (checagem de posse do
// cliente e do limite de terrenos), que é o que garante o isolamento
// -- por isso os testes não precisam simular upload de arquivo nem
// Supabase.
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

const dbHelpersPath = path.resolve(__dirname, "../../../database/dbHelpers.js");

// "Banco" fake: cliente 1 pertence ao topógrafo 10 (sem limite);
// cliente 2 pertence ao topógrafo 20 (limite de 1 terreno, já
// atingido -- 1 terreno cadastrado para ele).
const CLIENTES = [
  { id: 1, topografo_id: 10, nome: "Cliente A" },
  { id: 2, topografo_id: 20, nome: "Cliente B" },
];
const TOPOGRAFOS = [
  { id: 10, limite_terrenos: null },
  { id: 20, limite_terrenos: 1 },
];
const TERRENOS_POR_CLIENTE = { 1: [], 2: [{ id: 900 }] }; // cliente 2 já tem 1 terreno

const dbHelpersMock = {
  async all(sql, params = []) {
    if (/FROM terrenos WHERE cliente_id = \?/.test(sql)) {
      return TERRENOS_POR_CLIENTE[params[0]] || [];
    }
    return [];
  },
  async get(sql, params = []) {
    if (/FROM clientes WHERE id = \? AND topografo_id = \?/.test(sql)) {
      return CLIENTES.find((c) => c.id === Number(params[0]) && c.topografo_id === params[1]);
    }
    if (/SELECT limite_terrenos FROM topografos WHERE id = \?/.test(sql)) {
      return TOPOGRAFOS.find((t) => t.id === params[0]);
    }
    if (/COUNT\(\*\)::int AS total\s+FROM terrenos t\s+JOIN clientes c/.test(sql)) {
      const totalDoTopografo = CLIENTES.filter((c) => c.topografo_id === params[0]).reduce(
        (soma, c) => soma + (TERRENOS_POR_CLIENTE[c.id] || []).length,
        0
      );
      return { total: totalDoTopografo };
    }
    if (/FROM users WHERE matricula = \?/.test(sql)) {
      return undefined; // matrícula sempre livre nestes testes
    }
    return undefined;
  },
  async run() {
    return { lastID: 123, changes: 1 };
  },
};

Module._cache[dbHelpersPath] = {
  id: dbHelpersPath,
  filename: dbHelpersPath,
  loaded: true,
  exports: dbHelpersMock,
};

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

const TerrenosController = require("../terrenos.controller.js");

(async () => {
  // TESTE C -- topógrafo A lista terrenos só do seu próprio cliente
  await testeAsync("listarPorCliente() retorna terrenos do cliente do próprio topógrafo", async () => {
    const req = { topografoId: 10, params: { clienteId: 1 } };
    const res = resFake();
    await TerrenosController.listarPorCliente(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, []);
  });

  // TESTE D -- topógrafo A tentando listar terrenos de cliente de B -> bloqueado
  await testeAsync("listarPorCliente() bloqueia (404) cliente de outro topógrafo", async () => {
    const req = { topografoId: 10, params: { clienteId: 2 } }; // cliente 2 é do topógrafo 20
    const res = resFake();
    await TerrenosController.listarPorCliente(req, res);
    assert.strictEqual(res.statusCode, 404);
  });

  // TESTE F -- topógrafo A tenta criar terreno usando cliente de B -> bloqueado
  // (mesmo sem enviar nome/cpf/matricula/arquivo -- a checagem de posse
  // do cliente acontece ANTES de qualquer outra validação)
  await testeAsync("criarParaCliente() bloqueia cliente de outro topógrafo antes de tudo", async () => {
    const req = { topografoId: 10, params: { clienteId: 2 }, body: {} };
    const res = resFake();
    await TerrenosController.criarParaCliente(req, res);
    assert.strictEqual(res.statusCode, 404);
  });

  // TESTE J (parte 2) / seção 18 -- limite de terrenos do plano bloqueia
  // nova criação quando já atingido, mesmo sem chegar a validar
  // nome/cpf/arquivo.
  await testeAsync("criarParaCliente() bloqueia ao atingir o limite_terrenos do plano", async () => {
    const req = { topografoId: 20, params: { clienteId: 2 }, body: {} };
    const res = resFake();
    await TerrenosController.criarParaCliente(req, res);
    assert.strictEqual(res.statusCode, 403);
  });

  // Sem limite definido (null), a validação normal de campos continua
  // sendo o próximo passo -- aqui falha por falta de nome/cpf/matrícula,
  // não por limite.
  await testeAsync("criarParaCliente() sem limite_terrenos segue para validação normal", async () => {
    const req = { topografoId: 10, params: { clienteId: 1 }, body: {} };
    const res = resFake();
    await TerrenosController.criarParaCliente(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.error, /Nome, CPF e matrícula/);
  });

  console.log(`\n${passou} passaram, ${falhou} falharam`);
  process.exit(falhou > 0 ? 1 : 0);
})();
