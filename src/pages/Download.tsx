import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Check,
  DownloadCloud,
  Folder,
  FolderSearch,
  Info,
  Key,
  Save,
  Settings,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DownloadsButton } from "@/components/DownloadsButton";
import FileBrowserModal from "@/components/FileBrowserModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_GDRIVE_SOURCE = "1B1VaWp-mCKk15_7XpFnImsTdBJPOGx7a";
const DEFAULT_RCLONE_CONFIG_NAME = "gdrive_unofficial_neuro_kar";

export default function DownloadPage() {
  const [source, setSource] = useState(DEFAULT_GDRIVE_SOURCE);
  const [destination, setDestination] = useState("");
  const [remotes, setRemotes] = useState<string[]>([]);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(
    DEFAULT_RCLONE_CONFIG_NAME,
  );
  const [useSubfolder, setUseSubfolder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState("");
  const [log, setLog] = useState("");

  const [showBrowser, setShowBrowser] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[] | null>(null);

  const fetchRemotes = useCallback(async () => {
    try {
      const availableRemotes = await invoke<string[]>("get_gdrive_remotes");
      setRemotes(availableRemotes);
    } catch (err) {
      console.error("Failed to fetch remotes", err);
      setLog((prev) => `${prev}Error fetching remotes: ${err}\n`);
    }
  }, []);

  useEffect(() => {
    fetchRemotes();
  }, [fetchRemotes]);

  useEffect(() => {
    setSelectedRemote((prev) => {
      // If manually selected "new config" (null), keep it.
      if (prev === null) {
        return null;
      }
      // If the currently selected remote is still in the list, keep it.
      if (remotes.includes(prev)) {
        return prev;
      }
      // Otherwise, prefer the default config if available.
      if (remotes.includes(DEFAULT_RCLONE_CONFIG_NAME)) {
        return DEFAULT_RCLONE_CONFIG_NAME;
      }
      return null;
    });
  }, [remotes]);

  const handleCreateConfig = async () => {
    setLoading(true);
    setLog(
      (prev) => `${prev}\nStarting authorization flow... check your browser.`,
    );
    try {
      const newConfigName = await invoke<string>("create_gdrive_remote");
      setLog(
        (prev) =>
          `${prev}\nAuthorization successful. Config created: ${newConfigName}`,
      );
      await fetchRemotes();
      setSelectedRemote(newConfigName);
    } catch (err) {
      console.error(err);
      setLog((prev) => `${prev}\nAuthorization failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDestination = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected === null) return;
      if (typeof selected === "string") {
        setDestination(selected);
      }
    } catch (err) {
      console.error("Failed to select destination", err);
    }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (cancelling) return;
    setCancelling(true);
    try {
      setLog((prev) => `${prev}\nRequesting cancellation...`);
      await invoke("stop_rc_server");
    } catch (err) {
      console.error("Failed to stop rclone", err);
      setLog((prev) => `${prev}\nFailed to stop rclone: ${err}`);
      setCancelling(false);
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !destination) {
      setStatus("Please provide both source and destination.");
      return;
    }

    if (!selectedRemote) {
      setStatus("Please select a remote configuration.");
      return;
    }

    setLoading(true);
    setStatus("Downloading...");
    setLog(
      `Starting download...\nSource: ${source}\nDestination: ${destination}\nRemote: ${selectedRemote}\n`,
    );

    try {
      const output = await invoke<string>("download_gdrive", {
        source,
        destination,
        remoteConfig: selectedRemote,
        createSubfolder: useSubfolder,
        selectedFiles,
      });
      setStatus("Download completed successfully.");
      setLog((prev) => `${prev}\n${output}`);
    } catch (error) {
      console.error(error);
      setStatus("Download failed.");
      setLog((prev) => `${prev}\nError: ${error}`);
    } finally {
      setLoading(false);
      setCancelling(false);
    }
  };

  const isConfigValid = !!selectedRemote;

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-8">
      {showBrowser && isConfigValid && (
        <FileBrowserModal
          isOpen={showBrowser}
          onClose={() => setShowBrowser(false)}
          onConfirm={(files) => {
            setSelectedFiles(files);
            setShowBrowser(false);
          }}
          source={source}
          remoteConfig={selectedRemote || ""}
          initialSelection={selectedFiles || []}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DownloadCloud className="h-8 w-8" />
            GDrive Download
          </h1>
          <p className="text-muted-foreground mt-2">
            Download content directly from Google Drive using rclone.
          </p>
        </div>
        <DownloadsButton />
      </div>

      <Card>
        <form onSubmit={handleDownload}>
          <CardContent className="space-y-6 pt-6">
            {/* Remote Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="remote-config"
                  className="flex items-center gap-2"
                >
                  <Folder className="h-4 w-4" />
                  Rclone Remote Config
                </Label>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Info className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <p className="text-sm">
                      If "Generate New Config" is selected, clicking the Key
                      button will open a one-time authorization window in your
                      browser. The config will be saved as "
                      {DEFAULT_RCLONE_CONFIG_NAME}" for future use.
                    </p>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={selectedRemote || "new_config"}
                    onValueChange={(val) =>
                      setSelectedRemote(val === "new_config" ? null : val)
                    }
                    onOpenChange={(open) => {
                      if (open) fetchRemotes();
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger id="remote-config">
                      <SelectValue placeholder="Select a remote" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_config">
                        Generate New Config
                      </SelectItem>
                      {remotes.map((remote) => (
                        <SelectItem key={remote} value={remote}>
                          {remote}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!selectedRemote && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCreateConfig}
                    disabled={loading}
                    title="Authenticate & Generate Config"
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Source Input */}
            <div className="space-y-2">
              <Label htmlFor="source" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                GDrive Source (Link or ID)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="source"
                  type="text"
                  placeholder="e.g. 1AbCdEfGhIjK..."
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={loading || !isConfigValid}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Browse Files"
                  disabled={loading || !isConfigValid}
                  onClick={() => setShowBrowser(true)}
                >
                  <FolderSearch className="h-4 w-4" />
                </Button>
              </div>

              {/* Show Selection Status */}
              {selectedFiles && selectedFiles.length > 0 && (
                <div className="text-sm text-blue-500 flex items-center gap-2 mt-1">
                  <Check className="h-3 w-3" />
                  {selectedFiles.length} files/folders selected for download.
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive flex items-center"
                    onClick={() => setSelectedFiles(null)}
                  >
                    <XCircle className="h-3 w-3 ml-1" /> Clear
                  </button>
                </div>
              )}
            </div>

            {/* Destination Input */}
            <div className="space-y-2">
              <Label htmlFor="destination" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Destination (Local Folder Path)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="destination"
                  type="text"
                  placeholder="/home/user/Downloads/..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  disabled={loading || !isConfigValid}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSelectDestination}
                  disabled={loading || !isConfigValid}
                  title="Select Folder"
                >
                  <Folder className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="useSubfolder"
                  checked={useSubfolder}
                  onCheckedChange={(checked) =>
                    setUseSubfolder(checked as boolean)
                  }
                  disabled={loading || !isConfigValid}
                />
                <Label
                  htmlFor="useSubfolder"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  title="Appends '/Unofficial-Neuro-Karaoke-Archive' to the destination path."
                >
                  Place items in subfolder (/Unofficial-Neuro-Karaoke-Archive)
                </Label>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            {loading ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full"
              >
                {cancelling ? "Cancelling..." : "Cancel Download"}
              </Button>
            ) : (
              <Button
                type="submit"
                className="w-full"
                disabled={!isConfigValid}
              >
                Start Download
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>

      {/* Progress & Logs */}
      {loading && (
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground animate-pulse">
            Starting download process...
          </p>
        </div>
      )}

      {/* Status Output */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value={log || "Ready to download."}
            className="font-mono text-xs min-h-37.5"
          />
          {status && <p className="mt-2 text-sm font-semibold">{status}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
