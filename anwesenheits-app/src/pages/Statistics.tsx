import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ChartIcon } from '../components/Icons'

interface StatisticsProps {
    onBack?: () => void
}

interface PlayerStats {
    id: string
    name: string
    attendanceCount: number
    percentage: number
}

export default function Statistics({ onBack }: StatisticsProps) {
    const [stats, setStats] = useState<PlayerStats[]>([])
    const [totalTrainings, setTotalTrainings] = useState(0)
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    useEffect(() => {
        loadData()
    }, [])

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

            // 3. Hole Anwesenheiten (gefiltert über Trainings-Datum)
            let attendanceQuery = supabase
                .from('attendance')
                .select('player_id, trainings!inner(date)')
                .eq('is_present', true)

            if (startDate) attendanceQuery = attendanceQuery.gte('trainings.date', startDate)
            if (endDate) attendanceQuery = attendanceQuery.lte('trainings.date', endDate)

            const { data: attendance, error: attendanceError } = await attendanceQuery
            
            if (attendanceError) throw attendanceError

            // 4. Berechne Statistik
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

            // Sortiere nach Häufigkeit (absteigend)
            playerStats.sort((a, b) => b.attendanceCount - a.attendanceCount)

            setStats(playerStats)

        } catch (error) {
            console.error('Fehler beim Laden der Statistik:', error)
            alert('Statistik konnte nicht geladen werden.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-2 md:p-6 max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-4 mb-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <ChartIcon size={24} className="md:w-8 md:h-8" />
                        Statistik
                    </h1>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 text-sm rounded-lg transition"
                        >
                            Zurück
                        </button>
                    )}
                </div>

                {/* Date Filter */}
                <div className="mt-4 flex flex-col sm:flex-row items-end gap-2 bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <div className="w-full sm:flex-1 grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Von</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Bis</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                         <button
                            onClick={() => loadData()}
                            className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                        >
                            Filter
                        </button>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => {
                                    setStartDate('')
                                    setEndDate('')
                                }}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition"
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

            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Lade Statistik...</div>
                ) : stats.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Keine Daten verfügbar</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-100 border-b border-gray-200">
                                    <th className="p-2 font-bold text-gray-700 text-center w-8">#</th>
                                    <th className="p-2 font-bold text-gray-700">Name</th>
                                    <th className="p-2 font-bold text-gray-700 text-center w-12">Anz.</th>
                                    <th className="p-2 font-bold text-gray-700 text-right">Quote</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.map((player, index) => (
                                    <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                        <td className="p-2 text-gray-500 text-center text-xs">#{index + 1}</td>
                                        <td className="p-2 font-medium text-gray-800 truncate max-w-[100px] sm:max-w-none">{player.name}</td>
                                        <td className="p-2 text-center">
                                            <span className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold text-xs">
                                                {player.attendanceCount}
                                            </span>
                                        </td>
                                        <td className="p-2 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 sm:w-24 bg-gray-200 rounded-full h-1.5 sm:h-2.5">
                                                    <div 
                                                        className={`h-1.5 sm:h-2.5 rounded-full ${
                                                            player.percentage >= 75 ? 'bg-green-500' :
                                                            player.percentage >= 50 ? 'bg-blue-500' :
                                                            player.percentage >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}
                                                        style={{ width: `${player.percentage}%` }}
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
                )}
            </div>
        </div>
    )
}
