import { contextBridge, ipcRenderer } from 'electron'

// 向渲染进程安全暴露的 API
const api = {
  // 窗口控制
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },
  // 文件操作
  file: {
    open: (path: string) => ipcRenderer.invoke('file:open', path),
    save: (path: string, content: string) => ipcRenderer.invoke('file:save', path, content),
    readDir: (path: string) => ipcRenderer.invoke('file:readDir', path)
  },
  // 项目管理
  project: {
    getDefaultPath: () => ipcRenderer.invoke('project:getDefaultPath') as Promise<string>,
    selectDirectory: () => ipcRenderer.invoke('project:selectDirectory') as Promise<string | null>,
    create: (info: { name: string; path: string; type: string; platform: string }) =>
      ipcRenderer.invoke('project:create', info) as Promise<{ projectDir: string; eppPath: string }>,
    readFile: (filePath: string) => ipcRenderer.invoke('project:readFile', filePath) as Promise<string | null>,
    parseEpp: (eppPath: string) => ipcRenderer.invoke('project:parseEpp', eppPath) as Promise<{
      projectName: string; outputType: string; platform: string;
      files: Array<{ type: string; fileName: string; flag: number }>;
      projectDir: string;
    } | null>,
    saveOpenTabs: (projectDir: string, tabPaths: string[]) => ipcRenderer.invoke('project:saveOpenTabs', projectDir, tabPaths),
    loadOpenTabs: (projectDir: string) => ipcRenderer.invoke('project:loadOpenTabs', projectDir) as Promise<string[]>,
  },
  // 编译
  compiler: {
    compile: (projectPath: string) => ipcRenderer.invoke('compiler:compile', projectPath),
    onOutput: (callback: (data: string) => void) => {
      ipcRenderer.on('compiler:output', (_event, data) => callback(data))
    }
  },
  // 支持库管理
  library: {
    scan: (folder?: string) => ipcRenderer.invoke('library:scan', folder),
    scanFolder: () => ipcRenderer.invoke('library:scanFolder'),
    load: (name: string) => ipcRenderer.invoke('library:load', name),
    loadAll: () => ipcRenderer.invoke('library:loadAll'),
    getList: () => ipcRenderer.invoke('library:getList'),
    getInfo: (name: string) => ipcRenderer.invoke('library:getInfo', name),
    getAllCommands: () => ipcRenderer.invoke('library:getAllCommands'),
    getAllDataTypes: () => ipcRenderer.invoke('library:getAllDataTypes'),
    getWindowUnits: () => ipcRenderer.invoke('library:getWindowUnits'),
  },
  // 通用 IPC
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
