import { useUrlQueryParam } from '../lib/urlUtils'
import {
    CalendarIcon,
    PlusIcon,
    UmbrellaIcon,
    SpinnerIcon,
    ClipboardIcon
} from '../components/Icons'
import { useTrainingPlanner } from '../hooks/useTrainingPlanner'
import SeasonPlanner from '../components/training/SeasonPlanner'
import SingleTrainingForm from '../components/training/SingleTrainingForm'
import PlannedTrainingsList from '../components/training/PlannedTrainingsList'
import CoachScheduleOverview from '../components/training/CoachScheduleOverview'
import CoachCalendar from './CoachCalendar'

interface TrainingPlannerProps {
    onBack?: () => void
    onOpenCalendar?: () => void
    hideHeader?: boolean
}

export default function TrainingPlanner({ onBack, onOpenCalendar, hideHeader }: TrainingPlannerProps) {
    // ── 4 Reiter: Einzeltraining vs. Trainer-Einteilung vs. Saison-Planung vs. Trainer-Urlaub ──
    const [planTab, setPlanTab] = useUrlQueryParam<'single' | 'schedule' | 'season' | 'calendar'>('plannerTab', 'single')

    const {
        trainings,
        coaches,
        absences,
        loadingData,
        existingDates,
        loadTrainings,
        createSingleTraining,
        updateTraining,
        deleteTraining
    } = useTrainingPlanner()

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            {!hideHeader && (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                            <CalendarIcon size={26} className="text-blue-600" />
                            <span>Trainings planen</span>
                        </h1>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {onOpenCalendar && (
                                <button
                                    type="button"
                                    onClick={onOpenCalendar}
                                    className="flex items-center gap-1.5 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-2 rounded-lg transition cursor-pointer"
                                    title="Trainer-Abwesenheiten und Urlaub anzeigen"
                                >
                                    <UmbrellaIcon size={15} />
                                    <span>Trainer-Kalender</span>
                                </button>
                            )}
                            {onBack && (
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-lg transition text-xs font-semibold cursor-pointer"
                                >
                                    Zurück
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 4 REITER (Tabs): Einzeltraining, Trainer-Einteilung, Saisonplanung & Trainer-Urlaub ── */}
            <div className="grid grid-cols-4 bg-slate-200/80 p-1 rounded-xl max-w-2xl w-full shadow-2xs gap-1">
                <button
                    type="button"
                    onClick={() => setPlanTab('single')}
                    className={`py-2 px-1 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] text-center leading-tight ${
                        planTab === 'single'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <CalendarIcon size={16} className="shrink-0" />
                    <span className="truncate max-w-full">
                        <span className="sm:hidden">Einzel</span>
                        <span className="hidden sm:inline">Einzeltraining</span>
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setPlanTab('schedule')}
                    className={`py-2 px-1 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] text-center leading-tight ${
                        planTab === 'schedule'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <ClipboardIcon size={16} className="shrink-0" />
                    <span className="truncate max-w-full">
                        <span className="sm:hidden">Einteilung</span>
                        <span className="hidden sm:inline">Trainer-Einteilung</span>
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setPlanTab('season')}
                    className={`py-2 px-1 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] text-center leading-tight ${
                        planTab === 'season'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <PlusIcon size={16} className="shrink-0" />
                    <span className="truncate max-w-full">
                        <span className="sm:hidden">Saison</span>
                        <span className="hidden sm:inline">Saison-Planung</span>
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setPlanTab('calendar')}
                    className={`py-2 px-1 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] text-center leading-tight ${
                        planTab === 'calendar'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <UmbrellaIcon size={16} className="shrink-0" />
                    <span className="truncate max-w-full">
                        <span className="sm:hidden">Urlaub</span>
                        <span className="hidden sm:inline">Trainer-Urlaub</span>
                    </span>
                </button>
            </div>

            {/* ── REITER-INHALT ── */}
            {loadingData ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <SpinnerIcon size={28} className="text-blue-600 mb-2" />
                    <span className="text-xs text-slate-500 font-medium">Lade Daten...</span>
                </div>
            ) : planTab === 'calendar' ? (
                /* ── REITER 4: Trainer-Urlaub / Kalender ── */
                <CoachCalendar onBack={() => setPlanTab('single')} hideHeader={true} />
            ) : planTab === 'season' ? (
                /* ── REITER 3: Saison-Planung ── */
                <SeasonPlanner
                    coaches={coaches}
                    absences={absences}
                    existingDates={existingDates}
                    onTrainingsCreated={async () => {
                        await loadTrainings()
                        setPlanTab('single')
                    }}
                />
            ) : planTab === 'schedule' ? (
                /* ── REITER 2: Trainer-Einteilung ── */
                <CoachScheduleOverview
                    trainings={trainings}
                    coaches={coaches}
                    absences={absences}
                    onNavigateToPlan={() => setPlanTab('single')}
                />
            ) : (
                /* ── REITER 1: Einzeltraining ── */
                <div className="space-y-6">
                    <SingleTrainingForm
                        coaches={coaches}
                        absences={absences}
                        onCreateTraining={createSingleTraining}
                    />

                    <PlannedTrainingsList
                        trainings={trainings}
                        coaches={coaches}
                        absences={absences}
                        onUpdateTraining={updateTraining}
                        onDeleteTraining={deleteTraining}
                    />
                </div>
            )}
        </div>
    )
}
