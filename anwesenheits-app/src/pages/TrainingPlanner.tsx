import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Training, Coach } from '../types/interfaces'
import { CalendarIcon, PlusIcon, ClipboardIcon, CheckIcon, XIcon, EditIcon, TrashIcon, CircleIcon, UserIcon } from '../components/Icons'

interface TrainingPlannerProps {
    onBack?: () => void
}

interface TrainingWithCoaches extends Training {
    coach_attendance?: {
        coach_id: string
        coaches: { name: string }
    }[]
}

export default function TrainingPlanner({ onBack }: TrainingPlannerProps) {
    const [trainings, setTrainings] = useState<TrainingWithCoaches[]>([])
    const [coaches, setCoaches] = useState<Coach[]>([])
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
    const [newDescription, setNewDescription] = useState('')
    const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editDescription, setEditDescription] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        await Promise.all([
            loadTrainings(),
            loadCoaches()
        ])
    }

    async function loadCoaches() {
        const { data } = await supabase
            .from('coaches')
            .select('*')
            .eq('active', true)
            .order('name')

        if (data) setCoaches(data)
    }

    async function loadTrainings() {
        const today = new Date().toISOString().split('T')[0]

        // Lade zukünftige und heutige Trainings inkl. Trainer
        const { data, error } = await supabase
            .from('trainings')
            .select(`
                *,
                coach_attendance (
                    coach_id,
                    coaches ( name )
                )
            `)
            .gte('date', today)
            .order('date', { ascending: true })

        if (error) {
            console.error('Fehler beim Laden:', error)
        } else if (data) {
            setTrainings(data as any)
        }
    }

    function toggleCoachSelection(coachId: string) {
        setSelectedCoachIds(prev =>
            prev.includes(coachId)
                ? prev.filter(id => id !== coachId)
                : [...prev, coachId]
        )
    }

    async function createTraining() {
        if (!newDate) {
            alert('Bitte Datum auswählen')
            return
        }

        setLoading(true)

        // 1. Training erstellen
        const { data: trainingData, error: trainingError } = await supabase
            .from('trainings')
            .insert({
                date: newDate,
                description: newDescription || null
            })
            .select() // Wichtig um die ID zu bekommen
            .single()

        if (trainingError) {
            console.error('Fehler beim Erstellen:', trainingError)
            alert('Fehler: ' + trainingError.message)
            setLoading(false)
            return
        }

        // 2. Trainer zuweisen (falls ausgewählt)
        if (selectedCoachIds.length > 0 && trainingData) {
            const coachInserts = selectedCoachIds.map(coachId => ({
                training_id: trainingData.id,
                coach_id: coachId,
                is_present: true
            }))

            const { error: coachError } = await supabase
                .from('coach_attendance')
                .insert(coachInserts)

            if (coachError) {
                console.error('Fehler beim Trainer zuweisen:', coachError)
                // Wir machen weiter, auch wenn das fehlschlägt (Training ist ja da)
            }
        }

        setNewDate(new Date().toISOString().split('T')[0])
        setNewDescription('')
        setSelectedCoachIds([])
        await loadTrainings()
        setLoading(false)
    }

    async function updateTraining(id: string) {
        const { error } = await supabase
            .from('trainings')
            .update({ description: editDescription || null })
            .eq('id', id)

        if (error) {
            alert('Fehler beim Aktualisieren: ' + error.message)
        } else {
            setEditingId(null)
            await loadTrainings()
        }
    }

    async function deleteTraining(id: string) {
        if (!confirm('Training wirklich löschen? (Anwesenheitsdaten gehen verloren)')) {
            return
        }

        // Zuerst Anwesenheitsdaten löschen
        await supabase.from('attendance').delete().eq('training_id', id)
        await supabase.from('coach_attendance').delete().eq('training_id', id)

        // Dann Training löschen
        const { error } = await supabase
            .from('trainings')
            .delete()
            .eq('id', id)

        if (error) {
            alert('Fehler beim Löschen: ' + error.message)
        } else {
            await loadTrainings()
        }
    }

    function formatDateGerman(dateString: string) {
        const date = new Date(dateString + 'T00:00:00')
        const today = new Date().toISOString().split('T')[0]
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        let prefixElement = null
        if (dateString === today) {
            prefixElement = (
                <span className="inline-flex items-center gap-1 mr-2">
                    <CircleIcon className="text-red-600" size={10} />
                    <span className="font-bold">HEUTE</span>
                </span>
            )
        } else if (dateString === tomorrowStr) {
            prefixElement = (
                <span className="inline-flex items-center gap-1 mr-2">
                    <CircleIcon className="text-yellow-500" size={10} />
                    <span className="font-bold">MORGEN</span>
                </span>
            )
        }

        const dateStr = date.toLocaleDateString('de-AT', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        })

        return { prefix: prefixElement, dateStr }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <CalendarIcon size={32} />
                        Trainings planen
                    </h1>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                        >
                            Zurück
                        </button>
                    )}
                </div>
            </div>

            {/* Neues Training erstellen */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <PlusIcon size={24} />
                    Neues Training planen
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Datum *
                        </label>
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Beschreibung (optional)
                        </label>
                        <input
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="z.B. Techniktraining, Taktik, Aufschlag..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Trainer (optional)
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {coaches.map(coach => {
                                const isSelected = selectedCoachIds.includes(coach.id)
                                return (
                                    <button
                                        key={coach.id}
                                        onClick={() => toggleCoachSelection(coach.id)}
                                        className={`px-3 py-2 rounded-full border transition flex items-center gap-2 ${isSelected
                                                ? 'bg-blue-100 border-blue-500 text-blue-700'
                                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <UserIcon size={16} />
                                        {coach.name}
                                        {isSelected && <CheckIcon size={14} />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <button
                        onClick={createTraining}
                        disabled={loading || !newDate}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? 'Wird erstellt...' : (
                            <>
                                <CheckIcon />
                                Training erstellen
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Geplante Trainings */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <ClipboardIcon size={24} />
                    Geplante Trainings ({trainings.length})
                </h2>

                {trainings.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                        Noch keine Trainings geplant. Erstelle dein erstes Training oben!
                    </p>
                ) : (
                    <div className="space-y-3">
                        {trainings.map(training => {
                            const isToday = training.date === new Date().toISOString().split('T')[0]
                            const isEditing = editingId === training.id
                            const dateInfo = formatDateGerman(training.date)

                            return (
                                <div
                                    key={training.id}
                                    className={`p-4 rounded-lg border-2 ${isToday
                                        ? 'bg-red-50 border-red-500'
                                        : 'bg-gray-50 border-gray-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <p className={`font-bold text-lg flex items-center ${isToday ? 'text-red-700' : 'text-gray-800'
                                                }`}>
                                                {dateInfo.prefix}
                                                <span>{dateInfo.dateStr}</span>
                                            </p>

                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editDescription}
                                                    onChange={(e) => setEditDescription(e.target.value)}
                                                    placeholder="Beschreibung..."
                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            ) : (
                                                <>
                                                    <p className="text-gray-600 mt-1">
                                                        {training.description || <span className="italic text-gray-400">Keine Beschreibung</span>}
                                                    </p>
                                                    {training.coach_attendance && training.coach_attendance.length > 0 && (
                                                        <div className="mt-2 flex items-center gap-2 text-sm text-blue-700 font-medium">
                                                            <UserIcon size={14} />
                                                            <span>
                                                                Trainer: {training.coach_attendance.map(ca => ca.coaches?.name).join(', ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={() => updateTraining(training.id)}
                                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition text-sm flex items-center gap-1"
                                                    >
                                                        <CheckIcon size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition text-sm flex items-center gap-1"
                                                    >
                                                        <XIcon size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(training.id)
                                                            setEditDescription(training.description || '')
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition text-sm flex items-center gap-1"
                                                        title="Bearbeiten"
                                                    >
                                                        <EditIcon size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTraining(training.id)}
                                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition text-sm flex items-center gap-1"
                                                        title="Löschen"
                                                    >
                                                        <TrashIcon size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
