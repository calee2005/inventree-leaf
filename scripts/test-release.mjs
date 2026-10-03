import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "test-release.local");
const dist = path.join(root, "dist");

const { target, context } = await readConfig(configPath);
const node = process.execPath;
await run(node, [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit"]);
await run(node, [path.join(root, "node_modules/vite/bin/vite.js"), "build", "--base", context]);
await stat(path.join(dist, "index.html"));
await mkdir(target, { recursive: true });
await syncDir(dist, target);
console.log(`已按 ${context} 发布到 ${target}`);

async function readConfig(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new Error(
      "缺少 test-release.local。写上发布目录，并用 context=/mobile/ 指定访问前缀",
    );
  }
  let target = "";
  let context = "/";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    const keyed = eq > 0 && !line.startsWith("\\\\") && !/^smb:/i.test(line);
    if (!keyed) {
      target = line;
      continue;
    }
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    if (key === "context" || key === "base") {
      context = normalizeContext(value);
    } else if (key === "target" || key === "dir" || key === "path") {
      target = value;
    } else {
      throw new Error(`test-release.local 里有未知配置 ${key}`);
    }
  }
  if (!target) {
    throw new Error("test-release.local 里没有发布目录");
  }
  return { target: toUnc(target), context };
}

function normalizeContext(value) {
  let text = value.trim();
  if (!text || text === "/") {
    return "/";
  }
  if (!text.startsWith("/")) {
    text = `/${text}`;
  }
  if (!text.endsWith("/")) {
    text = `${text}/`;
  }
  return text;
}

function toUnc(raw) {
  let text = raw.trim();
  if (/^smb:\/\//i.test(text)) {
    text = "\\\\" + text.replace(/^smb:\/\//i, "").replace(/^\/+/, "").split("/").filter(Boolean).join("\\");
  } else {
    text = text.replaceAll("/", "\\");
  }
  if (!text.startsWith("\\\\")) {
    throw new Error("发布目录需要是 \\\\主机\\共享\\子目录，或 smb://主机/共享/子目录");
  }
  const parts = text.split("\\").filter(Boolean);
  if (parts.length < 3) {
    throw new Error("发布目录至少要写到共享下面的一层，避免覆盖整个共享");
  }
  return "\\\\" + parts.join("\\");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} 失败，退出码 ${code}`));
      }
    });
  });
}

async function syncDir(source, destination) {
  await mkdir(destination, { recursive: true });
  const sourceNames = new Set(await readdir(source));
  for (const name of await readdir(destination)) {
    if (!sourceNames.has(name)) {
      await rm(path.join(destination, name), { recursive: true, force: true });
    }
  }
  for (const name of sourceNames) {
    const from = path.join(source, name);
    const to = path.join(destination, name);
    if ((await stat(from)).isDirectory()) {
      await syncDir(from, to);
    } else {
      await cp(from, to);
    }
  }
}
