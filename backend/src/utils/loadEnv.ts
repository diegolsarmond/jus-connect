import fs from 'fs';
import path from 'path';

const parseLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const exportPrefix = 'export ';
  const normalized = trimmed.startsWith(exportPrefix)
    ? trimmed.slice(exportPrefix.length)
    : trimmed;

  const equalsIndex = normalized.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const key = normalized.slice(0, equalsIndex).trim();
  if (!key) {
    return null;
  }

  const rawValue = normalized.slice(equalsIndex + 1).trim();
  let value = rawValue;

  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    value = rawValue.slice(1, -1);
  }

  return [key, value];
};

const loadEnvFile = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const findEnvFileInAncestors = (startDir: string): string | null => {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(currentDir, '.env');
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return null;
};

const pathsEqual = (first: string | null | undefined, second: string | null | undefined) => {
  if (!first || !second) {
    return false;
  }

  return path.resolve(first) === path.resolve(second);
};


const loadEnvFilesInOrder = (paths: Array<string | null | undefined>) => {
  const seen = new Set<string>();

  for (const candidate of paths) {
    if (!candidate) {
      continue;
    }

    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      continue;
    }

    if (!fs.existsSync(resolved)) {
      continue;
    }

    try {
      const stats = fs.statSync(resolved);
      if (!stats.isFile()) {
        continue;
      }
    } catch {
      continue;
    }

    loadEnvFile(resolved);
    seen.add(resolved);
  }
};

const loadDefaultEnvFile = () => {
  const customPath = process.env.DOTENV_CONFIG_PATH;
  if (customPath) {
    const resolvedCustomPath = path.isAbsolute(customPath)
      ? customPath
      : path.resolve(process.cwd(), customPath);

    if (fs.existsSync(resolvedCustomPath)) {
      loadEnvFile(resolvedCustomPath);
      return;
    }
  }

  const backendRoot = path.resolve(__dirname, '..', '..');
  const repoRoot = path.resolve(backendRoot, '..');
  const backendEnvPath = path.join(backendRoot, '.env');
  const repoEnvPath = path.join(repoRoot, '.env');
  const ancestorEnvFile = findEnvFileInAncestors(process.cwd());

  const fallbackCandidates: Array<string | null> = [];

  if (
    ancestorEnvFile &&
    !pathsEqual(ancestorEnvFile, backendEnvPath) &&
    !pathsEqual(ancestorEnvFile, repoEnvPath)
  ) {
    fallbackCandidates.push(ancestorEnvFile);
  }

  fallbackCandidates.push(backendEnvPath, repoEnvPath);


  const ancestorEnvFile = findEnvFileInAncestors(process.cwd());
  const fallbackCandidates = [
    ancestorEnvFile,
    path.join(backendRoot, '.env'),
    path.join(repoRoot, '.env'),
  ];

  loadEnvFilesInOrder(fallbackCandidates);
};

loadDefaultEnvFile();
