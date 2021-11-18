import { chmodSync } from 'fs';

// See: https://github.com/microsoft/TypeScript/issues/37583
const addExecuteRightsMode = '755'; // default is 664
chmodSync('dist/index.js', addExecuteRightsMode);