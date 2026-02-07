import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Folder, Info, Save, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  HybridTooltip,
  HybridTooltipContent,
  HybridTooltipTrigger,
} from "@/components/ui/hybrid-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdvancedOptionsModal } from "./AdvancedOptionsModal";

interface DestinationSectionProps {
  destination: string;
  onDestinationChange: (destination: string) => void;
  syncMode: boolean;
  onSyncModeChange: (checked: boolean) => void;
  useSubfolder: boolean;
  onUseSubfolderChange: (checked: boolean) => void;
  createBackup: boolean;
  onCreateBackupChange: (checked: boolean) => void;
  deleteExcluded: boolean;
  onDeleteExcludedChange: (checked: boolean) => void;
  trackRenames: boolean;
  onTrackRenamesChange: (checked: boolean) => void;
  hasFileSelection: boolean;
  onSelectFolder: () => void;
  disabled: boolean;
}

export function DestinationSection({
  destination,
  onDestinationChange,
  syncMode,
  onSyncModeChange,
  useSubfolder,
  onUseSubfolderChange,
  createBackup,
  onCreateBackupChange,
  deleteExcluded,
  onDeleteExcludedChange,
  trackRenames,
  onTrackRenamesChange,
  hasFileSelection,
  onSelectFolder,
  disabled,
}: DestinationSectionProps) {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  return (
    <div className="space-y-2">
      <AdvancedOptionsModal
        isOpen={showAdvancedOptions}
        onClose={() => setShowAdvancedOptions(false)}
        useSubfolder={useSubfolder}
        onUseSubfolderChange={onUseSubfolderChange}
        createBackup={createBackup}
        onCreateBackupChange={onCreateBackupChange}
        deleteExcluded={deleteExcluded}
        onDeleteExcludedChange={onDeleteExcludedChange}
        trackRenames={trackRenames}
        onTrackRenamesChange={onTrackRenamesChange}
        disabled={disabled}
        hasFileSelection={hasFileSelection}
        syncMode={syncMode}
      />

      <Label htmlFor="destination" className="flex items-center gap-2">
        <Save className="h-4 w-4" />
        <Trans>Destination (Local Folder Path)</Trans>
      </Label>
      <div className="flex gap-2">
        <Input
          id="destination"
          type="text"
          placeholder="/home/user/Downloads/..."
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onSelectFolder}
          disabled={disabled}
          title={t`Select Folder`}
        >
          <Folder className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-2">
          <Switch
            id="syncMode"
            checked={syncMode}
            onCheckedChange={onSyncModeChange}
            disabled={disabled}
          />
          <Label
            htmlFor="syncMode"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {syncMode ? (
              <Trans>Sync Mode (Destructive)</Trans>
            ) : (
              <Trans>Copy Mode (Download Only)</Trans>
            )}
          </Label>
          <HybridTooltip>
            <HybridTooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors peer-disabled:opacity-70" />
            </HybridTooltipTrigger>
            <HybridTooltipContent className="w-80">
              <p className="text-sm">
                <Trans>
                  Copy will only download/update files. Sync can additionally
                  delete unwanted files (including if files were renamed).
                </Trans>
              </p>
            </HybridTooltipContent>
          </HybridTooltip>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedOptions(true)}
          disabled={disabled}
          type="button"
        >
          <Settings className="mr-2 h-4 w-4" />
          <Trans>Advanced Options</Trans>
        </Button>
      </div>
    </div>
  );
}
