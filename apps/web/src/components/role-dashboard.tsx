import { Calendar, Users, CreditCard, ShieldCheck, Activity, ChevronRight } from 'lucide-react';
import type { UserRole } from '@/lib/view-mode';

interface RoleDashboardProps {
  role: UserRole;
  onDismiss: () => void;
  onGoToOperations: () => void;
}

export function RoleDashboard({ role, onDismiss, onGoToOperations }: RoleDashboardProps) {
  const configs: Record<
    UserRole,
    {
      title: string;
      cards: {
        icon: React.ElementType;
        label: string;
        count: string;
        status: 'complete' | 'in-progress' | 'needs-attention';
      }[];
    }
  > = {
    front_desk: {
      title: 'Front Desk Dashboard',
      cards: [
        {
          icon: Calendar,
          label: "Today's Appointments",
          count: '12 scheduled',
          status: 'in-progress',
        },
        { icon: Users, label: 'Check-in Queue', count: '3 waiting', status: 'needs-attention' },
        { icon: Activity, label: 'Messages', count: '2 unread', status: 'in-progress' },
      ],
    },
    provider: {
      title: 'Provider Dashboard',
      cards: [
        { icon: Users, label: "Today's Patients", count: '8 visits', status: 'in-progress' },
        { icon: ShieldCheck, label: 'Open Charts', count: '3 pending', status: 'needs-attention' },
        { icon: Activity, label: 'Pending Tasks', count: '5 tasks', status: 'in-progress' },
      ],
    },
    billing: {
      title: 'Billing Dashboard',
      cards: [
        { icon: CreditCard, label: 'Claims Queue', count: '24 claims', status: 'in-progress' },
        { icon: Activity, label: 'Denials', count: '3 to review', status: 'needs-attention' },
        { icon: Calendar, label: 'Aging Report', count: '7 > 30 days', status: 'needs-attention' },
      ],
    },
    manager: {
      title: 'Operations Overview',
      cards: [
        {
          icon: ShieldCheck,
          label: 'Operations Status',
          count: 'Full dashboard',
          status: 'complete',
        },
        { icon: Activity, label: 'Critical Actions', count: 'See below', status: 'in-progress' },
        { icon: Users, label: 'Team Activity', count: 'All roles', status: 'complete' },
      ],
    },
    admin: {
      title: 'System Overview',
      cards: [
        { icon: Activity, label: 'System Health', count: 'All green', status: 'complete' },
        { icon: Users, label: 'User Management', count: '5 active', status: 'complete' },
        { icon: ShieldCheck, label: 'Audit Logs', count: 'View logs', status: 'complete' },
      ],
    },
  };

  const config = configs[role] || configs.manager;

  const statusDot = (status: string) => {
    if (status === 'complete') return <span className="h-2.5 w-2.5 rounded-full bg-success" />;
    if (status === 'needs-attention')
      return <span className="h-2.5 w-2.5 rounded-full bg-danger" />;
    return <span className="h-2.5 w-2.5 rounded-full bg-warn" />;
  };

  return (
    <div className="mb-5 rounded-lg border border-border bg-canvas-raised p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-headline font-semibold text-ink">{config.title}</h2>
        <button
          onClick={onDismiss}
          className="text-small text-ink-muted hover:text-ink transition-colors"
        >
          Dismiss
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {config.cards.map((card) => (
          <div
            key={card.label}
            className="rounded-md border border-border bg-canvas p-4 hover:bg-canvas-sunk/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="h-4 w-4 text-accent" />
              <span className="text-small font-medium text-ink-secondary">{card.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {statusDot(card.status)}
              <span className="text-body font-semibold text-ink">{card.count}</span>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onGoToOperations}
        className="mt-4 inline-flex items-center gap-1.5 text-small font-medium text-accent hover:text-accent-hover transition-colors"
      >
        Go to full Operations
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
