import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const cmd = ['dev'];
if (value('--host')) cmd.push('-H', value('--host'));
if (value('--port')) cmd.push('-p', value('--port'));
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...cmd], { stdio: 'inherit' });
child.on('exit', code => process.exit(code || 0));
