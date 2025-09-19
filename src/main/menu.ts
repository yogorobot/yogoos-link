import { app, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'YogoTool',
      submenu: [
        {
          label: 'About YogoTool',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide YogoTool',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };

    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            focusedWindow?.setFullScreen(!focusedWindow?.isFullScreen());
            // this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };

    const subMenuDebug: DarwinMenuItemConstructorOptions = {
      label: 'Debug',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            // 获取当前焦点窗口，如果没有则使用主窗口
            const focusedWindow =
              BrowserWindow.getFocusedWindow() || this.mainWindow;
            focusedWindow.webContents.toggleDevTools();
          },
        },
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            // 获取当前焦点窗口，如果没有则使用主窗口
            const focusedWindow =
              BrowserWindow.getFocusedWindow() || this.mainWindow;
            focusedWindow.webContents.reload();
          },
        },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuDebug, subMenuWindow];
  }

  buildDefaultTemplate() {
    const templateDefault: MenuItemConstructorOptions[] = [
      {
        label: '&Edit',
        submenu: [
          {
            label: '&Cut',
            accelerator: 'Ctrl+X',
            role: 'cut',
          },
          {
            label: '&Copy',
            accelerator: 'Ctrl+C',
            role: 'copy',
          },
          {
            label: '&Paste',
            accelerator: 'Ctrl+V',
            role: 'paste',
          },
          {
            label: 'Select &All',
            accelerator: 'Ctrl+A',
            role: 'selectAll',
          },
        ],
      },
      {
        label: '&Debug',
        submenu: [
          {
            label: 'Toggle &Developer Tools',
            accelerator: 'Alt+Ctrl+I',
            click: () => {
              // 获取当前焦点窗口，如果没有则使用主窗口
              const focusedWindow =
                BrowserWindow.getFocusedWindow() || this.mainWindow;
              focusedWindow.webContents.toggleDevTools();
            },
          },
          {
            label: '&Reload',
            accelerator: 'Ctrl+R',
            click: () => {
              // 获取当前焦点窗口，如果没有则使用主窗口
              const focusedWindow =
                BrowserWindow.getFocusedWindow() || this.mainWindow;
              focusedWindow.webContents.reload();
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
