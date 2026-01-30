import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard' // Das bauen wir als nächstes

function App() {
    // Hier nutzen wir den Hook! Er sagt uns jederzeit, ob wir rein dürfen.
    const { user, loading } = useAuth()

    // 1. Solange Supabase noch prüft (z.B. bei schlechtem Internet), zeigen wir "Laden..."
    if (loading) {
        return <div className="h-screen flex items-center justify-center text-white bg-gray-900">Lade App...</div>
    }

    // 2. Wenn KEIN User da ist -> Zeige Login
    if (!user) {
        return <Login />
    }

    // 3. Wenn User da ist -> Zeige das Dashboard (die eigentliche App)
    return (
        <div className=" min-h-screen">
            <Dashboard />
        </div>
    )
}

export default App