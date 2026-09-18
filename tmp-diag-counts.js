require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const q = await pool.query(`
    SELECT
      COUNT(*)::int AS terrenos,
      COUNT(*) FILTER (WHERE origin_x IS NOT NULL AND origin_y IS NOT NULL)::int AS com_origin,
      (SELECT COUNT(DISTINCT terreno_id)::int FROM confrontantes) AS terrenos_com_confrontantes,
      (SELECT COUNT(*)::int FROM confrontantes) AS total_confrontantes,
      (SELECT COUNT(*)::int FROM pontos_terreno) AS total_pontos
    FROM terrenos
  `);
  console.log("SUMMARY", JSON.stringify(q.rows[0]));

  const q2 = await pool.query(`
    SELECT COUNT(*)::int AS com_conf_sem_origin
    FROM terrenos t
    WHERE EXISTS (SELECT 1 FROM confrontantes c WHERE c.terreno_id = t.id)
      AND (t.origin_x IS NULL OR t.origin_y IS NULL)
  `);
  console.log("COM_CONF_SEM_ORIGIN", JSON.stringify(q2.rows[0]));

  const q3 = await pool.query(`
    SELECT COUNT(*)::int AS com_conf_e_origin
    FROM terrenos t
    WHERE EXISTS (SELECT 1 FROM confrontantes c WHERE c.terreno_id = t.id)
      AND t.origin_x IS NOT NULL
      AND t.origin_y IS NOT NULL
  `);
  console.log("COM_CONF_E_ORIGIN", JSON.stringify(q3.rows[0]));

  const q4 = await pool.query(`
    SELECT t.id,
           length(t.matricula) AS matricula_len,
           (t.origin_x IS NOT NULL) AS has_ox,
           (t.origin_y IS NOT NULL) AS has_oy,
           (SELECT COUNT(*)::int FROM confrontantes c WHERE c.terreno_id = t.id) AS n_conf,
           (SELECT COUNT(*)::int FROM pontos_terreno p WHERE p.terreno_id = t.id) AS n_pts
    FROM terrenos t
    ORDER BY t.id
  `);
  console.log("ROWS", JSON.stringify(q4.rows));

  await pool.end();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
