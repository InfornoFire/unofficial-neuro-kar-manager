import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { DownloadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DownloadsButton } from "@/components/DownloadsButton";
import { AuthDialog } from "@/components/download/AuthDialog";
import { BackupWarningDialog } from "@/components/download/BackupWarningDialog";
import { DestinationSection } from "@/components/download/DestinationSection";
import { DownloadLogs } from "@/components/download/DownloadLogs";
import { RemoteConfigSection } from "@/components/download/RemoteConfigSection";
import { SourceInputSection } from "@/components/download/SourceInputSection";
import FileBrowserModal from "@/components/FileBrowserModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useDownloadForm } from "@/hooks/useDownloadForm";
import { useDownloadProcess } from "@/hooks/useDownloadProcess";
import { useRemoteConfig } from "@/hooks/useRemoteConfig";

export default function DownloadPage() {
  const { config, loading: configLoading, saveConfig } = useAppConfig();
  const remoteConfig = useRemoteConfig();
  const form = useDownloadForm();
  const download = useDownloadProcess();

  const [showBrowser, setShowBrowser] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Load config on startup
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only load once
  useEffect(() => {
    if (!configLoading && config) {
      if (config.lastSource) form.setSource(config.lastSource);
      if (config.lastDestination) form.setDestination(config.lastDestination);

      if (config.lastRemote) remoteConfig.setSelectedRemote(config.lastRemote);

      form.setSyncMode(config.syncMode);
      form.setUseSubfolder(config.useSubfolder);
      form.setCreateBackup(config.createBackup);
      form.setDeleteExcluded(config.deleteExcluded);
      form.setTrackRenames(config.trackRenames);

      const savedFiles = config.selectedFiles?.[config.lastSource || ""];
      if (savedFiles) form.setSelectedFiles(savedFiles);
    }
  }, [configLoading]);

  // Save config on changes
  useEffect(() => {
    if (configLoading) return;

    const handler = setTimeout(() => {
      const currentConfig = configRef.current;
      const currentSource = form.source;
      const currentFiles = form.selectedFiles || [];

      const newSelectedFiles = {
        ...currentConfig?.selectedFiles,
        [currentSource]: currentFiles,
      };

      saveConfig({
        lastSource: form.source,
        lastDestination: form.destination,
        lastRemote: remoteConfig.selectedRemote || "",
        syncMode: form.syncMode,
        useSubfolder: form.useSubfolder,
        createBackup: form.createBackup,
        deleteExcluded: form.deleteExcluded,
        trackRenames: form.trackRenames,
        selectedFiles: newSelectedFiles,
      });
    }, 1000);

    return () => clearTimeout(handler);
  }, [
    configLoading,
    form.source,
    form.destination,
    remoteConfig.selectedRemote,
    form.syncMode,
    form.useSubfolder,
    form.createBackup,
    form.deleteExcluded,
    form.trackRenames,
    form.selectedFiles,
    saveConfig,
  ]);

  useEffect(() => {
    const unlistenPromise = listen<string>("gdrive-auth-url", (event) => {
      setAuthUrl(event.payload);
      setShowAuthDialog(true);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleCreateConfig = async () => {
    download.appendLog("\nStarting authorization flow...");
    try {
      const newConfigName = await remoteConfig.createConfig();
      download.appendLog(
        `\nAuthorization successful. Config created: ${newConfigName}`,
      );
      setShowAuthDialog(false);
    } catch (err) {
      download.appendLog(`\nAuthorization failed: ${err}`);
      setShowAuthDialog(false);
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
        form.setDestination(selected);
      }
    } catch (err) {
      console.error("Failed to select destination", err);
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.isValid(remoteConfig.isConfigValid)) {
      download.appendLog(
        "Please provide source, destination, and remote config.",
      );
      return;
    }

    if (!remoteConfig.selectedRemote) {
      download.appendLog("No remote configuration selected.");
      return;
    }

    const hasFileSelection =
      !!form.selectedFiles && form.selectedFiles.length > 0;
    const effectiveDeleteExcluded = hasFileSelection
      ? form.deleteExcluded
      : false;

    // Track renames only makes sense if sync mode is on
    const effectiveTrackRenames = form.syncMode ? form.trackRenames : false;

    await download.startDownload({
      source: form.source,
      destination: form.destination,
      remoteConfig: remoteConfig.selectedRemote,
      syncMode: form.syncMode,
      createSubfolder: form.useSubfolder,
      selectedFiles: form.selectedFiles,
      createBackup: form.createBackup,
      deleteExcluded: effectiveDeleteExcluded,
      trackRenames: effectiveTrackRenames,
    });
  };

  const isDisabled = download.loading || !remoteConfig.isConfigValid;

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-8">
      <BackupWarningDialog
        open={!!download.dryRunResult}
        onOpenChange={(open) => !open && download.cancelDownload()}
        dryRunResult={download.dryRunResult || undefined}
        hasBackup={form.createBackup}
        onConfirm={download.confirmDownload}
      />

      <AuthDialog
        url={authUrl}
        open={showAuthDialog}
        onOpenChange={(open) => {
          if (!open) {
            invoke("cancel_gdrive_auth").catch(console.error);
          }
          setShowAuthDialog(open);
        }}
      />

      {showBrowser && remoteConfig.isConfigValid && (
        <FileBrowserModal
          isOpen={showBrowser}
          onClose={() => setShowBrowser(false)}
          onConfirm={(files) => {
            form.setSelectedFiles(files);
            setShowBrowser(false);
          }}
          source={form.source}
          remoteConfig={remoteConfig.selectedRemote || ""}
          initialSelection={form.selectedFiles || []}
          destination={form.destination}
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
            <RemoteConfigSection
              remotes={remoteConfig.remotes}
              selectedRemote={remoteConfig.selectedRemote}
              onRemoteChange={remoteConfig.setSelectedRemote}
              onCreateConfig={handleCreateConfig}
              onRefreshRemotes={remoteConfig.fetchRemotes}
              loading={remoteConfig.loading || download.loading}
              disabled={download.loading}
            />

            <SourceInputSection
              source={form.source}
              onSourceChange={form.setSource}
              selectedFiles={form.selectedFiles}
              onClearSelection={() => form.setSelectedFiles(null)}
              onBrowseClick={() => setShowBrowser(true)}
              disabled={isDisabled}
            />

            <DestinationSection
              destination={form.destination}
              onDestinationChange={form.setDestination}
              syncMode={form.syncMode}
              onSyncModeChange={form.setSyncMode}
              useSubfolder={form.useSubfolder}
              onUseSubfolderChange={form.setUseSubfolder}
              createBackup={form.createBackup}
              onCreateBackupChange={form.setCreateBackup}
              deleteExcluded={form.deleteExcluded}
              onDeleteExcludedChange={form.setDeleteExcluded}
              trackRenames={form.trackRenames}
              onTrackRenamesChange={form.setTrackRenames}
              hasFileSelection={
                !!form.selectedFiles && form.selectedFiles.length > 0
              }
              onSelectFolder={handleSelectDestination}
              disabled={isDisabled}
            />
          </CardContent>
          <CardFooter>
            {download.loading ? (
              <Button
                key={String(download.cancelling)}
                type="button"
                variant="destructive"
                onClick={download.cancelDownload}
                disabled={download.cancelling}
                className="w-full"
              >
                {download.cancelling ? "Cancelling..." : "Cancel Download"}
              </Button>
            ) : (
              <Button
                type="submit"
                className="w-full"
                disabled={!remoteConfig.isConfigValid}
              >
                Start Download
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>

      <DownloadLogs
        log={download.log}
        status={download.status}
        loading={download.loading}
      />
    </div>
  );
}
