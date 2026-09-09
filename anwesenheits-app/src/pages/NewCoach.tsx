import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { SpinnerIcon, ChevronLeftIcon } from '../components/Icons'

interface NewCoachProps {
    onBack: () => void
    onSuccess?: () => void
    hideHeader?: boolean
}

export default function NewCoach({ onBack, onSuccess, hideHeader }: NewCoachProps) {
    const { toast } = useToast()
    const [name, setName] = useState('')
    const [role, setRole] = useState('Trainer')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        try {
            const { error } = await supabase
                .from('coaches')
                .insert({
                    name: name.trim(),
                    role: role.trim() || 'Trainer',
                    active: true
                })

            if (error) throw error

            setSuccess(true)
            setName('')
            setRole('Trainer')
            toast.success('Trainer erfolgreich erstellt!')

            if (onSuccess) {
                onSuccess()
            }

            setTimeout(() => {
                setSuccess(false)
            }, 3000)
        } catch (error) {
            console.error('Fehler beim Erstellen des Trainers:', error)
            toast.error('Fehler beim Erstellen des Trainers: ' + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className={hideHeader ? "" : "bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5"}>
            {!hideHeader && (
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-2xl font-bold text-gray-800">Neuer Trainer</h2>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800 px-3 py-2 rounded-xl transition text-sm font-medium cursor-pointer hover:bg-slate-100 min-h-[44px]"
                    >
                        <ChevronLeftIcon size={18} />
                        Zurück
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="coachName" className="block text-gray-700 font-medium mb-2 text-base">
                        Name
                    </label>
                    <input
                        type="text"
                        id="coachName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name des Trainers eingeben..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="coachRole" className="block text-gray-700 font-medium mb-2 text-base">
                        Rolle (optional)
                    </label>
                    <input
                        type="text"
                        id="coachRole"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="z.B. Trainer, Co-Trainer, Physiotherapeut..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                    />
                </div>

                {success && (
                    <div className="p-3 bg-green-100 text-green-700 rounded-xl font-medium">
                        Trainer erfolgreich erstellt!
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-sm min-h-[48px] text-base"
                >
                    {loading ? (
                        <>
                            <SpinnerIcon size={18} />
                            <span>Wird erstellt...</span>
                        </>
                    ) : (
                        <span>Trainer erstellen</span>
                    )}
                </button>
            </form>
        </div>
    )
}
