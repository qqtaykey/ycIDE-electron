import { useCallback, useEffect, useRef } from 'react'
import './OutputPanel.css'

export interface OutputMessage {
  type: 'info' | 'success' | 'error' | 'warning'
  text: string
}

interface OutputPanelProps {
  height: number
  onResize: (height: number) => void
  onClose: () => void
  messages?: OutputMessage[]
}

function OutputPanel({ height, onResize, onClose, messages = [] }: OutputPanelProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [messages])

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
        </div>
        <button className="output-close" onClick={onClose} aria-label="关闭输出面板">×</button>
      </div>
      <div className="output-content" ref={contentRef} role="log" aria-live="polite" tabIndex={0}>
        {messages.map((msg, i) => (
          <div key={i} className={`output-line ${msg.type}`}>{msg.text}</div>
        ))}
      </div>
    </div>
  )
}

export default OutputPanel
