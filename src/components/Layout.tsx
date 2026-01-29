import { Download, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DownloadPage from "@/pages/Download";
import HomePage from "@/pages/HomePage";

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-32 border-r border-border bg-sidebar text-sidebar-foreground flex flex-col">
        <nav className="flex-1 p-2 space-y-2 overflow-y-auto">
          <Button
            variant={location.pathname === "/home" ? "secondary" : "ghost"}
            className="w-full justify-start gap-2 px-3"
            asChild
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
          >
            <Link to="/download">
              <Download className="h-4 w-4" />
              Download
            </Link>
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full relative">
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
