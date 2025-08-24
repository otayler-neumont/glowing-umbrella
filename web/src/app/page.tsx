import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Tabletop RPG Platform</h1>
        <p className="opacity-80 mt-2">Manage campaigns, invite players, schedule sessions, and track characters.</p>
      </header>
      <section className="grid md:grid-cols-2 gap-6">
        <div className="border border-neutral-800 rounded p-5">
          <h2 className="text-xl font-medium mb-2">Get started</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Go to Auth and create or sign in to your account.</li>
            <li>Open Dashboard and create your first campaign.</li>
            <li>Invite a player using their email.</li>
            <li>Schedule a session and set up your character.</li>
          </ol>
          <div className="flex gap-3 mt-4">
            <Link href="/auth" className="bg-blue-600 hover:bg-blue-500 rounded px-4 py-2 text-sm">Auth</Link>
            <Link href="/dashboard" className="bg-emerald-600 hover:bg-emerald-500 rounded px-4 py-2 text-sm">Dashboard</Link>
          </div>
        </div>
        <div className="border border-neutral-800 rounded p-5">
          <h2 className="text-xl font-medium mb-2">What you can do</h2>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Create campaigns and manage membership.</li>
            <li>Send invite links to players via email.</li>
            <li>Plan upcoming sessions with date and duration.</li>
            <li>Create or edit your character per campaign.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
