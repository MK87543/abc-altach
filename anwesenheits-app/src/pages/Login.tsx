import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Props = {}

export default function Login({ }: Props) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn } = useAuth()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({
            email: email + '@local.at',
            password,
        })

        if (error) {
            console.log(error)
        }

        else {
            console.log("Erfolgreich eingeloggt")
        }

        setLoading(false)
    }



    return (
        <div className="flex justify-center items-center h-screen">
            <div className=" rounded-lg p-8 w-96 ">
                <h1 className="text-3xl font-bold text-center mb-6 text-white">Login</h1>
                <form onSubmit={handleLogin}>
                    <div className="mb-4 bg-white  opacity-95 shadow-md rounded-lg p-5">
                        <label htmlFor="username" className=" text-gray-700 font-medium mb-2 flex justify-center">
                            Benutzername
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Benutzername"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="mb-6 bg-white  opacity-95 shadow-md rounded-lg p-5">
                        <label htmlFor="password" className=" text-gray-700 font-medium mb-2 flex justify-center">
                            Passwort
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Passwort"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-200 disabled:opacity-50"
                    >
                        {loading ? 'Lädt...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    )

}