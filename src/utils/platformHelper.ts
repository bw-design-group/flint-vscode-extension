/**
 * @module platformHelper
 * @description Platform abstraction for WSL/Windows/macOS cross-boundary support.
 * Detects WSL, resolves Windows home directories, and handles cross-boundary process checks.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Cached values (static per process)
let cachedIsWSL: boolean | undefined;
let cachedIgnitionHomeDir: string | undefined;

/**
 * Detects if running inside WSL (Windows Subsystem for Linux).
 */
export function isWSL(): boolean {
    if (cachedIsWSL !== undefined) return cachedIsWSL;

    if (process.platform !== 'linux') {
        cachedIsWSL = false;
        return false;
    }

    // Fast check: WSL sets this environment variable
    if (process.env.WSL_DISTRO_NAME) {
        cachedIsWSL = true;
        return true;
    }

    // Fallback: check /proc/version for "microsoft" (covers WSL1 and WSL2)
    try {
        const version = fs.readFileSync('/proc/version', 'utf-8');
        cachedIsWSL = version.toLowerCase().includes('microsoft');
    } catch {
        cachedIsWSL = false;
    }

    return cachedIsWSL;
}

/**
 * Returns the Ignition home directory.
 * On WSL, resolves the Windows user's home directory (where Designer writes registry files).
 * On other platforms, returns `os.homedir()`.
 */
export function getIgnitionHomeDir(): string {
    if (cachedIgnitionHomeDir !== undefined) return cachedIgnitionHomeDir;

    if (!isWSL()) {
        cachedIgnitionHomeDir = os.homedir();
        return cachedIgnitionHomeDir;
    }

    // Try to resolve Windows home via cmd.exe
    try {
        const winHome = execSync('cmd.exe /c echo %USERPROFILE%', {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        if (winHome && !winHome.includes('%USERPROFILE%')) {
            const wslPath = execSync(`wslpath -u "${winHome}"`, {
                encoding: 'utf-8',
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe']
            }).trim();

            if (wslPath && fs.existsSync(wslPath)) {
                cachedIgnitionHomeDir = wslPath;
                return cachedIgnitionHomeDir;
            }
        }
    } catch {
        // Fall through to scanning
    }

    // Fallback: scan /mnt/c/Users/ for a directory containing .ignition/
    try {
        const usersDir = '/mnt/c/Users';
        if (fs.existsSync(usersDir)) {
            const entries = fs.readdirSync(usersDir);
            for (const entry of entries) {
                if (entry === 'Public' || entry === 'Default' || entry === 'Default User' || entry === 'All Users')
                    continue;
                const candidate = path.join(usersDir, entry);
                if (fs.existsSync(path.join(candidate, '.ignition'))) {
                    cachedIgnitionHomeDir = candidate;
                    return cachedIgnitionHomeDir;
                }
            }
        }
    } catch {
        // Fall through to default
    }

    // Final fallback: WSL home (won't find Windows Designer files, but won't crash)
    cachedIgnitionHomeDir = os.homedir();
    return cachedIgnitionHomeDir;
}

/**
 * Checks if a process is alive. On WSL, uses `tasklist.exe` to check Windows PIDs.
 */
export function isProcessAlive(pid: number): boolean {
    if (!isWSL()) {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }

    try {
        const output = execSync(`tasklist.exe /FI "PID eq ${pid}" /NH`, {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        // tasklist outputs the process info if found, or "INFO: No tasks..." if not
        return output.includes(String(pid));
    } catch {
        // If tasklist.exe fails, assume alive to avoid deleting registry files
        return true;
    }
}
