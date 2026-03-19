import { useState, useCallback, useEffect, useRef } from 'react'
import TitleBar from './components/TitleBar/TitleBar'
import Toolbar from './components/Toolbar/Toolbar'
import Sidebar from './components/Sidebar/Sidebar'
import type { TreeNode } from './components/Sidebar/Sidebar'
import Editor, { type EditorTab, type EditorHandle } from './components/Editor/Editor'
import OutputPanel, { type OutputMessage, type CommandDetail, type FileProblem } from './components/OutputPanel/OutputPanel'
import StatusBar from './components/StatusBar/StatusBar'
import LibraryDialog from './components/LibraryDialog/LibraryDialog'
import NewProjectDialog from './components/NewProjectDialog/NewProjectDialog'
import type { SelectionTarget, AlignAction, DesignForm, DesignControl } from './components/Editor/VisualDesigner'
import './App.css'

function App(): React.JSX.Element {
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [outputHeight, setOutputHeight] = useState(200)
  const [showOutput, setShowOutput] = useState(true)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [selection, setSelection] = useState<SelectionTarget>(null)
  const [sidebarTab, setSidebarTab] = useState<'project' | 'library' | 'property'>('project')
  const [alignAction, setAlignAction] = useState<AlignAction>(null)
  const [multiSelectCount, setMultiSelectCount] = useState(0)
  const [openProjectFiles, setOpenProjectFiles] = useState<EditorTab[]>()
  const [projectTree, setProjectTree] = useState<TreeNode[]>([])
  const [currentProjectDir, setCurrentProjectDir] = useState<string>('')
  const currentProjectDirRef = useRef('')
  const editorRef = useRef<EditorHandle>(null)
  const [themeList, setThemeList] = useState<string[]>([])
  const [currentTheme, setCurrentTheme] = useState<string>('')
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [outputMessages, setOutputMessages] = useState<OutputMessage[]>([])
  const [commandDetail, setCommandDetail] = useState<CommandDetail | null>(null)
  const commandCacheRef = useRef<Map<string, CommandDetail | null>>(new Map())
  const [fileProblems, setFileProblems] = useState<FileProblem[]>([])
  const [designProblems, setDesignProblems] = useState<FileProblem[]>([])
  const openTabsRef = useRef<EditorTab[]>([])
  const [cursorLine, setCursorLine] = useState<number | undefined>(undefined)
  const [cursorColumn, setCursorColumn] = useState<number | undefined>(undefined)
  const [docType, setDocType] = useState('')
  const [isCompiling, setIsCompiling] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [forceOutputTab, setForceOutputTab] = useState<'compile' | 'problems' | null>(null)
  const [targetArch, setTargetArch] = useState('x64')
  // 监听编译器输出
  useEffect(() => {
    const handleOutput = (msg: OutputMessage) => {
      setOutputMessages(prev => [...prev, msg])
    }
    window.api.on('compiler:output', handleOutput)
    return () => { window.api.off('compiler:output') }
  }, [])

  // 监听程序退出
  useEffect(() => {
    const handleExit = () => {
      setIsRunning(false)
    }
    window.api.on('compiler:processExit', handleExit)
    return () => { window.api.off('compiler:processExit') }
  }, [])

  // 检查设计时诊断：扫描所有 efw 标签页中的控件类型，找出依赖库未加载的
  const checkDesignProblems = useCallback(async (tabs: EditorTab[]) => {
    try {
      const units = await window.api.library.getWindowUnits() as Array<{ name: string; englishName?: string }>
      const knownTypes = new Set<string>(
        units.flatMap(u => [u.name, u.englishName].filter((n): n is string => !!n))
      )
      const problems: FileProblem[] = []
      for (const tab of tabs) {
        if (tab.language !== 'efw' || !tab.formData) continue
        for (const ctrl of tab.formData.controls) {
          if (!knownTypes.has(ctrl.type)) {
            problems.push({
              line: 0,
              column: 0,
              severity: 'error',
              file: tab.label,
              message: `窗口“${tab.formData.name}”中的控件“${ctrl.name}”(${ctrl.type})所依赖的支持库未加载`,
            })
          }
        }
      }
      setDesignProblems(problems)
    } catch {
      // 无法获取窗口单元列表时忽略
    }
  }, [])

  // 硬件加载或卸载时重新检查
  const handleLibraryChange = useCallback(() => {
    checkDesignProblems(openTabsRef.current)
  }, [checkDesignProblems])

  // 编译运行
  const handleCompileRun = useCallback(async () => {
    if (!currentProjectDir || isCompiling) return
    // 有无效命令时阻断运行，切换到问题面板
    if (fileProblems.length > 0 || designProblems.length > 0) {
      setShowOutput(true)
      setForceOutputTab('problems')
      setTimeout(() => setForceOutputTab(null), 100)
      return
    }
    setIsCompiling(true)
    editorRef.current?.save()
    setOutputMessages([])
    setShowOutput(true)
    setForceOutputTab('compile')
    const editorFiles = editorRef.current?.getEditorFiles()
    const result = await window.api.compiler.run(currentProjectDir, editorFiles, targetArch)
    setIsCompiling(false)
    setForceOutputTab(null)
    if (result?.success) setIsRunning(true)
  }, [currentProjectDir, isCompiling, targetArch, fileProblems, designProblems])

  // 普通编译
  const handleCompile = useCallback(async () => {
    if (!currentProjectDir || isCompiling) return
    if (fileProblems.length > 0 || designProblems.length > 0) {
      setShowOutput(true)
      setForceOutputTab('problems')
      setTimeout(() => setForceOutputTab(null), 100)
      return
    }
    setIsCompiling(true)
    editorRef.current?.save()
    setOutputMessages([])
    setShowOutput(true)
    setForceOutputTab('compile')
    const editorFiles = editorRef.current?.getEditorFiles()
    await window.api.compiler.compile(currentProjectDir, editorFiles, 'normal', targetArch)
    setIsCompiling(false)
    setForceOutputTab(null)
  }, [currentProjectDir, isCompiling, targetArch, fileProblems, designProblems])

  // 静态编译
  const handleCompileStatic = useCallback(async () => {
    if (!currentProjectDir || isCompiling) return
    if (fileProblems.length > 0 || designProblems.length > 0) {
      setShowOutput(true)
      setForceOutputTab('problems')
      setTimeout(() => setForceOutputTab(null), 100)
      return
    }
    setIsCompiling(true)
    editorRef.current?.save()
    setOutputMessages([])
    setShowOutput(true)
    setForceOutputTab('compile')
    const editorFiles = editorRef.current?.getEditorFiles()
    await window.api.compiler.compile(currentProjectDir, editorFiles, 'static', targetArch)
    setIsCompiling(false)
    setForceOutputTab(null)
  }, [currentProjectDir, isCompiling, fileProblems, designProblems])

  // 停止运行
  const handleStop = useCallback(() => {
    window.api.compiler.stop()
    setIsRunning(false)
  }, [])

  // 命令点击：查找命令详情
  const [highlightParamIndex, setHighlightParamIndex] = useState<number | undefined>(undefined)

  const handleCommandClick = useCallback(async (commandName: string, paramIndex?: number) => {
    // 对象.方法 形式，取方法名
    const name = commandName.includes('.') ? commandName.split('.').pop()! : commandName
    setHighlightParamIndex(paramIndex)

    // 先查缓存
    if (commandCacheRef.current.has(name)) {
      const cached = commandCacheRef.current.get(name)!
      setCommandDetail(cached)
      setShowOutput(true)
      return
    }

    // 从支持库加载全部命令并查找
    const allCommands = await window.api.library.getAllCommands()
    const cmd = allCommands.find((c: CommandDetail) => c.name === name)
    if (cmd) {
      const detail: CommandDetail = {
        name: cmd.name,
        englishName: cmd.englishName,
        description: cmd.description,
        returnType: cmd.returnType,
        category: cmd.category,
        libraryName: cmd.libraryName || '',
        params: cmd.params,
      }
      commandCacheRef.current.set(name, detail)
      setCommandDetail(detail)
    } else {
      setCommandDetail({ name, englishName: '', description: '未在已加载的支持库中找到此命令', returnType: '', category: '', libraryName: '', params: [] })
    }
    setShowOutput(true)
  }, [])

  const handleCommandClear = useCallback(() => {
    setCommandDetail(null)
  }, [])

  // 加载主题列表和当前主题
  const applyTheme = useCallback(async (name: string) => {
    const theme = await window.api?.theme?.load(name)
    if (!theme?.colors) return
    const root = document.documentElement
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(key, value as string)
    }
    setCurrentTheme(name)
    window.api?.theme?.setCurrent(name)
  }, [])

  useEffect(() => {
    (async () => {
      const list = await window.api?.theme?.getList()
      if (list) setThemeList(list)
      const saved = await window.api?.theme?.getCurrent()
      if (saved) applyTheme(saved)
    })()
  }, [applyTheme])

  const handleAlignDone = useCallback(() => setAlignAction(null), [])

  // 从 epp 文件列表构建项目树，按类别分组
  const buildProjectTreeFromEpp = useCallback((projectName: string, files: Array<{ type: string; fileName: string; flag: number }>): TreeNode[] => {
    const windowFiles: TreeNode[] = []
    const sourceFiles: TreeNode[] = []
    const globalVarFiles: TreeNode[] = []
    const resourceFiles: TreeNode[] = []

    for (const f of files) {
      if (f.type === 'EFW') {
        windowFiles.push({ id: f.fileName, label: f.fileName, type: 'window' })
      } else if (f.type === 'EYC') {
        sourceFiles.push({ id: f.fileName, label: f.fileName, type: 'module' })
      } else if (f.type === 'EGV') {
        globalVarFiles.push({ id: f.fileName, label: f.fileName, type: 'module' })
      } else {
        resourceFiles.push({ id: f.fileName, label: f.fileName, type: 'resource' })
      }
    }

    const categories: TreeNode[] = []
    categories.push({ id: '_cat_windows', label: '窗口', type: 'folder', expanded: true, children: windowFiles })
    categories.push({ id: '_cat_sources', label: '程序集', type: 'folder', expanded: true, children: sourceFiles })
    categories.push({ id: '_cat_globals', label: '全局变量', type: 'folder', expanded: true, children: globalVarFiles })
    categories.push({ id: '_cat_constants', label: '常量表', type: 'folder', expanded: false, children: [] })
    categories.push({ id: '_cat_datatypes', label: '自定义数据类型', type: 'folder', expanded: false, children: [] })
    categories.push({ id: '_cat_resources', label: '资源', type: 'folder', expanded: false, children: resourceFiles })

    return [{ id: 'root', label: projectName, type: 'folder', expanded: true, children: categories }]
  }, [])

  // 标签页变化时保存到项目目录，并重新检查设计时诊断
  const handleOpenTabsChange = useCallback((tabs: EditorTab[]) => {
    openTabsRef.current = tabs
    const dir = currentProjectDirRef.current
    if (dir) {
      const tabPaths = tabs.filter(t => t.filePath).map(t => t.filePath!)
      window.api?.project?.saveOpenTabs(dir, tabPaths)
    }
    checkDesignProblems(tabs)
  }, [checkDesignProblems])

  // 刷新项目树（窗口重命名后调用）
  const refreshProjectTree = useCallback(async () => {
    const dir = currentProjectDirRef.current
    if (!dir) return
    const dirFiles = await window.api?.file?.readDir(dir) as string[] | undefined
    if (!dirFiles) return
    const eppFile = dirFiles.find(f => f.endsWith('.epp'))
    if (!eppFile) return
    const eppInfo = await window.api?.project?.parseEpp(dir + '\\' + eppFile)
    if (eppInfo) {
      setProjectTree(buildProjectTreeFromEpp(eppInfo.projectName, eppInfo.files))
    }
  }, [buildProjectTreeFromEpp])

  // 同步 ref
  useEffect(() => {
    currentProjectDirRef.current = currentProjectDir
  }, [currentProjectDir])

  const handleAppClose = useCallback(async () => {
    const hasUnsaved = editorRef.current?.hasModifiedTabs?.() ?? false
    if (hasUnsaved) {
      const action = await window.api?.dialog?.confirmSaveBeforeClose('未保存文件')
      if (action === 'cancel') return
      if (action === 'save') {
        editorRef.current?.saveAll()
      }
    }
    window.api?.window.close()
  }, [])

  const handleMenuAction = useCallback(async (action: string) => {
    switch (action) {
      // 文件菜单
      case 'file:newProject':
        setShowNewProject(true)
        break
      case 'file:openProject': {
        const eppPath = await window.api?.project?.openEpp()
        if (!eppPath) return
        const eppInfo = await window.api?.project?.parseEpp(eppPath)
        if (!eppInfo) return
        const dir = eppPath.replace(/\\[^\\]+$/, '')
        setCurrentProjectDir(dir)
        if (eppInfo.platform) setTargetArch(eppInfo.platform)
        setProjectTree(buildProjectTreeFromEpp(eppInfo.projectName, eppInfo.files))

        const buildTabFromPath = async (fp: string): Promise<EditorTab | null> => {
          const fileName = fp.split('\\').pop() || ''
          const ext = fileName.split('.').pop()?.toLowerCase()
          const content = await window.api?.project?.readFile(fp)
          if (content === null || content === undefined) return null

          if (ext === 'efw') {
            const efwData = JSON.parse(content)
            const formData: DesignForm = {
              name: efwData.name || fileName.replace('.efw', ''),
              title: efwData.title || '',
              width: efwData.width || 592,
              height: efwData.height || 384,
              sourceFile: efwData.sourceFile,
              properties: efwData.properties || undefined,
              controls: (efwData.controls || []).map((c: any) => ({
                id: c.id, type: c.type, name: c.name,
                left: c.x ?? c.left ?? 0, top: c.y ?? c.top ?? 0,
                width: c.width ?? 100, height: c.height ?? 30,
                text: c.properties?.['标题'] ?? c.properties?.['内容'] ?? c.properties?.['文本'] ?? c.text ?? c.name ?? '',
                visible: c.visible ?? true, enabled: c.enabled ?? true, properties: c.properties || {},
              }))
            }
            return { id: fp, label: fileName, language: 'efw', value: '', savedValue: JSON.stringify(formData, null, 2), filePath: fp, formData }
          }

          if (ext === 'eyc' || ext === 'egv') {
            return { id: fp, label: fileName, language: ext, value: content, savedValue: content, filePath: fp }
          }

          return null
        }

        // 恢复之前打开的标签页
        const savedPaths = await window.api?.project?.loadOpenTabs(dir)
        const restoredTabs: EditorTab[] = []
        if (savedPaths && savedPaths.length > 0) {
          for (const fp of savedPaths) {
            const tab = await buildTabFromPath(fp)
            if (tab) restoredTabs.push(tab)
          }
        }

        // 未恢复到任何标签页时，默认打开 epp 中标记的主活动文件（flag=1）
        if (restoredTabs.length === 0) {
          const mainFile = eppInfo.files.find((f: { type: string; fileName: string; flag: number }) => f.flag === 1)
            || eppInfo.files.find((f: { type: string; fileName: string; flag: number }) => f.type === 'EFW')
            || eppInfo.files[0]
          if (mainFile) {
            const mainTab = await buildTabFromPath(dir + '\\' + mainFile.fileName)
            if (mainTab) restoredTabs.push(mainTab)
          }
        }

        if (restoredTabs.length > 0) setOpenProjectFiles(restoredTabs)
        break
      }
      case 'file:save':
        editorRef.current?.save()
        break
      case 'file:saveAll':
        editorRef.current?.saveAll()
        break
      case 'file:closeFile':
        editorRef.current?.closeActiveTab()
        break
      case 'file:closeProject':
        {
          const hasUnsaved = editorRef.current?.hasModifiedTabs?.() ?? false
          if (hasUnsaved) {
            const action = await window.api?.dialog?.confirmSaveBeforeClose('未保存文件')
            if (action === 'cancel') break
            if (action === 'save') {
              editorRef.current?.saveAll()
            }
          }
        }
        editorRef.current?.clearAllTabs()
        setOpenProjectFiles([])
        setProjectTree([])
        setCurrentProjectDir('')
        setSelection(null)
        setSidebarTab('project')
        break
      case 'file:exit':
        await handleAppClose()
        break

      // 编辑菜单
      case 'edit:undo':
      case 'edit:redo':
      case 'edit:cut':
      case 'edit:copy':
      case 'edit:paste':
      case 'edit:delete':
      case 'edit:selectAll':
      case 'edit:find':
      case 'edit:replace':
        editorRef.current?.editorAction(action.split(':')[1])
        break

      // 视图菜单
      case 'view:property':
        setSidebarTab('property')
        break
      case 'view:output':
        setShowOutput(v => !v)
        break
      case 'view:library':
        setSidebarTab('library')
        break
      case 'view:project':
        setSidebarTab('project')
        break

      // 工具菜单
      case 'tools:library':
        setShowLibrary(true)
        break

      // 编译菜单
      case 'build:compile':
        handleCompile()
        break
      case 'build:compile-static':
        handleCompileStatic()
        break
      case 'build:build':
        handleCompile()
        break
      case 'build:run':
        handleCompileRun()
        break

      // 调试菜单
      case 'debug:run':
        handleCompileRun()
        break
      case 'debug:stop':
        handleStop()
        break

      // 插入菜单
      case 'insert:sub':
        editorRef.current?.insertDeclaration()
        break
      case 'insert:localVar':
        editorRef.current?.insertLocalVariable()
        break
      case 'insert:module': {
        const dir = currentProjectDirRef.current
        if (!dir) break
        // 生成不重复的文件名
        const existingFiles = projectTree[0]?.children
          ?.find(c => c.id === '_cat_sources')?.children?.map(c => c.label) || []
        let n = 1
        while (existingFiles.includes('程序集' + n + '.eyc')) n++
        const newFileName = '程序集' + n + '.eyc'
        const assemblyName = '程序集' + n
        const content = '.版本 2\n.程序集 ' + assemblyName + '\n\n.子程序 子程序1\n\n'
        await window.api?.project?.addFile(dir, newFileName, 'EYC', content)
        // 更新项目树：添加新文件到程序集分类
        setProjectTree(prev => prev.map(root => ({
          ...root,
          children: root.children?.map(cat =>
            cat.id === '_cat_sources'
              ? { ...cat, children: [...(cat.children || []), { id: newFileName, label: newFileName, type: 'module' as const }] }
              : cat
          )
        })))
        // 打开新文件
        const filePath = dir + '\\' + newFileName
        editorRef.current?.openFile({ id: filePath, label: newFileName, language: 'eyc', value: content, savedValue: content, filePath })
        break
      }
      case 'insert:globalVar':
      {
        const dir = currentProjectDirRef.current
        if (!dir) break
        const existingFiles = projectTree[0]?.children
          ?.find(c => c.id === '_cat_globals')?.children?.map(c => c.label) || []
        let n = 1
        while (existingFiles.includes('全局变量' + n + '.egv')) n++
        const newFileName = '全局变量' + n + '.egv'
        const varName = '全局变量' + n
        const content = '.版本 2\n.全局变量 ' + varName + ', 整数型\n\n'
        await window.api?.project?.addFile(dir, newFileName, 'EGV', content)
        setProjectTree(prev => prev.map(root => ({
          ...root,
          children: root.children?.map(cat =>
            cat.id === '_cat_globals'
              ? { ...cat, children: [...(cat.children || []), { id: newFileName, label: newFileName, type: 'module' as const }] }
              : cat
          )
        })))
        const filePath = dir + '\\' + newFileName
        editorRef.current?.openFile({ id: filePath, label: newFileName, language: 'egv', value: content, savedValue: content, filePath })
        break
      }
      case 'insert:dataType':
      case 'insert:dllCmd':
      case 'insert:window':
      case 'insert:resource':
        break

      // 主题切换
      default:
        if (action.startsWith('theme:')) {
          const themeName = action.substring(6)
          applyTheme(themeName)
        }
        break
    }
  }, [buildProjectTreeFromEpp, applyTheme, handleCompile, handleCompileStatic, handleCompileRun, handleStop, handleAppClose])

  // 双击资源管理器文件时打开
  const handleOpenFile = useCallback(async (fileId: string, fileName: string) => {
    const dir = currentProjectDirRef.current
    if (!dir) return
    const filePath = dir + '\\' + fileName
    const ext = fileName.split('.').pop()?.toLowerCase()

    if (ext === 'efw') {
      const content = await window.api?.project?.readFile(filePath)
      if (!content) return
      const efwData = JSON.parse(content)
      const formData: DesignForm = {
        name: efwData.name || fileName.replace('.efw', ''),
        title: efwData.title || '',
        width: efwData.width || 592,
        height: efwData.height || 384,
        sourceFile: efwData.sourceFile,
        properties: efwData.properties || undefined,
        controls: (efwData.controls || []).map((c: any) => ({
          id: c.id, type: c.type, name: c.name,
          left: c.x ?? c.left ?? 0, top: c.y ?? c.top ?? 0,
          width: c.width ?? 100, height: c.height ?? 30,
          text: c.properties?.['标题'] ?? c.properties?.['内容'] ?? c.properties?.['文本'] ?? c.text ?? c.name ?? '',
          visible: c.visible ?? true, enabled: c.enabled ?? true, properties: c.properties || {},
        }))
      }
      editorRef.current?.openFile({ id: filePath, label: fileName, language: 'efw', value: '', savedValue: JSON.stringify(formData, null, 2), filePath, formData })
    } else if (ext === 'eyc' || ext === 'egv') {
      const content = await window.api?.project?.readFile(filePath)
      if (!content) return
      editorRef.current?.openFile({ id: filePath, label: fileName, language: ext, value: content, savedValue: content, filePath })
    }
  }, [])

  const handleNewProjectConfirm = useCallback(async (info: { name: string; path: string; type: string; platform: string }) => {
    try {
      const result = await window.api?.project?.create(info)
      if (!result) return

      setCurrentProjectDir(result.projectDir)
      if (info.platform) setTargetArch(info.platform)

      // 通过解析 epp 文件获取所有关联文件并构建项目树
      const eppInfo = await window.api?.project?.parseEpp(result.eppPath)
      if (eppInfo) {
        setProjectTree(buildProjectTreeFromEpp(eppInfo.projectName, eppInfo.files))
      }

      // 窗口程序：仅打开 efw 窗口文件
      if (info.type === 'windows-app') {
        const efwPath = result.projectDir + '\\_启动窗口.efw'
        const efwContent = await window.api?.project?.readFile(efwPath)
        if (efwContent) {
          const efwData = JSON.parse(efwContent)
          const formData: DesignForm = {
            name: efwData.name || '_启动窗口',
            title: efwData.title || info.name,
            width: efwData.width || 592,
            height: efwData.height || 384,
            sourceFile: efwData.sourceFile,
            properties: efwData.properties || undefined,
            controls: (efwData.controls || []).map((c: any) => ({
              id: c.id,
              type: c.type,
              name: c.name,
              left: c.x ?? c.left ?? 0,
              top: c.y ?? c.top ?? 0,
              width: c.width ?? 100,
              height: c.height ?? 30,
              text: c.properties?.['标题'] ?? c.properties?.['内容'] ?? c.properties?.['文本'] ?? c.text ?? c.name ?? '',
              visible: c.visible ?? true,
              enabled: c.enabled ?? true,
              properties: c.properties || {},
            }))
          }
          setOpenProjectFiles([{
            id: efwPath,
            label: '_启动窗口.efw',
            language: 'efw',
            value: '',
            savedValue: JSON.stringify(formData, null, 2),
            filePath: efwPath,
            formData,
          }])
        }
      }
      // 控制台/DLL：打开 eyc 文件
      else {
        const eycPath = result.projectDir + `\\${info.name}.eyc`
        const eycContent = await window.api?.project?.readFile(eycPath)
        if (eycContent) {
          setOpenProjectFiles([{
            id: eycPath,
            label: `${info.name}.eyc`,
            language: 'eyc',
            value: eycContent,
            savedValue: eycContent,
            filePath: eycPath,
          }])
        }
      }
    } catch (err) {
      console.error('创建项目失败:', err)
    }
  }, [buildProjectTreeFromEpp])

  // 全局快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      // 已被子组件处理
      if (e.defaultPrevented) return
      // 弹窗打开时不处理快捷键
      if (showLibrary || showNewProject) return

      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const code = e.code
      const key = e.key

      let action: string | null = null

      // 文件菜单
      if (ctrl && shift && code === 'KeyN') action = 'file:newProject'
      else if (ctrl && shift && code === 'KeyO') action = 'file:openProject'
      else if (ctrl && shift && code === 'KeyS') action = 'file:saveAll'
      else if (ctrl && !shift && code === 'KeyS') action = 'file:save'
      else if (ctrl && !shift && code === 'KeyW') action = 'file:closeFile'
      // 编辑菜单
      else if (ctrl && !shift && code === 'KeyZ') action = 'edit:undo'
      else if (ctrl && !shift && code === 'KeyY') action = 'edit:redo'
      else if (ctrl && !shift && code === 'KeyX') action = 'edit:cut'
      else if (ctrl && !shift && code === 'KeyC') action = 'edit:copy'
      else if (ctrl && !shift && code === 'KeyV') action = 'edit:paste'
      else if (ctrl && !shift && code === 'KeyF') action = 'edit:find'
      else if (ctrl && !shift && code === 'KeyH') action = 'edit:replace'
      // 编译菜单
      else if (ctrl && !shift && key === 'F7') action = 'build:compile'
      else if (!ctrl && !shift && key === 'F7') action = 'build:build'
      // 调试菜单
      else if (!ctrl && !shift && key === 'F5') action = 'build:run'
      else if (!ctrl && shift && key === 'F5') action = 'debug:stop'
      else if (!ctrl && !shift && key === 'F9') action = 'debug:toggleBreakpoint'
      else if (!ctrl && !shift && key === 'F10') action = 'debug:stepOver'
      else if (ctrl && !shift && key === 'F10') action = 'debug:runToCursor'
      else if (!ctrl && !shift && key === 'F11') action = 'debug:stepInto'
      else if (!ctrl && shift && key === 'F11') action = 'debug:stepOut'
      // 帮助
      // 插入菜单
      else if (ctrl && !shift && code === 'KeyL') action = 'insert:localVar'
      else if (!ctrl && !shift && key === 'F1') action = 'help:topics'

      if (action) {
        // 编辑类快捷键在原生输入框中时让浏览器处理
        const tag = (document.activeElement as HTMLElement)?.tagName
        if (action.startsWith('edit:') && action !== 'edit:find' && action !== 'edit:replace'
          && (tag === 'INPUT' || tag === 'TEXTAREA')) return
        // 有浏览器原生文本选中时，让浏览器处理复制/剪切/全选
        if ((action === 'edit:copy' || action === 'edit:cut' || action === 'edit:selectAll') && window.getSelection()?.toString()) return
        e.preventDefault()
        handleMenuAction(action)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleMenuAction, showLibrary, showNewProject])

  return (
    <div className="app">
      <TitleBar onMenuAction={handleMenuAction} onWindowClose={() => { void handleAppClose() }} hasProject={!!currentProjectDir} hasOpenFile={(openProjectFiles?.length ?? 0) > 0} themes={themeList} currentTheme={currentTheme} />
      <Toolbar
        hasControlSelected={multiSelectCount >= 2}
        onAlign={setAlignAction}
        onCompileRun={handleCompileRun}
        onStop={handleStop}
        hasProject={!!currentProjectDir}
        isCompiling={isCompiling}
        isRunning={isRunning}
        arch={targetArch}
        onArchChange={(arch: string) => {
          setTargetArch(arch)
          if (currentProjectDir) window.api?.project?.updatePlatform(currentProjectDir, arch)
        }}
        onNew={() => handleMenuAction('file:newProject')}
        onOpen={() => handleMenuAction('file:openProject')}
        onSave={() => handleMenuAction('file:save')}
        onUndo={() => handleMenuAction('edit:undo')}
        onRedo={() => handleMenuAction('edit:redo')}
      />
      <div className="app-body">
        <Sidebar width={sidebarWidth} onResize={setSidebarWidth} selection={selection} activeTab={sidebarTab} onTabChange={setSidebarTab} onSelectControl={setSelection} onPropertyChange={(kind, ctrlId, prop, val) => editorRef.current?.updateFormProperty(kind, ctrlId, prop, val)} projectTree={projectTree} onOpenFile={handleOpenFile} activeFileId={activeFileId ? activeFileId.replace(/^.*[\\/]/, '') : null} projectDir={currentProjectDir} onEventNavigate={(sel, eventName, eventArgs) => editorRef.current?.navigateToEventSub(sel, eventName, eventArgs)} onLibraryChange={handleLibraryChange} />
        <div className="app-main">
          <Editor
            ref={editorRef}
            onSelectControl={setSelection}
            onSidebarTab={setSidebarTab}
            selection={selection}
            alignAction={alignAction}
            onAlignDone={handleAlignDone}
            onMultiSelectChange={setMultiSelectCount}
            openProjectFiles={openProjectFiles}
            onOpenTabsChange={handleOpenTabsChange}
            onActiveTabChange={setActiveFileId}
            onCommandClick={handleCommandClick}
            onCommandClear={handleCommandClear}
            onProblemsChange={setFileProblems}
            onCursorChange={(line, col) => { setCursorLine(line); setCursorColumn(col) }}
            onDocTypeChange={setDocType}
            projectDir={currentProjectDir}
            onProjectTreeRefresh={refreshProjectTree}
          />
        </div>
      </div>
      {showOutput && (
        <OutputPanel
          height={outputHeight}
          onResize={setOutputHeight}
          onClose={() => setShowOutput(false)}
          messages={outputMessages}
          commandDetail={commandDetail}
          highlightParamIndex={highlightParamIndex}
          problems={[...fileProblems, ...designProblems]}
          forceTab={forceOutputTab}
          onProblemClick={(p) => editorRef.current?.navigateToLine(p.line)}
        />
      )}
      <StatusBar
        onToggleOutput={() => setShowOutput(!showOutput)}
        errorCount={[...fileProblems, ...designProblems].filter(p => p.severity === 'error').length}
        warningCount={[...fileProblems, ...designProblems].filter(p => p.severity === 'warning').length}
        cursorLine={cursorLine}
        cursorColumn={cursorColumn}
        docType={docType}
      />
      <LibraryDialog open={showLibrary} onClose={() => setShowLibrary(false)} />
      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} onConfirm={handleNewProjectConfirm} />
    </div>
  )
}

export default App
