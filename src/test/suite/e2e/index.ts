import * as path from 'path';

import * as glob from 'glob';
import Mocha from 'mocha';

export function run(): Promise<void> {
    // Create the mocha test runner with extended timeout for E2E tests
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 120000 // 2 minutes for E2E tests
    });

    const testsRoot = path.resolve(__dirname);

    return new Promise<void>((resolve, reject) => {
        glob.glob('**/*.test.js', { cwd: testsRoot }, (err: unknown, files: string[]) => {
            if (err) {
                return reject(err as Error);
            }

            // Add E2E test files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (runError) {
                console.error(runError);
                reject(runError as Error);
            }
        });
    });
}
