import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface NewPlayerProps {
    onBack: () => void
    onSuccess?: () => void
    hideHeader?: boolean
}

export default function NewPlayer({ onBack, onSuccess, hideHeader }: NewPlayerProps) {
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        try {
            const { error } = await supabase
                .from('players')
                .insert({
                    name: name.trim(),
                    active: true
                })

            if (error) throw error

            setSuccess(true)
            setName('')

            if (onSuccess) {
                onSuccess()
            }

            setTimeout(() => {
                setSuccess(false)
            }, 3000)
        } catch (error) {
            console.error('Fehler beim Erstellen des Spielers:', error)
            alert('Fehler beim Erstellen des Spielers')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={hideHeader ? "" : "bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6"}>
            {!hideHeader && (
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Neuer Spieler</h2>
                    <button
                        onClick={onBack}
                        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
                    >
                        Zurück
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="playerName" className="block text-gray-700 font-medium mb-2">
                        Spielername
                    </label>
                    <input
                        type="text"
                        id="playerName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name des Spielers eingeben..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />
                </div>

                {success && (
                    <div className="p-3 bg-green-100 text-green-700 rounded-lg">
                        Spieler erfolgreich erstellt!
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Wird erstellt...' : 'Spieler erstellen'}
                </button>
            </form>
        </div>
    )
}
