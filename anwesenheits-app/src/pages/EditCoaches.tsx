import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach } from '../types/interfaces'

interface EditCoachesProps {
    onBack: () => void
    hideHeader?: boolean
}

export default function EditCoaches({ onBack, hideHeader }: EditCoachesProps) {
    const [coaches, setCoaches] = useState<Coach[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editRole, setEditRole] = useState('')

    useEffect(() => {
        fetchCoaches()
    }, [])

    const fetchCoaches = async () => {
        const { data, error } = await supabase
            .from('coaches')
            .select('*')
            .order('active', { ascending: false })
            .order('name')

        if (error) {
            console.error('Fehler beim Laden der Trainer:', error)
        } else if (data) {
            setCoaches(data)
        }
    }

    const startEdit = (coach: Coach) => {
        setEditingId(coach.id)
        setEditName(coach.name)
        setEditRole(coach.role || '')
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName('')
        setEditRole('')
    }

    const saveEdit = async (coachId: string) => {
        try {
            const { error } = await supabase
                .from('coaches')
                .update({
                    name: editName,
                    role: editRole || null
                })
                .eq('id', coachId)

            if (error) throw error

            await fetchCoaches()
            setEditingId(null)
            setEditName('')
            setEditRole('')
        } catch (error) {
            console.error('Fehler beim Speichern:', error)
            alert('Fehler beim Speichern')
        }
    }

    const toggleActive = async (coachId: string, currentActive: boolean) => {
        try {
            const { error } = await supabase
                .from('coaches')
                .update({ active: !currentActive })
                .eq('id', coachId)

            if (error) throw error

            await fetchCoaches()
        } catch (error) {
            console.error('Fehler beim Ändern des Status:', error)
            alert('Fehler beim Ändern des Status')
        }
    }

    return (
        <div className={hideHeader ? "" : "bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6"}>
            {!hideHeader && (
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Trainer bearbeiten</h2>
                    <button
                        onClick={onBack}
                        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
                    >
                        Zurück
                    </button>
                </div>
            )}

            {coaches.length === 0 ? (
                <p className="text-gray-500">Keine Trainer gefunden</p>
            ) : (
                <div className="space-y-3">
                    {coaches.map(coach => (
                        <div
                            key={coach.id}
                            className={`p-4 rounded-lg border ${coach.active
                                ? 'bg-white border-gray-200'
                                : 'bg-gray-100 border-gray-300 opacity-60'
                                }`}
                        >
                            {editingId === coach.id ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Name"
                                        className="w-full px-3 py-2 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                    <input
                                        type="text"
                                        value={editRole}
                                        onChange={(e) => setEditRole(e.target.value)}
                                        placeholder="Rolle (z.B. Trainer, Co-Trainer)"
                                        className="w-full px-3 py-2 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => saveEdit(coach.id)}
                                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                                        >
                                            ✓ Speichern
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                                        >
                                            ✕ Abbrechen
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className={`text-lg font-medium ${!coach.active ? 'text-gray-500' : 'text-gray-800'}`}>
                                            {coach.name}
                                            {!coach.active && <span className="ml-2 text-sm">(Inaktiv)</span>}
                                        </span>
                                        {coach.role && (
                                            <span className="ml-2 text-sm text-gray-500">({coach.role})</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startEdit(coach)}
                                            className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition"
                                            title="Bearbeiten"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => toggleActive(coach.id, coach.active)}
                                            className={`px-3 py-1 rounded transition ${coach.active
                                                ? 'text-red-600 hover:bg-red-50'
                                                : 'text-green-600 hover:bg-green-50'
                                                }`}
                                            title={coach.active ? 'Inaktiv setzen' : 'Aktivieren'}
                                        >
                                            {coach.active ? '🗑️' : '✓'}
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
