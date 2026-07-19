import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AudioWaveform,
  BookOpen,
  FolderInput,
  LayoutTemplate,
  Library,
  Mic,
  Settings as SettingsIcon,
} from "lucide-react";

import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
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

function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar p-3">
      <div className="mb-6 flex items-center gap-2 px-2 pt-1">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <AudioWaveform className="size-4" />
        </div>
        <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
          {t("app.name")}
        </span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
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

function AppLayout() {
  const { theme } = useTheme();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
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
