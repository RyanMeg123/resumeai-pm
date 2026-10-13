import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export default async function ZitingProjectPage() {
    await requireUser()
    // Existing material is retained, but none of the configured accounts owns it.
    notFound()
}
