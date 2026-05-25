import { prisma } from "@/lib/prisma";
import Link from "next/link";
import DeleteButton from "./delete-button";

const LEVEL_LABELS: Record<string, string> = {
  primera: "1ra",
  segunda: "2da",
  tercera: "3ra",
  cuarta: "4ta",
  quinta: "5ta",
  sexta: "6ta",
  septima_mas: "7ma+",
};

const PAGE_SIZE = 50;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    level?: string;
    role?: string;
    active?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.search?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1"));
  const level = params.level || "";
  const role = params.role || "";
  const active = params.active || "";

  const where: any = {};

  if (search) {
    const numSearch = parseInt(search);
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      ...(!isNaN(numSearch) ? [{ rut: numSearch }] : []),
    ];
  }
  if (level) where.level = level;
  if (role) where.role = role;
  if (active !== "") where.is_active = active === "true";

  const [users, total] = await Promise.all([
    prisma.users.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        rut: true,
        dv_rut: true,
        name: true,
        phone: true,
        zone: true,
        level: true,
        mmr: true,
        role: true,
        is_active: true,
      },
    }),
    prisma.users.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildHref(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { search, page: String(page), level, role, active, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    return `/admin/users?${p.toString()}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <span className="text-sm text-gray-700">{total} en total</span>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <input
          name="search"
          type="text"
          defaultValue={search}
          placeholder="Buscar por nombre o RUT..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-64"
        />
        <select
          name="level"
          defaultValue={level}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los niveles</option>
          {Object.entries(LEVEL_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="role"
          defaultValue={role}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los roles</option>
          <option value="player">Jugador</option>
          <option value="admin">Admin</option>
        </select>
        <select
          name="active"
          defaultValue={active}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Buscar
        </button>
        <a
          href="/admin/users"
          className="border border-gray-300 text-gray-800 hover:text-gray-950 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Limpiar
        </a>
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-800">RUT</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-800">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-800">Teléfono</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-800">Zona</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-800">Nivel</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-800">MMR</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-800">Rol</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-800">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-800">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-600 py-12">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-800 font-mono text-xs">
                      {user.rut}-{user.dv_rut}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-950">{user.name}</td>
                    <td className="px-4 py-3 text-gray-800">{user.phone}</td>
                    <td className="px-4 py-3 text-gray-800">{user.zone}</td>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                        {LEVEL_LABELS[user.level] ?? user.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{user.mmr}</td>
                    <td className="px-4 py-3">
                      {user.role === "admin" ? (
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">
                          Admin
                        </span>
                      ) : (
                        <span className="text-gray-700 text-xs">Jugador</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                          Activo
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-medium">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                        >
                          Editar
                        </Link>
                        <DeleteButton userId={user.id} userName={user.name} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-700">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={buildHref({ page: String(page - 1) })}
                className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-800 hover:text-gray-950 transition-colors"
              >
                Anterior
              </a>
            )}
            {page < totalPages && (
              <a
                href={buildHref({ page: String(page + 1) })}
                className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-800 hover:text-gray-950 transition-colors"
              >
                Siguiente
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
