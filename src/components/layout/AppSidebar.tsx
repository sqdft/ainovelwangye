import {
  BookOpen,
  Download,
  FileText,
  Globe,
  RefreshCw,
  Upload,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { id: string; icon: LucideIcon; label: string };

export type ProgressView = {
  doneSteps: number;
  score: number;
  nextHint: string;
  tocCount?: number;
  written?: number;
  target?: number;
  segTotal?: number;
  doneSegs?: number;
  words?: number;
};

export function AppSidebar({
  mode,
  activeTab,
  navItems,
  progress,
  chaptersCount,
  shortHasContent,
  showDownloadMenu,
  showResetConfirm,
  onModeNovel,
  onModeShort,
  onNav,
  onToggleDownloadMenu,
  onDownloadTxt,
  onDownloadDocx,
  onDownloadTxtVolumes,
  onDownloadDocxVolumes,
  onExportData,
  onImportData,
  onResetBook,
  onResetAll,
}: {
  mode: 'novel' | 'shortStory';
  activeTab: string;
  navItems: NavItem[];
  progress: ProgressView;
  chaptersCount: number;
  shortHasContent: boolean;
  showDownloadMenu: boolean;
  showResetConfirm: boolean;
  onModeNovel: () => void;
  onModeShort: () => void;
  onNav: (id: string) => void;
  onToggleDownloadMenu: () => void;
  onDownloadTxt: () => void;
  onDownloadDocx: () => void;
  onDownloadTxtVolumes?: () => void;
  onDownloadDocxVolumes?: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onResetBook: () => void;
  onResetAll: () => void;
}) {
  return (
    <aside className="ui-sidebar-panel w-[4.75rem] md:w-64 lg:w-72 flex flex-col h-full shrink-0">
      <div className="h-14 flex items-center justify-center md:justify-start md:px-4 border-b border-[var(--ui-line)] shrink-0">
        <div className="ui-logo-mark">
          <BookOpen className="w-4 h-4 text-white shrink-0" />
        </div>
        <div className="ml-2.5 hidden md:block min-w-0">
          <h1 className="font-semibold text-[15px] tracking-tight text-[var(--ui-ink)] leading-tight">小说家</h1>
          <p className="text-[10px] text-[var(--ui-muted)] leading-tight mt-0.5">绯雾书房 · 写作工作台</p>
        </div>
      </div>

      <div className="p-3 border-b border-[var(--ui-line)] shrink-0">
        <div className="ui-mode-switch">
          <button type="button" onClick={onModeNovel} className={mode === 'novel' ? 'ui-mode-active' : 'ui-mode-idle'}>
            长篇
          </button>
          <button
            type="button"
            onClick={onModeShort}
            className={mode === 'shortStory' ? 'ui-mode-active' : 'ui-mode-idle'}
          >
            短篇
          </button>
        </div>
      </div>

      <div className="ui-progress-card hidden md:block">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold text-[var(--ui-ink)]">创作进度</span>
          <span className="text-[11px] tabular-nums text-[var(--ui-accent-text)]">{progress.doneSteps}/4</span>
        </div>
        <div className="ui-progress-track">
          <div className="ui-progress-fill" style={{ width: `${Math.round(progress.score * 100)}%` }} />
        </div>
        <p className="text-[10px] leading-relaxed text-[var(--ui-muted)] mt-2">{progress.nextHint}</p>
        {mode === 'novel' && (progress.tocCount || 0) > 0 && (
          <p className="text-[10px] text-[var(--ui-muted)] mt-1 tabular-nums">
            目录 {progress.tocCount} · 正文 {progress.written}/{progress.target}
          </p>
        )}
        {mode === 'shortStory' && (
          <p className="text-[10px] text-[var(--ui-muted)] mt-1 tabular-nums">
            {(progress.segTotal || 0) > 0
              ? `分段 ${progress.doneSegs}/${progress.segTotal} · ${progress.words}/${progress.target} 字`
              : `${progress.words}/${progress.target} 字`}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <div className="px-3 pt-3 pb-1 hidden md:block shrink-0">
          <p className="ui-side-label">写作流程</p>
        </div>
        <nav className="px-2.5 pb-2 space-y-1.5">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNav(item.id)}
              className={`ui-side-btn ${activeTab === item.id ? 'ui-nav-active' : 'ui-nav-idle'}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="ml-2.5 hidden md:block text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto px-2.5 pb-3 pt-2 border-t border-[var(--ui-line)] space-y-1.5">
          <div className="px-1 pb-1 hidden md:block">
            <p className="ui-side-label">工具</p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={onToggleDownloadMenu}
              disabled={(mode === 'novel' && chaptersCount === 0) || (mode === 'shortStory' && !shortHasContent)}
              className="ui-side-btn ui-side-btn-solid disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="ml-2.5 hidden md:block">导出全书</span>
            </button>
            {showDownloadMenu && (
              <div className="ui-menu bottom-full mb-2 left-0 right-0 md:left-0 md:right-auto md:w-full">
                <button type="button" onClick={onDownloadTxt} className="ui-menu-item">
                  导出已写章 TXT（含封面）
                </button>
                <button type="button" onClick={onDownloadDocx} className="ui-menu-item">
                  导出已写章 Word（含封面）
                </button>
                {onDownloadTxtVolumes && (
                  <button type="button" onClick={onDownloadTxtVolumes} className="ui-menu-item">
                    分卷 TXT（每卷约30章）
                  </button>
                )}
                {onDownloadDocxVolumes && (
                  <button type="button" onClick={onDownloadDocxVolumes} className="ui-menu-item">
                    分卷 Word（每卷约30章）
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNav('examples')}
            className={`ui-side-btn ${activeTab === 'examples' ? 'ui-nav-active' : 'ui-side-btn-tool'}`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="ml-2.5 hidden md:block text-sm">范文参考</span>
          </button>

          <a
            href="https://github.com/sqdft"
            target="_blank"
            rel="noopener noreferrer"
            className="ui-side-btn ui-side-btn-tool no-underline"
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span className="ml-2.5 hidden md:block text-sm">我的博客</span>
          </a>

          <button type="button" onClick={onExportData} className="ui-side-btn ui-side-btn-tool">
            <Download className="w-4 h-4 shrink-0" />
            <span className="ml-2.5 hidden md:block text-sm">备份数据</span>
          </button>

          <button type="button" onClick={onImportData} className="ui-side-btn ui-side-btn-tool">
            <Upload className="w-4 h-4 shrink-0" />
            <span className="ml-2.5 hidden md:block text-sm">恢复数据</span>
          </button>

          <button type="button" onClick={onResetBook} className="ui-side-btn ui-side-btn-warn">
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span className="ml-2.5 hidden md:block text-sm">重开新书</span>
          </button>

          <button
            type="button"
            onClick={onResetAll}
            className={`ui-side-btn ${showResetConfirm ? 'ui-side-btn-danger-active' : 'ui-side-btn-danger'}`}
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${showResetConfirm ? 'animate-spin' : ''}`} />
            <span className="ml-2.5 hidden md:block text-sm">{showResetConfirm ? '再点确认重置' : '重置全部'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
