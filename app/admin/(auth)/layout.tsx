import { requireAdmin } from "@/lib/admin-auth";
import { logoutAction } from "./logout";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-lg">PadelHub Admin</span>
            <a
              href="/admin/users"
              className="text-indigo-200 hover:text-white text-sm transition-colors"
            >
              Usuarios
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white text-sm font-medium">{admin.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-indigo-100 hover:text-white transition-colors cursor-pointer"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
