import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Player } from '../types/interfaces'

interface EditPlayersProps {
    onBack: () => void
}

export default function EditPlayers({ onBack }: EditPlayersProps) {
    const [players, setPlayers] = useState<Player[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')

    useEffect(() => {
        fetchPlayers()
    }, [])

    const fetchPlayers = async () => {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .order('active', { ascending: false })
            .order('name')

        if (error) {
            console.error('Fehler beim Laden der Spieler:', error)
        } else if (data) {
            setPlayers(data)
        }
    }

    const startEdit = (player: Player) => {
        setEditingId(player.id)
        setEditName(player.name)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName('')
    }

    const saveEdit = async (playerId: string) => {
        try {
            const { error } = await supabase
                .from('players')
                .update({ name: editName })
                .eq('id', playerId)

            if (error) throw error

            await fetchPlayers()
            setEditingId(null)
            setEditName('')
        } catch (error) {
            console.error('Fehler beim Speichern:', error)
            alert('Fehler beim Speichern')
        }
    }

    const toggleActive = async (playerId: string, currentActive: boolean) => {
        try {
            const { error } = await supabase
                .from('players')
                .update({ active: !currentActive })
                .eq('id', playerId)

            if (error) throw error

            await fetchPlayers()
        } catch (error) {
            console.error('Fehler beim Ändern des Status:', error)
            alert('Fehler beim Ändern des Status')
        }
    }

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Spieler bearbeiten</h2>
                <button
                    onClick={onBack}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
                >
                    Zurück
                </button>
            </div>

            {players.length === 0 ? (
                <p className="text-gray-500">Keine Spieler gefunden</p>
            ) : (
                <div className="space-y-3">
                    {players.map(player => (
                        <div
                            key={player.id}
                            className={`p-4 rounded-lg border ${player.active
                                ? 'bg-white border-gray-200'
                                : 'bg-gray-100 border-gray-300 opacity-60'
                                }`}
                        >
                            {editingId === player.id ? (
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => saveEdit(player.id)}
                                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                                    >
                                        ✓
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <span className={`text-lg font-medium ${!player.active ? 'text-gray-500' : 'text-gray-800'}`}>
                                        {player.name}
                                        {!player.active && <span className="ml-2 text-sm">(Inaktiv)</span>}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startEdit(player)}
                                            className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition"
                                            title="Bearbeiten"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => toggleActive(player.id, player.active)}
                                            className={`px-3 py-1 rounded transition ${player.active
                                                ? 'text-red-600 hover:bg-red-50'
                                                : 'text-green-600 hover:bg-green-50'
                                                }`}
                                            title={player.active ? 'Inaktiv setzen' : 'Aktivieren'}
                                        >
                                            {player.active ? '🗑️' : '✓'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
