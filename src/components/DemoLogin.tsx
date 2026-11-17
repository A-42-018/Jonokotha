// TEMPORARY (dev period): one-click demo sign-in for staging. Rendered by /login only while the server env
// DEMO_LOGIN=true. Remove this file, src/lib/demo.ts, src/app/api/demo-login and the two accounts before real users
// or judging (docs/backend-setup.md). Kept out of LoginForm so the frontend's component stays untouched.
export default function DemoLogin({ bn, failed = false }: { bn: boolean; failed?: boolean }) {
  return (
    <form method="post" action="/api/demo-login" className="mt-6 space-y-2 border-t border-slate-200 pt-4">
      <p className="text-sm text-slate-600">{bn ? "ডেমো লগইন (শুধু ডেভেলপমেন্টের জন্য)" : "Demo login (development only)"}</p>
      {failed && <p className="text-sm text-red-700" role="alert">{bn ? "ডেমো লগইন কাজ করেনি।" : "Demo login failed."}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button name="role" value="citizen" className="rounded-lg border border-civic px-4 py-3 text-civic">{bn ? "নাগরিক" : "Citizen"}</button>
        <button name="role" value="staff" className="rounded-lg border border-leaf-strong px-4 py-3 text-leaf-strong">{bn ? "অফিস কর্মী" : "Office staff"}</button>
      </div>
    </form>
  );
}
