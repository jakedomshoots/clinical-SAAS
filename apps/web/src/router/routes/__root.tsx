import {Link, Outlet, createRootRoute, useRouter} from '@tanstack/react-router';
import {useAuth} from '@/lib/auth';
import {Activity, Calendar, ClipboardList, LogOut, MessageSquare, Printer, Users} from 'lucide-react';

function SideNav() {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/schedule', label: 'Schedule', icon: Calendar },
    { to: '/faxes', label: 'Faxes', icon: Printer },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-clinic-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-clinic-200 px-4">
        <Activity className="h-5 w-5 text-accent-600" />
        <span className="font-semibold text-clinic-800">ConciergeOS</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-clinic-600 transition-colors hover:bg-clinic-100 hover:text-clinic-900 [&.active]:bg-clinic-100 [&.active]:text-clinic-900"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-clinic-200 p-3">
        <div className="mb-1 text-xs text-clinic-400">{user?.display_name}</div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-clinic-500 hover:bg-clinic-100 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export const Route = createRootRoute({
  component: () => {
    const { isAuthenticated } = useAuth();
    const router = useRouter();

    if (!isAuthenticated) {
      router.navigate({ to: '/login' });
      return null;
    }

    return (
      <div className="flex h-screen overflow-hidden">
        <SideNav />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
    );
  },
});
