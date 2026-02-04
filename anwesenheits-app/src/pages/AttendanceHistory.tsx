import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Training, Attendance, Coach, CoachAttendance } from '../types/interfaces'

interface TrainingWithAttendance extends Training {
    attendance: Attendance[]
    coach_attendance: (CoachAttendance & { coaches: Coach | null })[]
}

interface AttendanceHistoryProps {
    onBack: () => void
}

export default function AttendanceHistory({ onBack }: AttendanceHistoryProps) {
    const [pastTrainings, setPastTrainings] = useState<TrainingWithAttendance[]>([])
    const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null)
    const [editedAttendance, setEditedAttendance] = useState<Map<string, boolean>>(new Map())
    const [searchDate, setSearchDate] = useState('')

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
        fetchPastTrainings()
    }, [])

    const fetchPastTrainings = async () => {
        const { data, error } = await supabase
            .from('trainings')
            .select(`
                *,
                attendance (
                    *,
                    players:player_id (*)
                ),
                coach_attendance (
                    *,
                    coaches:coach_id (*)
                )
            `)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            console.error('Fehler beim Laden der Trainings:', error)
        } else if (data) {
            setPastTrainings(data as TrainingWithAttendance[])
        }
    }

    const startEditing = (training: TrainingWithAttendance) => {
        setEditingTrainingId(training.id)
        const attendanceMap = new Map<string, boolean>()
        training.attendance.forEach(att => {
            attendanceMap.set(att.id, att.is_present)
        })
        setEditedAttendance(attendanceMap)
    }

    const cancelEditing = () => {
        setEditingTrainingId(null)
        setEditedAttendance(new Map())
    }

    const saveEditing = async () => {
        try {
            const updates = Array.from(editedAttendance.entries()).map(([attId, isPresent]) => ({
                id: attId,
                is_present: isPresent
            }))

            for (const update of updates) {
                const { error } = await supabase
                    .from('attendance')
                    .update({ is_present: update.is_present })
                    .eq('id', update.id)

                if (error) throw error
            }

            await fetchPastTrainings()
            setEditingTrainingId(null)
            setEditedAttendance(new Map())
        } catch (error) {
            console.error('Fehler beim Speichern:', error)
            alert('Fehler beim Speichern der Änderungen')
        }
    }

    const toggleAttendanceEdit = (attId: string, currentValue: boolean) => {
        setEditedAttendance(prev => {
            const newMap = new Map(prev)
            newMap.set(attId, !currentValue)
            return newMap
        })
    }

    const deleteTraining = async (trainingId: string, trainingDate: string) => {
        if (!confirm(`Training vom ${formatDateGerman(trainingDate)} wirklich löschen?`)) {
            return
        }

        try {
            // Supabase wird automatisch attendance und coach_attendance löschen (CASCADE)
            const { error } = await supabase
                .from('trainings')
                .delete()
                .eq('id', trainingId)

            if (error) throw error

            await fetchPastTrainings()
        } catch (error) {
            console.error('Fehler beim Löschen:', error)
            alert('Fehler beim Löschen des Trainings')
        }
    }

    const filteredTrainings = searchDate
        ? pastTrainings.filter(t => t.date === searchDate)
        : pastTrainings

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Vergangene Trainings</h2>
                <button
                    onClick={onBack}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
                >
                    Zurück
                </button>
            </div>

            {/* Date Search */}
            <div className="mb-4">
                <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    placeholder="Nach Datum suchen..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchDate && (
                    <button
                        onClick={() => setSearchDate('')}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                        Filter zurücksetzen
                    </button>
                )}
            </div>
            {filteredTrainings.length === 0 ? (
                <p className="text-gray-500">{searchDate ? 'Keine Trainings für dieses Datum gefunden' : 'Keine vergangenen Trainings gefunden'}</p>
            ) : (
                <div className="space-y-4">
                    {filteredTrainings.map(training => {
                        const presentCount = training.attendance.filter(a => a.is_present).length
                        const totalCount = training.attendance.length
                        const isEditing = editingTrainingId === training.id

                        return (
                            <div key={training.id} className="border border-gray-200 rounded-lg p-4 bg-white/60">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800">
                                            {formatDateGerman(training.date)}
                                        </h3>
                                        {training.description && (
                                            <p className="text-gray-600 italic">{training.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-600">
                                            {presentCount}/{totalCount} anwesend
                                        </span>
                                        {!isEditing && (
                                            <>
                                                <button
                                                    onClick={() => startEditing(training)}
                                                    className="text-blue-600 hover:text-blue-800 px-2"
                                                    title="Bearbeiten"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => deleteTraining(training.id, training.date)}
                                                    className="text-red-600 hover:text-red-800 px-2"
                                                    title="Löschen"
                                                >
                                                    🗑️
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <details className="mt-2" open={isEditing}>
                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                        Details anzeigen
                                    </summary>
                                    <div className="mt-3 space-y-2">
                                        {training.coach_attendance && training.coach_attendance.length > 0 && (
                                            <div className="mb-4 pb-3 border-b border-gray-200">
                                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Trainer:</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {training.coach_attendance.map(ca => (
                                                        <span key={ca.id} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                                                            {ca.coaches?.name || 'Unbekannt'}
                                                            {ca.coaches?.role && (
                                                                <span className="text-xs ml-1">({ca.coaches.role})</span>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Spieler:</h4>
                                        {training.attendance.map(att => {
                                            const currentValue = isEditing
                                                ? (editedAttendance.get(att.id) ?? att.is_present)
                                                : att.is_present

                                            return (
                                                <div key={att.id} className="flex justify-between items-center py-2">
                                                    <span className="text-gray-700">
                                                        {att.players?.name || 'Unbekannt'}
                                                    </span>
                                                    {isEditing ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => toggleAttendanceEdit(att.id, currentValue)}
                                                                className={`px-4 py-1 rounded text-sm font-medium transition ${currentValue
                                                                    ? 'bg-green-500 text-white'
                                                                    : 'bg-gray-200 text-gray-700'
                                                                    }`}
                                                            >
                                                                Anwesend
                                                            </button>
                                                            <button
                                                                onClick={() => toggleAttendanceEdit(att.id, currentValue)}
                                                                className={`px-4 py-1 rounded text-sm font-medium transition ${!currentValue
                                                                    ? 'bg-red-500 text-white'
                                                                    : 'bg-gray-200 text-gray-700'
                                                                    }`}
                                                            >
                                                                Abwesend
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className={`px-3 py-1 rounded text-sm font-medium ${currentValue
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                            }`}>
                                                            {currentValue ? 'Anwesend' : 'Abwesend'}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {isEditing && (
                                        <div className="mt-4 flex gap-2 justify-end">
                                            <button
                                                onClick={cancelEditing}
                                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                                            >
                                                Abbrechen
                                            </button>
                                            <button
                                                onClick={() => saveEditing()}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                                            >
                                                Speichern
                                            </button>
                                        </div>
                                    )}
                                </details>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
