import Link from 'next/link'

export type PracticeMode = 'marathon' | 'mock' | 'cards' | 'resume' | 'company'

// 第一层是题源（练什么），第二层是练法（怎么练）
const SOURCES: Array<{ label: string; hint: string; modes: Array<{ mode: PracticeMode; label: string }> }> = [
    { label: '基础题库', hint: '150 道高频题 · 11 个模块', modes: [{ mode: 'marathon', label: '顺序全刷' }, { mode: 'cards', label: '抽卡补短板' }] },
    { label: '大厂面经', hint: '按公司和面经段落练', modes: [{ mode: 'company', label: '按公司练' }] },
    { label: '我的题', hint: '基于当前账号的简历和项目', modes: [{ mode: 'resume', label: '简历定向题' }, { mode: 'mock', label: '模拟面试' }] },
]

const pill = (active: boolean) => `inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-text-main' : 'border-white/10 bg-white/[0.04] text-text-muted hover:border-white/20 hover:text-text-main'}`

export function PracticeNav({ activeMode, onChange, loggedIn }: { activeMode: PracticeMode; onChange: (mode: PracticeMode) => void; loggedIn: boolean }) {
    const source = SOURCES.find((item) => item.modes.some((entry) => entry.mode === activeMode)) ?? SOURCES[0]
    return <nav aria-label="练习导航" className="mb-8 space-y-4">
        <div role="tablist" aria-label="题源" className="flex flex-wrap gap-3">
            {SOURCES.map((item) => <button key={item.label} role="tab" aria-selected={item === source} onClick={() => onChange(item.modes[0].mode)} className={`${pill(item === source)} flex-col items-start gap-0.5 rounded-2xl`}>
                <span>{item.label}</span>
                <span className="text-xs font-normal text-text-muted">{item.hint}</span>
            </button>)}
        </div>
        {(source.modes.length > 1 || source.label === '我的题') && <div aria-label="练法" className="flex flex-wrap items-center gap-2">
            {source.modes.length > 1 && source.modes.map((entry) => <button key={entry.mode} aria-pressed={entry.mode === activeMode} onClick={() => onChange(entry.mode)} className={pill(entry.mode === activeMode)}>{entry.label}</button>)}
            {source.label === '我的题' && <Link href="/project" className={pill(false)}>{loggedIn ? '项目深挖' : '登录查看项目深挖'}</Link>}
        </div>}
    </nav>
}
