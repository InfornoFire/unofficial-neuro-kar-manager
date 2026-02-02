export interface DryRunResult {
  would_delete: boolean;
  deleted_files: string[];
  stats: string;
}

export interface DownloadParams {
  source: string;
  destination: string;
  remoteConfig: string;
  syncMode: boolean;
  createSubfolder: boolean;
  selectedFiles: string[] | null;
  createBackup: boolean;
  deleteExcluded: boolean;
  trackRenames: boolean;
}
