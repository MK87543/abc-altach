import { useState, useEffect, type ReactElement } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach } from '../types/interfaces'
import { useActiveCoach } from '../hooks/useActiveCoach'
import { useUrlQueryParam } from '../lib/urlUtils'
import { useConfirm } from '../components/ConfirmModal'
import { useToast } from '../components/Toast'
import NewAttendance from './NewAttendance'
import AttendanceHistory from './AttendanceHistory'
import TrainingPlanner from './TrainingPlanner'
import ExportAttendance from './ExportAttendance'
import Statistics from './Statistics'
import ManageNew from './ManageNew'
import ManageEdit from './ManageEdit'
import CoachCalendar from './CoachCalendar'
import VereinHub from './VereinHub'
import { CheckIcon, ClipboardIcon, CalendarIcon, EditIcon, LogoutIcon, DownloadIcon, ChartIcon, PlusIcon, UserIcon, UmbrellaIcon } from '../components/Icons'

type View = 'attendance' | 'history' | 'planner' | 'statistics' | 'verwaltung' | 'manageNew' | 'manageEdit' | 'export' | 'coachCalendar' | 'verein'

export default function Dashboard() {
    const [currentView, setCurrentView] = useUrlQueryParam<View>('view', 'attendance')
    const navMode: '3pillar' | 'classic' = '3pillar'
    const { activeCoachId, setActiveCoach } = useActiveCoach()
    const [coaches, setCoaches] = useState<Coach[]>([])
    const { confirm } = useConfirm()
    const { toast } = useToast()

    useEffect(() => {
        supabase
            .from('coaches')
            .select('*')
            .eq('active', true)
            .order('name')
            .then(({ data }) => {
                if (data) setCoaches(data)
            })
    }, [])

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: 'Abmelden',
            message: 'Möchtest du dich wirklich abmelden?',
            confirmText: 'Abmelden',
            cancelText: 'Abbrechen',
            isDanger: true,
        })
        if (confirmed) {
            toast.info('Erfolgreich abgemeldet.')
            await supabase.auth.signOut()
        }
    }

    const navigateTo = (view: View) => {
        setCurrentView(view)
    }

    // ── 3-Säulen-Navigation (Neu) vs. 5-Tab-Navigation (Klassisch) ──
    const threePillarTabs: { view: View; label: string; icon: ReactElement }[] = [
        { view: 'attendance', label: 'Heute', icon: <CheckIcon size={20} /> },
        { view: 'planner', label: 'Termine', icon: <CalendarIcon size={20} /> },
        { view: 'verein', label: 'Verein', icon: <UserIcon size={20} /> },
    ]

    const classicTabs: { view: View; label: string; icon: ReactElement }[] = [
        { view: 'attendance', label: 'Heute', icon: <CheckIcon size={20} /> },
        { view: 'history', label: 'Historie', icon: <ClipboardIcon size={20} /> },
        { view: 'planner', label: 'Planung', icon: <CalendarIcon size={20} /> },
        { view: 'statistics', label: 'Statistik', icon: <ChartIcon size={20} /> },
        { view: 'verwaltung', label: 'Verwaltung', icon: <EditIcon size={20} /> },
    ]

    const currentTabs = navMode === '3pillar' ? threePillarTabs : classicTabs

    // Welcher Tab ist aktiv?
    const activeTab: View = navMode === '3pillar'
        ? (['verein', 'verwaltung', 'manageNew', 'manageEdit', 'export', 'history', 'statistics'].includes(currentView)
            ? 'verein'
            : (currentView === 'coachCalendar' ? 'planner' : currentView))
        : ((['manageNew', 'manageEdit', 'export', 'coachCalendar'] as View[]).includes(currentView)
            ? 'verwaltung'
            : currentView)

    // Aktuellen Seitentitel bestimmen
    const pageTitle: Record<View, string> = {
        attendance: 'Anwesenheit erfassen',
        history: 'Trainings-Historie',
        planner: navMode === '3pillar' ? 'Termine & Planung' : 'Trainings planen',
        statistics: 'Statistik',
        verwaltung: 'Verwaltung',
        manageNew: 'Neu hinzufügen',
        manageEdit: 'Bearbeiten',
        export: 'Excel Export',
        coachCalendar: 'Trainer-Abwesenheitskalender',
        verein: 'Vereinsverwaltung',
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* ── Fixer Header oben ── */}
            <header className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium leading-none">ABC Altach</p>
                        <h1 className="text-lg font-bold text-gray-800 leading-tight">{pageTitle[currentView] || 'ABC Altach'}</h1>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Aktiver Trainer (im Cookie gespeichert) */}
                        {coaches.length > 0 && (
                            <div className="hidden sm:flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-xs" title="Aktiver Trainer (wird im Cookie gespeichert)">
                                <UserIcon size={14} className="text-blue-600" />
                                <span className="text-blue-700 font-medium">Trainer:</span>
                                <select
                                    value={activeCoachId || ''}
                                    onChange={(e) => setActiveCoach(e.target.value || null)}
                                    className="bg-transparent text-blue-900 font-bold focus:outline-none cursor-pointer"
                                >
                                    <option value="">(Wählen...)</option>
                                    {coaches.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2.5 sm:px-3 py-1.5 rounded-lg transition text-xs sm:text-sm font-medium cursor-pointer"
                        >
                            <LogoutIcon size={16} />
                            <span className="hidden xs:inline">Abmelden</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Hauptinhalt ── */}
            <main className="flex-1 pb-20 sm:pb-24">
                {navMode === '3pillar' ? (
                    <>
                        {currentView === 'attendance' && (
                            <NewAttendance />
                        )}
                        {currentView === 'planner' && (
                            <TrainingPlanner
                                hideHeader={true}
                                onOpenCalendar={() => navigateTo('coachCalendar')}
                            />
                        )}
                        {currentView === 'coachCalendar' && (
                            <CoachCalendar
                                onBack={() => navigateTo('planner')}
                                hideHeader={true}
                            />
                        )}
                        {((['verein', 'verwaltung', 'history', 'statistics', 'export', 'manageNew', 'manageEdit'] as View[]).includes(currentView)) && (
                            <VereinHub />
                        )}
                    </>
                ) : (
                    <>
                        {currentView === 'attendance' && (
                            <NewAttendance />
                        )}
                        {currentView === 'history' && (
                            <AttendanceHistory />
                        )}
                        {currentView === 'planner' && (
                            <TrainingPlanner onOpenCalendar={() => navigateTo('coachCalendar')} />
                        )}
                        {currentView === 'statistics' && (
                            <Statistics />
                        )}
                        {currentView === 'verwaltung' && (
                            <VerwaltungHub
                                onNavigate={navigateTo}
                            />
                        )}
                        {currentView === 'manageNew' && (
                            <ManageNew onBack={() => navigateTo('verwaltung')} />
                        )}
                        {currentView === 'manageEdit' && (
                            <ManageEdit onBack={() => navigateTo('verwaltung')} />
                        )}
                        {currentView === 'export' && (
                            <ExportAttendance onBack={() => navigateTo('verwaltung')} />
                        )}
                        {currentView === 'coachCalendar' && (
                            <CoachCalendar onBack={() => navigateTo('verwaltung')} />
                        )}
                    </>
                )}
            </main>

            {/* ── Fixe untere Tab-Leiste (schlank & kompakt) ── */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-md z-50 safe-bottom-nav">
                <div className="max-w-4xl mx-auto flex">
                    {currentTabs.map((tab) => {
                        const isActive = activeTab === tab.view
                        return (
                            <button
                                key={tab.view}
                                onClick={() => navigateTo(tab.view)}
                                className={`flex-1 flex flex-col items-center justify-center py-1.5 sm:py-2 gap-0.5 transition-colors cursor-pointer relative min-h-[48px] sm:min-h-[50px] ${isActive
                                        ? 'text-blue-600'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <span className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-blue-50' : ''}`}>
                                    {tab.icon}
                                </span>
                                <span className={`text-[11px] sm:text-xs font-medium leading-tight ${isActive ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                                    {tab.label}
                                </span>
                                {isActive && (
                                    <span className="absolute bottom-0 h-[2.5px] w-8 bg-blue-600 rounded-t-full" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}

// ── Verwaltungs-Übersicht ──────────────────────────────────────────────────────
interface VerwaltungHubProps {
    onNavigate: (view: View) => void
}

function VerwaltungHub({ onNavigate }: VerwaltungHubProps) {
    const cards = [
        {
            view: 'coachCalendar' as View,
            icon: <UmbrellaIcon size={32} />,
            title: 'Trainer-Abwesenheiten & Urlaub',
            description: 'Urlaubszeiten eintragen oder wöchentliche Verhinderungen (z. B. jeden Dienstag)',
            color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
            iconColor: 'text-indigo-600',
        },
        {
            view: 'manageNew' as View,
            icon: <PlusIcon size={32} />,
            title: 'Spieler / Trainer hinzufügen',
            description: 'Neue Spieler oder Trainer in die App aufnehmen',
            color: 'bg-green-50 border-green-200 hover:bg-green-100',
            iconColor: 'text-green-600',
        },
        {
            view: 'manageEdit' as View,
            icon: <UserIcon size={32} />,
            title: 'Spieler / Trainer bearbeiten',
            description: 'Namen, Rollen ändern oder Personen deaktivieren',
            color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
            iconColor: 'text-blue-600',
        },
        {
            view: 'export' as View,
            icon: <DownloadIcon size={32} />,
            title: 'Excel Export',
            description: 'Anwesenheitsliste als Excel-Datei herunterladen',
            color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
            iconColor: 'text-purple-600',
        },
    ]

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
            <div className="flex flex-col gap-4">
                {cards.map((card) => (
                    <button
                        key={card.view}
                        onClick={() => onNavigate(card.view)}
                        className={`w-full text-left border-2 rounded-xl p-5 flex items-center gap-5 transition ${card.color}`}
                    >
                        <span className={card.iconColor}>{card.icon}</span>
                        <div>
                            <p className="text-gray-800 font-semibold text-base">{card.title}</p>
                            <p className="text-gray-500 text-sm mt-0.5">{card.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}

