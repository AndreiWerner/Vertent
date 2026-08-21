export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl2 bg-white p-6 shadow-card">
      <p className="font-display text-3xl font-semibold text-vertente-dark">{value}</p>
      <p className="mt-1 text-sm text-vertente-medium">{label}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: "ativo" | "inativo" }) {
  const isActive = status === "ativo";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
        isActive
          ? "bg-vertente-light/40 text-vertente-dark"
          : "bg-red-100 text-red-700"
      }`}
    >
      {isActive ? "Ativo" : "Inativo"}
    </span>
  );
}
