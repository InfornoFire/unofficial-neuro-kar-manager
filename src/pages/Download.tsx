import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { DownloadCloud, Folder, RefreshCw, Save, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DownloadsButton } from "@/components/DownloadsButton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedRemote, setSelectedRemote] = useState<string | null>(DEFAULT_RCLONE_CONFIG_NAME);
  const [useSubfolder, setUseSubfolder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState("");
  const [log, setLog] = useState("");

  const fetchRemotes = useCallback(async () => {
    try {
      const availableRemotes = await invoke<string[]>("get_gdrive_remotes");
      setRemotes(availableRemotes);
      if (availableRemotes.includes(DEFAULT_RCLONE_CONFIG_NAME)) {
        setSelectedRemote(DEFAULT_RCLONE_CONFIG_NAME);
      } else {
        setSelectedRemote(null);
      }
    } catch (err) {
      console.error("Failed to fetch remotes", err);
      setLog((prev) => `${prev}Error fetching remotes: ${err}\n`);
    }
  }, []);

  useEffect(() => {
    fetchRemotes();
  }, [fetchRemotes]);

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

    setLoading(true);
    setStatus("Downloading...");
    setLog(
      `Starting download...\nSource: ${source}\nDestination: ${destination}\nRemote: ${selectedRemote || "(Auto-auth)"}\n`,
    );

    try {
      const output = await invoke<string>("download_gdrive", {
        source,
        destination,
        remoteConfig: selectedRemote || null,
        createSubfolder: useSubfolder,
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

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-8">
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
            {/* Source Input */}
            <div className="space-y-2">
              <Label htmlFor="source" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                GDrive Source (Link or ID)
              </Label>
              <Input
                id="source"
                type="text"
                placeholder="e.g. 1AbCdEfGhIjK..."
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={loading}
              />
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
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSelectDestination}
                  disabled={loading}
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
                  disabled={loading}
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

            {/* Remote Selection */}
            <div className="space-y-2">
              <Label
                htmlFor="remote-config"
                className="flex items-center gap-2"
              >
                <Folder className="h-4 w-4" />
                Rclone Remote Config
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    key={remotes.length}
                    value={selectedRemote || "new_config"}
                    onValueChange={(val) =>
                      setSelectedRemote(val === "new_config" ? null : val)
                    }
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={fetchRemotes}
                  disabled={loading}
                  title="Refresh Remotes"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                If "Generate New Config" is selected, a one-time authorization
                window will open in your browser. The config will be saved as "
                {DEFAULT_RCLONE_CONFIG_NAME}" for future use.
              </p>
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
              <Button type="submit" className="w-full">
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
