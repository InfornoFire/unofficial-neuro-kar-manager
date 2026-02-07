import { Trans } from "@lingui/react/macro";
import { Info, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HybridTooltip,
  HybridTooltipContent,
  HybridTooltipTrigger,
} from "@/components/ui/hybrid-tooltip";
import { Label } from "@/components/ui/label";

interface AdvancedOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  useSubfolder: boolean;
  onUseSubfolderChange: (checked: boolean) => void;
  createBackup: boolean;
  onCreateBackupChange: (checked: boolean) => void;
  deleteExcluded: boolean;
  onDeleteExcludedChange: (checked: boolean) => void;
  trackRenames: boolean;
  onTrackRenamesChange: (checked: boolean) => void;
  disabled: boolean;
  hasFileSelection: boolean;
  syncMode: boolean;
}

export function AdvancedOptionsModal({
  isOpen,
  onClose,
  useSubfolder,
  onUseSubfolderChange,
  createBackup,
  onCreateBackupChange,
  deleteExcluded,
  onDeleteExcludedChange,
  trackRenames,
  onTrackRenamesChange,
  disabled,
  hasFileSelection,
  syncMode,
}: AdvancedOptionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <Trans>Advanced Options</Trans>
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="useSubfolder"
              checked={useSubfolder}
              onCheckedChange={(checked) =>
                onUseSubfolderChange(checked as boolean)
              }
              disabled={disabled}
            />
            <Label
              htmlFor="useSubfolder"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <Trans>Place items in subfolder</Trans>
            </Label>
            <HybridTooltip>
              <HybridTooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors peer-disabled:opacity-70" />
              </HybridTooltipTrigger>
              <HybridTooltipContent className="w-80">
                <p className="text-sm">
                  <Trans>
                    Appends '/Unofficial-Neuro-Karaoke-Archive' to the
                    destination path.
                  </Trans>
                </p>
              </HybridTooltipContent>
            </HybridTooltip>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createBackup"
              checked={createBackup}
              onCheckedChange={(checked) =>
                onCreateBackupChange(checked as boolean)
              }
              disabled={disabled}
            />
            <Label
              htmlFor="createBackup"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <Trans>Create Backup Folder</Trans>
            </Label>
            <HybridTooltip>
              <HybridTooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors peer-disabled:opacity-70" />
              </HybridTooltipTrigger>
              <HybridTooltipContent className="w-80">
                <p className="text-sm">
                  <Trans>
                    Generate a Backup Folder outside of the destination at
                    Backup-KAR-{"{TIME}"}
                  </Trans>
                </p>
              </HybridTooltipContent>
            </HybridTooltip>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="deleteExcluded"
              checked={deleteExcluded}
              onCheckedChange={(checked) =>
                onDeleteExcludedChange(checked as boolean)
              }
              disabled={disabled || !hasFileSelection || !syncMode}
            />
            <Label
              htmlFor="deleteExcluded"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <Trans>Delete excluded files</Trans>
            </Label>
            <HybridTooltip>
              <HybridTooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors peer-disabled:opacity-70" />
              </HybridTooltipTrigger>
              <HybridTooltipContent className="w-80">
                <p className="text-sm">
                  <Trans>
                    While download sync will delete files not in the archive
                    normally, it may fail to delete excluded files unless this
                    is checked. Only active in Sync Mode. Only applies if there
                    is a filter selection. Equivalent to --delete-excluded.
                  </Trans>
                </p>
              </HybridTooltipContent>
            </HybridTooltip>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="trackRenames"
              checked={trackRenames}
              onCheckedChange={(checked) =>
                onTrackRenamesChange(checked as boolean)
              }
              disabled={disabled || !syncMode}
            />
            <Label
              htmlFor="trackRenames"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <Trans>Track Renames (Hash Strategy)</Trans>
            </Label>
            <HybridTooltip>
              <HybridTooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors peer-disabled:opacity-70" />
              </HybridTooltipTrigger>
              <HybridTooltipContent className="w-80">
                <p className="text-sm">
                  <Trans>
                    Avoid redownloading files by checking if they are renamed or
                    moved. Only active in Sync Mode. --track-renames with hash
                    strategy.
                  </Trans>
                </p>
              </HybridTooltipContent>
            </HybridTooltip>
          </div>
        </div>

        <div className="p-4 border-t bg-muted/30 flex justify-end">
          <Button onClick={onClose}>
            <Trans>Done</Trans>
          </Button>
        </div>
      </Card>
    </div>
  );
}
