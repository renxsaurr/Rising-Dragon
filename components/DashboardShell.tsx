"use client";

import { MouseEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import GlobalSearch from "@/components/GlobalSearch";

const GridIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"
    />
  </svg>
);
const UsersIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 4v-1a4 4 0 00-3-3.87"
    />
  </svg>
);
const CheckSquareIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
    />
  </svg>
);
const CalendarIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeWidth={1.75} d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const BuildingIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M3 21h18M6 21V7l6-4 6 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"
    />
  </svg>
);
const CreditCardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.75} />
    <path strokeLinecap="round" strokeWidth={1.75} d="M2 10h20" />
  </svg>
);
const AwardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <circle cx="12" cy="8" r="6" strokeWidth={1.75} />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M8.5 13.5L6 22l6-3 6 3-2.5-8.5"
    />
  </svg>
);
const BellIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);
const SettingsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <circle cx="12" cy="12" r="3" strokeWidth={1.75} />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
    />
  </svg>
);
const LogoutIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);
const IdCardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.75} />
    <circle cx="8" cy="12" r="2" strokeWidth={1.75} />
    <path
      strokeLinecap="round"
      strokeWidth={1.75}
      d="M5 17c.5-1.5 1.8-2.5 3-2.5s2.5 1 3 2.5M14 9h6M14 13h6"
    />
  </svg>
);

type CurrentUser = {
  id: number;
  name: string;
  role: string;
  primary_branch_id: number | null;
} | null;

// Last known user, so loading screens can render the same sidebar while the next page is fetched.
let lastKnownUser: CurrentUser = null;
let sidebarOpenMemory = true;

export function getLastKnownUser() {
  return lastKnownUser;
}

export default function DashboardShell({
  title,
  currentUser,
  children,
}: {
  title: string;
  currentUser: CurrentUser;
  children: ReactNode;
}) {
  useEffect(() => {
    if (currentUser) lastKnownUser = currentUser;
  }, [currentUser]);

  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isHeadCoach = currentUser?.role === "head_coach";

  const workspaceItems = [
    {
      label: isHeadCoach ? "Students" : "Student roster",
      href: "/students",
      icon: UsersIcon,
      show: true,
      soon: false,
    },
    {
      label: "Attendance",
      href: "/attendance",
      icon: CheckSquareIcon,
      show: true,
      soon: false,
    },
    {
      label: "Schedule",
      href: "/scheduling",
      icon: CalendarIcon,
      show: true,
      soon: false,
    },
  ];

  const reportItems = [
    {
      label: "Branches",
      href: "/branches",
      icon: BuildingIcon,
      show: isHeadCoach,
      soon: false,
    },
    {
      label: "Payments",
      href: "/payments",
      icon: CreditCardIcon,
      show: isHeadCoach,
      soon: false,
    },
    {
      label: "Promotions",
      href: "/promotions",
      icon: AwardIcon,
      show: isHeadCoach,
      soon: false,
    },
  ];

  const systemItems = [
    {
      label: "Notifications",
      href: "/notifications",
      icon: BellIcon,
      show: true,
      soon: false,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: SettingsIcon,
      show: true,
      soon: false,
    },
    {
      label: "Users",
      href: "/users",
      icon: IdCardIcon,
      show: isHeadCoach,
      soon: false,
    },
  ];

  const handleLogout = async () => {
    lastKnownUser = null;
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Highlight the clicked link immediately instead of waiting for the server render to finish.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(sidebarOpenMemory);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setPendingHref(null);
  }

  const matches = (path: string, href: string) =>
    path === href || path.startsWith(`${href}/`);
  const isActive = (href: string) =>
    pendingHref ? matches(pendingHref, href) : matches(pathname, href);
  const toggleSidebar = () => {
    sidebarOpenMemory = !sidebarOpen;
    setSidebarOpen(sidebarOpenMemory);
  };

  const handleNavClick =
    (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      if (pathname === href) return;
      setPendingHref(href);
    };

  const navLink = (
    href: string,
    label: string,
    Icon: () => React.ReactElement,
  ) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={handleNavClick(href)}
        aria-current={active ? "page" : undefined}
        title={!sidebarOpen ? label : undefined}
        className={`relative flex items-center rounded-lg py-2.5 text-[14px] font-medium transition-colors ${sidebarOpen ? "gap-3 px-3.5" : "justify-center px-2"} ${
          active
            ? "bg-red-600 text-white"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-950"
        }`}
      >
        {active && (
          <span
            className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r bg-white"
            aria-hidden
          />
        )}
        <Icon />
        {sidebarOpen && <span>{label}</span>}
      </Link>
    );
  };

  const renderItem = (item: {
    label: string;
    href: string;
    icon: () => React.ReactElement;
    soon: boolean;
  }) => {
    if (!item.soon) return navLink(item.href, item.label, item.icon);
    const Icon = item.icon;
    return (
      <div
        key={item.href}
        title="Coming soon"
        className="flex cursor-not-allowed items-center justify-between rounded-lg px-3.5 py-2.5 text-[14px] font-medium text-gray-400"
      >
        <div className="flex items-center gap-3">
          <Icon />
          {item.label}
        </div>
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
          Soon
        </span>
      </div>
    );
  };

  const sectionLabel = (label: string) =>
    sidebarOpen ? (
      <p className="mt-5 mb-1.5 border-t border-gray-200 px-3.5 pt-5 text-[12px] font-medium text-gray-500">
        {label}
      </p>
    ) : null;

  return (
    <div data-shell="root" className="flex h-dvh w-full overflow-hidden bg-white">
      <aside data-shell="sidebar" className={`flex h-full shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ${sidebarOpen ? "w-64" : "w-[72px]"}`}>
        <Link
          href="/dashboard"
          onClick={handleNavClick("/dashboard")}
          title={!sidebarOpen ? "Rising Dragon Taekwondo" : undefined}
          className={`flex items-center pt-7 pb-5 ${sidebarOpen ? "gap-3 px-5" : "justify-center px-2"}`}
        >
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-gray-200">
            <Image
              src="/logo.png"
              alt=""
              fill
              sizes="44px"
              className="scale-[1.18] object-cover"
              priority
            />
          </span>
          {sidebarOpen && (
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-wide text-gray-950">
                RISING DRAGON
              </span>
              <span className="block text-[11px] font-medium tracking-[0.2em] text-gray-500">
                TAEKWONDO
              </span>
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse navigation drawer" : "Open navigation drawer"}
          aria-expanded={sidebarOpen}
          className={`mx-3 mb-2 flex h-9 items-center rounded-lg text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 ${sidebarOpen ? "gap-2 px-2.5" : "justify-center"}`}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
          {sidebarOpen && <span>Menu</span>}
        </button>

        <nav className={`no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto ${sidebarOpen ? "px-3" : "px-2"}`}>
          {navLink("/dashboard", "Dashboard", GridIcon)}
          {workspaceItems.filter((item) => item.show).map(renderItem)}
          {isHeadCoach && (
            <>
              {sectionLabel("Report")}
              {reportItems.filter((item) => item.show).map(renderItem)}
              {sectionLabel("System")}
              {systemItems.filter((item) => item.show).map(renderItem)}
            </>
          )}
        </nav>

        <div className="p-4">
          <button
            onClick={handleLogout}
            title={!sidebarOpen ? "Logout" : undefined}
            aria-label="Logout"
            className={`flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white py-2.5 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950 ${sidebarOpen ? "gap-2.5 px-4" : "px-2"}`}
          >
            <LogoutIcon />
            {sidebarOpen && "Logout"}
          </button>
        </div>
      </aside>

      <div data-shell="content" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header data-shell="header" className="flex shrink-0 items-center justify-between gap-3 px-4 pb-5 pt-6 sm:gap-4 sm:px-6 sm:pt-7 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-semibold text-gray-900">
              {title}
            </h1>
          </div>
          {currentUser && (
            <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
              <GlobalSearch canSearchStaff={isHeadCoach} />
              <div className="hidden min-w-0 max-w-56 flex-col border-l border-gray-200 pl-3 leading-tight md:flex">
                <span className="block whitespace-normal break-words text-[13px] font-semibold capitalize text-gray-900">
                  {currentUser.name}
                </span>
                <span className="block text-[11px] text-gray-500">
                  {isHeadCoach ? "Head Coach" : "Assistant Coach"}
                </span>
              </div>
            </div>
          )}
        </header>
        <main
          data-shell="main"
          aria-busy={pendingHref ? true : undefined}
          className={`no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-8 pb-8 transition-opacity ${pendingHref ? "opacity-60" : ""}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
