import 'server-only'
import { readResumeProfile } from './resume-projects'
import { projectAccount, type PracticeUser } from './auth'
import { loadInterviewGuides, loadProjectQuestionBank } from './project-question-bank'

export async function loadUserProjects(user: PracticeUser) {
    const profile = await readResumeProfile(user.username)
    if (profile.generated) return { sets: profile.generated.sets, guides: [] }
    const account = projectAccount(user)
    if (!account) return { sets: [], guides: [] }
    const sets = (await loadProjectQuestionBank()).filter((set) => set.id.startsWith(account.projectPrefix) && set.person === account.person)
    const guides = sets.length ? await loadInterviewGuides(account.person) : []
    return { sets, guides }
}
