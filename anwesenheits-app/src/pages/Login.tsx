import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { SpinnerIcon } from '../components/Icons'

type Props = {}

export default function Login({ }: Props) {
    const { toast } = useToast()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || !password) {
            toast.warning('Bitte Benutzername und Passwort eingeben.')
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim() + '@local.at',
            password,
        })

        if (error) {
            console.error('Login error:', error)
            toast.error('Anmeldung fehlgeschlagen: Bitte Zugangsdaten prüfen.')
        } else {
            toast.success('Erfolgreich angemeldet! Willkommen.')
        }

        setLoading(false)
    }

    return (
        <div className="flex justify-center items-center h-screen px-4">
            <div className="rounded-lg p-8 w-full max-w-sm">
                <h1 className="text-3xl font-bold text-center mb-6 text-white tracking-tight">Login</h1>
                <form onSubmit={handleLogin}>
                    <div className="mb-4 bg-white opacity-95 shadow-md rounded-xl p-5">
                        <label htmlFor="username" className="text-gray-700 font-medium mb-2 flex justify-center text-base">
                            Benutzername
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            placeholder="Benutzername"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="mb-6 bg-white opacity-95 shadow-md rounded-xl p-5">
                        <label htmlFor="password" className="text-gray-700 font-medium mb-2 flex justify-center text-base">
                            Passwort
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            placeholder="Passwort"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-base min-h-[48px]"
                    >
                        {loading && <SpinnerIcon className="w-5 h-5 text-white" />}
                        <span>{loading ? 'Wird angemeldet...' : 'Anmelden'}</span>
                    </button>
                </form>
            </div>
        </div>
    )
}