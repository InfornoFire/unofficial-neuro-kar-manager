import { useState } from "react";

const DEFAULT_GDRIVE_SOURCE = "1B1VaWp-mCKk15_7XpFnImsTdBJPOGx7a";

export function useDownloadForm() {
  const [source, setSource] = useState(DEFAULT_GDRIVE_SOURCE);
  const [destination, setDestination] = useState("");
  const [syncMode, setSyncMode] = useState(true);
  const [useSubfolder, setUseSubfolder] = useState(true);
  const [createBackup, setCreateBackup] = useState(true);
  const [deleteExcluded, setDeleteExcluded] = useState(true);
  const [trackRenames, setTrackRenames] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<string[] | null>(null);

  const isValid = (remoteConfigValid: boolean) => {
    return remoteConfigValid && !!source && !!destination;
  };

  return {
    source,
    setSource,
    destination,
    setDestination,
    syncMode,
    setSyncMode,
    useSubfolder,
    setUseSubfolder,
    createBackup,
    setCreateBackup,
    deleteExcluded,
    setDeleteExcluded,
    trackRenames,
    setTrackRenames,
    selectedFiles,
    setSelectedFiles,
    isValid,
  };
}
