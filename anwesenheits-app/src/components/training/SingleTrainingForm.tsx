import { useState } from 'react'
import type { Coach, CoachAbsence } from '../../types/interfaces'
import { PlusIcon, UserIcon, CheckIcon, SpinnerIcon } from '../Icons'
import { useConfirm } from '../ConfirmModal'
import { getCoachAbsenceMapForDate, formatAbsenceGerman } from '../../lib/absenceUtils'

interface SingleTrainingFormProps {
    coaches: Coach[]
    absences: CoachAbsence[]
    onCreateTraining: (
        date: string,
        description: string,
        mandatoryCoachIds: string[],
        additionalCoachIds: string[]
    ) => Promise<boolean>
}

export default function SingleTrainingForm({
    coaches,
    absences,
    onCreateTraining
}: SingleTrainingFormProps) {
    const { confirm } = useConfirm()

    const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0])
    const [newDescription, setNewDescription] = useState('')
    const [selectedMandatoryCoachIds, setSelectedMandatoryCoachIds] = useState<string[]>([])
    const [selectedAdditionalCoachIds, setSelectedAdditionalCoachIds] = useState<string[]>([])
    const [creatingTraining, setCreatingTraining] = useState(false)

    const absenceMapForNewDate = getCoachAbsenceMapForDate(absences, newDate)

    async function toggleMandatoryCoach(coachId: string) {
        const isSelecting = !selectedMandatoryCoachIds.includes(coachId)
        if (isSelecting && absenceMapForNewDate.has(coachId)) {
            const absence = absenceMapForNewDate.get(coachId)!
            const coach = coaches.find(c => c.id === coachId)
            const confirmed = await confirm({
                title: 'Trainer abwesend',
                message: `Hinweis: ${coach?.name || 'Dieser Trainer'} ist an diesem Tag als abwesend eingetragen (${formatAbsenceGerman(absence)}).\n\nTrotzdem als Pflichttrainer einteilen?`,
                confirmText: 'Trotzdem einteilen',
                cancelText: 'Abbrechen',
                isDanger: false,
            })
            if (!confirmed) return
        }

        setSelectedMandatoryCoachIds(prev => {
            if (prev.includes(coachId)) return prev.filter(id => id !== coachId)
            if (prev.length >= 2) return prev
            return [...prev, coachId]
        })
    }

    async function toggleAdditionalCoach(coachId: string) {
        const isSelecting = !selectedAdditionalCoachIds.includes(coachId)
        if (isSelecting && absenceMapForNewDate.has(coachId)) {
            const absence = absenceMapForNewDate.get(coachId)!
            const coach = coaches.find(c => c.id === coachId)
            const confirmed = await confirm({
                title: 'Trainer abwesend',
                message: `Hinweis: ${coach?.name || 'Dieser Trainer'} ist an diesem Tag als abwesend eingetragen (${formatAbsenceGerman(absence)}).\n\nTrotzdem als Zusatztrainer einteilen?`,
                confirmText: 'Trotzdem einteilen',
                cancelText: 'Abbrechen',
                isDanger: false,
            })
            if (!confirmed) return
        }

        setSelectedAdditionalCoachIds(prev =>
            prev.includes(coachId)
                ? prev.filter(id => id !== coachId)
                : [...prev, coachId]
        )
    }

    async function handleSubmit() {
        setCreatingTraining(true)
        try {
            const success = await onCreateTraining(
                newDate,
                newDescription,
                selectedMandatoryCoachIds,
                selectedAdditionalCoachIds
            )
            if (success) {
                setNewDescription('')
                setSelectedMandatoryCoachIds([])
                setSelectedAdditionalCoachIds([])
            }
        } finally {
            setCreatingTraining(false)
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <PlusIcon size={20} className="text-blue-600" />
                <span>Einzeltraining planen</span>
            </h2>

            <div className="space-y-3.5">
                {/* Datum */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                        Datum *
                    </label>
                    <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Beschreibung */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                        Beschreibung (optional)
                    </label>
                    <input
                        type="text"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="z. B. Techniktraining, Taktik, Aufschlag..."
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Pflichttrainer */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-blue-700">
                            Pflichttrainer (max. 2)
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            selectedMandatoryCoachIds.length >= 2
                                ? 'bg-amber-100 text-amber-800'
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
                            const coachAbsence = absenceMapForNewDate.get(coach.id)
                            return (
                                <button
                                    key={coach.id}
                                    type="button"
                                    onClick={() => !isDisabled && toggleMandatoryCoach(coach.id)}
                                    disabled={isDisabled}
                                    title={coachAbsence ? `Achtung: ${coach.name} ist abwesend (${formatAbsenceGerman(coachAbsence)})` : undefined}
                                    className={`px-4 py-2 rounded-xl border text-sm transition flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
                                        isDisabled
                                            ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                            : isSelected
                                            ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <UserIcon size={15} />
                                    <span>{coach.name}</span>
                                    {coachAbsence && (
                                        <span className="text-[10px] bg-red-100 text-red-800 px-1 rounded font-bold">
                                            Abwesend
                                        </span>
                                    )}
                                    {isSelected && <CheckIcon size={15} />}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Zusatztrainer */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-emerald-700">
                            Zusatztrainer (freiwillig)
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {coaches.map(coach => {
                            const isSelected = selectedAdditionalCoachIds.includes(coach.id)
                            const isAlreadyMandatory = selectedMandatoryCoachIds.includes(coach.id)
                            const isDisabled = isAlreadyMandatory
                            const coachAbsence = absenceMapForNewDate.get(coach.id)
                            return (
                                <button
                                    key={coach.id}
                                    type="button"
                                    onClick={() => !isDisabled && toggleAdditionalCoach(coach.id)}
                                    disabled={isDisabled}
                                    title={coachAbsence ? `Achtung: ${coach.name} ist abwesend (${formatAbsenceGerman(coachAbsence)})` : undefined}
                                    className={`px-4 py-2 rounded-xl border text-sm transition flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
                                        isDisabled
                                            ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                            : isSelected
                                            ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <UserIcon size={15} />
                                    <span>{coach.name}</span>
                                    {coachAbsence && (
                                        <span className="text-[10px] bg-red-100 text-red-800 px-1 rounded font-bold">
                                            Abwesend
                                        </span>
                                    )}
                                    {isSelected && <CheckIcon size={15} />}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Button: Training erstellen */}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={creatingTraining || !newDate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-base min-h-[48px]"
            >
                {creatingTraining ? (
                    <>
                        <SpinnerIcon size={18} />
                        <span>Erstelle Training...</span>
                    </>
                ) : (
                    <>
                        <CheckIcon size={18} />
                        <span>Training erstellen</span>
                    </>
                )}
            </button>
        </div>
    )
}
