import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Player, Coach } from '../types/interfaces'

interface NewAttendanceProps {
    onSuccess?: () => void
}

export default function NewAttendance({ onSuccess }: NewAttendanceProps) {
    const [players, setPlayers] = useState<Player[]>([])
    const [coaches, setCoaches] = useState<Coach[]>([])
    const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map())
    const [selectedCoaches, setSelectedCoaches] = useState<Set<string>>(new Set())
    const [isCoachDropdownOpen, setIsCoachDropdownOpen] = useState(false)
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitSuccess, setSubmitSuccess] = useState(false)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [isEditingDate, setIsEditingDate] = useState(false)

    const formatDateGerman = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00')
        return date.toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    useEffect(() => {
        fetchPlayers()
        fetchCoaches()
    }, [])

    const fetchPlayers = async () => {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('active', true)
            .order('name')

        if (error) {
            console.error('Fehler beim Laden der Spieler:', error)
        } else if (data) {
            setPlayers(data)
        }
    }

    const fetchCoaches = async () => {
        const { data, error } = await supabase
            .from('coaches')
            .select('*')
            .eq('active', true)
            .order('name')

        if (error) {
            console.error('Fehler beim Laden der Trainer:', error)
        } else if (data) {
            setCoaches(data)
        }
    }

    const toggleCoachSelection = (coachId: string) => {
        setSelectedCoaches(prev => {
            const newSet = new Set(prev)
            if (newSet.has(coachId)) {
                newSet.delete(coachId)
            } else {
                newSet.add(coachId)
            }
            return newSet
        })
    }

    const toggleAttendance = (playerId: string, isPresent: boolean) => {
        setAttendance(prev => {
            const newMap = new Map(prev)
            newMap.set(playerId, isPresent)
            return newMap
        })
    }

    const handleSubmit = async () => {
        setLoading(true)
        setSubmitSuccess(false)

        try {
            // 1. Training erstellen
            const { data: training, error: trainingError } = await supabase
                .from('trainings')
                .insert({
                    date: selectedDate,
                    description: description || null
                })
                .select()
                .single()

            if (trainingError) throw trainingError

            // 2. Anwesenheit für alle Spieler eintragen
            const attendanceRecords = players.map(player => ({
                training_id: training.id,
                player_id: player.id,
                is_present: attendance.get(player.id) ?? false
            }))

            const { error: attendanceError } = await supabase
                .from('attendance')
                .insert(attendanceRecords)

            if (attendanceError) throw attendanceError

            // 3. Anwesenheit für ausgewählte Trainer eintragen
            if (selectedCoaches.size > 0) {
                const coachAttendanceRecords = Array.from(selectedCoaches).map(coachId => ({
                    training_id: training.id,
                    coach_id: coachId,
                    is_present: true
                }))

                const { error: coachAttendanceError } = await supabase
                    .from('coach_attendance')
                    .insert(coachAttendanceRecords)

                if (coachAttendanceError) throw coachAttendanceError
            }

            setSubmitSuccess(true)
            // Reset nach erfolgreicher Eingabe
            setAttendance(new Map())
            setSelectedCoaches(new Set())
            setDescription('')

            if (onSuccess) {
                onSuccess()
            }

            setTimeout(() => setSubmitSuccess(false), 3000)
        } catch (error) {
            console.error('Fehler beim Speichern:', error)
            alert('Fehler beim Speichern der Anwesenheit')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {/* Datum Anzeige */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center gap-3">
                    {isEditingDate ? (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            onBlur={() => setIsEditingDate(false)}
                            className="text-xl text-gray-600 border-2 border-blue-500 rounded px-2 py-1 focus:outline-none"
                            autoFocus
                        />
                    ) : (
                        <p className="text-xl text-gray-600">{formatDateGerman(selectedDate)}</p>
                    )}
                    <button
                        onClick={() => setIsEditingDate(true)}
                        className="text-gray-600 hover:text-blue-500 transition"
                        title="Datum ändern"
                    >
                        ✏️
                    </button>
                </div>
            </div>

            {/* Trainer Auswahl */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6 relative z-[105]">
                <label className="block text-gray-700 font-medium mb-2">
                    Trainer
                </label>

                {/* Close dropdown overlay */}
                {isCoachDropdownOpen && (
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setIsCoachDropdownOpen(false)}
                    />
                )}

                <button
                    type="button"
                    onClick={() => setIsCoachDropdownOpen(!isCoachDropdownOpen)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-left flex justify-between items-center hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <span className="text-gray-700">
                        {selectedCoaches.size === 0
                            ? 'Trainer auswählen...'
                            : `${selectedCoaches.size} Trainer ausgewählt`
                        }
                    </span>
                    <span className="text-gray-400">▼</span>
                </button>

                {/* Dropdown Menu */}
                {isCoachDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl z-[110] max-h-60 overflow-y-auto">
                        {coaches.length === 0 ? (
                            <div className="px-4 py-3 text-gray-500">Keine Trainer gefunden</div>
                        ) : (
                            <div className="py-2">
                                {coaches.map(coach => (
                                    <label
                                        key={coach.id}
                                        className="flex items-center px-4 py-3 hover:bg-gray-100 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedCoaches.has(coach.id)}
                                            onChange={() => toggleCoachSelection(coach.id)}
                                            className="w-5 h-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="ml-3 text-gray-700">
                                            {coach.name}
                                            {coach.role && (
                                                <span className="text-sm text-gray-500 ml-2">({coach.role})</span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Beschreibung */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <label className="block text-gray-700 font-medium mb-2">
                    Beschreibung (optional)
                </label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="z.B. Taktik, Angaben..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Spielerliste */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Spieler</h2>
                {players.length === 0 ? (
                    <p className="text-gray-500">Keine Spieler gefunden</p>
                ) : (
                    <div className="space-y-3">
                        {players.map(player => {
                            const status = attendance.get(player.id)
                            return (
                                <div key={player.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-semibold text-gray-800">{player.name}</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => toggleAttendance(player.id, true)}
                                                className={`w-12 h-12 rounded-lg font-bold text-xl transition-all shadow-sm ${status === true
                                                    ? 'bg-green-500 text-white shadow-md scale-105'
                                                    : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-green-400 hover:bg-green-50'
                                                    }`}
                                                title="Anwesend"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                onClick={() => toggleAttendance(player.id, false)}
                                                className={`w-12 h-12 rounded-lg font-bold text-xl transition-all shadow-sm ${status === false
                                                    ? 'bg-red-500 text-white shadow-md scale-105'
                                                    : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-red-400 hover:bg-red-50'
                                                    }`}
                                                title="Abwesend"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Submit Button */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
                {submitSuccess && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
                        ✓ Anwesenheit erfolgreich gespeichert!
                    </div>
                )}
                <button
                    onClick={handleSubmit}
                    disabled={loading || players.length === 0}
                    className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Wird gespeichert...' : 'Anwesenheit speichern'}
                </button>
            </div>
        </>
    )
}
