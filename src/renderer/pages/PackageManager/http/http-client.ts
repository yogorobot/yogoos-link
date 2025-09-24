import * as axios from 'axios';

/**
 * HTTP client for robot API without using proto files
 */

interface PackageBox {
    package_ids: number[];
}

interface BoxPack {
    upper_box?: PackageBox;
    lower_box?: PackageBox;
}

interface PackageInfo {
    upperPackages: number[];
    lowerPackages: number[];
    totalCount: number;
}

interface RobotInfo {
    box_pack?: BoxPack;
    [key: string]: any;
}

interface GetInfoResponse {
    box_pack?: BoxPack;
    [key: string]: any;
}

interface ClearPackageResponse {
    error: number;
    [key: string]: any;
}

/**
 * Creates an HTTP client with default configuration
 * @param host The robot's hostname
 * @param port The port number (default: 45948, HTTP API port)
 * @returns Axios instance configured for the robot
 */
function createHttpClient(host: string, port: number = 45948) {
    return axios.create({
        baseURL: `http://${host}:${port}`,
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

/**
 * Queries complete package information on the robot using HTTP REST API
 * @param host The robot's hostname
 * @returns A promise that resolves with complete package information
 */
export async function queryPackageInfoHttp(host: string): Promise<PackageInfo> {
    try {
        const client = createHttpClient(host);
        
        // Make GET request to /v2/robot/info
        const response = await client.get<GetInfoResponse>('/v2/robot/info', {
            params: {
                app_id: 'clear-pkg-node'
            }
        });

        const upperPackages = response.data.box_pack?.upper_box?.package_ids || [];
        const lowerPackages = response.data.box_pack?.lower_box?.package_ids || [];
        
        return {
            upperPackages,
            lowerPackages,
            totalCount: upperPackages.length + lowerPackages.length
        };
    } catch (error: any) {
        if (error.response) {
            // 服务器返回了错误状态码
            throw new Error(`HTTP GetInfo failed: ${error.response.data?.message || error.response.statusText || 'Server Error'}`);
        } else if (error.request) {
            // 请求发送了但没有收到响应
            throw new Error(`HTTP GetInfo failed: No response from server`);
        } else {
            // 其他错误
            throw new Error(`HTTP GetInfo failed: ${error.message}`);
        }
    }
}

/**
 * Queries the number of packages on the robot using HTTP REST API (legacy)
 * @param host The robot's hostname
 * @returns A promise that resolves with the total number of packages
 */
export async function queryPackagesHttp(host: string): Promise<number> {
    const info = await queryPackageInfoHttp(host);
    return info.totalCount;
}

/**
 * Clears all packages on the robot using HTTP REST API
 * @param host The robot's hostname
 * @returns A promise that resolves with the number of packages cleared
 */
export async function clearPackagesHttp(host: string): Promise<number> {
    try {
        const client = createHttpClient(host);
        
        // Step 1: Get the list of current packages
        const infoResponse = await client.get<GetInfoResponse>('/v2/robot/info', {
            params: {
                app_id: 'clear-pkg-node'
            }
        });

        const upperPackages = infoResponse.data.box_pack?.upper_box?.package_ids || [];
        const lowerPackages = infoResponse.data.box_pack?.lower_box?.package_ids || [];
        const package_ids = [...upperPackages, ...lowerPackages];

        if (package_ids.length === 0) {
            return 0; // Nothing to clear
        }

        // Step 2: Clear the packages using PUT request to /v2/robot/clear/package
        const clearResponse = await client.put<ClearPackageResponse>('/v2/robot/clear/package', {
            package_ids,
            app_id: 'clear-pkg-node'
        });

        // Check if the operation was successful (ERROR_OK = 0)
        if (clearResponse.data.error !== 0) {
            throw new Error(`HTTP ClearPackage returned an error code: ${clearResponse.data.error}`);
        }

        return package_ids.length;
    } catch (error: any) {
        if (error.response) {
            throw new Error(`HTTP ClearPackage failed: ${error.response.data?.message || error.response.statusText || 'Server Error'}`);
        } else if (error.request) {
            throw new Error(`HTTP ClearPackage failed: No response from server`);
        } else {
            throw new Error(`HTTP ClearPackage failed: ${error.message}`);
        }
    }
}

/**
 * Generic HTTP request wrapper for robot API
 * @param host The robot's hostname
 * @param method HTTP method
 * @param path API path
 * @param data Request data
 * @returns Promise with response data
 */
export async function makeRobotApiRequest<T = any>(
    host: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any
): Promise<T> {
    try {
        const client = createHttpClient(host);
        
        let response;
        if (method === 'GET') {
            response = await client.get<T>(path, { params: data });
        } else if (method === 'POST') {
            response = await client.post<T>(path, data);
        } else if (method === 'PUT') {
            response = await client.put<T>(path, data);
        } else if (method === 'DELETE') {
            response = await client.delete<T>(path);
        } else {
            throw new Error(`Unsupported HTTP method: ${method}`);
        }
        
        return response.data;
    } catch (error: any) {
        if (error.response) {
            throw new Error(`HTTP ${method} ${path} failed: ${error.response.data?.message || error.response.statusText || 'Server Error'}`);
        } else if (error.request) {
            throw new Error(`HTTP ${method} ${path} failed: No response from server`);
        } else {
            throw new Error(`HTTP ${method} ${path} failed: ${error.message}`);
        }
    }
}