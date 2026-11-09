import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';

// Execute the shared production components; CSS is verified in browser tests.
const source = (await readFile('src/components/StaffDataState.tsx', 'utf8')).replace(/^import .*;\n/gm, '');
const { code } = await transform(source, { loader: 'tsx', format: 'cjs', jsx: 'transform' });
const components = new Function('React', 'module', code + ';return module.exports;')(React, { exports: {} });
export const { InitialDataState, LoadingState, RefreshStatus } = components;
