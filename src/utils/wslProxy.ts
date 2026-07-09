/**
 * @module wslProxy
 * @description TCP proxy for bridging WebSocket connections from WSL2 to Windows localhost
 * via PowerShell stdio piping. On WSL2, the Node.js process cannot directly connect to
 * Windows 127.0.0.1, but powershell.exe (running on Windows) can.
 */

import { spawn, type ChildProcess } from 'child_process';
import * as net from 'net';

export interface WslProxy {
    localPort: number;
    close(): void;
}

/**
 * Creates a local TCP proxy that relays connections to a Windows localhost port
 * via powershell.exe stdio piping.
 */
export function createWslProxy(targetPort: number): Promise<WslProxy> {
    return new Promise((resolve, reject) => {
        const children: ChildProcess[] = [];
        const server = net.createServer(socket => {
            // PowerShell script using .NET TcpClient for bidirectional relay
            const psScript = [
                `$c=[System.Net.Sockets.TcpClient]::new('127.0.0.1',${targetPort});`,
                '$s=$c.GetStream();',
                '$si=[Console]::OpenStandardInput();',
                '$so=[Console]::OpenStandardOutput();',
                '$t1=$s.CopyToAsync($so);',
                '$t2=$si.CopyToAsync($s);',
                '[void][System.Threading.Tasks.Task]::WaitAny(@($t1,$t2));',
                '$c.Dispose()'
            ].join('');

            const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
                stdio: ['pipe', 'pipe', 'ignore']
            });

            children.push(child);

            // Bidirectional pipe: socket <-> powershell stdin/stdout
            socket.pipe(child.stdin);
            child.stdout.pipe(socket);

            // Cleanup on either side closing
            socket.on('close', () => {
                child.kill();
            });

            socket.on('error', () => {
                child.kill();
            });

            child.on('exit', () => {
                socket.destroy();
            });

            child.on('error', () => {
                socket.destroy();
            });
        });

        server.on('error', err => {
            reject(err);
        });

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address() as net.AddressInfo;
            resolve({
                localPort: addr.port,
                close() {
                    for (const child of children) {
                        child.kill();
                    }
                    children.length = 0;
                    server.close();
                }
            });
        });
    });
}
