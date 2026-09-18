// Teste real de JWT (sem mock -- usa JWT_SECRET de verdade do .env)
// para middleware/topografoAuth.js: garante que um token de admin ou
// de usuário final NUNCA passa aqui, que um token de topógrafo passa e
// popula req.topografoId, e que a ausência de token dá 401.
//
// node src/middleware/__tests__/topografoAuth.test.cjs
require("dotenv").config();
const assert = require("assert");
const jwt = require("jsonwebtoken");
const topografoAuth = require("../topografoAuth.js");

let passou = 0;
let falhou = 0;

function teste(nome, fn) {
  try {
    fn();
    console.log(`✅ ${nome}`);
    passou++;
  } catch (err) {
    console.error(`❌ ${nome}`);
    console.error(`   ${err.message}`);
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

teste("sem token -> 401", () => {
  const req = { headers: {} };
  const res = resFake();
  let chamouNext = false;
  topografoAuth(req, res, () => (chamouNext = true));
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(chamouNext, false);
});

teste("token de admin (role: admin) é rejeitado -> 403", () => {
  const tokenAdmin = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${tokenAdmin}` } };
  const res = resFake();
  let chamouNext = false;
  topografoAuth(req, res, () => (chamouNext = true));
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(chamouNext, false);
});

teste("token de usuário final (role: user) é rejeitado -> 403", () => {
  const tokenUser = jwt.sign({ id: 5, role: "user" }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${tokenUser}` } };
  const res = resFake();
  let chamouNext = false;
  topografoAuth(req, res, () => (chamouNext = true));
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(chamouNext, false);
});

teste("token de topógrafo válido -> next() e req.topografoId populado", () => {
  const tokenTopografo = jwt.sign({ id: 42, role: "topografo" }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${tokenTopografo}` } };
  const res = resFake();
  let chamouNext = false;
  topografoAuth(req, res, () => (chamouNext = true));
  assert.strictEqual(chamouNext, true);
  assert.strictEqual(req.topografoId, 42);
});

teste("token com secret errada -> 401 (inválido)", () => {
  const tokenForjado = jwt.sign({ id: 1, role: "topografo" }, "secret-errada");
  const req = { headers: { authorization: `Bearer ${tokenForjado}` } };
  const res = resFake();
  let chamouNext = false;
  topografoAuth(req, res, () => (chamouNext = true));
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(chamouNext, false);
});

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou > 0 ? 1 : 0);
