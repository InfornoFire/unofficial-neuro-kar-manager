import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  File,
  Folder,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";

interface GdriveFile {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  mimeType: string;
}

interface FileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selected: string[] | null) => void;
  source: string;
  remoteConfig: string;
  initialSelection?: string[];
}

export default function FileBrowserModal({
  isOpen,
  onClose,
  onConfirm,
  source,
  remoteConfig,
  initialSelection = [],
}: FileBrowserModalProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [allItems, setAllItems] = useState<GdriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection is a Set of paths relative to root
  const [selection, setSelection] = useState<Set<string>>(
    new Set(initialSelection),
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const loadAllFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<GdriveFile[]>("list_gdrive_files", {
        source,
        remoteConfig,
      });
      setAllItems(result);
    } catch (err) {
      console.error(err);
      setError(`Failed to list files: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [source, remoteConfig]);

  useEffect(() => {
    if (isOpen) {
      setCurrentPath("");
      setHistory([]);
      setSearch("");
      setDebouncedSearch("");
      loadAllFiles();
    }
  }, [isOpen, loadAllFiles]);

  // Debounce search input (prevent excessive filtering and lag)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 100);
    return () => clearTimeout(timer);
  }, [search]);

  const handleBack = () => {
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCurrentPath(prev || "");
  };

  // Memoize descendant map for performance
  const descendantsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allItems.forEach((item) => {
      if (item.isDir) {
        const descendants = allItems
          .filter(
            (i) => i.path !== item.path && i.path.startsWith(`${item.path}/`),
          )
          .map((i) => i.path);
        map.set(item.path, descendants);
      }
    });
    return map;
  }, [allItems]);

  const toggleSelection = (path: string, isDir: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev);
      const isSelected = next.has(path);

      if (isDir) {
        const descendants = descendantsMap.get(path) || [];
        if (isSelected) {
          next.delete(path);
          descendants.forEach((d) => {
            next.delete(d);
          });
        } else {
          next.add(path);
          descendants.forEach((d) => {
            next.add(d);
          });
        }
      } else {
        isSelected ? next.delete(path) : next.add(path);
      }

      return next;
    });
  };

  const displayItems = useMemo(() => {
    if (!allItems.length) return [];

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      return allItems.filter((i) => i.name.toLowerCase().includes(searchLower));
    }

    const prefix = currentPath ? `${currentPath}/` : "";
    return allItems.filter((item) => {
      if (currentPath && !item.path.startsWith(prefix)) return false;
      const relative = currentPath ? item.path.slice(prefix.length) : item.path;
      return !relative.includes("/");
    });
  }, [allItems, debouncedSearch, currentPath]);

  const sortedDisplayItems = useMemo(() => {
    return [...displayItems].sort((a, b) => {
      if (a.isDir === b.isDir) {
        return a.name.localeCompare(b.name);
      }
      return a.isDir ? -1 : 1;
    });
  }, [displayItems]);

  const allVisibleSelected =
    sortedDisplayItems.length > 0 &&
    sortedDisplayItems.every((i) => selection.has(i.path));

  const handleSelectAll = (checked: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev);
      sortedDisplayItems.forEach((item) => {
        const descendants = item.isDir
          ? descendantsMap.get(item.path) || []
          : [];
        if (checked) {
          next.add(item.path);
          descendants.forEach((d) => {
            next.add(d);
          });
        } else {
          next.delete(item.path);
          descendants.forEach((d) => {
            next.delete(d);
          });
        }
      });
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-200 h-150 flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Browse Drive
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!currentPath && !debouncedSearch}
              onClick={
                debouncedSearch
                  ? () => {
                      setSearch("");
                      setDebouncedSearch("");
                    }
                  : handleBack
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {!debouncedSearch ? (
              <div className="flex-1 px-3 py-2 bg-background border rounded-md text-sm font-mono truncate">
                root/{currentPath}
              </div>
            ) : (
              <div className="flex-1 px-3 py-2 bg-accent/50 border rounded-md text-sm font-medium italic">
                Search results for "{debouncedSearch}"
              </div>
            )}

            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search all files..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>Fetching file list...</p>
              <p className="text-xs mt-2 opacity-70">
                This might take a moment
              </p>
            </div>
          ) : error ? (
            <div className="text-destructive p-4 text-center">{error}</div>
          ) : (
            <div className="space-y-1">
              {sortedDisplayItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No items found.
                </p>
              ) : (
                sortedDisplayItems.map((item) => (
                  <div
                    key={item.path}
                    className="flex items-center gap-3 p-2 hover:bg-accent rounded-md group transition-colors"
                  >
                    <Checkbox
                      checked={selection.has(item.path)}
                      onCheckedChange={() =>
                        toggleSelection(item.path, item.isDir)
                      }
                      className="mr-2"
                    />

                    <button
                      type="button"
                      className="flex-1 flex items-center gap-3 cursor-pointer text-left"
                      onClick={() => {
                        if (item.isDir) {
                          setHistory((prev) => [...prev, currentPath]);
                          setCurrentPath(item.path);
                          setSearch("");
                        } else {
                          toggleSelection(item.path, false);
                        }
                      }}
                    >
                      {item.isDir ? (
                        <Folder className="h-5 w-5 text-blue-400 fill-blue-400/20" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium leading-none truncate"
                          title={item.path}
                        >
                          {debouncedSearch ? item.path : item.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.isDir
                            ? "Folder"
                            : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                        </p>
                      </div>

                      {item.isDir && !debouncedSearch && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allVisibleSelected}
              onCheckedChange={(c) => handleSelectAll(c as boolean)}
              disabled={loading || sortedDisplayItems.length === 0}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium cursor-pointer select-none"
            >
              Select Visible
            </label>
            <span className="ml-4 text-sm text-muted-foreground border-l pl-4">
              {selection.size} item{selection.size !== 1 && "s"} selected
            </span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => onConfirm(Array.from(selection))}>
              <Check className="mr-2 h-4 w-4" />
              Confirm Selection
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
