"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { AirVent, Users, FileText, Building2, ChevronRight, LogOut } from "lucide-react";

const settings = [
  {
    href: "/settings/companies",
    icon: Building2,
    label: "Companies",
    description: "Vendor companies that issue DOH invoices",
  },
  {
    href: "/settings/ac-models",
    icon: AirVent,
    label: "AC Models",
    description: "Manage AC units available for installs",
  },
  {
    href: "/settings/team",
    icon: Users,
    label: "Team",
    description: "Invite technicians and manage roles",
  },
  {
    href: "/settings/pdf-templates",
    icon: FileText,
    label: "PDF Templates",
    description: "Configure invoice field mappings",
  },
];

export default function SettingsPage() {
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
    <div className="p-5 lg:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Settings</h1>

      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden mb-5">
        {settings.map(({ href, icon: Icon, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
          >
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-blue-50">
              <Icon className="h-5 w-5 text-slate-500 group-hover:text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {userEmail && (
          <div className="p-4 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signed in as</p>
            <p className="text-sm font-medium text-slate-700 truncate">{userEmail}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-4 p-4 w-full text-left hover:bg-red-50 transition-colors group"
        >
          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-red-100">
            <LogOut className="h-5 w-5 text-slate-500 group-hover:text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900 group-hover:text-red-600">Sign out</p>
            <p className="text-xs text-slate-500">End your session and return to the login screen</p>
          </div>
        </button>
      </div>
    </div>
  );
}
