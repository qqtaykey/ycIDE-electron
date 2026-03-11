import { join, dirname, basename } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs'
import { execFile, ChildProcess } from 'child_process'
import { app, BrowserWindow } from 'electron'

// 编译消息类型
export interface CompileMessage {
  type: 'info' | 'warning' | 'error' | 'success'
  text: string
}

// 编译选项
export interface CompileOptions {
  projectDir: string
  debug?: boolean
}

// 编译结果
export interface CompileResult {
  success: boolean
  outputFile: string
  errorCount: number
  warningCount: number
  elapsedMs: number
}

// 窗口控件信息
interface WindowControlInfo {
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  text: string
}

// 窗口文件信息
interface WindowFileInfo {
  width: number
  height: number
  title: string
  controls: WindowControlInfo[]
}

// 项目文件条目
interface ProjectFileEntry {
  type: string
  fileName: string
  flag: number
}

// 项目信息
interface ProjectInfo {
  projectName: string
  outputType: string
  platform: string
  files: ProjectFileEntry[]
  projectDir: string
}

// 正在运行的进程
let runningProcess: ChildProcess | null = null

// 发送编译消息到渲染进程
function sendMessage(msg: CompileMessage): void {
  BrowserWindow.getAllWindows().forEach(w => {
    w.webContents.send('compiler:output', msg)
  })
}

// 获取应用目录（开发模式下是项目根目录）
function getAppDirectory(): string {
  if (!app.isPackaged) {
    return app.getAppPath()
  }
  return dirname(process.execPath)
}

// 查找 Clang 编译器
function findClangCompiler(): string | null {
  const appDir = getAppDirectory()
  const searchPaths = [
    join(appDir, 'compiler', 'llvm', 'bin', 'clang.exe'),
    join(appDir, 'compiler', 'bin', 'clang.exe'),
  ]
  for (const p of searchPaths) {
    if (existsSync(p)) return p
  }
  return null
}

// 查找 MSVC SDK 路径
interface MSVCSDKPaths {
  msvcInclude: string
  msvcLib: string
  ucrtInclude: string
  ucrtLib: string
  umInclude: string
  sharedInclude: string
  umLib: string
}

function findMSVCSDK(arch: string): MSVCSDKPaths | null {
  const appDir = getAppDirectory()
  const searchRoots = [
    join(appDir, 'compiler', 'MSVCSDK'),
    join(appDir, 'MSVCSDK'),
  ]

  for (const root of searchRoots) {
    if (!existsSync(root)) continue

    // 检测 MSVC 版本号
    const msvcBase = join(root, 'MSVC')
    if (!existsSync(msvcBase)) continue
    const msvcVersions = readdirSync(msvcBase).filter(d => {
      try { return statSync(join(msvcBase, d)).isDirectory() } catch { return false }
    })
    if (msvcVersions.length === 0) continue
    const msvcVer = msvcVersions[msvcVersions.length - 1]
    const msvcRoot = join(msvcBase, msvcVer)

    // 检测 SDK 版本号
    const sdkBase = join(root, 'WindowsKits', '10')
    const sdkIncDir = join(sdkBase, 'Include')
    if (!existsSync(sdkIncDir)) continue
    const sdkVersions = readdirSync(sdkIncDir).filter(d => d.startsWith('10.'))
    if (sdkVersions.length === 0) continue
    const sdkVer = sdkVersions[sdkVersions.length - 1]

    const sdkIncBase = join(sdkBase, 'Include', sdkVer)
    const sdkLibBase = join(sdkBase, 'Lib', sdkVer)

    // 验证关键文件
    if (!existsSync(join(msvcRoot, 'include', 'vcruntime.h'))) continue
    if (!existsSync(join(sdkIncBase, 'um', 'windows.h'))) continue

    const archDir = arch === 'x86' ? 'x86' : 'x64'
    return {
      msvcInclude: join(msvcRoot, 'include'),
      msvcLib: join(msvcRoot, 'lib', archDir),
      ucrtInclude: join(sdkIncBase, 'ucrt'),
      ucrtLib: join(sdkLibBase, 'ucrt', archDir),
      umInclude: join(sdkIncBase, 'um'),
      sharedInclude: join(sdkIncBase, 'shared'),
      umLib: join(sdkLibBase, 'um', archDir),
    }
  }
  return null
}

// 解析 .epp 项目文件
function parseEppFile(eppPath: string): ProjectInfo | null {
  if (!existsSync(eppPath)) return null
  const content = readFileSync(eppPath, 'utf-8')
  const lines = content.split('\n').map(l => l.trim())
  const info: Record<string, string> = {}
  const files: ProjectFileEntry[] = []
  for (const line of lines) {
    if (line.startsWith('#') || line === '') continue
    if (line.startsWith('File=')) {
      const parts = line.substring(5).split('|')
      if (parts.length >= 2) {
        files.push({
          type: parts[0],
          fileName: parts[1],
          flag: parts[2] ? parseInt(parts[2], 10) : 0
        })
      }
    } else {
      const eqIdx = line.indexOf('=')
      if (eqIdx > 0) {
        info[line.substring(0, eqIdx)] = line.substring(eqIdx + 1)
      }
    }
  }
  return {
    projectName: info['ProjectName'] || '',
    outputType: info['OutputType'] || 'WindowsApp',
    platform: info['Platform'] || 'x64',
    files,
    projectDir: dirname(eppPath)
  }
}

// 获取控件的 Win32 类名
function getWin32ClassName(ctrlType: string): string {
  const map: Record<string, string> = {
    'Button': 'BUTTON', '按钮': 'BUTTON',
    'Label': 'STATIC', '标签': 'STATIC',
    'Edit': 'EDIT', '编辑框': 'EDIT',
    'TextBox': 'EDIT', '文本框': 'EDIT',
    'CheckBox': 'BUTTON', '复选框': 'BUTTON', '选择框': 'BUTTON',
    'RadioButton': 'BUTTON', '单选框': 'BUTTON',
    'ListBox': 'LISTBOX', '列表框': 'LISTBOX',
    'ComboBox': 'COMBOBOX', '组合框': 'COMBOBOX',
    'GroupBox': 'BUTTON', '分组框': 'BUTTON',
    '图片框': 'STATIC',
  }
  return map[ctrlType] || 'STATIC'
}

// 获取控件的 Win32 样式
function getWin32Style(ctrlType: string): string {
  const map: Record<string, string> = {
    'Button': 'WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON',
    '按钮': 'WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON',
    'Label': 'WS_CHILD | WS_VISIBLE | SS_LEFT',
    '标签': 'WS_CHILD | WS_VISIBLE | SS_LEFT',
    'Edit': 'WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL',
    '编辑框': 'WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL',
    'TextBox': 'WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL',
    '文本框': 'WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL',
    'CheckBox': 'WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX',
    '复选框': 'WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX',
    '选择框': 'WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX',
    'ListBox': 'WS_CHILD | WS_VISIBLE | WS_BORDER | WS_VSCROLL | LBS_NOTIFY',
    '列表框': 'WS_CHILD | WS_VISIBLE | WS_BORDER | WS_VSCROLL | LBS_NOTIFY',
    'ComboBox': 'WS_CHILD | WS_VISIBLE | CBS_DROPDOWNLIST | WS_VSCROLL',
    '组合框': 'WS_CHILD | WS_VISIBLE | CBS_DROPDOWNLIST | WS_VSCROLL',
    'GroupBox': 'WS_CHILD | WS_VISIBLE | BS_GROUPBOX',
    '分组框': 'WS_CHILD | WS_VISIBLE | BS_GROUPBOX',
    '图片框': 'WS_CHILD | WS_VISIBLE | SS_LEFT',
  }
  return map[ctrlType] || 'WS_CHILD | WS_VISIBLE | SS_LEFT'
}

// 解析窗口文件
function parseWindowFile(efwPath: string): WindowFileInfo {
  const info: WindowFileInfo = { width: 592, height: 384, title: '窗口', controls: [] }
  if (!existsSync(efwPath)) return info
  try {
    const data = JSON.parse(readFileSync(efwPath, 'utf-8'))
    info.width = data.formWidth || data.width || 592
    info.height = data.formHeight || data.height || 384
    info.title = data.formTitle || data.title || data.name || '窗口'
    if (Array.isArray(data.controls)) {
      for (const c of data.controls) {
        const props = c.properties || {}
        info.controls.push({
          type: c.type || '',
          name: c.name || '',
          x: c.x ?? c.left ?? 0,
          y: c.y ?? c.top ?? 0,
          width: c.width ?? 80,
          height: c.height ?? 24,
          text: props['标题'] || props['文本'] || props['title'] || props['text'] || c.name || '',
        })
      }
    }
  } catch { /* ignore */ }
  return info
}

// 易语言数据类型 → C 类型
function mapTypeToCType(type: string): string {
  const map: Record<string, string> = {
    '整数型': 'int', '长整数型': 'long long', '小数型': 'float',
    '双精度小数型': 'double', '文本型': 'wchar_t*', '逻辑型': 'int',
    '字节型': 'unsigned char', '短整数型': 'short',
  }
  return map[type] || 'int'
}

// 简易 .eyc 转 C 代码转译器
// 将易语言源代码中的子程序转译成 C 函数
function transpileEycContent(eycContent: string, fileName: string): string {
  const lines = eycContent.split('\n')
  let result = `/* 由 ycIDE 自动从 ${fileName} 生成 */\n`
  result += '#include <windows.h>\n#include <stdio.h>\n\n'

  let inSub = false
  let subName = ''
  let subBody = ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('.版本') || line.startsWith('.程序集') || line === '') continue

    if (line.startsWith('.子程序 ')) {
      // 如果之前有子程序，先输出
      if (inSub && subName) {
        result += `void ${subName}(void) {\n${subBody}}\n\n`
      }
      const parts = line.substring(4).split(',').map(s => s.trim())
      subName = parts[0] || 'unnamed'
      subBody = ''
      inSub = true
      continue
    }

    if (line.startsWith('.局部变量 ')) {
      const parts = line.substring(5).split(',').map(s => s.trim())
      const varName = parts[0] || 'v'
      const varType = parts[1] || '整数型'
      subBody += `    ${mapTypeToCType(varType)} ${varName};\n`
      continue
    }

    if (inSub) {
      // 简单的命令映射
      if (line.startsWith('信息框')) {
        const match = line.match(/信息框\s*[（(](.+?)[,，]/)
        const msg = match ? match[1].replace(/[""]/g, '"').replace(/^"|"$/g, '') : '消息'
        subBody += `    MessageBoxW(NULL, L"${msg}", L"提示", MB_OK);\n`
      } else if (line.startsWith('标准输出')) {
        const match = line.match(/标准输出\s*[（(](.+?)[)）]/)
        const msg = match ? match[1].replace(/[""]/g, '"').replace(/^"|"$/g, '') : ''
        subBody += `    wprintf(L"${msg}\\n");\n`
      } else {
        subBody += `    /* ${line} */\n`
      }
    }
  }

  // 输出最后一个子程序
  if (inSub && subName) {
    result += `void ${subName}(void) {\n${subBody}}\n\n`
  }

  return result
}

// 生成 main.c 入口文件
function generateMainC(project: ProjectInfo, tempDir: string, editorFiles?: Map<string, string>): string[] {
  const mainCPath = join(tempDir, 'main.c')
  const additionalCFiles: string[] = []

  let mainCode = '/* 由 ycIDE 自动生成 */\n'
  mainCode += `/* 项目名称: ${project.projectName} */\n\n`
  mainCode += '#include <windows.h>\n#include <stdio.h>\n\n'

  const isWindowsApp = project.outputType === 'WindowsApp'

  if (isWindowsApp) {
    // 查找启动窗口文件
    let efwFile = project.files.find(f => f.fileName === '_启动窗口.efw')
    if (!efwFile) efwFile = project.files.find(f => f.type === 'EFW')

    let winInfo: WindowFileInfo = { width: 592, height: 384, title: project.projectName, controls: [] }
    if (efwFile) {
      // 优先从编辑器内存中获取
      const editorContent = editorFiles?.get(efwFile.fileName)
      if (editorContent) {
        try {
          const data = JSON.parse(editorContent)
          winInfo.width = data.width || 592
          winInfo.height = data.height || 384
          winInfo.title = data.title || data.name || project.projectName
          if (Array.isArray(data.controls)) {
            for (const c of data.controls) {
              const props = c.properties || {}
              winInfo.controls.push({
                type: c.type || '', name: c.name || '',
                x: c.x ?? c.left ?? 0, y: c.y ?? c.top ?? 0,
                width: c.width ?? 80, height: c.height ?? 24,
                text: props['标题'] || props['文本'] || c.name || '',
              })
            }
          }
        } catch { /* fall through to file */ }
      } else {
        winInfo = parseWindowFile(join(project.projectDir, efwFile.fileName))
      }
    }

    // 全局变量
    mainCode += 'static const wchar_t* g_szClassName = L"ycIDEWindowClass";\n'
    mainCode += `static const wchar_t* g_szTitle = L"${winInfo.title}";\n`
    mainCode += `static int g_nWidth = ${winInfo.width};\n`
    mainCode += `static int g_nHeight = ${winInfo.height};\n`
    mainCode += 'static HINSTANCE g_hInstance;\n\n'

    // 控件ID
    if (winInfo.controls.length > 0) {
      mainCode += '/* 控件ID定义 */\n'
      let ctrlId = 1001
      for (const ctrl of winInfo.controls) {
        mainCode += `#define IDC_${ctrl.name.toUpperCase()} ${ctrlId++}\n`
      }
      mainCode += '\n'
    }

    // 前向声明 .eyc 中的子程序
    // 查找关联的 .eyc 文件并转译
    for (const f of project.files) {
      if (f.type !== 'EYC') continue
      const eycPath = join(project.projectDir, f.fileName)
      const editorContent = editorFiles?.get(f.fileName)
      const content = editorContent || (existsSync(eycPath) ? readFileSync(eycPath, 'utf-8') : '')
      if (!content) continue

      sendMessage({ type: 'info', text: `正在转换源文件: ${f.fileName}` })
      const cCode = transpileEycContent(content, f.fileName)
      const cFileName = f.fileName.replace(/\.eyc$/i, '.c')
      const cFilePath = join(tempDir, cFileName)
      writeFileSync(cFilePath, cCode, 'utf-8')
      additionalCFiles.push(cFilePath)
      sendMessage({ type: 'info', text: `已生成: ${cFileName}` })
    }

    // 创建控件函数
    mainCode += '/* 创建所有控件 */\n'
    mainCode += 'void CreateControls(HWND hWndParent) {\n'
    mainCode += '    HFONT hFont = (HFONT)GetStockObject(DEFAULT_GUI_FONT);\n'
    mainCode += '    HWND hCtrl;\n'

    let ctrlId = 1001
    for (const ctrl of winInfo.controls) {
      const className = getWin32ClassName(ctrl.type)
      const style = getWin32Style(ctrl.type)
      const text = ctrl.text || ctrl.name
      mainCode += `    hCtrl = CreateWindowExW(0, L"${className}", L"${text}",\n`
      mainCode += `        ${style},\n`
      mainCode += `        ${ctrl.x}, ${ctrl.y}, ${ctrl.width}, ${ctrl.height},\n`
      mainCode += `        hWndParent, (HMENU)${ctrlId++}, g_hInstance, NULL);\n`
      mainCode += '    SendMessage(hCtrl, WM_SETFONT, (WPARAM)hFont, TRUE);\n\n'
    }
    mainCode += '}\n\n'

    // 弱链接事件处理函数
    mainCode += '/* 事件处理函数默认实现 */\n'
    mainCode += '#define WEAK_FUNC __attribute__((weak))\n'
    for (const ctrl of winInfo.controls) {
      if (ctrl.type === 'Button' || ctrl.type === '按钮') {
        mainCode += `WEAK_FUNC void _${ctrl.name}_被单击(void) { }\n`
      }
    }
    mainCode += 'WEAK_FUNC void __启动窗口_创建完毕(void) { }\n\n'

    // 窗口过程
    mainCode += '/* 窗口过程函数 */\n'
    mainCode += 'LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam) {\n'
    mainCode += '    switch (message) {\n'
    mainCode += '    case WM_CREATE:\n'
    mainCode += '        CreateControls(hWnd);\n'
    mainCode += '        __启动窗口_创建完毕();\n'
    mainCode += '        break;\n'
    mainCode += '    case WM_COMMAND: {\n'
    mainCode += '        int wmId = LOWORD(wParam);\n'
    mainCode += '        int wmEvent = HIWORD(wParam);\n'
    mainCode += '        switch (wmId) {\n'

    ctrlId = 1001
    for (const ctrl of winInfo.controls) {
      if (ctrl.type === 'Button' || ctrl.type === '按钮') {
        mainCode += `        case IDC_${ctrl.name.toUpperCase()}:\n`
        mainCode += '            if (wmEvent == BN_CLICKED) {\n'
        mainCode += `                _${ctrl.name}_被单击();\n`
        mainCode += '            }\n'
        mainCode += '            break;\n'
      }
      ctrlId++
    }

    mainCode += '        default:\n'
    mainCode += '            return DefWindowProcW(hWnd, message, wParam, lParam);\n'
    mainCode += '        }\n'
    mainCode += '        break;\n'
    mainCode += '    }\n'
    mainCode += '    case WM_PAINT: {\n'
    mainCode += '        PAINTSTRUCT ps;\n'
    mainCode += '        HDC hdc = BeginPaint(hWnd, &ps);\n'
    mainCode += '        EndPaint(hWnd, &ps);\n'
    mainCode += '        break;\n'
    mainCode += '    }\n'
    mainCode += '    case WM_DESTROY:\n'
    mainCode += '        PostQuitMessage(0);\n'
    mainCode += '        break;\n'
    mainCode += '    default:\n'
    mainCode += '        return DefWindowProcW(hWnd, message, wParam, lParam);\n'
    mainCode += '    }\n'
    mainCode += '    return 0;\n'
    mainCode += '}\n\n'

    // WinMain
    mainCode += 'int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance,\n'
    mainCode += '                   LPSTR lpCmdLine, int nCmdShow) {\n'
    mainCode += '    g_hInstance = hInstance;\n'
    mainCode += '    WNDCLASSEXW wcex;\n'
    mainCode += '    wcex.cbSize = sizeof(WNDCLASSEXW);\n'
    mainCode += '    wcex.style = CS_HREDRAW | CS_VREDRAW;\n'
    mainCode += '    wcex.lpfnWndProc = WndProc;\n'
    mainCode += '    wcex.cbClsExtra = 0;\n'
    mainCode += '    wcex.cbWndExtra = 0;\n'
    mainCode += '    wcex.hInstance = hInstance;\n'
    mainCode += '    wcex.hIcon = LoadIcon(NULL, IDI_APPLICATION);\n'
    mainCode += '    wcex.hCursor = LoadCursor(NULL, IDC_ARROW);\n'
    mainCode += '    wcex.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);\n'
    mainCode += '    wcex.lpszMenuName = NULL;\n'
    mainCode += '    wcex.lpszClassName = g_szClassName;\n'
    mainCode += '    wcex.hIconSm = LoadIcon(NULL, IDI_APPLICATION);\n'
    mainCode += '    if (!RegisterClassExW(&wcex)) {\n'
    mainCode += '        MessageBoxW(NULL, L"窗口类注册失败!", L"错误", MB_ICONERROR);\n'
    mainCode += '        return 1;\n'
    mainCode += '    }\n'
    mainCode += '    int screenW = GetSystemMetrics(SM_CXSCREEN);\n'
    mainCode += '    int screenH = GetSystemMetrics(SM_CYSCREEN);\n'
    mainCode += '    int posX = (screenW - g_nWidth) / 2;\n'
    mainCode += '    int posY = (screenH - g_nHeight) / 2;\n'
    mainCode += '    HWND hWnd = CreateWindowExW(0, g_szClassName, g_szTitle,\n'
    mainCode += '        WS_OVERLAPPEDWINDOW,\n'
    mainCode += '        posX, posY, g_nWidth, g_nHeight,\n'
    mainCode += '        NULL, NULL, hInstance, NULL);\n'
    mainCode += '    if (!hWnd) {\n'
    mainCode += '        MessageBoxW(NULL, L"窗口创建失败!", L"错误", MB_ICONERROR);\n'
    mainCode += '        return 1;\n'
    mainCode += '    }\n'
    mainCode += '    ShowWindow(hWnd, nCmdShow);\n'
    mainCode += '    UpdateWindow(hWnd);\n'
    mainCode += '    MSG msg;\n'
    mainCode += '    while (GetMessage(&msg, NULL, 0, 0)) {\n'
    mainCode += '        TranslateMessage(&msg);\n'
    mainCode += '        DispatchMessage(&msg);\n'
    mainCode += '    }\n'
    mainCode += '    return (int)msg.wParam;\n'
    mainCode += '}\n'
  } else {
    // 控制台程序
    // 先转译 .eyc 文件
    for (const f of project.files) {
      if (f.type !== 'EYC') continue
      const eycPath = join(project.projectDir, f.fileName)
      const editorContent = editorFiles?.get(f.fileName)
      const content = editorContent || (existsSync(eycPath) ? readFileSync(eycPath, 'utf-8') : '')
      if (!content) continue

      sendMessage({ type: 'info', text: `正在转换源文件: ${f.fileName}` })
      const cCode = transpileEycContent(content, f.fileName)
      const cFileName = f.fileName.replace(/\.eyc$/i, '.c')
      const cFilePath = join(tempDir, cFileName)
      writeFileSync(cFilePath, cCode, 'utf-8')
      additionalCFiles.push(cFilePath)
    }

    mainCode += '/* 控制台程序入口点 */\n'
    mainCode += 'int main(int argc, char* argv[]) {\n'
    mainCode += '    SetConsoleOutputCP(65001);\n'
    mainCode += '    SetConsoleCP(65001);\n'
    mainCode += `    printf("程序开始运行...\\n");\n`
    mainCode += `    printf("项目: ${project.projectName}\\n");\n`
    mainCode += '    printf("\\n");\n'

    // 查找是否有 _启动子程序
    let hasStartupSub = false
    for (const f of project.files) {
      if (f.type !== 'EYC') continue
      const eycPath = join(project.projectDir, f.fileName)
      const editorContent = editorFiles?.get(f.fileName)
      const content = editorContent || (existsSync(eycPath) ? readFileSync(eycPath, 'utf-8') : '')
      if (content && content.includes('.子程序 _启动子程序')) {
        hasStartupSub = true
        mainCode += '    extern void _启动子程序(void);\n'
        mainCode += '    _启动子程序();\n'
        break
      }
    }

    if (!hasStartupSub) {
      mainCode += '    printf("无启动子程序\\n");\n'
    }

    mainCode += '    printf("\\n程序运行结束.\\n");\n'
    mainCode += '    return 0;\n'
    mainCode += '}\n'
  }

  writeFileSync(mainCPath, mainCode, 'utf-8')
  return additionalCFiles
}

// 编译项目
export async function compileProject(options: CompileOptions, editorFiles?: Map<string, string>): Promise<CompileResult> {
  const result: CompileResult = {
    success: false, outputFile: '', errorCount: 0, warningCount: 0, elapsedMs: 0
  }

  const startTime = Date.now()

  try {
    // 查找 .epp 文件
    const projectDir = options.projectDir
    const eppFiles = readdirSync(projectDir).filter(f => f.endsWith('.epp'))
    if (eppFiles.length === 0) {
      sendMessage({ type: 'error', text: '错误: 项目目录中找不到 .epp 文件' })
      result.errorCount++
      return result
    }

    const eppPath = join(projectDir, eppFiles[0])
    const project = parseEppFile(eppPath)
    if (!project) {
      sendMessage({ type: 'error', text: '错误: 无法解析项目文件' })
      result.errorCount++
      return result
    }

    sendMessage({ type: 'info', text: `正在编译项目: ${project.projectName}` })

    // 确定架构
    const arch = project.platform || 'x64'

    // 查找编译器
    const clangPath = findClangCompiler()
    if (!clangPath) {
      sendMessage({ type: 'error', text: '错误: 找不到 Clang 编译器\n请确保 compiler\\llvm\\bin 目录下有 clang.exe' })
      result.errorCount++
      return result
    }
    sendMessage({ type: 'info', text: `编译器: ${clangPath}` })

    // 查找 MSVC SDK
    const sdk = findMSVCSDK(arch)
    if (!sdk) {
      sendMessage({ type: 'error', text: '错误: 找不到 MSVC SDK\n请确保 compiler\\MSVCSDK 目录下有 MSVC 和 WindowsKits 文件' })
      result.errorCount++
      return result
    }

    // 准备目录
    const tempDir = join(projectDir, 'temp')
    const outputDir = join(projectDir, 'output')
    mkdirSync(tempDir, { recursive: true })
    mkdirSync(outputDir, { recursive: true })

    // 生成C代码
    sendMessage({ type: 'info', text: '正在生成C代码...' })
    const additionalCFiles = generateMainC(project, tempDir, editorFiles)

    // 构建 clang 参数
    const outputName = project.projectName || 'output'
    const outputExe = join(outputDir, outputName + '.exe')
    const mainC = join(tempDir, 'main.c')

    const args: string[] = [
      '-o', outputExe,
      mainC,
      ...additionalCFiles,
    ]

    // 项目类型
    const isWindowsApp = project.outputType === 'WindowsApp'
    if (isWindowsApp) {
      args.push('-Wl,/SUBSYSTEM:WINDOWS')
      sendMessage({ type: 'info', text: '项目类型: Windows窗口程序' })
    } else if (project.outputType === 'DynamicLibrary') {
      args.push('-shared')
      sendMessage({ type: 'info', text: '项目类型: 动态链接库(DLL)' })
    } else {
      args.push('-Wl,/SUBSYSTEM:CONSOLE')
      sendMessage({ type: 'info', text: '项目类型: 控制台程序' })
    }

    // 链接 Windows API 库
    args.push('-lkernel32', '-luser32', '-lgdi32', '-lmsvcrt', '-lucrt', '-lvcruntime')

    // 目标架构
    if (arch === 'x86') {
      args.push('--target=i686-pc-windows-msvc')
    } else {
      args.push('--target=x86_64-pc-windows-msvc')
    }

    // 链接器
    args.push('-fuse-ld=lld-link')

    // MSVC SDK 路径
    args.push(
      `-isystem`, sdk.msvcInclude,
      `-isystem`, sdk.ucrtInclude,
      `-isystem`, sdk.umInclude,
      `-isystem`, sdk.sharedInclude,
      `-Wl,/LIBPATH:${sdk.msvcLib}`,
      `-Wl,/LIBPATH:${sdk.ucrtLib}`,
      `-Wl,/LIBPATH:${sdk.umLib}`,
    )

    // 调试/优化选项
    if (options.debug) {
      args.push('-g')
    } else {
      args.push('-O2', '-fno-ident', '-ffunction-sections', '-fdata-sections')
      args.push('-Wl,/OPT:REF,/OPT:ICF')
    }

    sendMessage({ type: 'info', text: '正在编译...' })

    // 调用 clang
    const compileSuccess = await new Promise<boolean>((resolve) => {
      const clangDir = dirname(clangPath)
      const proc = execFile(clangPath, args, { cwd: clangDir, maxBuffer: 10 * 1024 * 1024 }, (error, _stdout, stderr) => {
        if (stderr) {
          const lines = stderr.split('\n').filter(l => l.trim())
          for (const line of lines) {
            const lower = line.toLowerCase()
            if (lower.includes('error')) {
              sendMessage({ type: 'error', text: line })
              result.errorCount++
            } else if (lower.includes('warning')) {
              sendMessage({ type: 'warning', text: line })
              result.warningCount++
            } else {
              sendMessage({ type: 'info', text: line })
            }
          }
        }
        resolve(!error)
      })
      proc.on('error', (err) => {
        sendMessage({ type: 'error', text: `编译器进程启动失败: ${err.message}` })
        resolve(false)
      })
    })

    if (!compileSuccess || !existsSync(outputExe)) {
      sendMessage({ type: 'error', text: '编译失败!' })
      result.errorCount++
      result.elapsedMs = Date.now() - startTime
      return result
    }

    // strip（非调试模式）
    if (!options.debug) {
      const stripPath = join(dirname(clangPath), 'llvm-strip.exe')
      if (existsSync(stripPath)) {
        await new Promise<void>((resolve) => {
          execFile(stripPath, ['--strip-all', outputExe], () => resolve())
        })
      }
    }

    result.success = true
    result.outputFile = outputExe
    result.elapsedMs = Date.now() - startTime

    sendMessage({ type: 'success', text: `编译成功 (${result.elapsedMs} 毫秒)` })
    sendMessage({ type: 'info', text: `输出文件: ${outputExe}` })

  } catch (e) {
    sendMessage({ type: 'error', text: `编译异常: ${e instanceof Error ? e.message : String(e)}` })
    result.errorCount++
  }

  result.elapsedMs = Date.now() - startTime
  return result
}

// 运行已编译的程序
export function runExecutable(exePath: string): boolean {
  if (!exePath || !existsSync(exePath)) {
    sendMessage({ type: 'error', text: '错误: 可执行文件不存在: ' + exePath })
    return false
  }

  // 如果已有程序在运行，先停止
  stopExecutable()

  sendMessage({ type: 'info', text: '' })
  sendMessage({ type: 'info', text: '==========================================' })
  sendMessage({ type: 'info', text: '正在运行程序...' })
  sendMessage({ type: 'info', text: '==========================================' })

  const workDir = dirname(exePath)

  try {
    const proc = execFile(exePath, [], {
      cwd: workDir,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: false,
    })

    runningProcess = proc

    proc.stdout?.on('data', (data: Buffer) => {
      sendMessage({ type: 'info', text: data.toString('utf-8') })
    })

    proc.stderr?.on('data', (data: Buffer) => {
      sendMessage({ type: 'warning', text: data.toString('utf-8') })
    })

    proc.on('exit', (code) => {
      runningProcess = null
      sendMessage({ type: 'info', text: '' })
      if (code === 0) {
        sendMessage({ type: 'success', text: `程序已退出 (退出码: ${code})` })
      } else {
        sendMessage({ type: 'warning', text: `程序已退出 (退出码: ${code})` })
      }
      BrowserWindow.getAllWindows().forEach(w => {
        w.webContents.send('compiler:processExit', code)
      })
    })

    proc.on('error', (err) => {
      runningProcess = null
      sendMessage({ type: 'error', text: `启动程序失败: ${err.message}` })
    })

    sendMessage({ type: 'success', text: `程序已启动 (PID: ${proc.pid})` })
    return true
  } catch (e) {
    sendMessage({ type: 'error', text: `启动程序失败: ${e instanceof Error ? e.message : String(e)}` })
    return false
  }
}

// 停止正在运行的程序
export function stopExecutable(): boolean {
  if (!runningProcess) return true

  try {
    runningProcess.kill()
    sendMessage({ type: 'info', text: '程序已停止' })
  } catch { /* ignore */ }

  runningProcess = null
  return true
}

// 检查是否有程序在运行
export function isRunning(): boolean {
  return runningProcess !== null
}
