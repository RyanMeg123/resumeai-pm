import React from 'react';
import { ResumeData } from '../lib/types';
import { Copy, ArrowLeft, Download, Loader2, FileText, CheckSquare, Square } from 'lucide-react';

export function SummaryView({
  data,
  onBack,
  sourceDocxFile,
}: {
  data: ResumeData,
  onBack: () => void,
  sourceDocxFile: File | null,
}) {
  const lockedProjects = React.useMemo(
    () => data.projects.filter(p => p.lockedVersion),
    [data.projects],
  );
  const lockedProjectIds = React.useMemo(
    () => lockedProjects.map(project => project.id),
    [lockedProjects],
  );
  const [selectedProjectIds, setSelectedProjectIds] = React.useState<string[]>([]);
  const [canExportPdf, setCanExportPdf] = React.useState(false);
  const [isCheckingExport, setIsCheckingExport] = React.useState(true);
  const [exportingTarget, setExportingTarget] = React.useState<'docx' | 'pdf' | null>(null);

  React.useEffect(() => {
    setSelectedProjectIds(lockedProjectIds);
  }, [lockedProjectIds]);

  React.useEffect(() => {
    let cancelled = false;

    const loadCapabilities = async () => {
      try {
        const response = await fetch('/api/export-resume');
        const result = await response.json();
        if (!cancelled) {
          setCanExportPdf(Boolean(result.canExportPdf));
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setIsCheckingExport(false);
        }
      }
    };

    if (sourceDocxFile) {
      loadCapabilities();
    } else {
      setIsCheckingExport(false);
    }

    return () => {
      cancelled = true;
    };
  }, [sourceDocxFile]);

  const getLockedVersionText = (project: typeof lockedProjects[number]) => {
    return project.lockedVersion === 'custom'
      ? project.customVersion
      : project.versions?.[project.lockedVersion as keyof typeof project.versions];
  };

  const selectedLockedProjects = lockedProjects.filter(project => selectedProjectIds.includes(project.id));

  const buildReplacements = () => selectedLockedProjects.map(p => {
    const versionText = getLockedVersionText(p);

    return {
      name: p.name,
      original: p.original,
      updated: versionText || '',
    };
  }).filter(item => item.updated.trim());

  const buildSelectedText = () => selectedLockedProjects.map(project => {
    const versionText = getLockedVersionText(project);
    return `【${project.name}】\n${project.role} | ${project.duration}\n${versionText || ''}`;
  }).join('\n\n');

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds(prev => prev.includes(projectId)
      ? prev.filter(id => id !== projectId)
      : [...prev, projectId]);
  };

  const handleSelectAll = () => {
    setSelectedProjectIds(lockedProjectIds);
  };

  const handleClearAll = () => {
    setSelectedProjectIds([]);
  };

  const handleExport = async (target: 'docx' | 'pdf') => {
    if (!sourceDocxFile) {
      alert('只有上传 Word(.docx) 简历时，才能保持原格式导出。');
      return;
    }

    if (selectedLockedProjects.length === 0) {
      alert('请先选择至少一个项目版本。');
      return;
    }

    setExportingTarget(target);
    try {
      const formData = new FormData();
      formData.append('file', sourceDocxFile);
      formData.append('target', target);
      formData.append('replacements', JSON.stringify(buildReplacements()));

      const response = await fetch('/api/export-resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        alert(result?.error || '导出失败，请重试。');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || (target === 'pdf' ? 'resume-updated.pdf' : 'resume-updated.docx');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('导出失败，请重试。');
    } finally {
      setExportingTarget(null);
    }
  };

  const handleCopyAll = () => {
    const text = buildSelectedText();
    if (!text.trim()) {
      alert('请先选择至少一个项目版本。');
      return;
    }

    navigator.clipboard.writeText(text);
    
    const btn = document.getElementById('copy-all-btn');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> 已复制 ✓';
      btn.classList.add('bg-success', 'hover:bg-success');
      btn.classList.remove('bg-primary', 'hover:bg-primary-hover');
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('bg-success', 'hover:bg-success');
        btn.classList.add('bg-primary', 'hover:bg-primary-hover');
      }, 1500);
    }
  };

  const handleDownloadSelectedText = () => {
    const text = buildSelectedText();
    if (!text.trim()) {
      alert('请先选择至少一个项目版本。');
      return;
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resume-optimized-projects.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto pt-12 px-6 pb-20">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> 返回修改
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-main mb-2">优化结果汇总</h1>
          <p className="text-text-muted">共完成 {lockedProjects.length} 个项目经历的优化，当前已选 {selectedLockedProjects.length} 个</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={handleDownloadSelectedText}
            disabled={selectedLockedProjects.length === 0}
            className="flex items-center gap-2 bg-bg-card border border-border hover:bg-bg-hover disabled:bg-border disabled:text-text-muted text-text-main px-5 py-3 rounded-lg font-medium transition-colors"
          >
            <FileText className="w-5 h-5" /> 下载优化内容
          </button>
          {sourceDocxFile && (
            <>
              <button
                onClick={() => handleExport('docx')}
                disabled={selectedLockedProjects.length === 0 || exportingTarget !== null}
                className="flex items-center gap-2 bg-bg-card border border-border hover:bg-bg-hover disabled:bg-border disabled:text-text-muted text-text-main px-5 py-3 rounded-lg font-medium transition-colors"
              >
                {exportingTarget === 'docx' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                一键生成Word
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={!canExportPdf || selectedLockedProjects.length === 0 || exportingTarget !== null || isCheckingExport}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-text-muted text-white px-5 py-3 rounded-lg font-medium transition-colors"
              >
                {exportingTarget === 'pdf' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                一键生成PDF
              </button>
            </>
          )}
          <button 
            id="copy-all-btn"
            onClick={handleCopyAll}
            disabled={selectedLockedProjects.length === 0}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-text-muted text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Copy className="w-5 h-5" /> 复制已选内容
          </button>
        </div>
      </div>

      {sourceDocxFile ? (
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-6">
          <p className="text-sm text-text-muted leading-relaxed">
            你可以先勾选想要的项目。如果想自己回去改原简历，就下载优化内容；如果想直接出新简历，就用右侧的一键生成。
            {!isCheckingExport && !canExportPdf && ' 当前环境还没有 PDF 转换能力，所以先支持保格式导出 Word。'}
          </p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-6">
          <p className="text-sm text-text-muted leading-relaxed">
            你现在可以先下载优化内容，手动贴回简历。如果你想直接生成一份新简历，请上传 Word(.docx) 版本的简历。
          </p>
        </div>
      )}

      {lockedProjects.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-text-main font-medium mb-1">选择要导出的项目</p>
            <p className="text-sm text-text-muted">你可以只导出其中几段，不一定全部带走。</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm text-text-main hover:text-primary transition-colors"
            >
              <CheckSquare className="w-4 h-4" /> 全选
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main transition-colors"
            >
              <Square className="w-4 h-4" /> 清空
            </button>
          </div>
        </div>
      )}

      {lockedProjects.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-12 text-center">
          <p className="text-text-muted text-lg">还没有锁定任何优化版本</p>
        </div>
      ) : (
        <div className="space-y-6">
          {lockedProjects.map(p => {
            const versionText = getLockedVersionText(p);
            const isSelected = selectedProjectIds.includes(p.id);

            return (
              <div key={p.id} className="bg-bg-card border border-border rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleProjectSelection(p.id)}
                      className="mt-1 text-text-muted hover:text-primary transition-colors"
                      aria-label={isSelected ? '取消选择该项目' : '选择该项目'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <h3 className="text-xl font-bold text-text-main mb-1">{p.name}</h3>
                      <p className="text-sm text-text-muted">{p.role} · {p.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${isSelected ? 'bg-success/10 text-success' : 'bg-bg-main text-text-muted'}`}>
                      {isSelected ? '已选择' : '未选择'}
                    </span>
                    <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded">
                      {p.lockedVersion === 'concise' ? '简洁版' : 
                       p.lockedVersion === 'detailed' ? '详细版' : 
                       p.lockedVersion === 'datadriven' ? '数据驱动版' : '自定义版'}
                    </span>
                  </div>
                </div>
                <p className="text-text-main leading-relaxed whitespace-pre-wrap">{versionText}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
