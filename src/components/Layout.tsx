import { Download, Home, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DownloadPage from "@/pages/Download";
import HomePage from "@/pages/HomePage";

export default function Layout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-[calc(0.5rem+env(safe-area-inset-top))] left-[calc(0.5rem+env(safe-area-inset-left))] z-50 md:hidden"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden input"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out",
          // Mobile styles
          "fixed inset-y-0 left-0 z-50 h-full w-32 pt-[env(safe-area-inset-top)]",
          isSidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
          // Desktop styles
          "md:translate-x-0 md:static md:w-32 md:shadow-none",
        )}
      >
        <div className="flex justify-end p-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-2 overflow-y-auto">
          <Button
            variant={location.pathname === "/home" ? "secondary" : "ghost"}
            className="w-full justify-start gap-2 px-3"
            asChild
            onClick={() => setIsSidebarOpen(false)}
          >
            <Link to="/home">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button
            variant={location.pathname === "/download" ? "secondary" : "ghost"}
            className="w-full justify-start gap-2 px-3"
            asChild
            onClick={() => setIsSidebarOpen(false)}
          >
            <Link to="/download">
              <Download className="h-4 w-4" />
              Download
            </Link>
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full relative pt-12 md:pt-0">
        <div
          style={{ display: location.pathname === "/home" ? "block" : "none" }}
        >
          <HomePage />
        </div>
        <div
          style={{
            display: location.pathname === "/download" ? "block" : "none",
          }}
        >
          <DownloadPage />
        </div>
      </main>
    </div>
  );
}
