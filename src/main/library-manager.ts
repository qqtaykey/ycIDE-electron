/**
 * 支持库管理器
 * 扫描 lib 文件夹、加载 .fne 文件、管理已加载的支持库信息。
 */
import { readdirSync, existsSync } from 'fs'
import { join, basename, extname } from 'path'
import { app } from 'electron'
import { parseFneFile, type LibInfo, type LibWindowUnit } from './fne-parser'

export interface LibraryItem {
  name: string         // 文件名（不含扩展名，如 krnln）
  filePath: string     // 完整路径
  loaded: boolean      // 是否已加载
  libInfo: LibInfo | null  // 加载后的信息
}

class LibraryManager {
  private libraries: LibraryItem[] = []

  /** 获取 lib 文件夹路径 */
  getLibFolder(): string {
    const isDev = !app.isPackaged
    if (isDev) {
      // 开发模式：项目根目录下的 lib 文件夹
      return join(app.getAppPath(), 'lib')
    }
    // 生产模式：exe 所在目录下的 lib 文件夹
    return join(process.resourcesPath, 'lib')
  }

  /** 扫描支持库文件夹，查找所有 .fne 文件 */
  scan(customFolder?: string): ReturnType<LibraryManager['getList']> {
    this.libraries = []
    const libFolder = customFolder || this.getLibFolder()
    const found = new Set<string>()

    // 扫描顺序：先 lib/x64，再 lib 根目录
    const scanDirs = [join(libFolder, 'x64'), libFolder]

    for (const dir of scanDirs) {
      if (!existsSync(dir)) continue
      try {
        const files = readdirSync(dir)
        for (const file of files) {
          if (extname(file).toLowerCase() !== '.fne') continue
          const name = basename(file, '.fne')
          if (found.has(name)) continue
          found.add(name)

          this.libraries.push({
            name,
            filePath: join(dir, file),
            loaded: false,
            libInfo: null,
          })
        }
      } catch {
        // 目录不可读，跳过
      }
    }

    return this.getList()
  }

  /** 加载指定支持库 */
  load(name: string): LibInfo | null {
    const item = this.libraries.find(l => l.name === name)
    if (!item) return null
    if (item.loaded && item.libInfo) return item.libInfo

    const info = parseFneFile(item.filePath)
    if (info) {
      item.loaded = true
      item.libInfo = info
    }
    return info
  }

  /** 加载所有已扫描的支持库 */
  loadAll(): number {
    let count = 0
    for (const item of this.libraries) {
      if (!item.loaded) {
        const info = parseFneFile(item.filePath)
        if (info) {
          item.loaded = true
          item.libInfo = info
          count++
        }
      }
    }
    return count
  }

  /** 获取支持库列表（不含 libInfo 详情，用于 UI 展示） */
  getList(): Array<{ name: string; filePath: string; loaded: boolean; libName?: string; cmdCount?: number; dtCount?: number }> {
    return this.libraries.map(l => ({
      name: l.name,
      filePath: l.filePath,
      loaded: l.loaded,
      libName: l.libInfo?.name,
      cmdCount: l.libInfo?.commands.length,
      dtCount: l.libInfo?.dataTypes.length,
    }))
  }

  /** 获取所有已加载的命令 */
  getAllCommands(): LibInfo['commands'] {
    const cmds: LibInfo['commands'] = []
    for (const item of this.libraries) {
      if (item.loaded && item.libInfo) {
        cmds.push(...item.libInfo.commands)
      }
    }
    return cmds
  }

  /** 获取所有已加载的数据类型 */
  getAllDataTypes(): LibInfo['dataTypes'] {
    const dts: LibInfo['dataTypes'] = []
    for (const item of this.libraries) {
      if (item.loaded && item.libInfo) {
        dts.push(...item.libInfo.dataTypes)
      }
    }
    return dts
  }

  /** 获取指定支持库的详细信息 */
  getLibInfo(name: string): LibInfo | null {
    const item = this.libraries.find(l => l.name === name)
    return item?.libInfo ?? null
  }

  /** 获取所有已加载的窗口组件 */
  getAllWindowUnits(): LibWindowUnit[] {
    const units: LibWindowUnit[] = []
    for (const item of this.libraries) {
      if (item.loaded && item.libInfo) {
        units.push(...item.libInfo.windowUnits)
      }
    }
    return units
  }
}

export const libraryManager = new LibraryManager()
