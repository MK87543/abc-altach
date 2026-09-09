import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmModal'

function App() {
    const { user, loading } = useAuth()

    return (
        <ToastProvider>
            <ConfirmProvider>
                {loading ? (
                    <div className="h-screen flex items-center justify-center text-white bg-gray-900">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-medium text-gray-300">Lade App...</p>
                        </div>
                    </div>
                ) : !user ? (
                    <Login />
                ) : (
                    <div className="min-h-screen">
                        <Dashboard />
                    </div>
                )}
            </ConfirmProvider>
        </ToastProvider>
    )
}

export default App