const crypto = require("crypto");

// CPF precisa ser recuperável no painel admin (por isso criptografia
// reversível, e não hash). A senha do admin e o CPF usado no login do
// app continuam usando bcrypt normalmente - isso aqui é só para o
// admin conseguir VER o CPF de um usuário já cadastrado.

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const raw = process.env.CPF_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CPF_ENCRYPTION_KEY não configurada no .env (gere uma com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "CPF_ENCRYPTION_KEY inválida: precisa ser uma string hex de 32 bytes (64 caracteres)"
    );
  }
  return key;
}

function encryptCpf(cpfPlain) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(cpfPlain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Formato armazenado: iv:authTag:ciphertext (tudo em hex)
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(
    ":"
  );
}

function decryptCpf(stored) {
  if (!stored) return null;

  const [ivHex, authTagHex, dataHex] = stored.split(":");
  if (!ivHex || !authTagHex || !dataHex) return null;

  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

module.exports = { encryptCpf, decryptCpf };
