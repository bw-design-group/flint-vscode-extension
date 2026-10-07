/**
 * @module resourcePathHelper.test
 * @description Unit tests for separator-independent resource path helpers
 */

import * as assert from 'assert';

import { stripResourceDirectoryPrefix, toPosixResourcePath } from '../../../../utils/path/resourcePathHelper';

suite('resourcePathHelper Test Suite', () => {
    suite('toPosixResourcePath()', () => {
        test('Should leave forward-slash paths unchanged', () => {
            assert.strictEqual(
                toPosixResourcePath('ignition/script-python/core/utils'),
                'ignition/script-python/core/utils'
            );
        });

        test('Should convert Windows separators to forward slashes', () => {
            assert.strictEqual(
                toPosixResourcePath('ignition\\script-python\\core\\utils'),
                'ignition/script-python/core/utils'
            );
        });

        test('Should convert mixed separators', () => {
            assert.strictEqual(
                toPosixResourcePath('ignition/script-python\\core/utils'),
                'ignition/script-python/core/utils'
            );
        });
    });

    suite('stripResourceDirectoryPrefix()', () => {
        const scriptDirectory = 'ignition/script-python';

        test('Should strip the provider directory from a forward-slash path', () => {
            assert.strictEqual(
                stripResourceDirectoryPrefix('ignition/script-python/core/db/utils', scriptDirectory),
                'core/db/utils'
            );
        });

        test('Should strip the provider directory from a Windows path', () => {
            assert.strictEqual(
                stripResourceDirectoryPrefix('ignition\\script-python\\core\\db\\utils', scriptDirectory),
                'core/db/utils'
            );
        });

        test('Should accept a provider directory written with backslashes or slashes at either end', () => {
            assert.strictEqual(
                stripResourceDirectoryPrefix('ignition/script-python/core', '\\ignition\\script-python\\'),
                'core'
            );
            assert.strictEqual(
                stripResourceDirectoryPrefix('ignition/script-python/core', '/ignition/script-python/'),
                'core'
            );
        });

        test('Should return an empty string when the path is the provider directory itself', () => {
            assert.strictEqual(stripResourceDirectoryPrefix('ignition/script-python', scriptDirectory), '');
            assert.strictEqual(stripResourceDirectoryPrefix('ignition\\script-python', scriptDirectory), '');
        });

        test('Should return paths already relative to the provider directory unchanged', () => {
            assert.strictEqual(stripResourceDirectoryPrefix('core/db/utils', scriptDirectory), 'core/db/utils');
            assert.strictEqual(stripResourceDirectoryPrefix('core\\db\\utils', scriptDirectory), 'core/db/utils');
        });

        test('Should not strip a sibling directory that shares the prefix', () => {
            assert.strictEqual(
                stripResourceDirectoryPrefix('ignition/script-python-extra/core', scriptDirectory),
                'ignition/script-python-extra/core'
            );
        });

        test('Should return the normalized path when no provider directory is given', () => {
            assert.strictEqual(stripResourceDirectoryPrefix('core\\db\\utils', ''), 'core/db/utils');
        });
    });
});
