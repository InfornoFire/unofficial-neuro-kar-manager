import { Download } from "lucide-react";
import { TransferStatus } from "@/components/TransferStatus";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTransferStats } from "@/hooks/useTransferStats";

export function DownloadsButton() {
  const stats = useTransferStats();
  const activeCount = stats?.transferring?.length || 0;
  const isTransferring = activeCount > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Downloads"
        >
          <Download className="h-5 w-5" />
          {isTransferring && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end">
        <div className="flex flex-col space-y-1.5 p-4 text-center sm:text-left border-b">
          <h4 className="font-semibold leading-none tracking-tight">
            Downloads
          </h4>
          {isTransferring ? (
            <p className="text-xs text-muted-foreground">
              {activeCount} active transfer{activeCount !== 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No active transfers</p>
          )}
        </div>
        <ScrollArea className="h-[min(60vh,300px)]">
          <TransferStatus stats={stats} compact={true} />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
