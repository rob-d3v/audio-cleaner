import { useState } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AudioWaveform,
  BookOpen,
  FolderInput,
  LayoutTemplate,
  Library,
  Menu,
  Mic,
  Settings as SettingsIcon,
} from "lucide-react";

import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import LibraryPage from "@/pages/LibraryPage";
import RecordPage from "@/pages/RecordPage";
import ImportWizardPage from "@/pages/ImportWizardPage";
import TemplatesPage from "@/pages/TemplatesPage";
import SettingsPage from "@/pages/SettingsPage";
import GuidePage from "@/pages/GuidePage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";

const queryClient = new QueryClient();

const NAV_ITEMS = [
  { to: "/", key: "nav.library", icon: Library },
  { to: "/record", key: "nav.record", icon: Mic },
  { to: "/import", key: "nav.import", icon: FolderInput },
  { to: "/templates", key: "nav.templates", icon: LayoutTemplate },
  { to: "/settings", key: "nav.settings", icon: SettingsIcon },
  { to: "/guide", key: "nav.guide", icon: BookOpen },
] as const;

// Thumb-reachable shortlist for the mobile bottom bar — the full list (incl.
// Templates/Guide) lives in the hamburger drawer.
const BOTTOM_NAV_PATHS = new Set(["/", "/record", "/import", "/settings"]);
const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => BOTTOM_NAV_PATHS.has(item.to));

function isNavActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function Brand() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
        <AudioWaveform className="size-4" />
      </div>
      <span className="font-heading text-sm font-semibold tracking-tight text-foreground">{t("app.name")}</span>
    </div>
  );
}

function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar p-3 md:flex">
      <div className="mb-6 px-2 pt-1">
        <Brand />
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavActive(location.pathname, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                isActive && "bg-sidebar-accent text-foreground",
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity",
                  isActive && "opacity-100",
                )}
              />
              <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")} />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileTopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-2 md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        onClick={onOpenNav}
        aria-label={t("nav.open_menu")}
      >
        <Menu />
      </Button>
      <Brand />
    </header>
  );
}

function NavDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle asChild>
            <div>
              <Brand />
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavActive(location.pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  isActive && "bg-sidebar-accent text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")} />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-sidebar md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const isActive = isNavActive(location.pathname, item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors",
              isActive && "text-primary",
            )}
          >
            <Icon className="size-5" />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

function AppLayout() {
  const { theme } = useTheme();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground md:flex-row">
      <MobileTopBar onOpenNav={() => setNavOpen(true)} />
      <NavDrawer open={navOpen} onOpenChange={setNavOpen} />
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/import" element={<ImportWizardPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/project/:id" element={<ProjectDetailPage />} />
        </Routes>
      </main>
      <BottomNav />
      <Toaster theme={theme} position="bottom-right" />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
