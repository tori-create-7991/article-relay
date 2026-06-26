import { spawn, spawnSync } from "node:child_process";
import { platform } from "node:os";

/** 文字列をシステムクリップボードへコピー（macOS / Linux / Windows 対応） */
export async function copyToClipboard(text: string): Promise<void> {
  const { cmd, args } = pickCopyCmd();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `clipboard copy failed (${cmd} exit ${code}): ${stderr.trim()}`
          )
        );
    });
    child.stdin.end(text);
  });
}

function pickCopyCmd(): { cmd: string; args: string[] } {
  const p = platform();
  if (p === "darwin") return { cmd: "pbcopy", args: [] };
  if (p === "win32") return { cmd: "clip.exe", args: [] };
  // Linux: prefer wl-copy (Wayland) → xclip → xsel
  if (hasCmd("wl-copy")) return { cmd: "wl-copy", args: [] };
  if (hasCmd("xclip")) return { cmd: "xclip", args: ["-selection", "clipboard"] };
  if (hasCmd("xsel")) return { cmd: "xsel", args: ["--clipboard", "--input"] };
  throw new Error(
    "no clipboard tool found. install xclip, xsel, or wl-clipboard."
  );
}

function hasCmd(cmd: string): boolean {
  try {
    const r = spawnSync("which", [cmd]);
    return r.status === 0;
  } catch {
    return false;
  }
}
