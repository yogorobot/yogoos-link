import { BrowserWindow } from 'electron';
import { sshManager } from '../managers';

const buildFilterCommand = (filters): string => {
  const commands: string[] = [];

  // 搜索关键词过滤
  if (filters.searchTerm) {
    const { searchTerm } = filters;
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

  window: BrowserWindow | null = null;

  private connectionId: string;

  constructor(windowId: number, connectionId?: string) {
    this.window = BrowserWindow.fromId(windowId);
    if (!connectionId) {
      throw new Error('日志窗口没有绑定连接');
    }
    this.connectionId = connectionId;
    this.window.once('closed', () => {
      this.window = null;
      this.cleanup();
    });
  }

  async detectLogType(): Promise<'meteor' | 'macross'> {
    const checkResult = await sshManager.executeCommand(
      this.connectionId,
      '[ -f /var/run/log/macross.log ] && echo "macross" || echo "meteor"',
    );
    return checkResult.trim() === 'macross' ? 'macross' : 'meteor';
  }

  async getStreamRealtimeFile() {
    try {
      const logType = await this.detectLogType();
      const logFile =
        logType === 'macross'
          ? '/var/run/log/macross.log'
          : '/var/run/log/meteor.log';

      const result = await sshManager.executeCommand(
        this.connectionId,
        `ls -l ${logFile} 2>/dev/null || true`,
      );
      console.log(result);

      return formatFileList(result);
    } catch (error) {
      console.error('获取实时日志文件失败:', error);
      return [];
    }
  }

  async getHistoryLogList() {
    try {
      const logType = await this.detectLogType();
      const pattern =
        logType === 'macross'
          ? '/var/log/macross-*.gz'
          : '/var/log/meteor-*.gz';

      const result = await sshManager.executeCommand(
        this.connectionId,
        `ls -l ${pattern} 2>/dev/null || true`,
      );

      return formatFileList(result);
    } catch (error) {
      console.error('获取历史日志列表失败:', error);
      return [];
    }
  }

  async cleanup() {
    this.processMap.forEach((stopProcess, requestId) => {
      console.log('清理日志流:', requestId);
      if (stopProcess) {
        stopProcess();
        this.processMap.delete(requestId);
      }
    });
  }

  async getStreamRealtime(options) {
    // const targetWindow = BrowserWindow.fromId(windowId);
    const { fileName, requestId, filters } = options;

    // 检查窗口是否存在
    if (!this.window || this.window.isDestroyed()) {
      throw new Error('目标窗口不存在或已销毁');
    }

    const filterCommand = buildFilterCommand(filters);

    const command =
      filterCommand === ''
        ? `sudo tail -n +1 -f ${fileName}`
        : `sudo tail -n +1 -f ${fileName} | ${filterCommand}`;

    console.log('实时日志命令:', command);

    // 检查窗口是否仍然存在
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(`log:stream-start-${requestId}`);
    }
    const stop = await sshManager.executePtyCommand(
      this.connectionId,
      command,
      (data) => {
        // 处理实时日志数据
        // 检查窗口是否仍然存在
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send(`log:stream-data-${requestId}`, data);
        }
      },
    );

    this.processMap.set(requestId, stop);
  }

  async getStreamHistory(options) {
    // const targetWindow = BrowserWindow.fromId(windowId);
    const { fileName, requestId, filters } = options;

    // 检查窗口是否存在
    if (!this.window || this.window.isDestroyed()) {
      throw new Error('目标窗口不存在或已销毁');
    }

    const filterCommand = buildFilterCommand(filters);

    const command =
      filterCommand === ''
        ? `sudo zcat ${fileName}`
        : `sudo zcat ${fileName} | ${filterCommand}`;

    console.log('日志命令:', command);

    console.log('::::::::::::::::开始获取历史日志----', requestId);
    // targetWindow.webContents.send(`log:stream-start-${requestId}`);
    const stop = await sshManager.executePtyCommand(
      this.connectionId,
      command,
      (data) => {
        // 处理实时日志数据
        // 检查窗口是否仍然存在
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send(`log:stream-data-${requestId}`, data);
        }
      },
    );

    this.processMap.set(requestId, stop);
  }
}

export default Logs;
