const stats = [
  { label: 'Orders Today', value: '128' },
  { label: 'Pending Fulfillment', value: '42' },
  { label: 'Revenue (24h)', value: '৳84,250' },
  { label: 'Low Stock Alerts', value: '9' },
];

export default function AdminDashboardPage() {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-600">
          Central operations overview for Shop Easy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {stat.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

