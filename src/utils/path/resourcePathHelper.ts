/**
 * @module resourcePathHelper
 * @description Separator-independent helpers for project-relative resource paths
 */

/**
 * Converts a project-relative resource path to forward slashes.
 * Resource paths and keys use this form on every OS so the tree, search, and commands can split on '/'.
 */
export function toPosixResourcePath(resourcePath: string): string {
    return resourcePath.replace(/\\/g, '/');
}

/**
 * Removes a provider directory (e.g. `ignition/script-python`) from the start of a resource path.
 * Accepts either separator on both arguments and returns the remainder with forward slashes.
 */
export function stripResourceDirectoryPrefix(resourcePath: string, resourceDirectory: string): string {
    const normalizedResourcePath = toPosixResourcePath(resourcePath);
    const normalizedResourceDirectory = toPosixResourcePath(resourceDirectory).replace(/^\/+|\/+$/g, '');

    if (normalizedResourceDirectory.length === 0) {
        return normalizedResourcePath;
    }

    if (normalizedResourcePath === normalizedResourceDirectory) {
        return '';
    }

    if (normalizedResourcePath.startsWith(`${normalizedResourceDirectory}/`)) {
        return normalizedResourcePath.substring(normalizedResourceDirectory.length + 1);
    }

    return normalizedResourcePath;
}
