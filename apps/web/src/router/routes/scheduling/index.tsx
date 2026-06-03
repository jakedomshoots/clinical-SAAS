import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/scheduling/')({
  component: () => (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-clinic-800">Schedule</h1>
      <div className="rounded-lg border border-clinic-200 bg-white p-6">
        <p className="text-center text-clinic-400 py-8">Calendar coming soon</p>
      </div>
    </div>
  ),
});
