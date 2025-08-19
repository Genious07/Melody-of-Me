import { cookies } from 'next/headers'
import LoginPage from '@/components/login-page'
import Dashboard from '@/components/dashboard'

export default async function Home() {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get('session_token')

  return (
    <main>
      {sessionToken ? <Dashboard /> : <LoginPage />}
    </main>
  )
}
