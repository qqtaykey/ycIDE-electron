import { useState, useCallback, useEffect, useRef } from 'react'
import TitleBar from './components/TitleBar/TitleBar'
import Toolbar from './components/Toolbar/Toolbar'
import Sidebar from './components/Sidebar/Sidebar'
import type { TreeNode } from './components/Sidebar/Sidebar'
import Editor, { type EditorTab } from './components/Editor/Editor'
import OutputPanel from './components/OutputPanel/OutputPanel'
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

  const handleAlignDone = useCallback(() => setAlignAction(null), [])

  // 从 epp 文件列表构建项目树
  const buildProjectTreeFromEpp = useCallback((projectName: string, files: Array<{ type: string; fileName: string; flag: number }>): TreeNode[] => {
    const children: TreeNode[] = files.map(f => {
      const nodeType = f.type === 'EFW' ? 'window' : f.type === 'EYC' ? 'module' : 'resource'
      return { id: f.fileName, label: f.fileName, type: nodeType } as TreeNode
    })
    return [{ id: 'root', label: projectName, type: 'folder', expanded: true, children }]
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

  const handleMenuAction = useCallback((action: string) => {
    switch (action) {
      case 'file:newProject':
        setShowNewProject(true)
        break
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
      <TitleBar onMenuAction={handleMenuAction} />
      <Toolbar
        onOpenLibrary={() => setShowLibrary(true)}
        hasControlSelected={multiSelectCount >= 2}
        onAlign={setAlignAction}
      />
      <div className="app-body">
        <Sidebar width={sidebarWidth} onResize={setSidebarWidth} selection={selection} activeTab={sidebarTab} onTabChange={setSidebarTab} onSelectControl={setSelection} projectTree={projectTree} />
        <div className="app-main">
          <Editor
            onSelectControl={setSelection}
            onSidebarTab={setSidebarTab}
            selection={selection}
            alignAction={alignAction}
            onAlignDone={handleAlignDone}
            onMultiSelectChange={setMultiSelectCount}
            openProjectFiles={openProjectFiles}
            onOpenTabsChange={handleOpenTabsChange}
          />
          {showOutput && (
            <OutputPanel
              height={outputHeight}
              onResize={setOutputHeight}
              onClose={() => setShowOutput(false)}
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
