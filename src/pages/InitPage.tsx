import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

export default function InitPage() {
  const [initMessage, setInitMessage] = useState("Initializing...");
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      try {
        setInitMessage("Finding Rclone...");
        setProgress(10);

        const installed = await invoke<boolean>("check_rclone");

        if (installed) {
          setInitMessage("Found Rclone.");
          setProgress(100);
          navigate("/home");
          return;
        }

        setInitMessage(
          "Error: Rclone binary not found. It should be bundled with the app. Please report this to the developers.",
        );
        setProgress(0);
      } catch (e) {
        setInitMessage(`Error: ${e}`);
        setProgress(0);
      }
    }

    init();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 space-y-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold tracking-tight">Setup</h1>
      <div className="w-full max-w-md space-y-2">
        <p className="text-sm text-muted-foreground text-center">
          {initMessage}
        </p>
        <Progress value={progress} className="w-full" />
      </div>
    </div>
  );
}
