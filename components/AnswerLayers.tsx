import { ANSWER_FORMAT, LAYERS, type LayerReview, type LayerStatus } from '@/lib/answer-layers'

const STATUS_STYLE: Record<LayerStatus, { label: string; className: string }> = {
    hit: { label: '已覆盖', className: 'border-success/40 text-success' },
    weak: { label: '偏弱', className: 'border-warning/40 text-warning' },
    miss: { label: '缺失', className: 'border-error/40 text-error' },
}

export function MethodCard() {
    return <details className="mt-4 rounded-2xl border border-white/10 p-4 text-sm">
        <summary className="cursor-pointer text-text-muted">答题方法卡：七层提问法 + 回答格式</summary>
        <ol className="mt-3 space-y-1 leading-6">
            {LAYERS.map((layer, index) => <li key={layer.name}><span className="font-medium">{index + 1}. {layer.name}</span><span className="text-text-muted"> · {layer.hint}</span></li>)}
        </ol>
        <p className="mt-3 leading-6"><span className="font-medium">回答格式：</span><span className="text-text-muted">{ANSWER_FORMAT.join(' → ')}</span></p>
        <p className="mt-1 text-xs text-text-muted">不是每题都要七层齐全；面试官的追问通常落在你漏掉的那一层。</p>
    </details>
}

export function LayerChips({ review }: { review: LayerReview }) {
    return <ul aria-label="七层覆盖" className="flex flex-wrap gap-2">
        {LAYERS.map((layer) => {
            const style = STATUS_STYLE[review.coverage[layer.name]]
            return <li key={layer.name} title={layer.hint} className={`rounded-full border px-3 py-1 text-xs ${style.className}`}>{layer.name} · {style.label}</li>
        })}
    </ul>
}
