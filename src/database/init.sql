-- 👤 TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  cpf_hash TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE
);

-- 🌍 TABELA DE TERRENOS
CREATE TABLE IF NOT EXISTS terrenos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricula TEXT NOT NULL,
  url_terreno TEXT NOT NULL,

  area REAL,
  perimetro REAL,
  altura_max REAL,
  altura_min REAL,

  FOREIGN KEY (matricula) REFERENCES users(matricula)
);