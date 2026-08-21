import { useRef, useState, type DragEvent } from "react";

type Props = {
  file: File | null;
  onSelect: (file: File | null) => void;
  progress?: number | null;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GlbDropzone({ file, onSelect, progress }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (!picked) return;

    if (!picked.name.toLowerCase().endsWith(".glb")) {
      alert("Selecione um arquivo .glb");
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
        className={`flex flex-col items-center justify-center rounded-xl2 border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-vertente bg-vertente/5"
            : "border-vertente-medium/30 bg-white"
        }`}
      >
        <p className="text-sm text-vertente-ink">
          Arraste o arquivo GLB aqui
        </p>
        <p className="my-2 text-xs text-vertente-medium">ou</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-vertente px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vertente-dark"
        >
          Selecionar arquivo
        </button>
        <p className="mt-3 text-xs text-vertente-medium">Formatos aceitos: .glb</p>

        <input
          ref={inputRef}
          type="file"
          accept=".glb"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {file && (
        <div className="mt-3 rounded-xl border border-vertente-medium/20 bg-white px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium text-vertente-ink">
              {file.name}
            </span>
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
