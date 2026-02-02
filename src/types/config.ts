export interface AppConfig {
  lastSource: string;
  lastDestination: string;
  lastRemote: string;
  syncMode: boolean;
  useSubfolder: boolean;
  createBackup: boolean;
  deleteExcluded: boolean;
  trackRenames: boolean;
  // Map of remote -> selected files
  selectedFiles: Record<string, string[]>;
}

export const NETWORK_DEFAULTS: AppConfig = {
  lastSource: "1B1VaWp-mCKk15_7XpFnImsTdBJPOGx7a",
  lastDestination: "",
  lastRemote: "",
  syncMode: true,
  useSubfolder: true,
  createBackup: true,
  deleteExcluded: true,
  trackRenames: true,
  selectedFiles: {},
};
