import { useState } from 'react'
import type { Coach, CoachAbsence } from '../../types/interfaces'
import type { TrainingWithCoaches } from '../../hooks/useTrainingPlanner'
import {
    CalendarIcon,
    ClipboardIcon,
    EditIcon,
    TrashIcon,
    CircleIcon,
    UserIcon,
    CheckIcon
} from '../Icons'
import { getCoachAbsenceMapForDate } from '../../lib/absenceUtils'

interface PlannedTrainingsListProps {
    trainings: TrainingWithCoaches[]
    coaches: Coach[]
    absences: CoachAbsence[]
    onUpdateTraining: (
        id: string,
        description: string,
        mandatoryCoachIds: string[],
        additionalCoachIds: string[]
    ) => Promise<boolean>
    onDeleteTraining: (id: string) => Promise<boolean>
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
                <span className="font-bold text-red-600 text-xs tracking-wider">HEUTE</span>
            </span>
        )
    } else if (dateString === tomorrowStr) {
        prefixElement = (
            <span className="inline-flex items-center gap-1 mr-2">
                <CircleIcon className="text-amber-500" size={10} />
                <span className="font-bold text-amber-600 text-xs tracking-wider">MORGEN</span>
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
    onUpdateTraining,
    onDeleteTraining
}: PlannedTrainingsListProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editDescription, setEditDescription] = useState('')
    const [editMandatoryCoachIds, setEditMandatoryCoachIds] = useState<string[]>([])
    const [editAdditionalCoachIds, setEditAdditionalCoachIds] = useState<string[]>([])
    const [deletingId, setDeletingId] = useState<string | null>(null)

    function startEditing(training: TrainingWithCoaches) {
        setEditingId(training.id)
        setEditDescription(training.description || '')
        const mandatory = (training.coach_attendance || [])
            .filter(ca => ca.is_mandatory)
            .map(ca => ca.coach_id)
        const additional = (training.coach_attendance || [])
            .filter(ca => !ca.is_mandatory)
            .map(ca => ca.coach_id)
        setEditMandatoryCoachIds(mandatory)
        setEditAdditionalCoachIds(additional)
    }

    function cancelEditing() {
        setEditingId(null)
        setEditMandatoryCoachIds([])
        setEditAdditionalCoachIds([])
    }

    async function handleSaveEdit(id: string) {
        const success = await onUpdateTraining(
            id,
            editDescription,
            editMandatoryCoachIds,
            editAdditionalCoachIds
        )
        if (success) {
            cancelEditing()
        }
    }

    async function handleDelete(id: string) {
        setDeletingId(id)
        try {
            await onDeleteTraining(id)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ClipboardIcon size={20} className="text-slate-600" />
                <span>Geplante Trainings ({trainings.length})</span>
            </h2>

            {trainings.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-6">
                    Noch keine Trainings geplant. Erstelle dein erstes Training oben oder wechsle zur Saison-Planung.
                </p>
            ) : (
                <div className="space-y-2.5">
                    {trainings.map(training => {
                        const isToday = training.date === new Date().toISOString().split('T')[0]
                        const isEditing = editingId === training.id
                        const absenceMap = getCoachAbsenceMapForDate(absences, training.date)
                        const formatted = formatDateGerman(training.date)

                        return (
                            <div
                                key={training.id}
                                className={`p-3.5 rounded-xl border transition ${
                                    isToday
                                        ? 'bg-blue-50/70 border-blue-200'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                    <div className="flex-1 w-full">
                                        {/* Datum & Heute-Badge */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <CalendarIcon size={16} className="text-slate-400" />
                                            <span className="font-bold text-slate-800 text-sm sm:text-base flex items-center">
                                                {formatted.prefix}
                                                {formatted.dateStr}
                                            </span>
                                            {isToday && (
                                                <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                                    Heute
                                                </span>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            /* Inline-Bearbeitung */
                                            <div className="mt-3 space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                        Beschreibung
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                        placeholder="Beschreibung (optional)..."
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>

                                                {/* Pflichttrainer */}
                                                <div>
                                                    <span className="block text-xs font-semibold text-blue-700 mb-1.5">
                                                        Pflichttrainer ({editMandatoryCoachIds.length}/2)
                                                    </span>
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
                                                                    onClick={() => {
                                                                        setEditMandatoryCoachIds(prev =>
                                                                            prev.includes(coach.id)
                                                                                ? prev.filter(id => id !== coach.id)
                                                                                : [...prev, coach.id]
                                                                        )
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs border transition flex items-center gap-1.5 cursor-pointer min-h-[38px] ${
                                                                        isDisabled
                                                                            ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                                                            : isSelected
                                                                            ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                                                                            : 'bg-white border-slate-200 text-slate-700'
                                                                    }`}
                                                                >
                                                                    <UserIcon size={14} />
                                                                    <span>{coach.name}</span>
                                                                    {editAbsence && <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded font-bold">Abwesend</span>}
                                                                    {isSelected && <CheckIcon size={13} />}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Zusatztrainer */}
                                                <div>
                                                    <span className="block text-xs font-semibold text-emerald-700 mb-1.5">
                                                        Zusatztrainer
                                                    </span>
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
                                                                    onClick={() => {
                                                                        setEditAdditionalCoachIds(prev =>
                                                                            prev.includes(coach.id)
                                                                                ? prev.filter(id => id !== coach.id)
                                                                                : [...prev, coach.id]
                                                                        )
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs border transition flex items-center gap-1.5 cursor-pointer min-h-[38px] ${
                                                                        isAlreadyMandatory
                                                                            ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                                                            : isSelected
                                                                            ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                                                                            : 'bg-white border-slate-200 text-slate-700'
                                                                    }`}
                                                                >
                                                                    <UserIcon size={14} />
                                                                    <span>{coach.name}</span>
                                                                    {editAbsence && <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded font-bold">Abwesend</span>}
                                                                    {isSelected && <CheckIcon size={13} />}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Aktionen Bearbeitung */}
                                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                                                    <button
                                                        type="button"
                                                        onClick={cancelEditing}
                                                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition min-h-[40px] flex items-center"
                                                    >
                                                        Abbrechen
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveEdit(training.id)}
                                                        className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition min-h-[40px] flex items-center gap-1"
                                                    >
                                                        <CheckIcon size={14} />
                                                        <span>Speichern</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Normale Ansicht */
                                            <div>
                                                {training.description && (
                                                    <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
                                                        {training.description}
                                                    </p>
                                                )}

                                                {/* Trainer-Badges */}
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {training.coach_attendance && training.coach_attendance.length > 0 ? (
                                                        training.coach_attendance.map((ca, idx) => (
                                                            <span
                                                                key={idx}
                                                                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                                                    ca.is_mandatory
                                                                        ? 'bg-blue-100 text-blue-800'
                                                                        : 'bg-emerald-100 text-emerald-800'
                                                                }`}
                                                            >
                                                                <UserIcon size={11} />
                                                                <span>{ca.coaches?.name || 'Trainer'}</span>
                                                                {ca.is_mandatory && (
                                                                    <span className="text-[9px] opacity-75">(Pflicht)</span>
                                                                )}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic">
                                                            Keine Trainer eingeteilt
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons (wenn nicht im Edit-Modus) */}
                                    {!isEditing && (
                                        <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => startEditing(training)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                                                title="Bearbeiten"
                                            >
                                                <EditIcon size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(training.id)}
                                                disabled={deletingId === training.id}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                                                title="Löschen"
                                            >
                                                <TrashIcon size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
