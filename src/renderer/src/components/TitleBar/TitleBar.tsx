import { useState, useRef, useEffect, useCallback } from 'react'
import './TitleBar.css'

interface MenuItem {
  label: string
  shortcut?: string
  divider?: boolean
  action?: string
}

const FILE_MENU: MenuItem[] = [
  { label: '新建项目(N)', shortcut: 'Ctrl+Shift+N', action: 'file:newProject' },
  { label: '', divider: true },
  { label: '打开项目(P)', shortcut: 'Ctrl+Shift+O', action: 'file:openProject' },
  { label: '打开文件(O)', shortcut: 'Ctrl+O', action: 'file:openFile' },
  { label: '', divider: true },
  { label: '保存(S)', shortcut: 'Ctrl+S' },
  { label: '保存全部(L)', shortcut: 'Ctrl+Shift+S' },
  { label: '另存为(A)' },
  { label: '', divider: true },
  { label: '关闭文件(C)', shortcut: 'Ctrl+W' },
  { label: '关闭项目' },
  { label: '', divider: true },
  { label: '最近打开的项目' },
  { label: '', divider: true },
  { label: '退出(X)', shortcut: 'Alt+F4' },
]

const EDIT_MENU: MenuItem[] = [
  { label: '撤销(U)', shortcut: 'Ctrl+Z' },
  { label: '重做(R)', shortcut: 'Ctrl+Y' },
  { label: '', divider: true },
  { label: '剪切(T)', shortcut: 'Ctrl+X' },
  { label: '复制(C)', shortcut: 'Ctrl+C' },
  { label: '粘贴(P)', shortcut: 'Ctrl+V' },
  { label: '删除(D)', shortcut: 'Delete' },
  { label: '', divider: true },
  { label: '全选(A)', shortcut: 'Ctrl+A' },
  { label: '查找(F)', shortcut: 'Ctrl+F' },
  { label: '替换(H)', shortcut: 'Ctrl+H' },
]

const VIEW_MENU: MenuItem[] = [
  { label: '属性面板' },
  { label: '输出面板' },
  { label: '工具箱' },
  { label: '', divider: true },
  { label: '状态栏' },
]

const INSERT_MENU: MenuItem[] = [
  { label: '全局变量(G)' },
  { label: '自定义数据类型(T)' },
  { label: 'DLL命令(D)' },
  { label: '', divider: true },
  { label: '程序集(M)' },
  { label: '子程序(S)' },
  { label: '', divider: true },
  { label: '窗口(W)' },
  { label: '模块(U)' },
  { label: '资源(R)' },
]

const BUILD_MENU: MenuItem[] = [
  { label: '编译(C)', shortcut: 'Ctrl+F7' },
  { label: '生成(B)', shortcut: 'F7' },
  { label: '', divider: true },
  { label: '编译运行(R)', shortcut: 'F5' },
  { label: '生成安装包' },
]

const DEBUG_MENU: MenuItem[] = [
  { label: '运行(R)', shortcut: 'F5' },
  { label: '停止(S)', shortcut: 'Shift+F5' },
  { label: '', divider: true },
  { label: '逐过程(O)', shortcut: 'F10' },
  { label: '逐语句(I)', shortcut: 'F11' },
  { label: '跳出(U)', shortcut: 'Shift+F11' },
  { label: '运行到光标处(C)', shortcut: 'Ctrl+F10' },
  { label: '', divider: true },
  { label: '切换断点(B)', shortcut: 'F9' },
  { label: '清除所有断点' },
]

const TOOLS_MENU: MenuItem[] = [
  { label: '支持库配置(L)' },
  { label: '系统配置(O)' },
  { label: '', divider: true },
  { label: '窗口组件管理' },
]

const HELP_MENU: MenuItem[] = [
  { label: '帮助主题(H)', shortcut: 'F1' },
  { label: '', divider: true },
  { label: '关于(A)' },
]

interface MenuDef {
  label: string
  items: MenuItem[]
}

const MENUS: MenuDef[] = [
  { label: '文件(F)', items: FILE_MENU },
  { label: '编辑(E)', items: EDIT_MENU },
  { label: '查看(V)', items: VIEW_MENU },
  { label: '插入(I)', items: INSERT_MENU },
  { label: '编译(B)', items: BUILD_MENU },
  { label: '调试(D)', items: DEBUG_MENU },
  { label: '工具(T)', items: TOOLS_MENU },
  { label: '帮助(H)', items: HELP_MENU },
]

function TitleBar({ onMenuAction }: { onMenuAction?: (action: string) => void }): React.JSX.Element {
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const menuBarRef = useRef<HTMLDivElement>(null)

  const handleMinimize = () => window.api?.window.minimize()
  const handleMaximize = () => window.api?.window.maximize()
  const handleClose = () => window.api?.window.close()

  const closeMenu = useCallback(() => setOpenMenu(null), [])

  // 点击外部关闭菜单
  useEffect(() => {
    if (openMenu === null) return
    const handler = (e: MouseEvent): void => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu, closeMenu])

  return (
    <header className="titlebar" role="banner">
      <div className="titlebar-drag">
        <div className="titlebar-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </div>
        <nav className="titlebar-menu" role="menubar" aria-label="主菜单" ref={menuBarRef}>
          {MENUS.map((menu, idx) => (
            <div key={menu.label} className="titlebar-menu-item">
              <button
                role="menuitem"
                tabIndex={idx === 0 ? 0 : -1}
                className={openMenu === idx ? 'active' : ''}
                onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
                onMouseEnter={() => { if (openMenu !== null) setOpenMenu(idx) }}
              >
                {menu.label}
              </button>
              {openMenu === idx && (
                <div className="titlebar-dropdown" role="menu">
                  {menu.items.map((item, i) =>
                    item.divider ? (
                      <div key={i} className="titlebar-dropdown-divider" />
                    ) : (
                      <button
                        key={i}
                        role="menuitem"
                        className="titlebar-dropdown-item"
                        onClick={() => { closeMenu(); if (item.action) onMenuAction?.(item.action) }}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <span className="titlebar-dropdown-shortcut">{item.shortcut}</span>}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="titlebar-title">ycIDE - 易语言集成开发环境</div>
      </div>
      <div className="titlebar-controls" aria-label="窗口控制">
        <button
          className="titlebar-btn"
          onClick={handleMinimize}
          aria-label="最小化"
          tabIndex={-1}
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          className="titlebar-btn"
          onClick={handleMaximize}
          aria-label="最大化"
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>
        <button
          className="titlebar-btn titlebar-btn-close"
          onClick={handleClose}
          aria-label="关闭"
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </header>
  )
}

export default TitleBar
