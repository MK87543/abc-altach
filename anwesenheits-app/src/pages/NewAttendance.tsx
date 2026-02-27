import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Player, Coach, Training } from '../types/interfaces'
import { CheckIcon, XIcon, WarningIcon, SaveIcon, LightbulbIcon, EditIcon, ClipboardIcon } from '../components/Icons'

interface NewAttendanceProps {
    onSuccess?: () => void
}

export default function NewAttendance({ onSuccess }: NewAttendanceProps) {
    const [todaysTraining, setTodaysTraining] = useState<Training | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [coaches, setCoaches] = useState<Coach[]>([])
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
    const [selectedMandatoryCoaches, setSelectedMandatoryCoaches] = useState<Set<string>>(new Set())
    const [selectedAdditionalCoaches, setSelectedAdditionalCoaches] = useState<Set<string>>(new Set())
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)

    const formatDateGerman = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00')
        return date.toLocaleDateString('de-AT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    useEffect(() => {
        loadTodaysTraining()
        loadPlayers()
        loadCoaches()
    }, [])

    async function loadTodaysTraining() {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        // Suche nach Training von HEUTE
        const { data } = await supabase
            .from('trainings')
            .select('*')
            .eq('date', today)
            .maybeSingle() // Gibt null zurück wenn keins gefunden

        if (data) {
            setTodaysTraining(data)
            setDescription(data.description || '')
            // Lade bereits erfasste Anwesenheit für dieses Training
            await loadExistingAttendance(data.id)
            setIsEditing(true) // Wir bearbeiten ein bestehendes Training
        }

        setLoading(false)
    }

    async function loadExistingAttendance(trainingId: string) {
        // Lade Spieler-Anwesenheit
        const { data: playerAttendance } = await supabase
            .from('attendance')
            .select('player_id')
            .eq('training_id', trainingId)
            .eq('is_present', true)

        if (playerAttendance && playerAttendance.length > 0) {
            const playerIds = playerAttendance.map(a => a.player_id).filter(Boolean)
            setSelectedPlayers(new Set(playerIds))
        }

        // Lade Trainer-Anwesenheit
        const { data: coachAttendance } = await supabase
            .from('coach_attendance')
            .select('coach_id, is_mandatory')
            .eq('training_id', trainingId)
            .eq('is_present', true)

        if (coachAttendance && coachAttendance.length > 0) {
            const mandatoryIds = coachAttendance
                .filter((a: any) => a.is_mandatory)
                .map((a: any) => a.coach_id)
                .filter(Boolean)
            const additionalIds = coachAttendance
                .filter((a: any) => !a.is_mandatory)
                .map((a: any) => a.coach_id)
                .filter(Boolean)
            setSelectedMandatoryCoaches(new Set(mandatoryIds))
            setSelectedAdditionalCoaches(new Set(additionalIds))
        }
    }

    const loadPlayers = async () => {
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

    const loadCoaches = async () => {
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

    const toggleMandatoryCoach = (coachId: string) => {
        setSelectedMandatoryCoaches(prev => {
            const newSet = new Set(prev)
            if (newSet.has(coachId)) {
                newSet.delete(coachId)
            } else {
                if (newSet.size >= 2) return prev // Max 2 Pflichttrainer
                newSet.add(coachId)
            }
            return newSet
        })
    }

    const toggleAdditionalCoach = (coachId: string) => {
        setSelectedAdditionalCoaches(prev => {
            const newSet = new Set(prev)
            if (newSet.has(coachId)) {
                newSet.delete(coachId)
            } else {
                newSet.add(coachId)
            }
            return newSet
        })
    }

    function togglePlayer(playerId: string) {
        const newSet = new Set(selectedPlayers)
        if (newSet.has(playerId)) {
            newSet.delete(playerId)
        } else {
            newSet.add(playerId)
        }
        setSelectedPlayers(newSet)
    }

    // SCHNELL-AUSWAHL: Alle an/aus
    function selectAll() {
        setSelectedPlayers(new Set(players.map(p => p.id)))
    }

    function deselectAll() {
        setSelectedPlayers(new Set())
    }

    async function createSpontaneousTraining() {
        const topic = prompt('Beschreibung für heute (optional):')
        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('trainings')
            .insert({
                date: today,
                description: topic || 'Spontanes Training'
            })
            .select()
            .single()

        if (error) {
            alert('Fehler beim Erstellen: ' + error.message)
            return
        }

        if (data) {
            setTodaysTraining(data)
            setDescription(data.description || '')
        }
    }

    async function saveAttendance() {
        if (!todaysTraining) {
            alert('Kein Training für heute geplant!')
            return
        }

        const totalCoaches = selectedMandatoryCoaches.size + selectedAdditionalCoaches.size
        if (selectedPlayers.size === 0 && totalCoaches === 0) {
            if (!confirm('Keine Spieler oder Trainer ausgewählt. Wirklich speichern (= alle abwesend)?')) {
                return
            }
        }

        setLoading(true)

        try {
            // 1. Lösche alte Spieler-Anwesenheit für dieses Training
            await supabase
                .from('attendance')
                .delete()
                .eq('training_id', todaysTraining.id)

            // 2. Lösche alte Trainer-Anwesenheit
            await supabase
                .from('coach_attendance')
                .delete()
                .eq('training_id', todaysTraining.id)

            // 3. Speichere neue Spieler-Anwesenheit
            if (selectedPlayers.size > 0) {
                const attendanceData = Array.from(selectedPlayers).map(playerId => ({
                    training_id: todaysTraining.id,
                    player_id: playerId,
                    is_present: true
                }))

                const { error: playerError } = await supabase
                    .from('attendance')
                    .insert(attendanceData)

                if (playerError) throw playerError
            }

            // 4. Speichere neue Trainer-Anwesenheit
            const allCoachAttendanceData = [
                ...Array.from(selectedMandatoryCoaches).map(coachId => ({
                    training_id: todaysTraining.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: true
                })),
                ...Array.from(selectedAdditionalCoaches).map(coachId => ({
                    training_id: todaysTraining.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: false
                }))
            ]

            if (allCoachAttendanceData.length > 0) {
                const { error: coachError } = await supabase
                    .from('coach_attendance')
                    .insert(allCoachAttendanceData)

                if (coachError) throw coachError
            }

            // 5. Aktualisiere Beschreibung falls geändert
            if (description !== todaysTraining.description) {
                await supabase
                    .from('trainings')
                    .update({ description: description || null })
                    .eq('id', todaysTraining.id)
            }

            alert(`Anwesenheit ${isEditing ? 'aktualisiert' : 'gespeichert'}!`)

            if (onSuccess) {
                onSuccess()
            }
        } catch (error) {
            console.error('Fehler beim Speichern:', error)
            alert('Fehler beim Speichern der Anwesenheit')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <p className="text-gray-600 text-lg">Lade Training...</p>
            </div>
        )
    }

    // FALL 1: KEIN Training für heute geplant
    if (!todaysTraining) {
        return (
            <div className="p-6 max-w-3xl mx-auto">
                <div className="bg-yellow-50 border-2 border-yellow-400 text-yellow-900 p-6 rounded-lg text-center">
                    <div className="flex justify-center mb-3">
                        <WarningIcon className="text-yellow-600" size={48} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Kein Training geplant</h2>
                    <p className="mb-4">
                        Für heute ({new Date().toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: 'long' })})
                        ist noch kein Training eingetragen.
                    </p>
                </div>

                {/* Notfall-Modus für spontanes Training */}
                <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
                    <h3 className="text-gray-800 font-semibold mb-3">Spontanes Training erstellen?</h3>
                    <button
                        onClick={createSpontaneousTraining}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition font-medium"
                    >
                        + Jetzt schnell Training erstellen
                    </button>
                </div>
            </div>
        )

    }

    // FALL 2: Training für heute existiert → Anwesenheit erfassen/bearbeiten
    return (
        <div className="p-6 max-w-3xl mx-auto">
            {/* Header mit Training-Info */}
            <div className="bg-blue-50 border-2 border-blue-400 p-6 rounded-lg mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                            {isEditing ? (
                                <><EditIcon size={24} /> Anwesenheit bearbeiten</>
                            ) : (
                                <><CheckIcon size={24} /> Anwesenheit erfassen</>
                            )}
                        </h1>
                        <p className="text-blue-800">
                            {formatDateGerman(todaysTraining.date)}
                        </p>
                        {todaysTraining.description && (
                            <p className="text-blue-700 font-semibold mt-2 flex items-center gap-2">
                                <ClipboardIcon size={16} />
                                {todaysTraining.description}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Beschreibung bearbeiten */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <label className="block text-gray-700 font-medium mb-2">
                    Beschreibung (optional)
                </label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="z.B. Taktik, Techniktraining..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Trainer Auswahl */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Trainer</h2>

                {/* Pflichttrainer */}
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-700 font-medium">Pflichttrainer</span>
                        <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${selectedMandatoryCoaches.size >= 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                            {selectedMandatoryCoaches.size}/2
                        </span>
                    </div>
                    <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {coaches.length === 0 ? (
                            <p className="text-gray-500 text-sm py-1">Keine Trainer gefunden</p>
                        ) : (
                            coaches.map(coach => {
                                const isSelected = selectedMandatoryCoaches.has(coach.id)
                                const isAlreadyAdditional = selectedAdditionalCoaches.has(coach.id)
                                const isDisabled = isAlreadyAdditional || (!isSelected && selectedMandatoryCoaches.size >= 2)
                                return (
                                    <label
                                        key={coach.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg transition ${isAlreadyAdditional
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 border-2 border-gray-200'
                                                : isDisabled
                                                    ? 'opacity-40 cursor-not-allowed bg-gray-100 border-2 border-gray-200'
                                                    : isSelected
                                                        ? 'bg-blue-50 border-2 border-blue-400 cursor-pointer'
                                                        : 'bg-white border-2 border-gray-200 hover:bg-gray-50 cursor-pointer'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isDisabled}
                                            onChange={() => toggleMandatoryCoach(coach.id)}
                                            className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <span className="text-gray-800 flex-1">
                                            {coach.name}
                                            {coach.role && (
                                                <span className="text-sm text-gray-500 ml-2">({coach.role})</span>
                                            )}
                                        </span>
                                        {isSelected && (
                                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Pflicht</span>
                                        )}
                                    </label>
                                )
                            })
                        )}
                    </div>
                    {selectedMandatoryCoaches.size >= 2 && (
                        <p className="text-orange-600 text-sm mt-1 flex items-center gap-1">
                            <WarningIcon size={14} />
                            Maximale Anzahl von 2 Pflichttrainern erreicht
                        </p>
                    )}
                </div>

                {/* Zusatztrainer */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-700 font-medium">Zusatztrainer</span>
                        {selectedAdditionalCoaches.size > 0 && (
                            <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                {selectedAdditionalCoaches.size} ausgewählt
                            </span>
                        )}
                    </div>
                    <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {coaches.length === 0 ? (
                            <p className="text-gray-500 text-sm py-1">Keine Trainer gefunden</p>
                        ) : (
                            coaches.map(coach => {
                                const isSelected = selectedAdditionalCoaches.has(coach.id)
                                const isAlreadyMandatory = selectedMandatoryCoaches.has(coach.id)
                                return (
                                    <label
                                        key={coach.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg transition ${isAlreadyMandatory
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 border-2 border-gray-200'
                                                : isSelected
                                                    ? 'bg-green-50 border-2 border-green-400 cursor-pointer'
                                                    : 'bg-white border-2 border-gray-200 hover:bg-gray-50 cursor-pointer'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isAlreadyMandatory}
                                            onChange={() => toggleAdditionalCoach(coach.id)}
                                            className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <span className="text-gray-800 flex-1">
                                            {coach.name}
                                            {coach.role && (
                                                <span className="text-sm text-gray-500 ml-2">({coach.role})</span>
                                            )}
                                        </span>
                                        {isSelected && (
                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Zusatz</span>
                                        )}
                                    </label>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Schnell-Buttons */}
            <div className="flex gap-3 mb-4">
                <button
                    onClick={selectAll}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition font-medium flex items-center justify-center gap-2"
                >
                    <CheckIcon />
                    Alle markieren
                </button>
                <button
                    onClick={deselectAll}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg transition font-medium flex items-center justify-center gap-2"
                >
                    <XIcon />
                    Alle abwählen
                </button>
            </div>

            {/* Spielerliste */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    Anwesende Spieler ({selectedPlayers.size} von {players.length})
                </h2>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {players.map(player => (
                        <label
                            key={player.id}
                            className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition ${selectedPlayers.has(player.id)
                                ? 'bg-green-100 border-2 border-green-500'
                                : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
                                }`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedPlayers.has(player.id)}
                                onChange={() => togglePlayer(player.id)}
                                className="w-6 h-6 cursor-pointer"
                            />
                            <span className="text-gray-800 font-medium text-lg flex-1">{player.name}</span>
                            {selectedPlayers.has(player.id) && (
                                <CheckIcon className="text-green-600" size={24} />
                            )}
                        </label>
                    ))}
                </div>
            </div>

            {/* Speichern-Button */}
            <button
                onClick={saveAttendance}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg transition text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading
                    ? 'Wird gespeichert...'
                    : isEditing
                        ? (
                            <>
                                <SaveIcon size={24} />
                                Anwesenheit aktualisieren
                            </>
                        )
                        : (
                            <>
                                <CheckIcon size={24} />
                                Anwesenheit speichern
                            </>
                        )
                }
            </button>

            {/* Info-Hinweis */}
            {isEditing && (
                <p className="text-gray-500 text-sm text-center mt-3 flex items-center justify-center gap-2">
                    <LightbulbIcon size={16} />
                    Diese Anwesenheit wurde bereits erfasst und wird überschrieben
                </p>
            )}
        </div>
    )
}
