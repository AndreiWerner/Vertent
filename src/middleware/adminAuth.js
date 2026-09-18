const jwt = require("jsonwebtoken");

// Protege as rotas /admin/*. Usuários comuns do app mobile nunca têm
// um token gerado por /admin/login (o payload traz role: "admin"),
// então não conseguem acessar essas rotas mesmo que tentem reutilizar
// algum token.
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

    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito ao administrador" });
    }

    req.adminId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};
