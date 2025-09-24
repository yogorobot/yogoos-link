import axios from 'axios';
import sshManager from '../managers/ssh';
import { ErrorResponse, SuccessResponse } from '../util';

// 查询包裹

class Package {
  async queryPackages() {
    try {
      const { host } = sshManager.sshCredentials;
      const client = axios.create({
        baseURL: `http://${host}:45948`,
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await client.get('/v2/robot/info', {
        params: { app_id: 'clear-pkg-node' },
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
    console.log(111111);
    try {
      const { host } = sshManager.sshCredentials;
      const client = axios.create({
        baseURL: `http://${host}:45948`,
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      });
      // 先查包裹
      const infoResponse = await client.get('/v2/robot/info', {
        params: { app_id: 'clear-pkg-node' },
      });
      console.log(infoResponse);
      const upperPackages =
        infoResponse.data.box_pack?.upper_box?.package_ids || [];
      const lowerPackages =
        infoResponse.data.box_pack?.lower_box?.package_ids || [];
      const package_ids = [...upperPackages, ...lowerPackages];
      if (package_ids.length === 0) return new SuccessResponse(0);
      // 清空
      const clearResponse = await client.put('/v2/robot/clear/package', {
        package_ids,
        app_id: 'clear-pkg-node',
      });
      if (clearResponse.data.error !== 0) {
        return new ErrorResponse(`清空包裹失败，错误码: ${clearResponse.data.error}`);
      }
      return new SuccessResponse(package_ids.length);
    } catch (error: any) {
      return new ErrorResponse(error.message || '主进程清空包裹失败');
    }
  }
}

export default Package;
