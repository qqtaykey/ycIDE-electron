import { useState, useCallback, useEffect, useMemo } from 'react'
import type { DesignControl, DesignForm, SelectionTarget, LibWindowUnit, LibUnitProperty, LibUnitEvent } from '../Editor/VisualDesigner'
import Icon from '../Icon/Icon'
import '../Icon/Icon.css'
import './Sidebar.css'

type SidebarTab = 'project' | 'library' | 'property'

const TREE_ICON_MAP: Record<string, string> = {
  folder: 'folder-closed',
  'folder-expanded': 'folder-opened',
  module: 'module',
  class: 'class',
  sub: 'procedure',
  func: 'method',
  window: 'windows-form',
  resource: 'resource-view',
}

interface SidebarProps {
  width: number
  onResize: (width: number) => void
  selection?: SelectionTarget
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  onSelectControl?: (target: SelectionTarget) => void
  projectTree?: TreeNode[]
  onOpenFile?: (fileId: string, fileName: string) => void
  activeFileId?: string | null
}

interface LibItem {
  name: string
  filePath: string
  loaded: boolean
  libName?: string
  cmdCount?: number
  dtCount?: number
}

export interface TreeNode {
  id: string
  label: string
  type: 'folder' | 'module' | 'class' | 'sub' | 'func' | 'window' | 'resource'
  children?: TreeNode[]
  expanded?: boolean
}

function TreeItem({ node, depth = 0, onOpenFile, activeFileId }: { node: TreeNode; depth?: number; onOpenFile?: (fileId: string, fileName: string) => void; activeFileId?: string | null }): React.JSX.Element {
  const [expanded, setExpanded] = useState(node.expanded ?? false)
  const hasChildren = node.children && node.children.length > 0

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className={`tree-item ${hasChildren ? 'tree-branch' : 'tree-leaf'}${!hasChildren && activeFileId && activeFileId === node.id ? ' tree-item-active' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
        onDoubleClick={() => {
          if (!hasChildren && onOpenFile) {
            onOpenFile(node.id, node.label)
          }
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (hasChildren) setExpanded(!expanded)
            else if (onOpenFile) onOpenFile(node.id, node.label)
          }
        }}
      >
        {hasChildren && (
          <span className={`tree-arrow ${expanded ? 'expanded' : ''}`} aria-hidden="true">▶</span>
        )}
        {!hasChildren && <span className="tree-arrow-placeholder" aria-hidden="true" />}
        <Icon name={(node.type === 'folder' ? (expanded ? TREE_ICON_MAP['folder-expanded'] : TREE_ICON_MAP['folder']) : TREE_ICON_MAP[node.type]) || 'custom-control'} size={16} />
        <span className="tree-label">{node.label}</span>
      </div>
      {hasChildren && expanded && (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} onOpenFile={onOpenFile} activeFileId={activeFileId} />
          ))}
        </ul>
      )}
    </li>
  )
}

interface LibDetail {
  name: string
  version: string
  author: string
  description: string
  commands: Array<{ name: string; category: string; description: string; isHidden: boolean }>
  dataTypes: Array<{ name: string; description: string }>
}

function LibraryPanel(): React.JSX.Element {
  const [libs, setLibs] = useState<LibItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expandedLibs, setExpandedLibs] = useState<Set<string>>(new Set())
  const [libDetails, setLibDetails] = useState<Record<string, LibDetail>>({})
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!loaded) {
      window.api.library.getList().then((list: LibItem[]) => {
        setLibs(list)
        setLoaded(true)
      })
    }
  }, [loaded])

  const toggleLib = useCallback(async (name: string) => {
    const next = new Set(expandedLibs)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
      // 首次展开时加载详细信息
      if (!libDetails[name]) {
        const info = await window.api.library.getInfo(name)
        if (info) {
          setLibDetails(prev => ({ ...prev, [name]: info }))
        }
      }
    }
    setExpandedLibs(next)
  }, [expandedLibs, libDetails])

  const toggleCat = useCallback((key: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className="sidebar-panel">
      <ul className="tree" role="tree" aria-label="支持库列表">
        {libs.map(lib => {
          const isExpanded = expandedLibs.has(lib.name)
          const detail = libDetails[lib.name]
          // 按分类分组命令（排除隐藏命令）
          const catMap: Record<string, LibDetail['commands']> = {}
          if (detail) {
            for (const cmd of detail.commands) {
              if (cmd.isHidden) continue
              const cat = cmd.category || '其他'
              if (!catMap[cat]) catMap[cat] = []
              catMap[cat].push(cmd)
            }
          }
          const catNames = Object.keys(catMap)

          return (
            <li key={lib.name} role="treeitem" aria-expanded={isExpanded}>
              <div
                className="tree-item tree-branch"
                style={{ paddingLeft: 8 }}
                onDoubleClick={() => toggleLib(lib.name)}
              >
                <span
                  className={`tree-arrow ${isExpanded ? 'expanded' : ''}`}
                  aria-hidden="true"
                  onClick={(e) => { e.stopPropagation(); toggleLib(lib.name) }}
                >▶</span>
                <Icon name="library" size={16} />
                <span className="tree-label">{lib.libName || lib.name}</span>
              </div>
              {isExpanded && detail && (
                <ul role="group">
                  {/* 数据类型分组 */}
                  {detail.dataTypes.length > 0 && (() => {
                    const dtKey = `${lib.name}::__dt__`
                    const dtExpanded = expandedCats.has(dtKey)
                    return (
                      <li role="treeitem" aria-expanded={dtExpanded}>
                        <div
                          className="tree-item tree-branch"
                          style={{ paddingLeft: 24 }}
                          onDoubleClick={() => toggleCat(dtKey)}
                        >
                          <span
                            className={`tree-arrow ${dtExpanded ? 'expanded' : ''}`}
                            aria-hidden="true"
                            onClick={(e) => { e.stopPropagation(); toggleCat(dtKey) }}
                          >▶</span>
                          <Icon name="class" size={16} />
                          <span className="tree-label">数据类型</span>
                          <span className="tree-badge">{detail.dataTypes.length}</span>
                        </div>
                        {dtExpanded && (
                          <ul role="group">
                            {detail.dataTypes.map(dt => (
                              <li key={dt.name} role="treeitem">
                                <div className="tree-item tree-leaf" style={{ paddingLeft: 40 }} title={dt.description}>
                                  <span className="tree-arrow-placeholder" aria-hidden="true" />
                                  <Icon name="class" size={16} />
                                  <span className="tree-label">{dt.name}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })()}
                  {/* 命令分类 */}
                  {catNames.map(cat => {
                    const catKey = `${lib.name}::${cat}`
                    const catExpanded = expandedCats.has(catKey)
                    const cmds = catMap[cat]
                    return (
                      <li key={cat} role="treeitem" aria-expanded={catExpanded}>
                        <div
                          className="tree-item tree-branch"
                          style={{ paddingLeft: 24 }}
                          onDoubleClick={() => toggleCat(catKey)}
                        >
                          <span
                            className={`tree-arrow ${catExpanded ? 'expanded' : ''}`}
                            aria-hidden="true"
                            onClick={(e) => { e.stopPropagation(); toggleCat(catKey) }}
                          >▶</span>
                          <Icon name="folder-closed" size={16} />
                          <span className="tree-label">{cat}</span>
                          <span className="tree-badge">{cmds.length}</span>
                        </div>
                        {catExpanded && (
                          <ul role="group">
                            {cmds.map(cmd => (
                              <li key={cmd.name} role="treeitem">
                                <div className="tree-item tree-leaf" style={{ paddingLeft: 40 }} title={cmd.description}>
                                  <span className="tree-arrow-placeholder" aria-hidden="true" />
                                  <Icon name="method" size={16} />
                                  <span className="tree-label">{cmd.name}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                  {isExpanded && !detail && (
                    <li className="sidebar-empty">加载中...</li>
                  )}
                </ul>
              )}
            </li>
          )
        })}
        {libs.length === 0 && (
          <li className="sidebar-empty">暂无支持库</li>
        )}
      </ul>
    </div>
  )
}

/** 属性值格式化显示 */
function formatPropValue(prop: LibUnitProperty, value: string | number | boolean | undefined): string {
  if (value === undefined) return ''
  if (prop.typeName === '逻辑型') return value ? '真' : '假'
  if (prop.pickOptions.length > 0 && typeof value === 'number') {
    return prop.pickOptions[value] || String(value)
  }
  return String(value)
}

function PropertyPanel({ selection, windowUnits, onSelectControl }: { selection?: SelectionTarget; windowUnits: LibWindowUnit[]; onSelectControl?: (target: SelectionTarget) => void }): React.JSX.Element {
  // 获取当前窗口数据（从任意选中状态中提取）
  const form = selection?.kind === 'form' ? selection.form
    : selection?.kind === 'control' ? selection.form
    : null

  // 下拉选择框切换
  const handleDropdownChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!form || !onSelectControl) return
    const val = e.target.value
    if (val === '__form__') {
      onSelectControl({ kind: 'form', form })
    } else {
      const ctrl = form.controls.find(c => c.id === val)
      if (ctrl) onSelectControl({ kind: 'control', control: ctrl, form })
    }
  }, [form, onSelectControl])

  // 当前选中的 ID
  const selectedValue = selection?.kind === 'form' ? '__form__'
    : selection?.kind === 'control' ? selection.control.id
    : ''

  // 下拉框渲染
  const renderSelector = (): React.JSX.Element => (
    <div className="prop-header">
      <select
        className="prop-selector"
        value={selectedValue}
        onChange={handleDropdownChange}
      >
        {form && (
          <>
            <option value="__form__">{form.name} - 窗口</option>
            {form.controls.map(c => (
              <option key={c.id} value={c.id}>{c.name} - {c.type}</option>
            ))}
          </>
        )}
        {!form && <option value="">请选择组件</option>}
      </select>
    </div>
  )

  if (!selection) {
    return (
      <div className="sidebar-panel">
        <div className="prop-header">
          <select className="prop-selector" disabled>
            <option>请选择一个控件或窗口</option>
          </select>
        </div>
        <div className="sidebar-empty">请选择一个控件或窗口以查看属性</div>
      </div>
    )
  }

  if (selection.kind === 'form') {
    const f = selection.form
    const windowUnit = windowUnits.find(u => u.name === '窗口')
    const baseProps: Array<{ label: string; value: string }> = [
      { label: '窗口名称', value: f.name },
      { label: '类型', value: '窗口' },
      { label: '标题', value: f.title },
      { label: '宽度', value: String(f.width) },
      { label: '高度', value: String(f.height) },
    ]
    return (
      <div className="sidebar-panel">
        {renderSelector()}
        <table className="prop-table">
          <tbody>
            {baseProps.map(p => (
              <tr key={p.label} className="prop-row">
                <td className="prop-name">{p.label}</td>
                <td className="prop-value">{p.value}</td>
              </tr>
            ))}
            {windowUnit?.properties.filter(p => !p.isReadOnly).map(p => (
              <tr key={p.name} className="prop-row">
                <td className="prop-name" title={p.description}>{p.name}</td>
                <td className="prop-value">{p.typeName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const control = selection.control
  const typeName = control.type
  const unit = windowUnits.find(u => u.name === control.type)

  const baseProps: Array<{ label: string; value: string }> = [
    { label: '控件名称', value: control.name },
    { label: '控件类型', value: typeName },
  ]

  return (
    <div className="sidebar-panel">
      {renderSelector()}
      <table className="prop-table">
        <tbody>
          {baseProps.map(p => (
            <tr key={p.label} className="prop-row">
              <td className="prop-name">{p.label}</td>
              <td className="prop-value">{p.value}</td>
            </tr>
          ))}
          {unit ? (
            unit.properties.filter(p => !p.isReadOnly).map(p => (
              <tr key={p.name} className="prop-row">
                <td className="prop-name" title={p.description}>{p.name}</td>
                <td className="prop-value">
                  {formatPropValue(p, control.properties[p.name])}
                </td>
              </tr>
            ))
          ) : (
            <>
              <tr className="prop-row"><td className="prop-name">标题</td><td className="prop-value">{control.text}</td></tr>
              <tr className="prop-row"><td className="prop-name">左边</td><td className="prop-value">{control.left}</td></tr>
              <tr className="prop-row"><td className="prop-name">顶边</td><td className="prop-value">{control.top}</td></tr>
              <tr className="prop-row"><td className="prop-name">宽度</td><td className="prop-value">{control.width}</td></tr>
              <tr className="prop-row"><td className="prop-name">高度</td><td className="prop-value">{control.height}</td></tr>
              <tr className="prop-row"><td className="prop-name">可视</td><td className="prop-value">{control.visible ? '真' : '假'}</td></tr>
              <tr className="prop-row"><td className="prop-name">禁止</td><td className="prop-value">{control.enabled ? '假' : '真'}</td></tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Sidebar({ width, onResize, selection, activeTab, onTabChange, onSelectControl, projectTree, onOpenFile, activeFileId }: SidebarProps): React.JSX.Element {
  const [windowUnits, setWindowUnits] = useState<LibWindowUnit[]>([])

  // 从支持库加载窗口组件信息，并在支持库加载后刷新
  const loadWindowUnits = useCallback(() => {
    window.api.library.getWindowUnits().then(setWindowUnits).catch(() => {})
  }, [])

  useEffect(() => {
    loadWindowUnits()
    window.api.on('library:loaded', loadWindowUnits)
    return () => { window.api.off('library:loaded') }
  }, [loadWindowUnits])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(150, Math.min(500, startWidth + e.clientX - startX))
      onResize(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [width, onResize])

  const tabTitle = activeTab === 'project' ? '项目管理器'
    : activeTab === 'library' ? '支持库'
    : '属性'

  // 默认事件映射
  const defaultEventMap: Record<string, string> = {
    '窗口': '创建完毕',
    '按钮': '被单击',
    '编辑框': '内容被改变',
    '标签': '被单击',
    '图片框': '被单击',
    '选择框': '被单击',
    '列表框': '被选择',
    '组合框': '被选择'
  }

  // 当前选中组件的事件列表
  const selectedEvents = useMemo<LibUnitEvent[]>(() => {
    if (!selection) return []
    const typeName = selection.kind === 'form' ? '窗口' : selection.control.type
    const unit = windowUnits.find(u => u.name === typeName)
    return unit?.events ?? []
  }, [selection, windowUnits])

  const selectedTypeName = selection ? (selection.kind === 'form' ? '窗口' : selection.control.type) : ''

  const [selectedEvent, setSelectedEvent] = useState('')

  // 选中组件变化时，自动选择默认事件
  useEffect(() => {
    if (selectedEvents.length === 0) {
      setSelectedEvent('')
      return
    }
    const defaultName = defaultEventMap[selectedTypeName]
    const hasDefault = defaultName && selectedEvents.some(e => e.name === defaultName)
    setSelectedEvent(hasDefault ? defaultName : selectedEvents[0].name)
  }, [selectedEvents, selectedTypeName])

  return (
    <aside className="sidebar" style={{ width: `${width}px` }} role="complementary" aria-label="项目导航">
      <div className="sidebar-header">
        <span>{tabTitle}</span>
      </div>
      <div className="sidebar-content">
        {activeTab === 'project' && (
          projectTree && projectTree.length > 0 ? (
            <ul className="tree" role="tree" aria-label="项目结构">
              {projectTree.map((node) => (
                <TreeItem key={node.id} node={node} onOpenFile={onOpenFile} activeFileId={activeFileId} />
              ))}
            </ul>
          ) : (
            <div className="sidebar-empty">暂无打开的项目</div>
          )
        )}
        {activeTab === 'library' && <LibraryPanel />}
        {activeTab === 'property' && <PropertyPanel selection={selection} windowUnits={windowUnits} onSelectControl={onSelectControl} />}
      </div>
      {activeTab === 'property' && (
        <div className="sidebar-event-bar">
          <select
            className="sidebar-event-selector"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            disabled={selectedEvents.length === 0}
          >
            {selectedEvents.length === 0
              ? <option value="">(无事件)</option>
              : selectedEvents.map(ev => (
                  <option key={ev.name} value={ev.name} title={ev.description}>{ev.name}</option>
                ))
            }
          </select>
        </div>
      )}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => onTabChange('library')}
        >支持库</button>
        <button
          className={`sidebar-tab ${activeTab === 'project' ? 'active' : ''}`}
          onClick={() => onTabChange('project')}
        >项目</button>
        <button
          className={`sidebar-tab ${activeTab === 'property' ? 'active' : ''}`}
          onClick={() => onTabChange('property')}
        >属性</button>
      </div>
      <div className="sidebar-resizer" onMouseDown={handleMouseDown} role="separator" aria-orientation="vertical" />
    </aside>
  )
}

export default Sidebar
