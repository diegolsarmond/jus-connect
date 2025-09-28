"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const parseLine = (line) => {
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
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        value = rawValue.slice(1, -1);
    }
    return [key, value];
};
const loadEnvFile = (filePath) => {
    if (!fs_1.default.existsSync(filePath)) {
        return;
    }
    const content = fs_1.default.readFileSync(filePath, 'utf8');
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
const findEnvFileInAncestors = (startDir) => {
    let currentDir = path_1.default.resolve(startDir);
    while (true) {
        const candidate = path_1.default.join(currentDir, '.env');
        if (fs_1.default.existsSync(candidate)) {
            return candidate;
        }
        const parentDir = path_1.default.dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }
    return null;
};
const pathsEqual = (first, second) => {
    if (!first || !second) {
        return false;
    }
    return path_1.default.resolve(first) === path_1.default.resolve(second);
};
const loadEnvFilesInOrder = (paths) => {
    const seen = new Set();
    for (const candidate of paths) {
        if (!candidate) {
            continue;
        }
        const resolved = path_1.default.resolve(candidate);
        if (seen.has(resolved)) {
            continue;
        }
        if (!fs_1.default.existsSync(resolved)) {
            continue;
        }
        try {
            const stats = fs_1.default.statSync(resolved);
            if (!stats.isFile()) {
                continue;
            }
        }
        catch (_a) {
            continue;
        }
        loadEnvFile(resolved);
        seen.add(resolved);
    }
};
const loadDefaultEnvFile = () => {
    const customPath = process.env.DOTENV_CONFIG_PATH;
    if (customPath) {
        const resolvedCustomPath = path_1.default.isAbsolute(customPath)
            ? customPath
            : path_1.default.resolve(process.cwd(), customPath);
        if (fs_1.default.existsSync(resolvedCustomPath)) {
            loadEnvFile(resolvedCustomPath);
            return;
        }
    }
    const backendRoot = path_1.default.resolve(__dirname, '..', '..');
    const repoRoot = path_1.default.resolve(backendRoot, '..');
    const backendEnvPath = path_1.default.join(backendRoot, '.env');
    const repoEnvPath = path_1.default.join(repoRoot, '.env');
    const ancestorEnvFile = findEnvFileInAncestors(process.cwd());
    const fallbackCandidates = [];
    if (ancestorEnvFile &&
        !pathsEqual(ancestorEnvFile, backendEnvPath) &&
        !pathsEqual(ancestorEnvFile, repoEnvPath)) {
        fallbackCandidates.push(ancestorEnvFile);
    }
    fallbackCandidates.push(backendEnvPath, repoEnvPath);
    loadEnvFilesInOrder(fallbackCandidates);
};
loadDefaultEnvFile();
