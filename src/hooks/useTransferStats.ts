import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export interface CoreStatsTransfer {
  name: string;
  size: number;
  bytes: number;
  percentage: number;
  speed: number;
  speedAvg: number;
  eta?: number;
}

export interface CoreStatsResponse {
  bytes: number;
  totalBytes: number;
  speed: number;
  transfers: number;
  transferring: CoreStatsTransfer[];
}

export function useTransferStats() {
  const [stats, setStats] = useState<CoreStatsResponse | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await invoke<CoreStatsResponse>("get_stats");
        setStats(res);
      } catch (_) {
        // Silent fail on stats fetch (maybe rclone not running yet)
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return stats;
}
