import { runCommand } from "./executor.js";

export interface AndroidDevice {
  id: string;
  status: string;
  model?: string;
}

export function parseAdbDevices(output: string): AndroidDevice[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices attached"))
    .map((line) => {
      const [id, status, ...rest] = line.split(/\s+/);
      const modelToken = rest.find((token) => token.startsWith("model:"));
      return {
        id,
        status: status ?? "unknown",
        model: modelToken ? modelToken.replace("model:", "") : undefined,
      };
    })
    .filter((device) => Boolean(device.id));
}

export async function listAndroidDevices(): Promise<AndroidDevice[]> {
  const result = await runCommand(
    {
      label: "adb devices -l",
      cmd: "adb",
      args: ["devices", "-l"],
    },
    { stdio: "pipe" },
  );

  if (!result.success) {
    return [];
  }

  return parseAdbDevices(result.stdout);
}
