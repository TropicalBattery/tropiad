const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const skipDirs = new Set(["node_modules", ".next", ".git"]);

const replacements = [
  [
    /-mx-4 min-h-full bg-\[#0a0a0f\]/g,
    "-mx-4 min-h-full bg-[#f0f4f9] dark:bg-[#0a0a0f]",
  ],
  [
    /border-\[#1e1e3a\] bg-\[#0a0a0f\]/g,
    "border-[#dde4ee] bg-[#f8fafc] dark:border-[#dde4ee] dark:border-[#1e1e3a] dark:bg-[#0a0a0f]",
  ],
  [/bg-\[#0f0f1a\]/g, "bg-white dark:bg-white dark:bg-[#0f0f1a]"],
  [/bg-\[#0d0d1a\]/g, "bg-white dark:bg-white dark:bg-[#0d0d1a]"],
  [/border-\[#1e1e3a\]/g, "border-[#dde4ee] dark:border-[#dde4ee] dark:border-[#1e1e3a]"],
  [/hover:bg-\[#1e1e3a\]/g, "hover:bg-[#e8f0fb] dark:hover:bg-[#e8f0fb] dark:hover:bg-[#f8fafc] dark:bg-[#1e1e3a]"],
  [
    /(?<!dark:)bg-\[#1e1e3a\]/g,
    "bg-[#f8fafc] dark:bg-[#1e1e3a]",
  ],
  [
    /(?<!dark:)bg-\[#0a0a0f\]/g,
    "bg-[#f8fafc] dark:bg-[#0a0a0f]",
  ],
  [/text-[#6b7280] dark:text-slate-400/g, "text-[#6b7280] dark:text-[#6b7280] dark:text-slate-400"],
  [/text-[#9ca3af] dark:text-slate-500/g, "text-[#9ca3af] dark:text-[#9ca3af] dark:text-slate-500"],
  [/text-[#374151] dark:text-slate-300/g, "text-[#374151] dark:text-[#374151] dark:text-slate-300"],
  [/text-[#374151] dark:text-slate-200/g, "text-[#374151] dark:text-[#374151] dark:text-slate-200"],
  [
    /(?<!dark:)text-[#111827] dark:text-white(?![/])/g,
    "text-[#111827] dark:text-white",
  ],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function migrateFile(filePath) {
  if (filePath.includes("lib\\email\\")) return false;
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }

  // Fix double dark: prefixes from chained replacements
  content = content.replace(/dark:/g, "dark:");
  content = content.replace(
    /text-\[#111827\] dark:text-white\/(\d+)/g,
    "text-white/$1 dark:text-white/$1"
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

const files = walk(root);
const updated = files.filter(migrateFile);
console.log(`Updated ${updated.length} files`);
