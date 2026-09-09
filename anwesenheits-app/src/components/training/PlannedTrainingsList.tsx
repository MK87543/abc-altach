import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import type { Coach, CoachAbsence, Training } from '../../types/interfaces'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmModal'
import {
    CalendarIcon,
    CheckIcon,
    XIcon,
    EditIcon,
    TrashIcon,
    CircleIcon,
    UserIcon,
    SpinnerIcon,
    PlusIcon
} from '../Icons'
import { getCoachAbsenceMapForDate, formatAbsenceGerman } from '../../lib/absenceUtils'

export interface TrainingWithCoaches extends Training {
    coach_attendance?: {
        coach_id: string
        is_mandatory: boolean
        coaches: { name: string }
    }[]
}

interface PlannedTrainingsListProps {
    trainings: TrainingWithCoaches[]
    coaches: Coach[]
    absences: CoachAbsence[]
    onRefresh: () => Promise<void>
    onSwitchToPlan?: () => void
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
                <CircleIcon className="text-emerald-500 fill-emerald-500" size={10} />
                <span className="font-bold text-emerald-700 text-xs tracking-wider">HEUTE</span>
            </span>
        )
    } else if (dateString === tomorrowStr) {
        prefixElement = (
            <span className="inline-flex items-center gap-1 mr-2">
                <CircleIcon className="text-amber-500 fill-amber-500" size={10} />
                <span className="font-bold text-amber-700 text-xs tracking-wider">MORGEN</span>
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

export default function PlannedTrainingsList({
    trainings,
    coaches,
    absences,
    onRefresh,
    onSwitchToPlan
}: PlannedTrainingsListProps) {
    const { toast } = useToast()
    const { confirm } = useConfirm()

    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editDescription, setEditDescription] = useState('')
    const [editMandatoryCoachIds, setEditMandatoryCoachIds] = useState<string[]>([])
    const [editAdditionalCoachIds, setEditAdditionalCoachIds] = useState<string[]>([])
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [savingEdit, setSavingEdit] = useState(false)

    // Filter trainings by search
    const filteredTrainings = useMemo(() => {
        if (!searchQuery.trim()) return trainings
        const q = searchQuery.toLowerCase()
        return trainings.filter(t => {
            if (t.date.toLowerCase().includes(q)) return true
            if (t.description?.toLowerCase().includes(q)) return true
            const hasCoachMatch = t.coach_attendance?.some(ca =>
                ca.coaches?.name?.toLowerCase().includes(q)
            )
            return Boolean(hasCoachMatch)
        })
    }, [trainings, searchQuery])

    const startEditing = (training: TrainingWithCoaches) => {
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
    }

    const cancelEditing = () => {
        setEditingId(null)
        setEditDescription('')
        setEditMandatoryCoachIds([])
        setEditAdditionalCoachIds([])
    }

    const saveEdit = async (trainingId: string) => {
        setSavingEdit(true)
        try {
            // 1. Update description
            const { error: descError } = await supabase
                .from('trainings')
                .update({ description: editDescription.trim() || null })
                .eq('id', trainingId)

            if (descError) {
                toast.error('Fehler beim Aktualisieren: ' + descError.message)
                return
            }

            // 2. Delete existing coach_attendance and insert updated
            await supabase.from('coach_attendance').delete().eq('training_id', trainingId)

            const allCoachInserts = [
                ...editMandatoryCoachIds.map(coachId => ({
                    training_id: trainingId,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: true
                })),
                ...editAdditionalCoachIds.map(coachId => ({
                    training_id: trainingId,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: false
                }))
            ]

            if (allCoachInserts.length > 0) {
                await supabase.from('coach_attendance').insert(allCoachInserts)
            }

            cancelEditing()
            await onRefresh()
            toast.success('Training erfolgreich aktualisiert!')
        } catch (err) {
            console.error('Update training error:', err)
            toast.error('Fehler beim Speichern der Änderungen.')
        } finally {
            setSavingEdit(false)
        }
    }

    const handleDelete = async (trainingId: string, dateStr: string) => {
        const confirmed = await confirm({
            title: 'Training löschen',
            message: `Möchtest du das Training am ${dateStr} wirklich löschen? Alle zugehörigen Anwesenheitsdaten gehen unwiderruflich verloren.`,
            confirmText: 'Unwiderruflich löschen',
            cancelText: 'Abbrechen',
            isDanger: true,
        })
        if (!confirmed) return

        setDeletingId(trainingId)
        try {
            await supabase.from('attendance').delete().eq('training_id', trainingId)
            await supabase.from('coach_attendance').delete().eq('training_id', trainingId)

            const { error } = await supabase
                .from('trainings')
                .delete()
                .eq('id', trainingId)

            if (error) {
                toast.error('Fehler beim Löschen: ' + error.message)
            } else {
                await onRefresh()
                toast.success('Training gelöscht.')
            }
        } catch (err) {
            console.error('Delete training error:', err)
            toast.error('Unerwarteter Fehler beim Löschen.')
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-4">
            {/* Kopfbereich mit Suchfeld und Statistik */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-xs border border-slate-100">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">
                        Geplante Trainings
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {trainings.length}
                    </span>
                </div>

                <div className="w-full sm:w-64">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Datum, Beschreibung, Trainer..."
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                </div>
            </div>

            {/* Liste der Trainings */}
            {filteredTrainings.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                        <CalendarIcon size={24} />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">
                        {trainings.length === 0 ? 'Noch keine Trainings geplant' : 'Keine Treffer gefunden'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                        {trainings.length === 0
                            ? 'Nutze die Schnell-Planung oder den Serien-Generator, um zukünftige Trainings anzulegen.'
                            : 'Passe deinen Suchfilter an, um geplante Trainings anzuzeigen.'}
                    </p>
                    {onSwitchToPlan && trainings.length === 0 && (
                        <button
                            type="button"
                            onClick={onSwitchToPlan}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                        >
                            <PlusIcon size={16} />
                            <span>Jetzt Trainings planen</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredTrainings.map(training => {
                        const isToday = training.date === new Date().toISOString().split('T')[0]
                        const isEditing = editingId === training.id
                        const formatted = formatDateGerman(training.date)
                        const absenceMap = getCoachAbsenceMapForDate(absences, training.date)

                        return (
                            <div
                                key={training.id}
                                className={`p-4 sm:p-5 rounded-2xl transition border ${
                                    isToday
                                        ? 'bg-blue-50/60 border-blue-200 shadow-xs'
                                        : 'bg-white border-slate-100 hover:border-slate-200 shadow-2xs'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="flex-1 w-full">
                                        {/* Datum & Heute-Badge */}
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <CalendarIcon size={16} className="text-slate-400" />
                                            <span className="font-bold text-slate-800 text-sm sm:text-base flex items-center">
                                                {formatted.prefix}
                                                {formatted.dateStr}
                                            </span>
                                            {isToday && (
                                                <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                    Heute
                                                </span>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            /* Bearbeitungs-Modus */
                                            <div className="mt-3 space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                        Beschreibung
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                        placeholder="z. B. Meisterschaftsvorbereitung..."
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>

                                                {/* Pflichttrainer */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-semibold text-blue-700">
                                                            Pflichttrainer
                                                        </span>
                                                        <span className={`text-[11px] font-bold px-2 py-0.2 rounded-full ${
                                                            editMandatoryCoachIds.length >= 2
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {editMandatoryCoachIds.length}/2
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {coaches.map(coach => {
                                                            const isSelected = editMandatoryCoachIds.includes(coach.id)
                                                            const isAlreadyAdditional = editAdditionalCoachIds.includes(coach.id)
                                                            const isDisabled = isAlreadyAdditional || (!isSelected && editMandatoryCoachIds.length >= 2)
                                                            const editAbsence = absenceMap.get(coach.id)

                                                            return (
                                                                <button
                                                                    key={coach.id}
                                                                    type="button"
                                                                    disabled={isDisabled}
                                                                    title={editAbsence ? `Achtung: ${coach.name} ist abwesend (${formatAbsenceGerman(editAbsence)})` : undefined}
                                                                    onClick={async () => {
                                                                        if (isDisabled) return
                                                                        if (!isSelected && editAbsence) {
                                                                            const confirmed = await confirm({
                                                                                title: 'Trainer abwesend',
                                                                                message: `Hinweis: ${coach.name} ist an diesem Tag als abwesend eingetragen (${formatAbsenceGerman(editAbsence)}).\n\nTrotzdem als Pflichttrainer einteilen?`,
                                                                                confirmText: 'Trotzdem einteilen',
                                                                                cancelText: 'Abbrechen',
                                                                                isDanger: false,
                                                                            })
                                                                            if (!confirmed) return
                                                                        }
                                                                        setEditMandatoryCoachIds(prev =>
                                                                            prev.includes(coach.id)
                                                                                ? prev.filter(id => id !== coach.id)
                                                                                : [...prev, coach.id]
                                                                        )
                                                                    }}
                                                                    className={`px-2.5 py-1 rounded-lg border text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                                                        isDisabled
                                                                            ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                                                            : isSelected
                                                                            ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                                                                            : editAbsence
                                                                            ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                                                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    <UserIcon size={12} />
                                                                    <span>{coach.name}</span>
                                                                    {editAbsence && (
                                                                        <span className="text-[10px] bg-red-200 text-red-900 px-1 rounded-full font-bold">
                                                                            Abwesend
                                                                        </span>
                                                                    )}
                                                                    {isSelected && <CheckIcon size={12} />}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Zusatztrainer */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-semibold text-emerald-700">
                                                            Zusatztrainer (freiwillig)
                                                        </span>
                                                        {editAdditionalCoachIds.length > 0 && (
                                                            <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                                                                {editAdditionalCoachIds.length} gewählt
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {coaches.map(coach => {
                                                            const isSelected = editAdditionalCoachIds.includes(coach.id)
                                                            const isAlreadyMandatory = editMandatoryCoachIds.includes(coach.id)
                                                            const editAbsence = absenceMap.get(coach.id)

                                                            return (
                                                                <button
                                                                    key={coach.id}
                                                                    type="button"
                                                                    disabled={isAlreadyMandatory}
                                                                    title={editAbsence ? `Achtung: ${coach.name} ist abwesend (${formatAbsenceGerman(editAbsence)})` : undefined}
                                                                    onClick={async () => {
                                                                        if (isAlreadyMandatory) return
                                                                        if (!isSelected && editAbsence) {
                                                                            const confirmed = await confirm({
                                                                                title: 'Trainer abwesend',
                                                                                message: `Hinweis: ${coach.name} ist an diesem Tag als abwesend eingetragen (${formatAbsenceGerman(editAbsence)}).\n\nTrotzdem als Zusatztrainer einteilen?`,
                                                                                confirmText: 'Trotzdem einteilen',
                                                                                cancelText: 'Abbrechen',
                                                                                isDanger: false,
                                                                            })
                                                                            if (!confirmed) return
                                                                        }
                                                                        setEditAdditionalCoachIds(prev =>
                                                                            prev.includes(coach.id)
                                                                                ? prev.filter(id => id !== coach.id)
                                                                                : [...prev, coach.id]
                                                                        )
                                                                    }}
                                                                    className={`px-2.5 py-1 rounded-lg border text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                                                        isAlreadyMandatory
                                                                            ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                                                            : isSelected
                                                                            ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                                                                            : editAbsence
                                                                            ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                                                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    <UserIcon size={12} />
                                                                    <span>{coach.name}</span>
                                                                    {editAbsence && (
                                                                        <span className="text-[10px] bg-red-200 text-red-900 px-1 rounded-full font-bold">
                                                                            Abwesend
                                                                        </span>
                                                                    )}
                                                                    {isSelected && <CheckIcon size={12} />}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Anzeige-Modus */
                                            <>
                                                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                                                    {training.description || (
                                                        <span className="italic text-slate-400">Keine Beschreibung</span>
                                                    )}
                                                </p>

                                                {training.coach_attendance && training.coach_attendance.length > 0 && (
                                                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                                        {/* Pflicht */}
                                                        {training.coach_attendance.some(ca => ca.is_mandatory) && (
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                                                                    Pflicht:
                                                                </span>
                                                                {training.coach_attendance.filter(ca => ca.is_mandatory).map(ca => {
                                                                    const coachAbsence = absenceMap.get(ca.coach_id)
                                                                    return (
                                                                        <span
                                                                            key={ca.coach_id}
                                                                            className="inline-flex items-center gap-1 text-xs text-blue-900 font-semibold bg-blue-100/60 px-2 py-0.5 rounded-md"
                                                                        >
                                                                            {ca.coaches?.name}
                                                                            {coachAbsence && (
                                                                                <span
                                                                                    className="text-[9px] bg-red-100 text-red-800 border border-red-200 px-1 rounded-sm font-bold"
                                                                                    title={`Abwesend: ${formatAbsenceGerman(coachAbsence)}`}
                                                                                >
                                                                                    ⚠️ Abwesend
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Zusatz */}
                                                        {training.coach_attendance.some(ca => !ca.is_mandatory) && (
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                                                    Zusatz:
                                                                </span>
                                                                {training.coach_attendance.filter(ca => !ca.is_mandatory).map(ca => {
                                                                    const coachAbsence = absenceMap.get(ca.coach_id)
                                                                    return (
                                                                        <span
                                                                            key={ca.coach_id}
                                                                            className="inline-flex items-center gap-1 text-xs text-emerald-900 font-semibold bg-emerald-100/60 px-2 py-0.5 rounded-md"
                                                                        >
                                                                            {ca.coaches?.name}
                                                                            {coachAbsence && (
                                                                                <span
                                                                                    className="text-[9px] bg-red-100 text-red-800 border border-red-200 px-1 rounded-sm font-bold"
                                                                                    title={`Abwesend: ${formatAbsenceGerman(coachAbsence)}`}
                                                                                >
                                                                                    ⚠️ Abwesend
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled={savingEdit}
                                                    onClick={() => saveEdit(training.id)}
                                                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition text-xs flex items-center justify-center cursor-pointer shadow-xs"
                                                    title="Änderungen speichern"
                                                >
                                                    {savingEdit ? <SpinnerIcon size={16} /> : <CheckIcon size={16} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={savingEdit}
                                                    onClick={cancelEditing}
                                                    className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition text-xs flex items-center justify-center cursor-pointer"
                                                    title="Abbrechen"
                                                >
                                                    <XIcon size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => startEditing(training)}
                                                    className="p-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-xl transition text-xs flex items-center justify-center cursor-pointer"
                                                    title="Bearbeiten"
                                                >
                                                    <EditIcon size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={deletingId === training.id}
                                                    onClick={() => handleDelete(training.id, formatted.dateStr)}
                                                    className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-xl transition text-xs flex items-center justify-center cursor-pointer disabled:opacity-50"
                                                    title="Löschen"
                                                >
                                                    {deletingId === training.id ? <SpinnerIcon size={16} /> : <TrashIcon size={16} />}
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
    )
}
