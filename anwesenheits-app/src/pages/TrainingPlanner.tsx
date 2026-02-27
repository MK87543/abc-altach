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
        is_mandatory: boolean
        coaches: { name: string }
    }[]
}

export default function TrainingPlanner({ onBack }: TrainingPlannerProps) {
    const [trainings, setTrainings] = useState<TrainingWithCoaches[]>([])
    const [coaches, setCoaches] = useState<Coach[]>([])
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
    const [newDescription, setNewDescription] = useState('')
    const [selectedMandatoryCoachIds, setSelectedMandatoryCoachIds] = useState<string[]>([])
    const [selectedAdditionalCoachIds, setSelectedAdditionalCoachIds] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editDescription, setEditDescription] = useState('')
    const [editMandatoryCoachIds, setEditMandatoryCoachIds] = useState<string[]>([])
    const [editAdditionalCoachIds, setEditAdditionalCoachIds] = useState<string[]>([])

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
                    is_mandatory,
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

    function toggleMandatoryCoach(coachId: string) {
        setSelectedMandatoryCoachIds(prev => {
            if (prev.includes(coachId)) return prev.filter(id => id !== coachId)
            if (prev.length >= 2) return prev // Max 2
            return [...prev, coachId]
        })
    }

    function toggleAdditionalCoach(coachId: string) {
        setSelectedAdditionalCoachIds(prev =>
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
        const allCoachInserts = [
            ...selectedMandatoryCoachIds.map(coachId => ({
                training_id: trainingData.id,
                coach_id: coachId,
                is_present: true,
                is_mandatory: true
            })),
            ...selectedAdditionalCoachIds.map(coachId => ({
                training_id: trainingData.id,
                coach_id: coachId,
                is_present: true,
                is_mandatory: false
            }))
        ]

        if (allCoachInserts.length > 0 && trainingData) {
            const { error: coachError } = await supabase
                .from('coach_attendance')
                .insert(allCoachInserts)

            if (coachError) {
                console.error('Fehler beim Trainer zuweisen:', coachError)
            }
        }

        setNewDate(new Date().toISOString().split('T')[0])
        setNewDescription('')
        setSelectedMandatoryCoachIds([])
        setSelectedAdditionalCoachIds([])
        await loadTrainings()
        setLoading(false)
    }

    async function updateTraining(id: string) {
        // 1. Beschreibung aktualisieren
        const { error } = await supabase
            .from('trainings')
            .update({ description: editDescription || null })
            .eq('id', id)

        if (error) {
            alert('Fehler beim Aktualisieren: ' + error.message)
            return
        }

        // 2. Trainer: alte Einträge löschen, neue speichern
        await supabase.from('coach_attendance').delete().eq('training_id', id)

        const allCoachInserts = [
            ...editMandatoryCoachIds.map(coachId => ({
                training_id: id,
                coach_id: coachId,
                is_present: true,
                is_mandatory: true
            })),
            ...editAdditionalCoachIds.map(coachId => ({
                training_id: id,
                coach_id: coachId,
                is_present: true,
                is_mandatory: false
            }))
        ]

        if (allCoachInserts.length > 0) {
            await supabase.from('coach_attendance').insert(allCoachInserts)
        }

        setEditingId(null)
        setEditMandatoryCoachIds([])
        setEditAdditionalCoachIds([])
        await loadTrainings()
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

                        {/* Pflichttrainer */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-blue-700">Pflichttrainer</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedMandatoryCoachIds.length >= 2
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {selectedMandatoryCoachIds.length}/2
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {coaches.map(coach => {
                                    const isSelected = selectedMandatoryCoachIds.includes(coach.id)
                                    const isAlreadyAdditional = selectedAdditionalCoachIds.includes(coach.id)
                                    const isDisabled = isAlreadyAdditional || (!isSelected && selectedMandatoryCoachIds.length >= 2)
                                    return (
                                        <button
                                            key={coach.id}
                                            onClick={() => !isDisabled && toggleMandatoryCoach(coach.id)}
                                            disabled={isDisabled}
                                            className={`px-3 py-2 rounded-full border transition flex items-center gap-2 ${isDisabled
                                                    ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400'
                                                    : isSelected
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
                            {selectedMandatoryCoachIds.length >= 2 && (
                                <p className="text-orange-600 text-xs mt-1">Maximale Anzahl von 2 Pflichttrainern erreicht</p>
                            )}
                        </div>

                        {/* Zusatztrainer */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-green-700">Zusatztrainer</span>
                                {selectedAdditionalCoachIds.length > 0 && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                        {selectedAdditionalCoachIds.length} ausgewählt
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {coaches.map(coach => {
                                    const isSelected = selectedAdditionalCoachIds.includes(coach.id)
                                    const isAlreadyMandatory = selectedMandatoryCoachIds.includes(coach.id)
                                    return (
                                        <button
                                            key={coach.id}
                                            onClick={() => !isAlreadyMandatory && toggleAdditionalCoach(coach.id)}
                                            disabled={isAlreadyMandatory}
                                            className={`px-3 py-2 rounded-full border transition flex items-center gap-2 ${isAlreadyMandatory
                                                    ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400'
                                                    : isSelected
                                                        ? 'bg-green-100 border-green-500 text-green-700'
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
                                                <div className="mt-2 space-y-3">
                                                    <input
                                                        type="text"
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                        placeholder="Beschreibung..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />

                                                    {/* Pflichttrainer bearbeiten */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-semibold text-blue-700">Pflichttrainer</span>
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${editMandatoryCoachIds.length >= 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                                }`}>{editMandatoryCoachIds.length}/2</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {coaches.map(coach => {
                                                                const isSelected = editMandatoryCoachIds.includes(coach.id)
                                                                const isAlreadyAdditional = editAdditionalCoachIds.includes(coach.id)
                                                                const isDisabled = isAlreadyAdditional || (!isSelected && editMandatoryCoachIds.length >= 2)
                                                                return (
                                                                    <button
                                                                        key={coach.id}
                                                                        type="button"
                                                                        disabled={isDisabled}
                                                                        onClick={() => {
                                                                            if (isDisabled) return
                                                                            setEditMandatoryCoachIds(prev =>
                                                                                prev.includes(coach.id)
                                                                                    ? prev.filter(id => id !== coach.id)
                                                                                    : [...prev, coach.id]
                                                                            )
                                                                        }}
                                                                        className={`px-2 py-1 rounded-full border text-xs transition flex items-center gap-1 ${isDisabled
                                                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400'
                                                                                : isSelected
                                                                                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                                                                                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                                                            }`}
                                                                    >
                                                                        <UserIcon size={12} />{coach.name}{isSelected && <CheckIcon size={11} />}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Zusatztrainer bearbeiten */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-semibold text-green-700">Zusatztrainer</span>
                                                            {editAdditionalCoachIds.length > 0 && (
                                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                                    {editAdditionalCoachIds.length} ausgewählt
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {coaches.map(coach => {
                                                                const isSelected = editAdditionalCoachIds.includes(coach.id)
                                                                const isAlreadyMandatory = editMandatoryCoachIds.includes(coach.id)
                                                                return (
                                                                    <button
                                                                        key={coach.id}
                                                                        type="button"
                                                                        disabled={isAlreadyMandatory}
                                                                        onClick={() => {
                                                                            if (isAlreadyMandatory) return
                                                                            setEditAdditionalCoachIds(prev =>
                                                                                prev.includes(coach.id)
                                                                                    ? prev.filter(id => id !== coach.id)
                                                                                    : [...prev, coach.id]
                                                                            )
                                                                        }}
                                                                        className={`px-2 py-1 rounded-full border text-xs transition flex items-center gap-1 ${isAlreadyMandatory
                                                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400'
                                                                                : isSelected
                                                                                    ? 'bg-green-100 border-green-500 text-green-700'
                                                                                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                                                            }`}
                                                                    >
                                                                        <UserIcon size={12} />{coach.name}{isSelected && <CheckIcon size={11} />}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-gray-600 mt-1">
                                                        {training.description || <span className="italic text-gray-400">Keine Beschreibung</span>}
                                                    </p>
                                                    {training.coach_attendance && training.coach_attendance.length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {training.coach_attendance.some(ca => ca.is_mandatory) && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <UserIcon size={14} className="text-blue-600" />
                                                                    <span className="text-xs font-semibold text-blue-600 uppercase">Pflicht:</span>
                                                                    <span className="text-blue-700">
                                                                        {training.coach_attendance.filter(ca => ca.is_mandatory).map(ca => ca.coaches?.name).join(', ')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {training.coach_attendance.some(ca => !ca.is_mandatory) && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <UserIcon size={14} className="text-green-600" />
                                                                    <span className="text-xs font-semibold text-green-600 uppercase">Zusatz:</span>
                                                                    <span className="text-green-700">
                                                                        {training.coach_attendance.filter(ca => !ca.is_mandatory).map(ca => ca.coaches?.name).join(', ')}
                                                                    </span>
                                                                </div>
                                                            )}
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
                                                        onClick={() => {
                                                            setEditingId(null)
                                                            setEditMandatoryCoachIds([])
                                                            setEditAdditionalCoachIds([])
                                                        }}
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
                                                            setEditMandatoryCoachIds(
                                                                training.coach_attendance
                                                                    ?.filter(ca => ca.is_mandatory)
                                                                    .map(ca => ca.coach_id) ?? []
                                                            )
                                                            setEditAdditionalCoachIds(
                                                                training.coach_attendance
                                                                    ?.filter(ca => !ca.is_mandatory)
                                                                    .map(ca => ca.coach_id) ?? []
                                                            )
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
