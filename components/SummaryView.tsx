import React from 'react';
import Link from 'next/link';
import { ResumeData, TargetRoleProfile } from '../lib/types';
import { Copy, ArrowLeft, Download, Loader2, FileText, CheckSquare, Square, Sparkles } from 'lucide-react';
import { generateFullResumeDraft } from '../lib/gemini';
import { RESUME_INTERVIEW_PROFILE_STORAGE_KEY } from '../lib/interview-profile';

export function SummaryView({
  data,
  onBack,
  sourceDocxFile,
  originalResumeText,
  targetRoleProfile,
}: {
  data: ResumeData,
  onBack: () => void,
  sourceDocxFile: File | null,
  originalResumeText: string,
  targetRoleProfile: TargetRoleProfile | null,
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
  const [isGeneratingFullResume, setIsGeneratingFullResume] = React.useState(false);
  const [fullResumeDraft, setFullResumeDraft] = React.useState<null | {
    title: string;
    summary: string;
    highlights: string[];
    fullText: string;
  }>(null);
  const [fullResumeSelectionSignature, setFullResumeSelectionSignature] = React.useState('');
  const targetRoleLabel = React.useMemo(() => {
    if (!targetRoleProfile?.title) {
      return '';
    }

    return targetRoleProfile.company
      ? `${targetRoleProfile.title} · ${targetRoleProfile.company}`
      : targetRoleProfile.title;
  }, [targetRoleProfile]);

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

  const getLockedVersionText = React.useCallback((project: typeof lockedProjects[number]) => {
    return project.lockedVersion === 'custom'
      ? project.customVersion
      : project.versions?.[project.lockedVersion as keyof typeof project.versions];
  }, []);

  const selectedLockedProjects = lockedProjects.filter(project => selectedProjectIds.includes(project.id));
  const selectedProjectSignature = React.useMemo(
    () => JSON.stringify(selectedLockedProjects.map(project => ({
      id: project.id,
      lockedVersion: project.lockedVersion,
      text: getLockedVersionText(project) || '',
    }))),
    [getLockedVersionText, selectedLockedProjects],
  );
  const fullResumeOutdated = Boolean(
    fullResumeDraft && fullResumeSelectionSignature !== selectedProjectSignature,
  );

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

  const handleGenerateFullResume = async () => {
    if (selectedLockedProjects.length === 0) {
      alert('请先选择至少一个项目版本，再生成整份简历。');
      return;
    }

    if (!originalResumeText.trim()) {
      alert('当前没有拿到原始简历内容，暂时无法生成整份简历。');
      return;
    }

    setIsGeneratingFullResume(true);
    try {
      const draft = await generateFullResumeDraft({
        resumeData: data,
        originalResumeText,
        selectedProjects: selectedLockedProjects.map(project => ({
          name: project.name,
          role: project.role,
          duration: project.duration,
          text: getLockedVersionText(project) || '',
        })),
        targetRole: targetRoleProfile,
      });

      setFullResumeDraft(draft);
      setFullResumeSelectionSignature(selectedProjectSignature);
    } catch (e) {
      console.error(e);
      alert('整份简历生成失败，请重试。');
    } finally {
      setIsGeneratingFullResume(false);
    }
  };

  const handleCopyFullResume = () => {
    if (!fullResumeDraft?.fullText.trim()) {
      alert('请先生成整份简历。');
      return;
    }

    navigator.clipboard.writeText(fullResumeDraft.fullText);
  };

  const handleDownloadFullResume = () => {
    if (!fullResumeDraft?.fullText.trim()) {
      alert('请先生成整份简历。');
      return;
    }

    const markdown = [
      `# ${fullResumeDraft.title}`,
      '',
      fullResumeDraft.summary,
      '',
      '## 这版简历的重点',
      '',
      ...fullResumeDraft.highlights.map(item => `- ${item}`),
      '',
      '## 完整正文',
      '',
      fullResumeDraft.fullText,
    ].join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resume-full-draft.md';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  React.useEffect(() => {
    const projectsForInterview = (selectedLockedProjects.length > 0
      ? selectedLockedProjects
      : lockedProjects
    ).map(project => ({
      name: project.name,
      role: project.role,
      duration: project.duration,
      text: getLockedVersionText(project) || '',
    })).filter(project => project.text.trim());

    if (typeof window === 'undefined' || projectsForInterview.length === 0) {
      return;
    }

    window.localStorage.setItem(
      RESUME_INTERVIEW_PROFILE_STORAGE_KEY,
      JSON.stringify({
        name: data.name,
        targetRoleProfile,
        overallIssues: data.overallIssues || [],
        selectedProjects: projectsForInterview,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, [data.name, data.overallIssues, getLockedVersionText, lockedProjects, selectedLockedProjects, targetRoleProfile]);

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

      {targetRoleLabel && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-text-main font-medium mb-1">这次是按目标岗位定向优化的</p>
          <p className="text-sm text-text-muted leading-relaxed">
            当前目标岗位：{targetRoleLabel}
            {targetRoleProfile?.jobDescription?.trim()
              ? '，并且已经参考了你填写的岗位描述。'
              : '。如果下次补充岗位描述，定向程度还可以继续提高。'}
          </p>
        </div>
      )}

      <div className="bg-bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-text-main font-medium mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              整份简历草稿
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              这里不再只是导出几个项目段，而是会把你选中的项目版本合并进整份简历，直接给你一版完整草稿。
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleGenerateFullResume}
              disabled={selectedLockedProjects.length === 0 || isGeneratingFullResume}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-text-muted text-white px-5 py-3 rounded-lg font-medium transition-colors"
            >
              {isGeneratingFullResume ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {fullResumeDraft ? '重新生成整份简历' : '生成整份简历'}
            </button>
            <button
              onClick={handleCopyFullResume}
              disabled={!fullResumeDraft}
              className="flex items-center gap-2 bg-bg-main border border-border hover:bg-bg-hover disabled:bg-border disabled:text-text-muted text-text-main px-5 py-3 rounded-lg font-medium transition-colors"
            >
              <Copy className="w-5 h-5" /> 复制整份简历
            </button>
            <button
              onClick={handleDownloadFullResume}
              disabled={!fullResumeDraft}
              className="flex items-center gap-2 bg-bg-main border border-border hover:bg-bg-hover disabled:bg-border disabled:text-text-muted text-text-main px-5 py-3 rounded-lg font-medium transition-colors"
            >
              <Download className="w-5 h-5" /> 下载整份简历
            </button>
          </div>
        </div>

        {!fullResumeDraft ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-text-muted leading-relaxed">
            先勾选你要带进最终简历的项目版本，再点上面的按钮，系统就会给你出一整份简历草稿。
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {fullResumeOutdated && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-text-main">
                你刚刚改了项目选择，这份整份简历还是基于上一次勾选生成的。如果要拿最新版本，请重新生成一次。
              </div>
            )}

            <div className="rounded-xl border border-border bg-bg-main p-5">
              <h2 className="text-xl font-bold text-text-main mb-2">{fullResumeDraft.title}</h2>
              <p className="text-sm text-text-muted leading-relaxed">{fullResumeDraft.summary}</p>
            </div>

            <div className="rounded-xl border border-border bg-bg-main p-5">
              <h3 className="text-sm font-medium text-text-main mb-3">这版简历的重点</h3>
              <div className="space-y-2">
                {fullResumeDraft.highlights.map(item => (
                  <p key={item} className="text-sm text-text-muted leading-relaxed">- {item}</p>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-main p-5">
              <h3 className="text-sm font-medium text-text-main mb-3">完整正文</h3>
              <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">{fullResumeDraft.fullText}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-medium text-text-main transition-colors hover:bg-primary/20"
          >
            去首页刷基于这份简历的定向题
          </Link>
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
