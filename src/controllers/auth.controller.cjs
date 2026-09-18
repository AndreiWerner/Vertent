const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database/db.cjs");

exports.login = (req, res) => {
  const { cpf, matricula } = req.body;

  if (!cpf || !matricula) {
    return res.status(400).json({ error: "CPF e matrícula obrigatórios" });
  }

  const cpfLimpo = cpf.replace(/\D/g, "");

  db.get(
    "SELECT * FROM users WHERE matricula = ?",
    [matricula],
    async (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erro interno" });
      }

      if (!user) {
        return res.status(401).json({ error: "Usuário não encontrado" });
      }

      const cpfValido = await bcrypt.compare(cpfLimpo, user.cpf_hash);

      if (!cpfValido) {
        return res.status(401).json({ error: "CPF inválido" });
      }

      // Usuários desativados pelo painel administrativo não acessam o terreno
      if (user.status === "inativo") {
        return res.status(403).json({ error: "Acesso desativado. Entre em contato com o administrador." });
      }

      db.get(
        "SELECT * FROM terrenos WHERE matricula = ?",
        [matricula],
        (err, terreno) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao buscar terreno" });
          }

          if (!terreno) {
            return res.json({
              usuario: { id: user.id, nome: user.nome, matricula: user.matricula },
              terreno: terreno,
              // ETAPA 3A -- aditivo: o app atual ignora este campo e
              // continua funcionando exatamente como antes. Usado só
              // pelas novas rotas GET/POST /users/me/terrenos.
              token: emitirTokenUsuario(user.id),
            });
          }

          // Confrontantes/pontos são opcionais (terrenos cadastrados
          // antes desta funcionalidade não têm nenhum) -- por isso o
          // app recebe listas vazias nesse caso, não um erro. O app
          // não mantém sessão/token depois do login (é uma chamada só
          // que já devolve tudo que a tela de terreno precisa), então
          // esses dados entram aqui em vez de um endpoint separado
          // que o app não teria como autenticar depois.
          db.all(
            "SELECT numero, x, y FROM pontos_terreno WHERE terreno_id = ? ORDER BY numero",
            [terreno.id],
            (err, pontos) => {
              if (err) {
                console.error(err);
                return res.status(500).json({ error: "Erro ao buscar pontos do terreno" });
              }

              db.all(
                "SELECT nome, matricula, ponto_inicio, ponto_fim, ordem FROM confrontantes WHERE terreno_id = ? ORDER BY ordem",
                [terreno.id],
                (err, confrontantes) => {
                  if (err) {
                    console.error(err);
                    return res.status(500).json({ error: "Erro ao buscar confrontantes" });
                  }

                  return res.json({
                    usuario: {
                      id: user.id,
                      nome: user.nome,
                      matricula: user.matricula,
                    },
                    terreno: {
                      ...terreno,
                      pontos,
                      confrontantes,
                    },
                    // ETAPA 3A -- ver comentário no outro branch acima.
                    token: emitirTokenUsuario(user.id),
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

// ETAPA 3A -- token de usuário comum (role: "user"), consumido só por
// middleware/auth.js nas novas rotas /users/me/*. Mesma JWT_SECRET que
// o token de admin já usa (role: "admin") -- o `role` é o que impede
// um token valer para as rotas do outro (ver middleware/auth.js e
// middleware/adminAuth.js). Sem expiresIn de propósito: o app mobile
// não tinha nenhum conceito de sessão/expiração até agora; adicionar
// uma expiração agora exigiria também um fluxo de refresh que não
// existe e não foi pedido nesta etapa.
function emitirTokenUsuario(userId) {
  return jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET);
}