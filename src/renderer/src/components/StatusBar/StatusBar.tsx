import './StatusBar.css'

interface StatusBarProps {
  onToggleOutput: () => void
}

function StatusBar({ onToggleOutput }: StatusBarProps): React.JSX.Element {
  return (
    <footer className="statusbar" role="contentinfo" aria-label="状态栏">
      <div className="statusbar-left">
        <button className="statusbar-item" onClick={onToggleOutput}>
          <span aria-hidden="true">⚡</span> 就绪
        </button>
        <span className="statusbar-item">
          <span aria-hidden="true">⚠</span> 0 错误, 0 警告
        </span>
      </div>
      <div className="statusbar-right">
        <span className="statusbar-item">行 3, 列 1</span>
        <span className="statusbar-item">GBK</span>
        <span className="statusbar-item">ycIDE v1.0.0</span>
      </div>
    </footer>
  )
}

export default StatusBar
