"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  Inbox,
  Briefcase,
  CalendarDays,
  PlusCircle,
  User,
  BarChart3,
  Users,
  Settings,
  FileSpreadsheet,
  LogOut,
} from "lucide-react";

const mainNav = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/jobs/new", label: "New", icon: PlusCircle },
  { href: "/dashboard", label: "Dashboard", icon: User },
];

const secondaryNav = [
  { href: "/running-sheets", label: "Running Sheets", icon: FileSpreadsheet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: 60_000,
  });
  const userEmail = session?.user?.email || "";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex h-dvh bg-slate-50">
      {/* Desktop side rail */}
      <aside className="hidden lg:flex lg:w-64 flex-col border-r border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            HEAP / DOH
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Job Management System</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {mainNav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            );
          })}
          <div className="pt-6 pb-2">
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Admin
            </p>
          </div>
          {secondaryNav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-slate-100">
          {userEmail && (
            <div className="px-4 pb-2 text-[11px] text-slate-400 truncate" title={userEmail}>
              {userEmail}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-lg safe-bottom">
          {mainNav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 min-h-[52px] justify-center transition-colors ${
                  active ? "text-blue-600" : "text-slate-400"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
