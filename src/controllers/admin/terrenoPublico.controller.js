const { get, all } = require("../database/dbHelpers");

// GET /terreno-publico/:matricula
//
// Único endpoint pensado para ser chamado diretamente pelo Vertente
// Web (sem login) -- por isso só faz SELECT (nenhuma escrita é
// possível por aqui) e só devolve os campos que o visualizador 3D
// precisa. NUNCA inclui CPF, hash de CPF, dados de usuário/admin ou
// qualquer coluna que não esteja explicitamente listada no SELECT
// abaixo -- ao adicionar colunas novas em `terrenos` no futuro, elas
// só aparecem aqui se forem adicionadas explicitamente a essa lista.
exports.obterPublico = async (req, res) => {
  try {
    const { matricula } = req.params;

    if (!matricula || !matricula.trim()) {
      return res.status(400).json({ error: "Matrícula obrigatória" });
    }

    const terreno = await get(
      `
      SELECT
        id,
        matricula,
        url_terreno,
        area,
        perimetro,
        altura_max,
        altura_min,
        pdf_confrontantes_url AS planta_url,
        memorial_pdf_url AS memorial_url,
        origin_x,
        origin_y,
        origin_z,
        origin_epsg
      FROM terrenos
      WHERE matricula = ?
      `,
      [matricula]
    );

    if (!terreno) {
      return res.status(404).json({ error: "Terreno não encontrado" });
    }

    // Pontos/confrontantes são opcionais -- terrenos cadastrados antes
    // dessa funcionalidade simplesmente não têm nenhum (mesmo
    // tratamento já usado em auth.controller.cjs: listas vazias, não
    // erro).
    const [pontos, confrontantes] = await Promise.all([
      all(
        "SELECT numero, x, y FROM pontos_terreno WHERE terreno_id = ? ORDER BY numero",
        [terreno.id]
      ),
      all(
        "SELECT nome, matricula, ponto_inicio, ponto_fim, ordem FROM confrontantes WHERE terreno_id = ? ORDER BY ordem",
        [terreno.id]
      ),
    ]);

    return res.json({
      matricula: terreno.matricula,
      url_terreno: terreno.url_terreno,
      area: terreno.area,
      perimetro: terreno.perimetro,
      altura_max: terreno.altura_max,
      altura_min: terreno.altura_min,
      planta_url: terreno.planta_url,
      memorial_url: terreno.memorial_url,
      // `null` para terrenos cujo GLB não tem os metadados do Topo
      // Textura (ver utils/glbOrigin.js) -- o Vertente Web não deve
      // tentar posicionar confrontantes nesse caso (ver bloqueio nas
      // pendências).
      origin_x: terreno.origin_x,
      origin_y: terreno.origin_y,
      origin_z: terreno.origin_z,
      origin_epsg: terreno.origin_epsg,
      pontos,
      confrontantes,
    });
  } catch (err) {
    console.error("Erro ao buscar terreno público:", err);
    return res.status(500).json({ error: "Erro ao buscar terreno" });
  }
};
