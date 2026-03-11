import { useState, useCallback, useEffect, useRef } from 'react'
import TitleBar from './components/TitleBar/TitleBar'
import Toolbar from './components/Toolbar/Toolbar'
import Sidebar from './components/Sidebar/Sidebar'
import type { TreeNode } from './components/Sidebar/Sidebar'
import Editor, { type EditorTab, type EditorHandle } from './components/Editor/Editor'
import OutputPanel, { type OutputMessage } from './components/OutputPanel/OutputPanel'
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

  // 监听编译器输出
  useEffect(() => {
    const handleOutput = (msg: OutputMessage) => {
      setOutputMessages(prev => [...prev, msg])
    }
    window.api.on('compiler:output', handleOutput)
    return () => { window.api.off('compiler:output') }
  }, [])

  // 编译运行
  const handleCompileRun = useCallback(async () => {
    if (!currentProjectDir) return
    // 先保存所有文件
    editorRef.current?.save()
    setOutputMessages([])
    setShowOutput(true)
    const editorFiles = editorRef.current?.getEditorFiles()
    await window.api.compiler.run(currentProjectDir, editorFiles)
  }, [currentProjectDir])

  // 仅编译
  const handleCompile = useCallback(async () => {
    if (!currentProjectDir) return
    editorRef.current?.save()
    setOutputMessages([])
    setShowOutput(true)
    const editorFiles = editorRef.current?.getEditorFiles()
    await window.api.compiler.compile(currentProjectDir, editorFiles)
  }, [currentProjectDir])

  // 停止运行
  const handleStop = useCallback(() => {
    window.api.compiler.stop()
  }, [])

  // 加载主题列表和当前主题
  const applyTheme = useCallback(async (name: string) => {
    const theme = await window.api?.theme?.load(name)
    if (!theme?.colors) return
    const root = document.documentElement
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(key, value)
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
    const resourceFiles: TreeNode[] = []

    for (const f of files) {
      if (f.type === 'EFW') {
        windowFiles.push({ id: f.fileName, label: f.fileName, type: 'window' })
      } else if (f.type === 'EYC') {
        sourceFiles.push({ id: f.fileName, label: f.fileName, type: 'module' })
      } else {
        resourceFiles.push({ id: f.fileName, label: f.fileName, type: 'resource' })
      }
    }

    const categories: TreeNode[] = []
    categories.push({ id: '_cat_windows', label: '窗口', type: 'folder', expanded: true, children: windowFiles })
    categories.push({ id: '_cat_sources', label: '程序集', type: 'folder', expanded: true, children: sourceFiles })
    categories.push({ id: '_cat_constants', label: '常量表', type: 'folder', expanded: false, children: [] })
    categories.push({ id: '_cat_datatypes', label: '自定义数据类型', type: 'folder', expanded: false, children: [] })
    categories.push({ id: '_cat_resources', label: '资源', type: 'folder', expanded: false, children: resourceFiles })

    return [{ id: 'root', label: projectName, type: 'folder', expanded: true, children: categories }]
  }, [])

  // 标签页变化时保存到项目目录
  const handleOpenTabsChange = useCallback((tabs: EditorTab[]) => {
    const dir = currentProjectDirRef.current
    if (dir) {
      const tabPaths = tabs.filter(t => t.filePath).map(t => t.filePath!)
      window.api?.project?.saveOpenTabs(dir, tabPaths)
    }
  }, [])

  // 同步 ref
  useEffect(() => {
    currentProjectDirRef.current = currentProjectDir
  }, [currentProjectDir])

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
        setProjectTree(buildProjectTreeFromEpp(eppInfo.projectName, eppInfo.files))
        // 恢复之前打开的标签页
        const savedPaths = await window.api?.project?.loadOpenTabs(dir)
        if (savedPaths && savedPaths.length > 0) {
          const restoredTabs: EditorTab[] = []
          for (const fp of savedPaths) {
            const fileName = fp.split('\\').pop() || ''
            const ext = fileName.split('.').pop()?.toLowerCase()
            const content = await window.api?.project?.readFile(fp)
            if (!content) continue
            if (ext === 'efw') {
              const efwData = JSON.parse(content)
              const formData: DesignForm = {
                name: efwData.name || fileName.replace('.efw', ''),
                title: efwData.title || '',
                width: efwData.width || 592,
                height: efwData.height || 384,
                controls: (efwData.controls || []).map((c: DesignControl) => ({
                  id: c.id, type: c.type, name: c.name,
                  left: c.x ?? c.left ?? 0, top: c.y ?? c.top ?? 0,
                  width: c.width ?? 100, height: c.height ?? 30,
                  text: c.properties?.['标题'] ?? c.name ?? '',
                  visible: true, enabled: true, properties: c.properties || {},
                }))
              }
              restoredTabs.push({ id: fp, label: fileName, language: 'efw', value: '', savedValue: '', filePath: fp, formData })
            } else if (ext === 'eyc') {
              restoredTabs.push({ id: fp, label: fileName, language: 'eyc', value: content, savedValue: content, filePath: fp })
            }
          }
          if (restoredTabs.length > 0) setOpenProjectFiles(restoredTabs)
        }
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
        setOpenProjectFiles([])
        setProjectTree([])
        setCurrentProjectDir('')
        break
      case 'file:exit':
        window.close()
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
  }, [buildProjectTreeFromEpp, applyTheme, handleCompile, handleCompileRun, handleStop])

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
        controls: (efwData.controls || []).map((c: DesignControl) => ({
          id: c.id, type: c.type, name: c.name,
          left: c.x ?? c.left ?? 0, top: c.y ?? c.top ?? 0,
          width: c.width ?? 100, height: c.height ?? 30,
          text: c.properties?.['\u6807\u9898'] ?? c.name ?? '',
          visible: true, enabled: true, properties: c.properties || {},
        }))
      }
      editorRef.current?.openFile({ id: filePath, label: fileName, language: 'efw', value: '', savedValue: '', filePath, formData })
    } else if (ext === 'eyc') {
      const content = await window.api?.project?.readFile(filePath)
      if (!content) return
      editorRef.current?.openFile({ id: filePath, label: fileName, language: 'eyc', value: content, savedValue: content, filePath })
    }
  }, [])

  const handleNewProjectConfirm = useCallback(async (info: { name: string; path: string; type: string; platform: string }) => {
    try {
      const result = await window.api?.project?.create(info)
      if (!result) return

      setCurrentProjectDir(result.projectDir)

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
            controls: (efwData.controls || []).map((c: DesignControl) => ({
              id: c.id,
              type: c.type,
              name: c.name,
              left: c.x ?? c.left ?? 0,
              top: c.y ?? c.top ?? 0,
              width: c.width ?? 100,
              height: c.height ?? 30,
              text: c.properties?.['标题'] ?? c.name ?? '',
              visible: true,
              enabled: true,
              properties: c.properties || {},
            }))
          }
          setOpenProjectFiles([{
            id: efwPath,
            label: '_启动窗口.efw',
            language: 'efw',
            value: '',
            savedValue: '',
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

  return (
    <div className="app">
      <TitleBar onMenuAction={handleMenuAction} hasProject={!!currentProjectDir} hasOpenFile={(openProjectFiles?.length ?? 0) > 0} themes={themeList} currentTheme={currentTheme} />
      <Toolbar
        onOpenLibrary={() => setShowLibrary(true)}
        hasControlSelected={multiSelectCount >= 2}
        onAlign={setAlignAction}
        onCompileRun={handleCompileRun}
        onStop={handleStop}
      />
      <div className="app-body">
        <Sidebar width={sidebarWidth} onResize={setSidebarWidth} selection={selection} activeTab={sidebarTab} onTabChange={setSidebarTab} onSelectControl={setSelection} projectTree={projectTree} onOpenFile={handleOpenFile} activeFileId={activeFileId ? activeFileId.replace(/^.*[\\/]/, '') : null} />
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
          />
          {showOutput && (
            <OutputPanel
              height={outputHeight}
              onResize={setOutputHeight}
              onClose={() => setShowOutput(false)}
              messages={outputMessages}
            />
          )}
        </div>
      </div>
      <StatusBar onToggleOutput={() => setShowOutput(!showOutput)} />
      <LibraryDialog open={showLibrary} onClose={() => setShowLibrary(false)} />
      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} onConfirm={handleNewProjectConfirm} />
    </div>
  )
}

export default App
