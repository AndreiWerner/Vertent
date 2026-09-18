const jwt = require("jsonwebtoken");

// MULTI-TENANCY -- protege as rotas /topografo/*. Mesmo padrão exato
// de middleware/adminAuth.js e middleware/auth.js: aceita "Bearer
// <token>" (ou só o token puro), verifica com a MESMA JWT_SECRET já
// usada por admin/usuário, e confere `role`. Um token de admin
// (role: "admin") ou de usuário final (role: "user") NUNCA funciona
// aqui, e vice-versa -- é exatamente essa checagem de `role`, e não a
// rota por onde o token entrou, que garante o isolamento entre os
// três tipos de conta.
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ")
    ? header.slice(7)
    : header;

  if (!token) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "topografo") {
      return res.status(403).json({ error: "Acesso restrito ao topógrafo" });
    }

    // Nunca vem do corpo/query da requisição -- todo controller de
    // /topografo/* usa SOMENTE req.topografoId (do token) para filtrar
    // clientes/terrenos, nunca um id enviado pelo cliente da API (ver
    // seção 11 do pedido -- "nunca confiar em topografo_id enviado
    // pelo frontend").
    req.topografoId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};
