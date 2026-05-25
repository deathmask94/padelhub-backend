"use client";
import { useActionState } from "react";
import { updateUserAction } from "../actions";
import Link from "next/link";

const LEVELS = [
  { value: "primera", label: "1ra" },
  { value: "segunda", label: "2da" },
  { value: "tercera", label: "3ra" },
  { value: "cuarta", label: "4ta" },
  { value: "quinta", label: "5ta" },
  { value: "sexta", label: "6ta" },
  { value: "septima_mas", label: "7ma+" },
];

type User = {
  id: string;
  name: string;
  zone: string;
  level: string;
  role: string;
  is_active: boolean;
};

export default function EditForm({ user }: { user: User }) {
  const [state, action, isPending] = useActionState(updateUserAction, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="user_id" value={user.id} />

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Nombre</label>
        <input
          name="name"
          type="text"
          defaultValue={user.name}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Zona</label>
        <input
          name="zone"
          type="text"
          defaultValue={user.zone}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Nivel</label>
        <select
          name="level"
          defaultValue={user.level}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Rol</label>
        <select
          name="role"
          defaultValue={user.role}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="player">Jugador</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Estado</label>
        <select
          name="is_active"
          defaultValue={user.is_active ? "true" : "false"}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
        <Link
          href="/admin/users"
          className="flex-1 text-center border border-gray-300 text-gray-800 hover:text-gray-950 py-2 rounded-lg text-sm transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
