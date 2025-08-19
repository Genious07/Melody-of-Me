import Header from "./header";
import UserProfile from "./user-profile";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start">
          <UserProfile />
        </div>
      </main>
    </div>
  )
}
