import { useCallback } from 'react'
import './OutputPanel.css'

interface OutputPanelProps {
  height: number
  onResize: (height: number) => void
  onClose: () => void
}

function OutputPanel({ height, onResize, onClose }: OutputPanelProps): React.JSX.Element {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = height

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = Math.max(100, Math.min(500, startHeight - (e.clientY - startY)))
      onResize(newHeight)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [height, onResize])

  return (
    <div className="output-panel" style={{ height: `${height}px` }} role="region" aria-label="输出面板">
      <div className="output-resizer" onMouseDown={handleMouseDown} role="separator" aria-orientation="horizontal" />
      <div className="output-header">
        <div className="output-tabs" role="tablist">
          <button className="output-tab active" role="tab" aria-selected>编译输出</button>
          <button className="output-tab" role="tab">调试信息</button>
          <button className="output-tab" role="tab">查找结果</button>
        </div>
        <button className="output-close" onClick={onClose} aria-label="关闭输出面板">×</button>
      </div>
      <div className="output-content" role="log" aria-live="polite" tabIndex={0}>
        <div className="output-line info">编译开始...</div>
        <div className="output-line">正在检查语法...</div>
        <div className="output-line">正在链接支持库...</div>
        <div className="output-line success">编译成功！生成文件: output.exe</div>
        <div className="output-line info">共 1 个文件, 0 个错误, 0 个警告</div>
      </div>
    </div>
  )
}

export default OutputPanel
