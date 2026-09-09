import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import type { Coach } from '../../types/interfaces'
import { useToast } from '../Toast'
import { CalendarIcon, PlusIcon, SpinnerIcon } from '../Icons'
import { formatDateShortGerman } from '../../lib/absenceUtils'

interface QuickAddCardProps {
    existingDates: Set<string>
    coaches: Coach[]
    onTrainingCreated: () => void
}

// Berechnet den nächsten Wochentag (0=So, 1=Mo, ..., 5=Fr)
function getNextDateForDayOfWeek(dayOfWeek: number, fromDate = new Date()): string {
    const d = new Date(fromDate)
    const currentDay = d.getDay()
    let diff = dayOfWeek - currentDay
    if (diff < 0) {
        diff += 7
    }
    d.setDate(d.getDate() + diff)
    return d.toISOString().split('T')[0]
}

export default function QuickAddCard({ existingDates, onTrainingCreated }: QuickAddCardProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)

    // Ermittle den nächsten noch nicht geplanten Freitag
    const nextFreeFriday = useMemo(() => {
        let testDate = new Date()
        for (let i = 0; i < 30; i++) {
            const dateStr = getNextDateForDayOfWeek(5, testDate)
            if (!existingDates.has(dateStr)) {
                return dateStr
            }
            const nextDay = new Date(dateStr + 'T00:00:00')
            nextDay.setDate(nextDay.getDate() + 1)
            testDate = nextDay
        }
        return null
    }, [existingDates])

    const handleQuickAdd = async () => {
        if (!nextFreeFriday) {
            toast.info('Alle Freitage der nächsten Wochen sind bereits geplant.')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase
                .from('trainings')
                .insert({
                    date: nextFreeFriday,
                    description: 'Reguläres Freitagstraining'
                })

            if (error) {
                toast.error('Fehler beim Erstellen: ' + error.message)
                return
            }

            toast.success(`Training für Freitag, ${formatDateShortGerman(nextFreeFriday)} angelegt!`)
            onTrainingCreated()
        } catch (err) {
            console.error('QuickAdd Fehler:', err)
            toast.error('Unerwarteter Fehler beim Erstellen.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-linear-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="p-2 bg-white/15 rounded-xl text-white">
                        <CalendarIcon size={20} />
                    </span>
                    <div>
                        <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider block">
                            Schnell-Aktion
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                            1-Klick Schnell-Planung
                        </h2>
                    </div>
                </div>
                <p className="text-xs sm:text-sm text-blue-100 pl-0.5">
                    {nextFreeFriday ? (
                        <>Nächster freier Freitag ist der <strong>{formatDateShortGerman(nextFreeFriday)}</strong>.</>
                    ) : (
                        <>Alle Freitage der nächsten Wochen sind bereits geplant.</>
                    )}
                </p>
            </div>

            <button
                type="button"
                onClick={handleQuickAdd}
                disabled={loading || !nextFreeFriday}
                className="w-full sm:w-auto px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm rounded-xl transition shadow-xs hover:shadow disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
                {loading ? (
                    <>
                        <SpinnerIcon size={18} />
                        <span>Wird angelegt...</span>
                    </>
                ) : (
                    <>
                        <PlusIcon size={18} />
                        <span>{nextFreeFriday ? `+ Freitag (${formatDateShortGerman(nextFreeFriday)}) anlegen` : 'Kein freier Freitag'}</span>
                    </>
                )}
            </button>
        </div>
    )
}
