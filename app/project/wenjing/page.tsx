import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export default async function WenjingProjectPage() {
    const user = await requireUser()
    if (user.username !== 'zhangwenjing') notFound()
    redirect('/project')
}
