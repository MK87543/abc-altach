import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Training, Attendance, Coach, CoachAttendance } from '../types/interfaces'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { useUrlQueryParam } from '../lib/urlUtils'
import {
    SpinnerIcon,
    EditIcon,
    TrashIcon,
    ChevronLeftIcon,
    CheckIcon,
    CalendarIcon,
    ClockIcon
} from '../components/Icons'

interface TrainingWithAttendance extends Training {
    attendance: Attendance[]
    coach_attendance: (CoachAttendance & { coaches: Coach | null })[]
}

interface AttendanceHistoryProps {
    onBack?: () => void
}

function getRelativeDateLabel(dateStr: string, todayStr: string): string {
    if (dateStr === todayStr) return 'Heute'
    const d1 = new Date(dateStr + 'T00:00:00')
    const d2 = new Date(todayStr + 'T00:00:00')
    const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) return 'Morgen'
    if (diffDays === 2) return 'Übermorgen'
    if (diffDays > 2 && diffDays <= 7) return `In ${diffDays} Tagen`
    if (diffDays > 7 && diffDays <= 14) return 'Nächste Woche'
    if (diffDays < 0) return 'Vergangen'
    return ''
}

export default function AttendanceHistory({ onBack }: AttendanceHistoryProps) {
    const { toast } = useToast()
    const { confirm } = useConfirm()

    const [pastTrainings, setPastTrainings] = useState<TrainingWithAttendance[]>([])
    const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null)
    const [editedAttendance, setEditedAttendance] = useState<Map<string, boolean>>(new Map())
    const [searchDate, setSearchDate] = useUrlQueryParam<string>('histDate', '')
    const [statusFilter, setStatusFilter] = useUrlQueryParam<'all' | 'recorded' | 'unrecorded'>('histStatus', 'all')
    const [isSaving, setIsSaving] = useState(false)
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

    const todayStr = new Date().toISOString().split('T')[0]

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
            .limit(100)

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
        setIsSaving(true)
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
            toast.success('Änderungen erfolgreich gespeichert.')
        } catch (error) {
            console.error('Fehler beim Speichern:', error)
            toast.error('Fehler beim Speichern der Änderungen')
        } finally {
            setIsSaving(false)
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
        const confirmed = await confirm({
            title: 'Training löschen',
            message: `Training vom ${formatDateGerman(trainingDate)} wirklich löschen? Alle zugehörigen Daten gehen verloren.`,
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            isDanger: true,
        })
        if (!confirmed) {
            return
        }

        setIsDeletingId(trainingId)
        try {
            // Supabase wird automatisch attendance und coach_attendance löschen (CASCADE)
            const { error } = await supabase
                .from('trainings')
                .delete()
                .eq('id', trainingId)

            if (error) throw error

            await fetchPastTrainings()
            toast.success('Training erfolgreich gelöscht.')
        } catch (error) {
            console.error('Fehler beim Löschen:', error)
            toast.error('Fehler beim Löschen des Trainings')
        } finally {
            setIsDeletingId(null)
        }
    }

    // Gefilterte Termine nach Suchdatum
    const filteredTrainings = useMemo(() => {
        return searchDate
            ? pastTrainings.filter(t => t.date === searchDate)
            : pastTrainings
    }, [pastTrainings, searchDate])

    // 1. Bereits erfasste Trainings (mind. 1 Datensatz in attendance)
    const recordedTrainings = useMemo(() => {
        return filteredTrainings.filter(t => t.attendance && t.attendance.length > 0)
    }, [filteredTrainings])

    // 2. Zukünftige oder offene Trainings (noch keine attendance erfasst)
    const unrecordedTrainings = useMemo(() => {
        const list = filteredTrainings.filter(t => !t.attendance || t.attendance.length === 0)
        // Zukünftige chronologisch aufsteigend (nächstes zuerst), vergangene danach absteigend
        return list.sort((a, b) => {
            const aFuture = a.date >= todayStr
            const bFuture = b.date >= todayStr
            if (aFuture && bFuture) return a.date.localeCompare(b.date)
            if (aFuture && !bFuture) return -1
            if (!aFuture && bFuture) return 1
            return b.date.localeCompare(a.date)
        })
    }, [filteredTrainings, todayStr])

    // Einzelne Trainingskarte rendern
    const renderTrainingCard = (training: TrainingWithAttendance) => {
        const hasAttendance = Boolean(training.attendance && training.attendance.length > 0)
        const presentCount = training.attendance?.filter(a => a.is_present).length || 0
        const totalCount = training.attendance?.length || 0
        const isEditing = editingTrainingId === training.id
        const isFuture = training.date > todayStr
        const isToday = training.date === todayStr
        const relativeLabel = getRelativeDateLabel(training.date, todayStr)

        return (
            <div
                key={training.id}
                className={`border rounded-2xl p-4 transition shadow-2xs ${hasAttendance
                    ? 'bg-white border-slate-200 hover:border-slate-300'
                    : isFuture
                        ? 'bg-blue-50/50 border-blue-200 hover:border-blue-300'
                        : isToday
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                    }`}
            >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
                            {formatDateGerman(training.date)}
                        </h3>
                        {training.description && (
                            <p className="text-slate-600 text-xs sm:text-sm mt-0.5">{training.description}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        {/* Status-Badge */}
                        {hasAttendance ? (
                            <span className="text-xs font-bold px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg flex items-center gap-1 shrink-0">
                                <CheckIcon size={14} />
                                <span>{presentCount}/{totalCount} anwesend</span>
                            </span>
                        ) : isFuture ? (
                            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg flex items-center gap-1 shrink-0">
                                <CalendarIcon size={14} />
                                <span>Zukünftig {relativeLabel ? `(${relativeLabel})` : ''}</span>
                            </span>
                        ) : isToday ? (
                            <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg flex items-center gap-1 shrink-0">
                                <span>⚡ Heute (Offen)</span>
                            </span>
                        ) : (
                            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg flex items-center gap-1 shrink-0">
                                <ClockIcon size={14} />
                                <span>Nicht erfasst</span>
                            </span>
                        )}

                        {/* Aktionen */}
                        <div className="flex items-center gap-1 shrink-0">
                            {hasAttendance && !isEditing && (
                                <button
                                    onClick={() => startEditing(training)}
                                    className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                                    title="Anwesenheit bearbeiten"
                                >
                                    <EditIcon size={18} />
                                </button>
                            )}
                            <button
                                onClick={() => deleteTraining(training.id, training.date)}
                                disabled={isDeletingId === training.id}
                                className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition cursor-pointer disabled:opacity-50 min-h-[40px] min-w-[40px] flex items-center justify-center"
                                title="Training löschen"
                            >
                                {isDeletingId === training.id ? <SpinnerIcon size={18} /> : <TrashIcon size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Trainer-Anzeige wenn keine Spieleranwesenheit vorhanden */}
                {!hasAttendance && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/60">
                        {training.coach_attendance && training.coach_attendance.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="font-bold text-slate-500 mr-1">Eingeteilte Trainer:</span>
                                {training.coach_attendance.map(ca => (
                                    <span
                                        key={ca.id}
                                        className={`px-2 py-0.5 rounded-md font-semibold ${ca.is_mandatory
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-green-100 text-green-800'
                                            }`}
                                    >
                                        {ca.coaches?.name || 'Unbekannt'} {ca.is_mandatory ? '(Pflicht)' : '(Zusatz)'}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic">
                                Keine Trainer eingeteilt.
                            </p>
                        )}
                        <p className="mt-1.5 text-xs text-slate-400">
                            {isFuture
                                ? '🗓️ Geplantes Training – Spieler-Anwesenheit wird am Trainingstag erfasst.'
                                : isToday
                                    ? '⚡ Training für heute – Anwesenheit kann im Tab „Heute“ erfasst werden.'
                                    : '⏳ Vergangenes Training ohne gespeicherte Spielerliste.'}
                        </p>
                    </div>
                )}

                {/* Details & Spielerliste (wenn Anwesenheit vorhanden) */}
                {hasAttendance && (
                    <details className="mt-2.5 pt-2 border-t border-slate-100" open={isEditing}>
                        <summary className="cursor-pointer text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 select-none">
                            {isEditing ? 'Bearbeitungsmodus aktiv' : 'Details & Spielerliste anzeigen'}
                        </summary>
                        <div className="mt-3 space-y-2">
                            {training.coach_attendance && training.coach_attendance.length > 0 && (
                                <div className="mb-3 pb-2.5 border-b border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Trainer:</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {training.coach_attendance.map(ca => (
                                            <span
                                                key={ca.id}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${ca.is_mandatory
                                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                    : 'bg-green-50 text-green-700 border border-green-200'
                                                    }`}
                                            >
                                                {ca.coaches?.name || 'Unbekannt'} {ca.is_mandatory ? '(Pflicht)' : '(Zusatz)'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Spieler:</h4>
                            <div className="space-y-1.5">
                                {training.attendance.map(att => {
                                    const currentValue = isEditing
                                        ? (editedAttendance.get(att.id) ?? att.is_present)
                                        : att.is_present

                                    return (
                                        <div key={att.id} className="flex justify-between items-center py-1 px-2 rounded-lg bg-slate-50 text-xs sm:text-sm">
                                            <span className="font-medium text-slate-800">
                                                {att.players?.name || 'Unbekannt'}
                                            </span>
                                            {isEditing ? (
                                                <div className="flex gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAttendanceEdit(att.id, currentValue)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition min-h-[36px] cursor-pointer ${currentValue
                                                            ? 'bg-green-600 text-white shadow-xs'
                                                            : 'bg-slate-200 text-slate-600'
                                                            }`}
                                                    >
                                                        Anwesend
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAttendanceEdit(att.id, currentValue)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition min-h-[36px] cursor-pointer ${!currentValue
                                                            ? 'bg-red-600 text-white shadow-xs'
                                                            : 'bg-slate-200 text-slate-600'
                                                            }`}
                                                    >
                                                        Abwesend
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${currentValue
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
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
                                        type="button"
                                        onClick={cancelEditing}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition min-h-[40px] cursor-pointer font-semibold text-xs sm:text-sm"
                                    >
                                        Abbrechen
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => saveEditing()}
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer font-bold text-xs sm:text-sm min-h-[40px] shadow-xs"
                                    >
                                        {isSaving && <SpinnerIcon size={16} />}
                                        <span>{isSaving ? 'Speichert...' : 'Speichern'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </details>
                )}
            </div>
        )
    }

    return (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6 space-y-4">
            {/* Kopfzeile */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">Trainings-Historie</h2>
                    <p className="text-xs text-slate-500">Übersicht aller erfassten und geplanten Trainingseinheiten</p>
                </div>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800 px-3 py-2 rounded-xl transition text-xs sm:text-sm font-semibold cursor-pointer hover:bg-slate-100 min-h-[40px]"
                    >
                        <ChevronLeftIcon size={16} />
                        <span>Zurück</span>
                    </button>
                )}
            </div>

            {/* ── 3-Tab Filter: Erfasst vs. Zukünftig / Offen vs. Alle ── */}
            <div className="grid grid-cols-3 bg-slate-200/80 p-1 rounded-xl w-full shadow-2xs gap-1 text-xs font-bold">
                <button
                    type="button"
                    onClick={() => setStatusFilter('recorded')}
                    className={`py-2 px-1 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-center leading-tight ${statusFilter === 'recorded'
                        ? 'bg-white text-green-700 shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <CheckIcon size={14} className="shrink-0 text-green-600" />
                    <span className="truncate">
                        <span className="sm:hidden">Erfasst ({recordedTrainings.length})</span>
                        <span className="hidden sm:inline">Erfasste Trainings ({recordedTrainings.length})</span>
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter('unrecorded')}
                    className={`py-2 px-1 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-center leading-tight ${statusFilter === 'unrecorded'
                        ? 'bg-white text-blue-700 shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <CalendarIcon size={14} className="shrink-0 text-blue-600" />
                    <span className="truncate">
                        <span className="sm:hidden">Offen ({unrecordedTrainings.length})</span>
                        <span className="hidden sm:inline">Offen ({unrecordedTrainings.length})</span>
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`py-2 px-1 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-center leading-tight ${statusFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <span className="truncate">
                        <span className="sm:hidden">Alle ({filteredTrainings.length})</span>
                        <span className="hidden sm:inline">Alle anzeigen ({filteredTrainings.length})</span>
                    </span>
                </button>
            </div>

            {/* Datum-Suchfilter */}
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-slate-50"
                    placeholder="Datum filtern..."
                />
                {searchDate && (
                    <button
                        type="button"
                        onClick={() => setSearchDate('')}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 transition cursor-pointer"
                    >
                        Filter löschen
                    </button>
                )}
            </div>

            {/* ── Listen-Inhalt je nach Filter ── */}
            {filteredTrainings.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm font-medium">
                        {searchDate ? 'Keine Trainings für dieses Datum gefunden.' : 'Keine Trainings in der Datenbank vorhanden.'}
                    </p>
                </div>
            ) : statusFilter === 'recorded' ? (
                /* Nur erfasste Trainings */
                recordedTrainings.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-sm font-medium">Bislang wurden noch keine Trainings mit Anwesenheit erfasst.</p>
                        <p className="text-xs text-slate-400 mt-1">Im Tab „Zukünftig / Offen“ findest du alle geplanten Termine.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recordedTrainings.map(t => renderTrainingCard(t))}
                    </div>
                )
            ) : statusFilter === 'unrecorded' ? (
                /* Nur zukünftige / offene Trainings */
                unrecordedTrainings.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-sm font-medium">Keine zukünftigen oder offenen Trainings vorhanden.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {unrecordedTrainings.map(t => renderTrainingCard(t))}
                    </div>
                )
            ) : (
                /* Alle: Unterteilt in 2 Abschnitte (Zukünftig/Offen & Erfasst) */
                <div className="space-y-6">
                    {/* Abschnitt 1: Zukünftig & Offen */}
                    {unrecordedTrainings.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-1 border-b border-blue-200">
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                                    <CalendarIcon size={14} />
                                    <span>Zukünftige & offene Termine ({unrecordedTrainings.length})</span>
                                </span>
                            </div>
                            <div className="space-y-3">
                                {unrecordedTrainings.map(t => renderTrainingCard(t))}
                            </div>
                        </div>
                    )}

                    {/* Abschnitt 2: Erfasste Trainings */}
                    {recordedTrainings.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-1 border-b border-green-200">
                                <span className="text-xs font-bold uppercase tracking-wider text-green-700 flex items-center gap-1.5">
                                    <CheckIcon size={14} />
                                    <span>Erfasste Trainings mit Anwesenheit ({recordedTrainings.length})</span>
                                </span>
                                <span className="text-[11px] text-green-600 font-medium">Abgeschlossen</span>
                            </div>
                            <div className="space-y-3">
                                {recordedTrainings.map(t => renderTrainingCard(t))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

