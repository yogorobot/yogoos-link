import { BrowserWindow, dialog } from 'electron';
import log, { info } from 'electron-log';
import axios from 'axios';
import { sshManager } from '../managers';
import { ErrorResponse, SuccessResponse } from '../util';

class System {
  window: BrowserWindow | null = null;

  private connectionId: string;

  constructor(windowId: number, connectionId?: string) {
    this.window = BrowserWindow.fromId(windowId);
    if (!connectionId) {
      throw new Error('系统窗口没有绑定连接');
    }
    this.connectionId = connectionId;
    this.window?.once('closed', () => {
      // 清理引用
      this.window = null;
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private async getClient() {
    const host = await sshManager.executeCommand(
      this.connectionId,
      'sudo hostname',
    );
    return axios.create({
      baseURL: `http://${host}.yogo.love:45948`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async getStorageInfo() {
    try {
      // 使用 bash -c 包装，确保命令总是返回 0
      const stdout = await sshManager.executeCommand(
        this.connectionId,
        `bash -c "df -h -x tmpfs -x devtmpfs --output=source,size,used,avail,pcent,target 2>/dev/null; exit 0"`,
      );
      return new SuccessResponse(stdout);
    } catch (error) {
      console.error('获取存储信息失败:', error);
      return new ErrorResponse('获取存储信息失败');
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async reboot() {
    try {
      await sshManager.executeCommand(this.connectionId, 'sudo reboot');
      return new SuccessResponse(null);
    } catch (error) {
      console.error('执行重启命令失败:', error);
      return new ErrorResponse('重启失败');
    }
  }

  async rebootWithConfirmation(): Promise<
    SuccessResponse<void> | ErrorResponse
  > {
    const { window } = this;

    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      title: '系统重启确认',
      message: '您确定要重启系统吗？',
      detail: '系统重启后，所有未保存的工作将丢失，当前连接也会断开。',
      buttons: ['取消', '确认重启'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response === 1) {
      info('用户确认系统重启，正在执行重启命令');
      return this.reboot();
    }

    return new ErrorResponse('用户取消重启操作');
  }

  async getMeteorRobotVersion(): Promise<string> {
    try {
      const client = await this.getClient();

      // Make GET request to /v2/robot/version
      const response = await client.get<{ version: string }>(
        '/v2/robot/version',
        {
          params: {
            app_id: 'clear-pkg',
          },
        },
      );

      return response.data.version;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `HTTP GetVersion failed: ${error.response.data?.message || error.response.statusText || 'Server Error'}`,
        );
      } else if (error.request) {
        throw new Error(`HTTP GetVersion failed: No response from server`);
      } else {
        throw new Error(`HTTP GetVersion failed: ${error.message}`);
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async getTFCardMountPoint(): Promise<
    SuccessResponse<string> | ErrorResponse
  > {
    try {
      log.info('查找 TF 卡挂载点');

      const mountPointCommand = `df -h 2>/dev/null | grep '/dev/mmcblk' | awk '{print $NF}' | head -n 1 || echo ""`;
      const mountPoint = await sshManager.executeCommand(
        this.connectionId,
        mountPointCommand,
      );

      if (!mountPoint.trim()) {
        log.warn('未检测到 TF 卡挂载点');
        return new ErrorResponse('未检测到 TF 卡挂载点');
      }

      log.info(`检测到 TF 卡挂载点: ${mountPoint.trim()}`);
      return new SuccessResponse(mountPoint.trim());
    } catch (error) {
      log.error('查找 TF 卡挂载点失败:', error);
      return new ErrorResponse(`查找失败: ${(error as Error).message}`);
    }
  }

  async getServicesUsingTFCard(): Promise<
    SuccessResponse<string[]> | ErrorResponse
  > {
    try {
      log.info('开始检查使用 TF 卡的应用');

      // 1. 查找 TF 卡挂载点
      const mountPointResult = await this.getTFCardMountPoint();
      if (mountPointResult instanceof ErrorResponse) {
        return new SuccessResponse([]); // 没有 TF 卡时返回空数组
      }

      const mountPoint = mountPointResult.data;
      log.info(`检测到 TF 卡挂载点: ${mountPoint}`);

      // 2. 检查 lsof 命令是否可用
      const lsofCheckCommand = `command -v lsof > /dev/null 2>&1 && echo "available" || echo "not_available"`;
      const lsofAvailable = await sshManager.executeCommand(
        this.connectionId,
        lsofCheckCommand,
      );

      if (lsofAvailable.trim() !== 'available') {
        log.warn('lsof 命令不可用');
        return new SuccessResponse([]);
      }

      // 3. 查找使用 TF 卡的进程 PID
      const lsofCommand = `sudo lsof +D "${mountPoint}" 2>/dev/null | tail -n +2 | awk '{print $2}' | sort -u || echo ""`;
      const pidsOutput = await sshManager.executeCommand(
        this.connectionId,
        lsofCommand,
      );

      if (!pidsOutput.trim()) {
        log.info('未发现使用 TF 卡的进程');
        return new SuccessResponse([]);
      }

      const pids = pidsOutput
        .trim()
        .split('\n')
        .filter((pid) => pid.trim());
      const services: string[] = [];

      // 4. 对每个 PID 查找对应的 systemd 服务
      await Promise.all(
        pids.map(async (pid) => {
          try {
            const serviceCommand = `systemctl status ${pid} 2>/dev/null | grep -oP '●\\s+\\K[^\\s]+\\.service' | head -n 1 || echo ""`;
            const serviceName = await sshManager.executeCommand(
              this.connectionId,
              serviceCommand,
            );

            if (serviceName.trim() && !services.includes(serviceName.trim())) {
              services.push(serviceName.trim());
              log.info(`发现服务: ${serviceName.trim()} (PID: ${pid})`);
            }
          } catch (error) {
            log.warn(`查询 PID ${pid} 对应的服务失败:`, error);
          }
        }),
      );

      log.info('解析后的服务列表:', services);
      return new SuccessResponse(services);
    } catch (error) {
      log.error('查询使用TF卡的服务失败:', error);
      return new ErrorResponse(`查询失败: ${(error as Error).message}`);
    }
  }

  async clearCacheWithConfirmation(): Promise<
    SuccessResponse<string> | ErrorResponse
  > {
    const { window } = this;
    if (!window) {
      return new ErrorResponse('Window not found');
    }

    // 格式化存储卡的警告
    const dialogMessage = '您确定要格式化TF卡吗？';
    const dialogDetail =
      '此操作将【永久删除TF卡上的所有数据】。这是一个无法恢复的危险操作！';

    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      title: '高危操作确认',
      message: dialogMessage,
      detail: dialogDetail,
      buttons: ['取消', '确认执行'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response !== 1) {
      return new ErrorResponse('用户取消了操作');
    }

    // 用户已确认，立即向前端发送“确认信号”，以便UI可以显示模态框
    this.window?.webContents.send('system:clear-cache-confirmed');

    info('用户确认格式化操作，开始执行...');
    try {
      this.window?.webContents.send(
        'system:clear-cache-progress',
        '开始检查和格式化 TF 卡...\n',
      );

      const mountPointResult = await this.getTFCardMountPoint();
      if (mountPointResult instanceof ErrorResponse) {
        this.window?.webContents.send(
          'system:clear-cache-progress',
          `TF 卡检查失败: ${mountPointResult.error}\n`,
        );
        return new ErrorResponse(`TF 卡检查失败: ${mountPointResult.error}`);
      }

      const mountPoint = mountPointResult.data;
      this.window?.webContents.send(
        'system:clear-cache-progress',
        `检测到 TF 卡挂载点: ${mountPoint}\n`,
      );

      // 获取 TF 卡设备路径
      const deviceCommand = `df | grep '${mountPoint}' | awk '{print $1}' | head -n 1`;
      const device = await sshManager.executeCommand(
        this.connectionId,
        deviceCommand,
      );

      if (!device.trim()) {
        const errorMsg = '无法获取 TF 卡设备路径';
        this.window?.webContents.send(
          'system:clear-cache-progress',
          `${errorMsg}\n`,
        );
        return new ErrorResponse(errorMsg);
      }

      this.window?.webContents.send(
        'system:clear-cache-progress',
        `TF 卡设备: ${device.trim()}\n正在卸载 TF 卡...\n`,
      );

      const formatScript = `
#!/bin/bash

DEVICE="${device.trim()}"
MOUNT_POINT="${mountPoint}"

echo "开始TF卡格式化操作..."
echo "使用动态检测到的设备: $DEVICE"
echo "使用动态检测到的挂载点: $MOUNT_POINT"

# 检查设备是否存在
if [ ! -e "$DEVICE" ]; then
    echo "错误: 设备 $DEVICE 不存在"
    exit 1
fi

echo "设备存在检查通过"

# 检查当前挂载状态
echo "当前挂载状态:"
mount | grep "$DEVICE" || echo "设备未挂载"

# 强制卸载设备（如果已挂载）
echo "强制卸载设备..."

# 尝试多种卸载方法
for attempt in {1..5}; do
    echo "第 $attempt 次卸载尝试..."

    # 先尝试普通卸载
    sudo umount "$DEVICE" 2>/dev/null
    sudo umount "$MOUNT_POINT" 2>/dev/null

    # 检查是否还有挂载
    if ! mount | grep -q "$DEVICE"; then
        echo "✓ 设备已成功卸载"
        break
    fi

    if [ $attempt -eq 5 ]; then
        echo "尝试lazy卸载..."
        sudo umount -l "$DEVICE" 2>/dev/null
        sudo umount -l "$MOUNT_POINT" 2>/dev/null
        sleep 3

        # 最后检查
        if mount | grep -q "$DEVICE"; then
            echo "⚠ 无法完全卸载设备，但将尝试强制格式化"
        else
            echo "✓ lazy卸载成功"
        fi
        break
    fi

    echo "设备仍然挂载，等待后重试..."
    sleep 2
done

# 同步文件系统，确保所有数据写入完成
echo "同步文件系统..."
sync

# 格式化设备
echo "开始格式化TF卡为ext4格式..."
echo "执行命令: mkfs.ext4 -F $DEVICE"

# 使用-F强制格式化参数，即使设备被认为正在使用
if sudo mkfs.ext4 -F "$DEVICE" 2>&1; then
    echo "✓ 格式化成功"
else
    echo "✗ 格式化失败，尝试更强制的方法..."
    # 再次尝试卸载并格式化
    sudo umount -f "$DEVICE" 2>/dev/null
    sleep 2
    if sudo mkfs.ext4 -F "$DEVICE" 2>&1; then
        echo "✓ 强制格式化成功"
    else
        echo "✗ 格式化彻底失败"
        exit 1
    fi
fi

# 重新挂载
echo "重新挂载TF卡..."
sudo mkdir -p "$MOUNT_POINT"

if sudo mount "$DEVICE" "$MOUNT_POINT"; then
    echo "✓ 重新挂载成功"
else
    echo "✗ 重新挂载失败"
    exit 1
fi

echo "✅ TF卡格式化并重新挂载完毕"

# 验证挂载状态
echo "验证挂载状态..."
if mount | grep -q "$DEVICE"; then
    echo "✓ 设备已成功挂载到 $MOUNT_POINT"
    df -h "$MOUNT_POINT" 2>/dev/null | tail -1 || echo "无法获取磁盘信息"
else
    echo "⚠ 警告: 设备未正确挂载"
    exit 1
fi

echo "格式化操作成功完成"
`;
      const exitCode = await sshManager.executeCommandWithStream(
        this.connectionId,
        formatScript,
        (data: string) => {
          this.window?.webContents.send('system:clear-cache-progress', data);
        },
      );

      if (exitCode !== 0) {
        throw new Error(`TF 卡格式化失败，退出码: ${exitCode}`);
      }

      this.window?.webContents.send(
        'system:clear-cache-progress',
        '\n✅ TF 卡格式化完成！\n',
      );

      return new SuccessResponse('格式化操作执行完毕');
    } catch (error) {
      log.error('格式化操作失败:', error);
      const errorMessage = `格式化操作失败: ${(error as Error).message}`;
      this.window?.webContents.send(
        'system:clear-cache-progress',
        `\n\n❌ 错误: ${errorMessage}\n`,
      );
      return new ErrorResponse(errorMessage);
    }
  }
}

export default System;
