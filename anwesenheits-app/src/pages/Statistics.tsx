import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ChartIcon, SpinnerIcon, ChevronLeftIcon } from '../components/Icons'
import { useUrlQueryParam } from '../lib/urlUtils'
import { useToast } from '../components/Toast'

interface StatisticsProps {
    onBack?: () => void
}

interface PlayerStats {
    id: string
    name: string
    attendanceCount: number
    percentage: number
}

interface CoachStats {
    id: string
    name: string
    role?: string
    mandatoryCount: number
    additionalCount: number
    totalCount: number
}

function getProgressWidthClass(pct: number): string {
    if (pct >= 100) return 'w-full'
    if (pct >= 95) return 'w-[95%]'
    if (pct >= 90) return 'w-[90%]'
    if (pct >= 85) return 'w-[85%]'
    if (pct >= 80) return 'w-[80%]'
    if (pct >= 75) return 'w-3/4'
    if (pct >= 70) return 'w-[70%]'
    if (pct >= 65) return 'w-[65%]'
    if (pct >= 60) return 'w-[60%]'
    if (pct >= 55) return 'w-[55%]'
    if (pct >= 50) return 'w-1/2'
    if (pct >= 45) return 'w-[45%]'
    if (pct >= 40) return 'w-[40%]'
    if (pct >= 35) return 'w-[35%]'
    if (pct >= 33) return 'w-1/3'
    if (pct >= 30) return 'w-[30%]'
    if (pct >= 25) return 'w-1/4'
    if (pct >= 20) return 'w-[20%]'
    if (pct >= 15) return 'w-[15%]'
    if (pct >= 10) return 'w-[10%]'
    if (pct >= 5) return 'w-[5%]'
    return 'w-0'
}

export default function Statistics({ onBack }: StatisticsProps) {
    const { toast } = useToast()
    const [stats, setStats] = useState<PlayerStats[]>([])
    const [coachStats, setCoachStats] = useState<CoachStats[]>([])
    const [totalTrainings, setTotalTrainings] = useState(0)
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useUrlQueryParam<string>('statsFrom', '')
    const [endDate, setEndDate] = useUrlQueryParam<string>('statsTo', '')
    const [activeTab, setActiveTab] = useUrlQueryParam<'player' | 'coach'>('statsTab', 'player')

    useEffect(() => {
        loadData()
    }, [startDate, endDate])


    async function loadData() {
        setLoading(true)
        try {
            // 1. Hole Trainingsanzahl (gefiltert)
            let trainingQuery = supabase
                .from('trainings')
                .select('*', { count: 'exact', head: true })

            if (startDate) trainingQuery = trainingQuery.gte('date', startDate)
            if (endDate) trainingQuery = trainingQuery.lte('date', endDate)

            const { count, error: countError } = await trainingQuery

            if (countError) throw countError

            const total = count || 0
            setTotalTrainings(total)

            if (total === 0) {
                setStats([])
                setCoachStats([])
                setLoading(false)
                return
            }

            // 2. Hole alle aktiven Spieler
            const { data: players, error: playersError } = await supabase
                .from('players')
                .select('id, name')
                .eq('active', true)
                .order('name')

            if (playersError) throw playersError

            // 3. Hole Spieler-Anwesenheiten (gefiltert über Trainings-Datum)
            let attendanceQuery = supabase
                .from('attendance')
                .select('player_id, trainings!inner(date)')
                .eq('is_present', true)

            if (startDate) attendanceQuery = attendanceQuery.gte('trainings.date', startDate)
            if (endDate) attendanceQuery = attendanceQuery.lte('trainings.date', endDate)

            const { data: attendance, error: attendanceError } = await attendanceQuery

            if (attendanceError) throw attendanceError

            // 4. Berechne Spieler-Statistik
            const playerStats: PlayerStats[] = players.map(player => {
                const count = attendance?.filter((a: any) => a.player_id === player.id).length || 0
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0

                return {
                    id: player.id,
                    name: player.name,
                    attendanceCount: count,
                    percentage
                }
            })

            playerStats.sort((a, b) => b.attendanceCount - a.attendanceCount)
            setStats(playerStats)

            // 5. Hole alle aktiven Trainer
            const { data: coaches, error: coachesError } = await supabase
                .from('coaches')
                .select('id, name, role')
                .eq('active', true)
                .order('name')

            if (coachesError) throw coachesError

            // 6. Hole Trainer-Anwesenheiten mit Pflicht/Zusatz (gefiltert)
            let coachAttQuery = supabase
                .from('coach_attendance')
                .select('coach_id, is_mandatory, trainings!inner(date)')
                .eq('is_present', true)

            if (startDate) coachAttQuery = coachAttQuery.gte('trainings.date', startDate)
            if (endDate) coachAttQuery = coachAttQuery.lte('trainings.date', endDate)

            const { data: coachAttendance, error: coachAttError } = await coachAttQuery

            if (coachAttError) throw coachAttError

            // 7. Berechne Trainer-Statistik
            const computedCoachStats: CoachStats[] = coaches.map(coach => {
                const entries = coachAttendance?.filter((a: any) => a.coach_id === coach.id) || []
                const mandatoryCount = entries.filter((a: any) => a.is_mandatory).length
                const additionalCount = entries.filter((a: any) => !a.is_mandatory).length
                return {
                    id: coach.id,
                    name: coach.name,
                    role: coach.role,
                    mandatoryCount,
                    additionalCount,
                    totalCount: mandatoryCount + additionalCount
                }
            })

            computedCoachStats.sort((a, b) => b.totalCount - a.totalCount)
            setCoachStats(computedCoachStats)

        } catch (error) {
            console.error('Fehler beim Laden der Statistik:', error)
            toast.error('Statistik konnte nicht geladen werden.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 mb-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <ChartIcon size={24} />
                        Statistik
                    </h1>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800 px-3 py-2 rounded-xl transition text-sm font-medium cursor-pointer hover:bg-slate-100 min-h-[44px]"
                        >
                            <ChevronLeftIcon size={18} />
                            Zurück
                        </button>
                    )}
                </div>

                {/* Date Filter */}
                <div className="mt-4 flex flex-col sm:flex-row items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <div className="w-full sm:flex-1 grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => loadData()}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 transition min-h-[44px] cursor-pointer font-medium"
                        >
                            Filter
                        </button>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => {
                                    setStartDate('')
                                    setEndDate('')
                                }}
                                className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-300 transition min-h-[44px] cursor-pointer font-medium"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                <p className="text-gray-600 mt-2 text-sm">
                    Trainings gesamt: <span className="font-bold">{totalTrainings}</span>
                </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md overflow-hidden">
                {/* Tab Switcher */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('player')}
                        className={`flex-1 py-3.5 text-base font-semibold transition min-h-[48px] cursor-pointer ${activeTab === 'player'
                                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
                            }`}
                    >
                        Spieler
                    </button>
                    <button
                        onClick={() => setActiveTab('coach')}
                        className={`flex-1 py-3.5 text-base font-semibold transition min-h-[48px] cursor-pointer ${activeTab === 'coach'
                                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
                            }`}
                    >
                        Trainer
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-gray-500">
                        <SpinnerIcon size={28} className="text-blue-600" />
                        <p className="text-sm font-medium">Lade Statistik...</p>
                    </div>
                ) : activeTab === 'player' ? (
                    stats.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Keine Daten verfügbar</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-100 border-b border-gray-200">
                                        <th className="p-3 font-bold text-gray-700 text-center w-8">#</th>
                                        <th className="p-3 font-bold text-gray-700">Name</th>
                                        <th className="p-3 font-bold text-gray-700 text-center w-12">Anz.</th>
                                        <th className="p-3 font-bold text-gray-700 text-right">Quote</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.map((player, index) => (
                                        <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                            <td className="p-3 text-gray-500 text-center text-xs">#{index + 1}</td>
                                            <td className="p-3 font-medium text-gray-800 truncate max-w-25 sm:max-w-none text-base">{player.name}</td>
                                            <td className="p-3 text-center">
                                                <span className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold text-xs">
                                                    {player.attendanceCount}
                                                </span>
                                            </td>
                                            <td className="p-2 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 sm:w-24 bg-gray-200 rounded-full h-1.5 sm:h-2.5">
                                                        <div
                                                            className={`h-1.5 sm:h-2.5 rounded-full ${player.percentage >= 75 ? 'bg-green-500' :
                                                                    player.percentage >= 50 ? 'bg-blue-500' :
                                                                        player.percentage >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                                                                } ${getProgressWidthClass(player.percentage)}`}
                                                        ></div>
                                                    </div>
                                                    <span className="font-bold text-xs w-8">{player.percentage}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    coachStats.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Keine Daten verfügbar</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-100 border-b border-gray-200">
                                        <th className="p-2 font-bold text-gray-700 text-center w-8">#</th>
                                        <th className="p-2 font-bold text-gray-700">Name</th>
                                        <th className="p-2 font-bold text-gray-700 text-center">
                                            <span className="text-blue-600">Pflicht</span>
                                        </th>
                                        <th className="p-2 font-bold text-gray-700 text-center">
                                            <span className="text-green-600">Zusatz</span>
                                        </th>
                                        <th className="p-2 font-bold text-gray-700 text-center">Gesamt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {coachStats.map((coach, index) => (
                                        <tr key={coach.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                            <td className="p-2 text-gray-500 text-center text-xs">#{index + 1}</td>
                                            <td className="p-2 font-medium text-gray-800 truncate max-w-25 sm:max-w-none">
                                                {coach.name}
                                                {coach.role && (
                                                    <span className="text-xs text-gray-400 ml-1">({coach.role})</span>
                                                )}
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold text-xs">
                                                    {coach.mandatoryCount}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold text-xs">
                                                    {coach.additionalCount}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold text-xs">
                                                    {coach.totalCount}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
