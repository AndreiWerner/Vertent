import { useRef, useState, type DragEvent } from "react";

type Props = {
  file: File | null;
  onSelect: (file: File | null) => void;
  progress?: number | null;
  label?: string;
  // Extensões aceitas (com ponto, ex.: ".pdf") e mimetypes correspondentes.
  // Padrão: só PDF -- mesmo comportamento de antes. A Planta continua
  // usando o padrão (precisa de PDF pra extrair a tabela de coordenadas
  // por posição na página); o Memorial passa também .doc/.docx.
  extensoesAceitas?: string[];
  mimetypesAceitos?: string[];
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EXTENSOES_PADRAO = [".pdf"];
const MIMETYPES_PADRAO = ["application/pdf"];

export function PdfDropzone({
  file,
  onSelect,
  progress,
  label = "Arraste o PDF aqui",
  extensoesAceitas = EXTENSOES_PADRAO,
  mimetypesAceitos = MIMETYPES_PADRAO,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (!picked) return;

    const nome = picked.name.toLowerCase();
    const extensaoValida = extensoesAceitas.some((ext) => nome.endsWith(ext));
    const mimetypeValido = mimetypesAceitos.includes(picked.type);

    if (!extensaoValida && !mimetypeValido) {
      alert(`Selecione um arquivo ${extensoesAceitas.join(", ")}`);
      return;
    }
    onSelect(picked);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-xl2 border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragOver ? "border-vertente bg-vertente/5" : "border-vertente-medium/30 bg-white"
        }`}
      >
        <p className="text-sm text-vertente-ink">{label}</p>
        <p className="my-2 text-xs text-vertente-medium">ou</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-vertente px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vertente-dark"
        >
          Selecionar arquivo
        </button>
        <p className="mt-3 text-xs text-vertente-medium">
          Formato aceito: {extensoesAceitas.join(", ")}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={[...extensoesAceitas, ...mimetypesAceitos].join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {file && (
        <div className="mt-3 rounded-xl border border-vertente-medium/20 bg-white px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium text-vertente-ink">{file.name}</span>
            <span className="text-vertente-medium">{formatSize(file.size)}</span>
          </div>

          {typeof progress === "number" && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-vertente-bg">
              <div
                className="h-full rounded-full bg-vertente transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
