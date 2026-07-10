import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * Resolve a path to a TypeScript file, trying various extensions
 */
function resolveTypescriptPath(basePath) {
    // Try exact path first
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        return basePath;
    }
    // Try with .ts extension
    if (fs.existsSync(basePath + '.ts')) {
        return basePath + '.ts';
    }
    // Try with /index.ts for directories
    if (fs.existsSync(path.join(basePath, 'index.ts'))) {
        return path.join(basePath, 'index.ts');
    }
    // Fallback
    return basePath + '.ts';
}

// Resolve @/* path aliases (from tsconfig) to src/* — used by the extension bundle.
const pathAliasPlugin = {
    name: 'path-alias',
    setup(build) {
        build.onResolve({ filter: /^@\// }, args => {
            const relativePath = args.path.replace(/^@\//, 'src/');
            const absolutePath = path.resolve(__dirname, relativePath);
            const resolvedPath = resolveTypescriptPath(absolutePath);
            return { path: resolvedPath };
        });
    }
};

/** @type {esbuild.BuildOptions} */
const extensionBuildOptions = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'out/src/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !production,
    minify: production,
    treeShaking: true,
    plugins: [pathAliasPlugin]
};

async function main() {
    if (watch) {
        const extensionCtx = await esbuild.context(extensionBuildOptions);
        await extensionCtx.watch();
        console.log('Watching for changes...');
    } else {
        await esbuild.build(extensionBuildOptions);
        console.log(production ? 'Production build complete' : 'Development build complete');
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
