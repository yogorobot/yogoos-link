import { Client } from 'ssh2';
import { queryPackagesHttp, clearPackagesHttp, queryPackageInfoHttp } from './http-client';

/**
 * Constructs the full hostname for a given robot name.
 * @param name The short name of the robot (e.g., "kago5-123").
 * @returns The full hostname.
 */
function getHost(name: string): string {
    return `${name.toLowerCase()}-arma.yogo.love`;
}

/**
 * Executes a single command on a remote server via SSH.
 * @param conn An active ssh2 Client connection.
 * @param command The command to execute.
 * @returns A promise that resolves with the command's stdout or rejects on error.
 */
function runSSHCommand(conn: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let output = '';
        conn.exec(command, (err, stream) => {
            if (err) {
                return reject(err);
            }
            stream.on('close', (code: number) => {
                if (code !== 0) {
                    return reject(new Error(`Command failed with exit code ${code}:\n${output}`));
                }
                resolve(output);
            }).on('data', (data: Buffer) => {
                output += data.toString('utf8');
            }).stderr.on('data', (data: Buffer) => {
                output += data.toString('utf8');
            });
        });
    });
}

/**
 * Connects to an SSH server and executes a series of commands.
 * @param host The hostname to connect to.
 * @param password The password for authentication.
 * @param commands An array of commands to execute sequentially.
 * @returns A promise that resolves when all commands have executed successfully.
 */
async function connectAndExecute(host: string, password = 'yogo', commands: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on('ready', async () => {
            try {
                for (const cmd of commands) {
                    await runSSHCommand(conn, cmd);
                }
                conn.end();
                resolve();
            } catch (error) {
                conn.end();
                reject(error);
            }
        }).on('error', (err: Error) => {
            reject(new Error(`SSH connection failed: ${err.message}`));
        }).connect({
            host: host,
            port: 22,
            username: 'yogo',
            password: password,
            readyTimeout: 20000
        });
    });
}

/**
 * Validates the robot name format.
 * @param name The name of the robot.
 * @throws An error if the name is invalid.
 */
function validateRobotName(name: string) {
    const nameLower = name.toLowerCase();
    const validName = /^kago5-\d+$/;
    if (!nameLower.startsWith('kago5-') || !validName.test(nameLower)) {
        throw new Error(`错误的机器人名: ${name}`);
    }
}

export async function clearCache(name: string, passwd?: string, clearTFCard?: boolean): Promise<string> {
    validateRobotName(name);
    const host = getHost(name);

    const commands = [
        'sudo systemctl stop meteor-robot',
        'sudo rm -rf /srv/meteor-robot/leveldbtsrepository.db',
        'sudo systemctl start meteor-robot',
        'sudo find /var/log/apps/ -type f \\( -name "*zip" -o -name "*tar*" -o -name "*gz" -o -name "*log" \\) -size +500M -delete',
        'sudo find /var/log/ -type f \\( -name "meteor-*.log" \\) -size +100M -delete',
    ];

    if (clearTFCard) {
        const formatCommands = [
            'sudo systemctl stop telescope',
            'sudo systemctl stop jarvis-agent',
            'sudo umount /dev/mmcblk0p1',
            'sudo mkfs -F -t ext4 /dev/mmcblk0p1 -q',
            'sudo mount /dev/mmcblk0p1 /media/yogo/tfcard',
            'sudo systemctl start jarvis-agent',
            'sudo systemctl start telescope',
        ];
        commands.push(...formatCommands);
    }

    try {
        await connectAndExecute(host, passwd, commands);
        return `${name} 清理完成`;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        throw new Error(`清理 ${name} 失败: ${errorMessage}`);
    }
}

export async function rebootSystem(name: string, passwd?: string, force?: boolean): Promise<string> {
    validateRobotName(name);
    const host = getHost(name);

    const command = force
        ? `echo 1 | sudo tee /proc/sys/kernel/sysrq && echo b | sudo tee /proc/sysrq-trigger`
        : 'sudo reboot';

    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on('ready', () => {
            conn.exec(command, (err) => {
                conn.end();
                resolve(`${name} 重启指令已发送`);
            });
        }).on('error', (err: Error) => {
            if (err.message.includes('Socket closed') || err.message.includes('ECONNRESET')) {
                resolve(`${name} 重启指令已发送`);
            } else {
                reject(new Error(`SSH connection failed for ${name}: ${err.message}`));
            }
        }).connect({
            host: host,
            port: 22,
            username: 'yogo',
            password: passwd || 'yogo',
            readyTimeout: 20000
        });
    });
}

/**
 * Query packages using HTTP REST API instead of gRPC
 * @param name The robot name
 * @returns Promise with result message containing complete package information
 */
export async function queryPkgHttp(name: string): Promise<string> {
    validateRobotName(name);
    const host = getHost(name);
    try {
        const packageInfo = await queryPackageInfoHttp(host);
        
        const result = {
            robot: name,
            total: packageInfo.totalCount,
            upper_box: {
                count: packageInfo.upperPackages.length,
                package_ids: packageInfo.upperPackages
            },
            lower_box: {
                count: packageInfo.lowerPackages.length,
                package_ids: packageInfo.lowerPackages
            }
        };
        
        return JSON.stringify(result);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        throw new Error(`查询 ${name} 包裹失败: ${errorMessage}`);
    }
}

/**
 * Clear packages using HTTP REST API instead of gRPC
 * @param name The robot name
 * @returns Promise with result message
 */
export async function clearPkgHttp(name: string): Promise<string> {
    validateRobotName(name);
    const host = getHost(name);
    try {
        const count = await clearPackagesHttp(host);
        return `${name} 清理完成: ${count}个`;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        throw new Error(`清理 ${name} 包裹失败: ${errorMessage}`);
    }
}

// Note: gRPC functions are available in robot-api.ts if needed
// This HTTP-only version doesn't depend on gRPC or proto files