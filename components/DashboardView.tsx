import React, { useState, useEffect } from 'react';
import { ResumeData, Project } from '../lib/types';
import { CircularProgress } from './CircularProgress';
import { optimizeProject, refineProjectStream } from '../lib/gemini';
import { AI_PM_REQUIREMENTS } from '../lib/ai-pm-requirements';
import { CheckCircle, AlertTriangle, ChevronRight, Lock, Copy, Send, Loader2 } from 'lucide-react';

export function DashboardView({
  data,
  onUpdateProject,
  onFinish
}: {
  data: ResumeData;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onFinish: () => void;
}) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>('overall');
  const activeProject = data.projects.find(p => p.id === activeProjectId);

  const [activeTab, setActiveTab] = useState<'concise' | 'detailed' | 'datadriven' | 'custom'>('concise');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  useEffect(() => {
    const generateVersions = async (project: Project) => {
      setIsGenerating(true);
      try {
        const versions = await optimizeProject(project);
        onUpdateProject(project.id, { versions });
      } catch (e) {
        console.error(e);
        alert('生成优化版本失败，请重试');
      } finally {
        setIsGenerating(false);
      }
    };

    if (activeProject && !activeProject.versions && !isGenerating) {
      generateVersions(activeProject);
    }
  }, [activeProject, isGenerating, onUpdateProject]);

  const handleChat = async () => {
    if (!chatInput.trim() || !activeProject || !activeProject.versions) return;

    const currentText = activeTab === 'custom' && activeProject.customVersion
      ? activeProject.customVersion
      : activeProject.versions[activeTab as keyof typeof activeProject.versions];

    const userReq = chatInput.trim();
    setChatInput('');
    setIsChatting(true);

    const newHistory = [...(activeProject.chatHistory || []), { role: 'user' as const, content: userReq }];
    onUpdateProject(activeProject.id, { chatHistory: newHistory });

    try {
      let aiText = '';
      const stream = refineProjectStream(currentText, userReq);
      for await (const chunk of stream) {
        aiText += chunk;
        onUpdateProject(activeProject.id, {
          customVersion: aiText,
          chatHistory: [...newHistory, { role: 'ai', content: aiText }]
        });
        setActiveTab('custom');
      }
    } catch (e) {
      console.error(e);
      alert('对话失败，请重试');
    } finally {
      setIsChatting(false);
    }
  };

  const currentVersionText = activeProject?.versions
    ? (activeTab === 'custom' ? activeProject.customVersion : activeProject.versions[activeTab as keyof typeof activeProject.versions])
    : '';

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 bg-bg-card border-r border-border flex flex-col h-full overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-main mb-6">简历诊断报告</h2>
          <div className="flex justify-center mb-6">
            <CircularProgress value={data.overallScore} />
          </div>
          <div className="space-y-4">
            <ProgressBar label="PM相关度" value={data.projects[0]?.scores?.pm || 0} />
            <ProgressBar label="量化程度" value={data.projects[0]?.scores?.quantify || 0} />
            <ProgressBar label="STAR结构" value={data.projects[0]?.scores?.star || 0} />
            <ProgressBar label="关键词覆盖" value={data.projects[0]?.scores?.keywords || 0} />
          </div>
        </div>
        <div className="p-4 flex-1">
          <h3 className="text-sm font-medium text-text-muted mb-4 px-2">项目列表</h3>
          <div className="space-y-2">
            <button
              onClick={() => setActiveProjectId('overall')}
              className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${
                activeProjectId === 'overall' ? 'bg-primary/10 border border-primary/30' : 'hover:bg-bg-hover border border-transparent'
              }`}
            >
              <div className="text-sm font-medium text-text-main">整体诊断报告</div>
            </button>
            {data.projects.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); setActiveTab('concise'); }}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${
                  activeProjectId === p.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-bg-hover border border-transparent'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="text-sm font-medium text-text-main truncate">{p.name}</div>
                  <div className="text-xs text-text-muted truncate">{p.role}</div>
                </div>
                {p.lockedVersion ? (
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={onFinish}
            className="w-full bg-primary hover:bg-primary-hover text-white py-2 rounded-lg font-medium transition-colors"
          >
            查看最终结果
          </button>
        </div>
      </div>

      {/* Main Area */}
      {activeProjectId === 'overall' ? (
        <div className="flex-1 p-8 overflow-y-auto bg-bg-main">
          <h2 className="text-2xl font-bold text-text-main mb-6">整体简历诊断报告</h2>
          <div className="bg-bg-card rounded-xl p-6 border border-border mb-6">
            <h4 className="text-lg font-medium text-error mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> 核心问题诊断 (整体)
            </h4>
            <ul className="list-disc list-inside text-text-main space-y-2 leading-relaxed">
              {data.overallIssues && data.overallIssues.length > 0 ? (
                data.overallIssues.map((issue, idx) => <li key={idx}>{issue}</li>)
              ) : (
                <>
                  <li>简历整体偏向纯执行视角，缺乏AI产品经理核心的模型评估、数据策略和算法团队协作经验。</li>
                  <li>项目描述中缺乏具体的AI相关数据指标（如模型准确率、召回率、推理延迟等），量化不够饱满。</li>
                  <li>部分项目经历未严格遵循 STAR 法则，AI功能落地的业务背景和最终业务结果阐述不清晰。</li>
                </>
              )}
            </ul>
          </div>
          <div className="bg-bg-card rounded-xl p-6 border border-border mb-6">
            <h4 className="text-lg font-medium text-text-main mb-4">AI产品经理岗位20条参考要求</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {AI_PM_REQUIREMENTS.map((item, idx) => (
                <div key={idx} className="text-sm text-text-muted leading-relaxed">
                  <span className="text-text-main font-medium">{idx + 1}.</span> {item}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center p-12 border-2 border-dashed border-border rounded-xl">
            <p className="text-text-muted text-lg">👈 请在左侧选择一个具体项目进行深度优化</p>
          </div>
        </div>
      ) : activeProject ? (
        <div className="flex-1 flex flex-col min-h-0 bg-bg-main">
          {/* Diagnostic Header */}
          <div className="p-6 border-b border-border bg-bg-card shrink-0">
            <h2 className="text-2xl font-bold text-text-main mb-2">{activeProject.name}</h2>
            <p className="text-text-muted text-sm mb-4">{activeProject.duration} · {activeProject.role}</p>
            <div className="bg-bg-main rounded-xl p-4 border border-border">
              <h4 className="text-sm font-medium text-error mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> 该项目核心问题
              </h4>
              <ul className="list-disc list-inside text-sm text-text-muted space-y-1">
                {activeProject.issues && activeProject.issues.length > 0 ? (
                  activeProject.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))
                ) : (
                  <li>该项目描述缺乏具体的量化数据和明确的业务结果。</li>
                )}
              </ul>
            </div>
            <div className="bg-bg-main rounded-xl p-4 border border-border mt-4">
              <h4 className="text-sm font-medium text-text-main mb-2">
                当前项目会按这20条AI产品经理岗位要求来改写
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">
                AI 会优先补这个项目在“场景定义、AI方案、数据评测、业务结果、跨团队推进、落地闭环”等方面最缺的内容，不再只是做普通润色。
              </p>
            </div>
          </div>

          {/* Optimization Area */}
          <div className="flex-1 min-h-0 p-6 flex flex-col gap-6 overflow-y-auto">
            <div className="bg-bg-card rounded-xl p-5 border border-border shrink-0 max-h-40 overflow-y-auto">
              <h4 className="text-sm font-medium text-text-muted mb-3 sticky top-0 bg-bg-card">原始描述</h4>
              <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">{activeProject.original}</p>
            </div>

            <div className="flex-1 min-h-[360px] flex flex-col bg-bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex border-b border-border bg-bg-main shrink-0">
                {(['concise', 'detailed', 'datadriven'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab ? 'text-primary border-b-2 border-primary bg-bg-card' : 'text-text-muted hover:text-text-main hover:bg-bg-hover'
                    }`}
                  >
                    {tab === 'concise' ? '简洁版' : tab === 'detailed' ? '详细版' : '数据驱动版'}
                  </button>
                ))}
                {activeProject.customVersion && (
                  <button
                    onClick={() => setActiveTab('custom')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'custom' ? 'text-primary border-b-2 border-primary bg-bg-card' : 'text-text-muted hover:text-text-main hover:bg-bg-hover'
                    }`}
                  >
                    自定义版
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 p-6 relative flex flex-col overflow-hidden">
                {isGenerating && !activeProject.versions ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-card/80 z-10">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="text-text-muted text-sm">AI正在重写你的项目经历...</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto mb-4 pr-2">
                      <p className="text-text-main leading-relaxed whitespace-pre-wrap">
                        {currentVersionText}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-border shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentVersionText || '');
                          const btn = document.getElementById('copy-btn-' + activeProject.id);
                          if (btn) {
                            const originalText = btn.innerHTML;
                            btn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> 已复制 ✓';
                            btn.classList.add('text-success');
                            setTimeout(() => {
                              btn.innerHTML = originalText;
                              btn.classList.remove('text-success');
                            }, 1500);
                          }
                        }}
                        id={'copy-btn-' + activeProject.id}
                        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main transition-colors"
                      >
                        <Copy className="w-4 h-4" /> 复制此版本
                      </button>
                      <button
                        onClick={() => onUpdateProject(activeProject.id, { lockedVersion: activeTab })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeProject.lockedVersion === activeTab
                            ? 'bg-success/20 text-success border border-success/30'
                            : 'bg-primary hover:bg-primary-hover text-white'
                        }`}
                      >
                        {activeProject.lockedVersion === activeTab ? (
                          <><CheckCircle className="w-4 h-4" /> 已锁定</>
                        ) : (
                          <><Lock className="w-4 h-4" /> 锁定此版本</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Input */}
            <div className="bg-bg-card rounded-xl border border-border p-2 flex items-end gap-2 shrink-0">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="对当前版本不满意？输入你的修改要求，例如：'加上大模型微调的业务背景'、'突出数据清洗和特征工程的贡献'..."
                className="flex-1 bg-transparent border-none text-sm text-text-main resize-none focus:outline-none p-2 max-h-32 min-h-[40px]"
                rows={1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChat();
                  }
                }}
              />
              <button
                onClick={handleChat}
                disabled={isChatting || !chatInput.trim() || isGenerating}
                className="p-2 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-text-muted text-white rounded-lg transition-colors shrink-0"
              >
                {isChatting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProgressBar({ label, value }: { label: string, value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted">{label}</span>
        <span className="text-text-main">{value}/100</span>
      </div>
      <div className="h-2 bg-bg-main rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-1000 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
