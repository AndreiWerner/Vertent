const jwt = require("jsonwebtoken");

// ETAPA 3A -- protege as rotas /users/me/*. Este arquivo já existia,
// mas nunca era usado por nenhuma rota ativa (a única rota que o
// importava, GET / em terreno.routes.js, nunca foi montada em
// server.cjs, e sua query dependia de uma tabela "permissoes" que não
// existe no schema -- código morto de um protótipo anterior, não
// mexido/removido nesta etapa). Alinhado aqui ao mesmo padrão do
// middleware/adminAuth.js: aceita "Bearer <token>" (ou só o token puro,
// como antes) e confere `role` -- um token de admin (role: "admin",
// emitido por /admin/login) nunca deve funcionar aqui, e vice-versa.
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "user") {
      return res.status(403).json({ error: "Acesso restrito ao usuário" });
    }

    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};
