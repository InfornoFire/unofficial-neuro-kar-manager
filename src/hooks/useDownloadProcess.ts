import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import type { DownloadParams, DryRunResult } from "@/types/download";

export function useDownloadProcess() {
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const isCancelledRef = useRef(false);
  const [status, setStatus] = useState("");
  const [log, setLog] = useState("");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [pendingParams, setPendingParams] = useState<DownloadParams | null>(
    null,
  );

  const appendLog = (message: string) => {
    setLog((prev) => `${prev}${message}\n`);
  };

  const setCancelledState = (isCancelled: boolean) => {
    isCancelledRef.current = isCancelled;
    setCancelling(isCancelled);
  };

  const clearPendingState = () => {
    setDryRunResult(null);
    setPendingParams(null);
  };

  const handleTransferCancelled = (message = "\nDownload cancelled.") => {
    setStatus("Cancelled.");
    appendLog(message);
    setLoading(false);

    // Ensure states are synced with the current cancellation intention
    setCancelledState(false);
  };

  const isCancellationError = (error: unknown) => {
    const errStr = String(error);
    return errStr.includes("cancelled") || isCancelledRef.current;
  };

  const cancelDownload = async () => {
    // If the modal is open (not loading, result present), handle standard cancel
    if (!loading && dryRunResult) {
      clearPendingState();
      appendLog("\nDownload cancelled by user.");
      setStatus("Cancelled.");
      return;
    }

    // If already cancelling, ignore
    if (cancelling) return;

    // Set cancellation flags
    setCancelledState(true);

    try {
      appendLog("\nRequesting cancellation...");
      await invoke("stop_rc_server");
    } catch (err) {
      console.error("Failed to stop rclone", err);
      appendLog(`\nFailed to stop rclone: ${err}`);
      // Even if stop fails, consider it cancelled on frontend naturally
      setCancelling(false);
    }
  };

  const runDownload = async (params: DownloadParams) => {
    if (isCancelledRef.current) {
      handleTransferCancelled();
      return;
    }

    setLoading(true);
    setStatus("Downloading...");
    appendLog(`Starting download...\n`);

    clearPendingState();

    try {
      const output = await invoke<string>("download_gdrive", {
        source: params.source,
        destination: params.destination,
        remoteConfig: params.remoteConfig,
        syncMode: params.syncMode,
        createSubfolder: params.createSubfolder,
        selectedFiles: params.selectedFiles,
        createBackup: params.createBackup,
        deleteExcluded: params.deleteExcluded,
        trackRenames: params.trackRenames,
      });
      setStatus("Download completed successfully.");
      appendLog(`\n${output}`);
    } catch (error) {
      if (isCancellationError(error)) {
        handleTransferCancelled();
      } else {
        console.error(error);
        setStatus("Download failed.");
        appendLog(`\nError: ${error}`);
      }
    } finally {
      setLoading(false);
      setCancelledState(false);
    }
  };

  const startDownload = async (params: DownloadParams) => {
    setCancelledState(false);

    const configLogs = [
      "Download Configuration:",
      `Source: ${params.source}`,
      `Destination: ${params.destination}`,
      `Remote: ${params.remoteConfig}`,
      `Backup: ${params.createBackup ? "Yes" : "No"}`,
      `Sync Mode: ${params.syncMode ? "Yes" : "No"}`,
    ];

    if (params.syncMode) {
      configLogs.push(
        `Delete Excluded: ${params.deleteExcluded ? "Yes" : "No"}`,
      );
      configLogs.push(
        `Track Renames: ${params.trackRenames ? "Yes (Hash)" : "No"}`,
      );
    }

    setLog(`${configLogs.join("\n")}\n`);

    setLoading(true);
    setStatus("Preparing...");

    if (!params.syncMode) {
      appendLog("\nCopy mode enabled. Skipping dry run check...");
      await runDownload(params);
      return;
    }

    appendLog("\nPerforming dry run to check for potential file deletions...");

    try {
      const result = await invoke<DryRunResult>("check_dry_run", {
        source: params.source,
        destination: params.destination,
        remoteConfig: params.remoteConfig,
        trackRenames: params.trackRenames,
        createSubfolder: params.createSubfolder,
        selectedFiles: params.selectedFiles,
        deleteExcluded: params.deleteExcluded,
      });

      // If user clicked cancel while dry run was in progress, abort here
      if (isCancelledRef.current) {
        handleTransferCancelled("\nDry run cancelled by user.");
        return;
      }

      appendLog(`Dry run complete: ${result.stats}`);

      if (result.would_delete) {
        appendLog(
          "Warning: Files will be deleted. Waiting for confirmation...",
        );
        setDryRunResult(result);
        setPendingParams(params);
        setLoading(false);
      } else {
        appendLog("No files will be deleted. Proceeding with download...");
        await runDownload(params);
      }
    } catch (error) {
      if (isCancellationError(error)) {
        handleTransferCancelled("\nDry run cancelled.");
        return;
      }

      appendLog(`\nDry run failed: ${error}`);
      appendLog("You can still proceed, but file deletion status is unknown.");

      setDryRunResult({
        would_delete: false,
        deleted_files: [],
        stats: "Dry run check failed",
      });
      setPendingParams(params);
      setLoading(false);
    }
  };

  const confirmDownload = () => {
    if (pendingParams) {
      runDownload(pendingParams);
    }
  };

  return {
    loading,
    cancelling,
    status,
    log,
    dryRunResult,
    startDownload,
    confirmDownload,
    cancelDownload,
    appendLog,
  };
}
