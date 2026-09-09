import { useUrlQueryParam } from '../lib/urlUtils'
import {
    UserIcon,
    PlusIcon,
    ClipboardIcon,
    ChartIcon,
    DownloadIcon
} from '../components/Icons'
import ManageNew from './ManageNew'
import ManageEdit from './ManageEdit'
import AttendanceHistory from './AttendanceHistory'
import Statistics from './Statistics'
import ExportAttendance from './ExportAttendance'

type VereinSubView = 'hub' | 'manageNew' | 'manageEdit' | 'history' | 'stats' | 'export'

export default function VereinHub() {
    const [subView, setSubView] = useUrlQueryParam<VereinSubView>('vereinView', 'hub')

    // Die 5 übersichtlichen Aktions-Karten für den Verein-Tab
    const cards = [
        {
            id: 'manageNew' as VereinSubView,
            icon: <PlusIcon size={36} />,
            title: 'Spieler / Trainer hinzufügen',
            description: 'Neue Spieler oder Trainer in die App aufnehmen',
            color: 'bg-green-50 border-green-200 hover:bg-green-100',
            iconColor: 'text-green-600',
        },
        {
            id: 'manageEdit' as VereinSubView,
            icon: <UserIcon size={36} />,
            title: 'Spieler / Trainer bearbeiten',
            description: 'Namen, Rollen ändern oder Personen deaktivieren',
            color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
            iconColor: 'text-blue-600',
        },
        {
            id: 'history' as VereinSubView,
            icon: <ClipboardIcon size={36} />,
            title: 'Trainings-Historie',
            description: 'Vergangene Trainings und Anwesenheiten ansehen oder löschen',
            color: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
            iconColor: 'text-amber-600',
        },
        {
            id: 'stats' as VereinSubView,
            icon: <ChartIcon size={36} />,
            title: 'Statistik & Quoten',
            description: 'Trainingsbeteiligung und Anwesenheitsstatistiken auswerten',
            color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
            iconColor: 'text-indigo-600',
        },
        {
            id: 'export' as VereinSubView,
            icon: <DownloadIcon size={36} />,
            title: 'Excel Export',
            description: 'Anwesenheitsliste als Excel-Datei herunterladen',
            color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
            iconColor: 'text-purple-600',
        },
    ]

    // ── 1. Übersicht (Karten-Layout wie vom User gewünscht) ──
    if (subView === 'hub') {
        return (
            <div className="p-4 md:p-8 max-w-2xl mx-auto">
                <div className="flex flex-col gap-5">
                    {cards.map((card) => (
                        <button
                            key={card.id}
                            type="button"
                            onClick={() => setSubView(card.id)}
                            className={`w-full text-left border-2 rounded-2xl p-6 flex items-center gap-5 transition cursor-pointer shadow-xs min-h-[80px] ${card.color}`}
                        >
                            <span className={`shrink-0 ${card.iconColor}`}>{card.icon}</span>
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

    // ── 2. Ausgewählte Unterseite (jede Seite hat ihren eigenen Zurück-Button) ──
    return (
        <div className="max-w-4xl mx-auto">
            {subView === 'manageNew' && (
                <ManageNew onBack={() => setSubView('hub')} />
            )}
            {subView === 'manageEdit' && (
                <ManageEdit onBack={() => setSubView('hub')} />
            )}
            {subView === 'history' && (
                <div className="p-4 sm:p-6 max-w-4xl mx-auto">
                    <AttendanceHistory onBack={() => setSubView('hub')} />
                </div>
            )}
            {subView === 'stats' && (
                <Statistics onBack={() => setSubView('hub')} />
            )}
            {subView === 'export' && (
                <ExportAttendance onBack={() => setSubView('hub')} />
            )}
        </div>
    )
}
