import { useState } from 'react'
import { supabase } from '../lib/supabase'
import NewAttendance from './NewAttendance'
import AttendanceHistory from './AttendanceHistory'
import TrainingPlanner from './TrainingPlanner'
import ExportAttendance from './ExportAttendance'
import Statistics from './Statistics'
import ManageNew from './ManageNew'
import ManageEdit from './ManageEdit'
import { CheckIcon, ClipboardIcon, CalendarIcon, EditIcon, LogoutIcon, DownloadIcon, ChartIcon, PlusIcon, UserIcon } from '../components/Icons'

type View = 'attendance' | 'history' | 'planner' | 'statistics' | 'verwaltung' | 'manageNew' | 'manageEdit' | 'export'

export default function Dashboard() {
    const [currentView, setCurrentView] = useState<View>('attendance')

    const handleLogout = async () => {
        if (confirm('Wirklich abmelden?')) {
            await supabase.auth.signOut()
        }
    }

    const navigateTo = (view: View) => {
        setCurrentView(view)
    }

    // Die 5 Haupt-Tabs für die untere Navigationsleiste
    const mainTabs: { view: View; label: string; icon: JSX.Element }[] = [
        { view: 'attendance', label: 'Heute', icon: <CheckIcon size={22} /> },
        { view: 'history', label: 'Historie', icon: <ClipboardIcon size={22} /> },
        { view: 'planner', label: 'Planung', icon: <CalendarIcon size={22} /> },
        { view: 'statistics', label: 'Statistik', icon: <ChartIcon size={22} /> },
        { view: 'verwaltung', label: 'Verwaltung', icon: <EditIcon size={22} /> },
    ]

    // Welcher Tab ist aktiv? (Unterseiten von Verwaltung zählen auch als "Verwaltung")
    const activeTab: View = (['manageNew', 'manageEdit', 'export'] as View[]).includes(currentView)
        ? 'verwaltung'
        : currentView

    // Aktuellen Seitentitel bestimmen
    const pageTitle: Record<View, string> = {
        attendance: 'Anwesenheit erfassen',
        history: 'Trainings-Historie',
        planner: 'Trainings planen',
        statistics: 'Statistik',
        verwaltung: 'Verwaltung',
        manageNew: 'Neu hinzufügen',
        manageEdit: 'Bearbeiten',
        export: 'Excel Export',
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* ── Fixer Header oben ── */}
            <header className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium leading-none">ABC Altach</p>
                        <h1 className="text-lg font-bold text-gray-800 leading-tight">{pageTitle[currentView]}</h1>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition text-sm font-medium"
                    >
                        <LogoutIcon size={16} />
                        Abmelden
                    </button>
                </div>
            </header>

            {/* ── Hauptinhalt ── */}
            <main className="flex-1 pb-24">
                {currentView === 'attendance' && (
                    <NewAttendance />
                )}
                {currentView === 'history' && (
                    <AttendanceHistory />
                )}
                {currentView === 'planner' && (
                    <TrainingPlanner />
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
            </main>

            {/* ── Fixe untere Tab-Leiste ── */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                <div className="max-w-4xl mx-auto flex">
                    {mainTabs.map((tab) => {
                        const isActive = activeTab === tab.view
                        return (
                            <button
                                key={tab.view}
                                onClick={() => navigateTo(tab.view)}
                                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${isActive
                                        ? 'text-blue-600'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <span className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-blue-50' : ''}`}>
                                    {tab.icon}
                                </span>
                                <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                                    {tab.label}
                                </span>
                                {isActive && (
                                    <span className="absolute bottom-0 h-0.5 w-8 bg-blue-600 rounded-t-full" />
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
            <p className="text-gray-500 text-sm mb-6">Wähle eine Aktion aus:</p>
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
