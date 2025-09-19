import { BrowserWindow } from 'electron';
import { sshManager, windowManager } from '../managers';

const buildFilterCommand = (filters): string => {
  const commands: string[] = [];

  // 搜索关键词过滤
  if (filters.searchTerm) {
    const searchTerm = filters.searchTerm;
    const caseFlag = filters.caseSensitive ? '' : '-i';
    commands.push(`grep -F ${caseFlag} '${searchTerm}'`);
  }

  // 排除关键词过滤
  if (filters.excludeTerms?.length > 0) {
    filters.excludeTerms.slice(0, 3).forEach((term) => {
      if (term) {
        const caseFlag = filters.caseSensitive ? '' : '-i';
        commands.push(`grep -F -v ${caseFlag} '${term}'`);
      }
    });
  }

  // 返回简化的命令
  return commands.join(' | ');
};

const formatFileList = (result) => {
  const lines = result.split('\n').filter((line) => line.trim());

  // 检查是否是目录列表（第一行是 "total xxx"）
  const startIndex = lines[0] && lines[0].startsWith('total ') ? 1 : 0;

  return lines
    .slice(startIndex)
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 9) return null; // 确保有足够的字段

      return {
        permissions: parts[0],
        links: parts[1],
        owner: parts[2],
        group: parts[3],
        size: parts[4],
        date: parts.slice(5, 8).join(' '),
        name: parts.slice(8).join(' '),
      };
    })
    .filter((file) => file && file.name)
    .sort((a, b) => b.name.localeCompare(a.name));
};

class Logs {
  processMap: Map<string, () => void> = new Map();

  async getStreamRealtimeFile() {
    const isExistsMeteorFile = await this.checkLogMeteorFile();
    const logFile = isExistsMeteorFile
      ? '/var/run/log/meteor.log'
      : '/var/log/apps/macross.log';

    const result = await sshManager.executeCommand(`ls -l ${logFile}`);
    console.log(result);

    return formatFileList(result);
  }

  async getHistoryLogList() {
    const result = await sshManager.executeCommand(
      `ls -l /var/log/meteor-*.gz`,
    );

    return formatFileList(result);
  }

  async checkLogMeteorFile() {
    const { sshConnection } = sshManager;
    if (!sshConnection) {
      throw new Error('SSH连接未建立');
    }

    const checkResult = await sshManager.executeCommand(
      '[ -f /var/run/log/meteor.log ] && echo "exists" || echo "not exists"',
    );

    return checkResult.trim() == 'exists';
  }

  async clearStream(id) {
    console.log('清理日志流:', id);
    const stopProcess = this.processMap.get(id);
    if (stopProcess) {
      stopProcess();
      this.processMap.delete(id);
    }
  }

  async getStreamRealtime(windowId, options) {
    const targetWindow = BrowserWindow.fromId(windowId);
    const { sshConnection } = sshManager;
    const { fileName, requestId, filters } = options;

    // 检查窗口是否存在
    if (!targetWindow || targetWindow.isDestroyed()) {
      throw new Error('目标窗口不存在或已销毁');
    }

    if (!sshConnection) {
      throw new Error('SSH连接未建立');
    }

    const filterCommand = buildFilterCommand(filters);

    const command =
      filterCommand === ''
        ? `sudo tail -n +1 -f ${fileName}`
        : `sudo tail -n +1 -f ${fileName} | ${filterCommand}`;

    console.log('实时日志命令:', command);

    // 检查窗口是否仍然存在
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send(`log:stream-start-${requestId}`);
    }
    const stop = await sshManager.executePtyCommand(command, (data) => {
      // 处理实时日志数据
      // 检查窗口是否仍然存在
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send(`log:stream-data-${requestId}`, data);
      }
    });

    this.processMap.set(requestId, stop);

    targetWindow.on('close', () => {
      this.clearStream(requestId);
    });

    return { success: true };
  }

  async getStreamHistory(windowId, options) {
    const targetWindow = BrowserWindow.fromId(windowId);
    const { sshConnection } = sshManager;
    const { fileName, requestId, filters } = options;

    // 检查窗口是否存在
    if (!targetWindow || targetWindow.isDestroyed()) {
      throw new Error('目标窗口不存在或已销毁');
    }

    if (!sshConnection) {
      throw new Error('SSH连接未建立');
    }

    const filterCommand = buildFilterCommand(filters);

    const command =
      filterCommand === ''
        ? `sudo zcat ${fileName}`
        : `sudo zcat ${fileName} | ${filterCommand}`;

    console.log('日志命令:', command);

    console.log('::::::::::::::::开始获取历史日志----', requestId);
    // targetWindow.webContents.send(`log:stream-start-${requestId}`);
    const stop = await sshManager.executePtyCommand(command, (data) => {
      // 处理实时日志数据
      // 检查窗口是否仍然存在
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send(`log:stream-data-${requestId}`, data);
      }
    });

    this.processMap.set(requestId, stop);

    targetWindow.on('close', () => {
      this.clearStream(requestId);
    });

    return { success: true };
  }
}

const logs = new Logs();

export default logs;
