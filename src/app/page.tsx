import { cookies } from 'next/headers'
import LoginPage from '@/components/login-page'
import Dashboard from '@/components/dashboard'

export default function Home() {
  const cookieStore = cookies()
  const accessToken = cookieStore.get('spotify_access_token')

  return (
    <main>
      {accessToken ? <Dashboard /> : <LoginPage />}
    </main>
  )
}
