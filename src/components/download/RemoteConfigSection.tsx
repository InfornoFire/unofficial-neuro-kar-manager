import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Folder, Info, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HybridTooltip,
  HybridTooltipContent,
  HybridTooltipTrigger,
} from "@/components/ui/hybrid-tooltip";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_RCLONE_CONFIG_NAME = "gdrive_unofficial_neuro_kar";

interface RemoteConfigSectionProps {
  remotes: string[];
  selectedRemote: string | null;
  onRemoteChange: (remote: string | null) => void;
  onCreateConfig: () => Promise<void>;
  onRefreshRemotes: () => Promise<void>;
  loading: boolean;
  disabled: boolean;
}

export function RemoteConfigSection({
  remotes,
  selectedRemote,
  onRemoteChange,
  onCreateConfig,
  onRefreshRemotes,
  loading,
  disabled,
}: RemoteConfigSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="remote-config" className="flex items-center gap-2">
          <Folder className="h-4 w-4" />
          <Trans>Rclone Remote Config</Trans>
        </Label>
        <HybridTooltip>
          <HybridTooltipTrigger asChild>
            <Info className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
          </HybridTooltipTrigger>
          <HybridTooltipContent className="w-80">
            <p className="text-sm">
              <Trans>
                If "Generate New Config" is selected, clicking the Key button
                will open a one-time authorization window in your browser. The
                config will be saved as "{DEFAULT_RCLONE_CONFIG_NAME}" for
                future use.
              </Trans>
            </p>
          </HybridTooltipContent>
        </HybridTooltip>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Select
            value={selectedRemote || "new_config"}
            onValueChange={(val) =>
              onRemoteChange(val === "new_config" ? null : val)
            }
            onOpenChange={(open) => {
              if (open) onRefreshRemotes();
            }}
            disabled={disabled || loading}
          >
            <SelectTrigger id="remote-config">
              <SelectValue placeholder={t`Select a remote`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new_config">
                <Trans>Generate New Config</Trans>
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
          <div className="relative inline-flex h-10 w-10 overflow-hidden rounded-md p-0.5">
            <span className="absolute -inset-full animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,var(--color-pink-500)_0%,var(--color-violet-500)_50%,var(--color-pink-500)_100%)]" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCreateConfig}
              disabled={disabled || loading}
              title={t`Authenticate & Generate Config`}
              className="relative h-full w-full bg-background hover:bg-background/90"
            >
              <Key className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
