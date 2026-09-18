const db = require("../database/db.cjs");

// 🔥 DADOS DO TERRENO
const matricula = "2";
const url = "https://vertent-web-np6e.vercel.app/?url=/models/adegil1.glb";

const area = "23.3ha";
const perimetro = "240m";
const altura_max = 220.4;
const altura_min = 100.1;

db.run(
  `INSERT OR REPLACE INTO terrenos 
   (matricula, url_terreno, area, perimetro, altura_max, altura_min)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [matricula, url, area, perimetro, altura_max, altura_min],
  function (err) {
    if (err) {
      console.error("Erro:", err);
    } else {
      console.log("✅ Terreno salvo/atualizado ID:", this.lastID);
    }
  }
);