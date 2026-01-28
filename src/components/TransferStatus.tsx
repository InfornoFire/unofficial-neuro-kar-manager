import { Activity, FileIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  type CoreStatsResponse,
  useTransferStats,
} from "@/hooks/useTransferStats";

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [
    "Bytes",
    "KiB",
    "MiB",
    "GiB",
    "TiB",
    "PiB",
    "EiB",
    "ZiB",
    "YiB",
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function formatTime(seconds: number | undefined) {
  if (seconds === undefined || seconds === null) return "--";
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

interface TransferStatusProps {
  stats?: CoreStatsResponse | null;
  compact?: boolean;
}

export function TransferStatus({
  stats: propStats,
  compact = false,
}: TransferStatusProps) {
  const hookStats = useTransferStats();
  const stats = propStats !== undefined ? propStats : hookStats;

  if (!stats || !stats.transferring || stats.transferring.length === 0) {
    if (compact)
      return (
        <div className="p-4 text-center text-muted-foreground text-sm">
          No active transfers
        </div>
      );
    return null;
  }

  // If compact, we render just the list without the card wrapper card effects
  if (compact) {
    return (
      <div className="w-full">
        <div className="p-2 space-y-3">
          {stats.transferring.map((transfer) => (
            <div key={transfer.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="truncate flex-1 font-medium flex items-center gap-1 max-w-50">
                  <FileIcon className="h-3 w-3" />
                  <span className="truncate" title={transfer.name}>
                    {transfer.name}
                  </span>
                </span>
                <span className="text-muted-foreground whitespace-nowrap ml-2 text-xs">
                  {formatBytes(transfer.speed)}/s
                </span>
              </div>
              <Progress value={transfer.percentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(transfer.bytes)} / {formatBytes(transfer.size)}
                </span>
                <span>
                  {transfer.percentage}% • {formatTime(transfer.eta)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t bg-muted/50 text-xs text-center text-muted-foreground">
          Total Speed: {formatBytes(stats.speed)}/s
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Activity className="h-5 w-5" />
          Active Transfers
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            Total Speed: {formatBytes(stats.speed)}/s
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.transferring.map((transfer) => (
          <div key={transfer.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="truncate flex-1 font-medium flex items-center gap-1 max-w-50">
                <FileIcon className="h-3 w-3" />
                <span className="truncate" title={transfer.name}>
                  {transfer.name}
                </span>
              </span>
              <span className="text-muted-foreground whitespace-nowrap ml-2 text-xs">
                {formatBytes(transfer.speed)}/s
              </span>
            </div>
            <Progress value={transfer.percentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {formatBytes(transfer.bytes)} / {formatBytes(transfer.size)}
              </span>
              <span>
                {transfer.percentage}% • {formatTime(transfer.eta)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
