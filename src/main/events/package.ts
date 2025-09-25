import axios from 'axios';
import { BrowserWindow } from 'electron';
import sshManager from '../managers/ssh';
import { ErrorResponse, SuccessResponse } from '../util';

// 查询包裹

class Package {
  window: Electron.BrowserWindow | null = null;
  constructor(windowId: number) {
    this.window = BrowserWindow.fromId(windowId);
    this.window?.on('closed', () => {
      // 清理引用
      this.window = null;
    });
  }

  private async getClient() {
    const host = await sshManager.executeCommand('sudo hostname');
    return axios.create({
      baseURL: `http://${host}.yogo.love:45948`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async queryPackages() {
    try {
      const client = await this.getClient();
      const response = await client.get('/v2/robot/info', {
        params: { app_id: 'clear-pkg' },
      });

      const upperPackages =
        response.data.box_pack?.upper_box?.package_ids || [];
      const lowerPackages =
        response.data.box_pack?.lower_box?.package_ids || [];
      return new SuccessResponse({
        upperPackages,
        lowerPackages,
        totalCount: upperPackages.length + lowerPackages.length,
      });
    } catch (error: any) {
      return new ErrorResponse(error.message || '主进程包裹查询失败');
    }
  }

  async clearPackages() {
    try {
      const client = await this.getClient();
      // 先查包裹
      const infoResponse = await client.get('/v2/robot/info', {
        params: { app_id: 'clear-pkg' },
      });
      const upperPackages =
        infoResponse.data.box_pack?.upper_box?.package_ids || [];
      const lowerPackages =
        infoResponse.data.box_pack?.lower_box?.package_ids || [];
      const package_ids = [...upperPackages, ...lowerPackages];

      if (package_ids.length === 0) return new SuccessResponse(0);
      // 清空
      const clearResponse = await client.put('/v2/robot/clear/package', {
        package_ids,
        app_id: 'jarvis',
      });
      if (clearResponse.data.error) {
        return new ErrorResponse(
          `清空包裹失败，错误码: ${clearResponse.data.error}`,
        );
      }
      return new SuccessResponse(package_ids.length);
    } catch (error: any) {
      return new ErrorResponse(error.message || '主进程清空包裹失败');
    }
  }

  async clearSinglePackage(packageId: number) {
    try {
      const client = await this.getClient();
      // 清空单个包裹
      const clearResponse = await client.put('/v2/robot/clear/package', {
        package_ids: [packageId],
        app_id: 'jarvis',
      });
      if (clearResponse.data.error) {
        return new ErrorResponse(
          `清空包裹 ${packageId} 失败，错误码: ${clearResponse.data.error}`,
        );
      }
      return new SuccessResponse(packageId);
    } catch (error: any) {
      return new ErrorResponse(error.message || '主进程清空单个包裹失败');
    }
  }
}

export default Package;
