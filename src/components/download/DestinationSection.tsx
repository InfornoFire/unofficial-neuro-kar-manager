import { Folder, Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  hasFileSelection,
  onSelectFolder,
  disabled,
}: DestinationSectionProps) {
  return (
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
          onChange={(e) => onDestinationChange(e.target.value)}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onSelectFolder}
          disabled={disabled}
          title="Select Folder"
        >
          <Folder className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center space-x-2 pt-1">
        <Switch
          id="syncMode"
          checked={syncMode}
          onCheckedChange={onSyncModeChange}
          disabled={disabled}
        />
        <Label
          htmlFor="syncMode"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
        >
          {syncMode ? "Sync Mode (Destructive)" : "Copy Mode (Download Only)"}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <p className="text-sm">
                Copy will only download/update files. Sync can additionally delete unwanted files (including if files were renamed).
              </p>
            </HoverCardContent>
          </HoverCard>
        </Label>
      </div>
      <div className="flex items-center space-x-2 pt-1">
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
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
        >
          Place items in subfolder
          <HoverCard>
            <HoverCardTrigger asChild>
              <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <p className="text-sm">
                Appends '/Unofficial-Neuro-Karaoke-Archive' to the destination
                path.
              </p>
            </HoverCardContent>
          </HoverCard>
        </Label>
      </div>
      <div className="flex items-center space-x-2 pt-1">
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
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
        >
          Create Backup Folder
          <HoverCard>
            <HoverCardTrigger asChild>
              <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <p className="text-sm">
                Generate a Backup Folder outside of the destination at
                Backup-KAR-{"{TIME}"}
              </p>
            </HoverCardContent>
          </HoverCard>
        </Label>
      </div>
      <div className="flex items-center space-x-2 pt-1">
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
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
        >
          Delete files not in selection
          <HoverCard>
            <HoverCardTrigger asChild>
              <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <p className="text-sm">
                Only applies if there is a filter selection. While download sync
                will delete files not part of the archive normally, it fails to
                do so when there is a filter selection. This option allows it to
                delete files not in this selection.
              </p>
            </HoverCardContent>
          </HoverCard>
        </Label>
      </div>
    </div>
  );
}
