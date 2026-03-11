import { useState, useEffect, useCallback } from 'react'
import './LibraryDialog.css'

interface LibItem {
  name: string
  filePath: string
  loaded: boolean
  libName?: string
  cmdCount?: number
  dtCount?: number
}

interface LibraryDialogProps {
  open: boolean
  onClose: () => void
}

function LibraryDialog({ open, onClose }: LibraryDialogProps): React.JSX.Element | null {
  const [libs, setLibs] = useState<LibItem[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const refreshList = useCallback(async () => {
    const list = await window.api.library.getList()
    setLibs(list)
  }, [])

  useEffect(() => {
    if (open) refreshList()
  }, [open, refreshList])

  const handleScan = async (): Promise<void> => {
    setLoading(true)
    setStatus('正在扫描...')
    const result = await window.api.library.scan()
    setLibs(result)
    setStatus(`扫描完成，找到 ${result.length} 个支持库`)
    setLoading(false)
  }

  const handleScanFolder = async (): Promise<void> => {
    setLoading(true)
    setStatus('选择文件夹...')
    const result = await window.api.library.scanFolder()
    if (result) {
      setLibs(result)
      setStatus(`扫描完成，找到 ${result.length} 个支持库`)
    } else {
      setStatus('已取消')
    }
    setLoading(false)
  }

  const handleLoadAll = async (): Promise<void> => {
    setLoading(true)
    setStatus('正在加载所有支持库...')
    const count = await window.api.library.loadAll()
    setStatus(`成功加载 ${count} 个支持库`)
    await refreshList()
    setLoading(false)
  }

  const handleLoad = async (name: string): Promise<void> => {
    setLoading(true)
    setStatus(`正在加载 ${name}...`)
    const info = await window.api.library.load(name)
    if (info) {
      setStatus(`已加载 ${info.name}：${info.commands.length} 个命令，${info.dataTypes.length} 个数据类型`)
    } else {
      setStatus(`加载 ${name} 失败`)
    }
    await refreshList()
    setLoading(false)
  }

  if (!open) return null

  return (
    <div className="lib-dialog-overlay" onClick={onClose}>
      <div className="lib-dialog" onClick={e => e.stopPropagation()}>
        <div className="lib-dialog-header">
          <span className="lib-dialog-title">支持库管理</span>
          <button className="lib-dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="lib-dialog-toolbar">
          <button className="lib-btn" onClick={handleScan} disabled={loading}>
            扫描默认目录
          </button>
          <button className="lib-btn" onClick={handleScanFolder} disabled={loading}>
            选择文件夹...
          </button>
          <button className="lib-btn lib-btn-primary" onClick={handleLoadAll} disabled={loading || libs.length === 0}>
            全部加载
          </button>
        </div>

        <div className="lib-dialog-list">
          <table className="lib-table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>支持库名称</th>
                <th>命令数</th>
                <th>数据类型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {libs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="lib-empty">
                    暂无支持库，请先扫描文件夹
                  </td>
                </tr>
              ) : (
                libs.map(lib => (
                  <tr key={lib.name} className={lib.loaded ? 'lib-loaded' : ''}>
                    <td>{lib.name}.fne</td>
                    <td>{lib.libName || '-'}</td>
                    <td>{lib.cmdCount ?? '-'}</td>
                    <td>{lib.dtCount ?? '-'}</td>
                    <td>
                      <span className={`lib-status ${lib.loaded ? 'lib-status-ok' : ''}`}>
                        {lib.loaded ? '已加载' : '未加载'}
                      </span>
                    </td>
                    <td>
                      {!lib.loaded && (
                        <button
                          className="lib-btn lib-btn-sm"
                          onClick={() => handleLoad(lib.name)}
                          disabled={loading}
                        >
                          加载
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {status && (
          <div className="lib-dialog-status">{status}</div>
        )}
      </div>
    </div>
  )
}

export default LibraryDialog
