import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Player, Coach, Training } from '../types/interfaces'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'

interface UseNewAttendanceProps {
    onSuccess?: () => void
}

export function useNewAttendance({ onSuccess }: UseNewAttendanceProps = {}) {
    const { toast } = useToast()
    const { confirm, prompt } = useConfirm()

    const [todaysTraining, setTodaysTraining] = useState<Training | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [coaches, setCoaches] = useState<Coach[]>([])
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
    const [selectedMandatoryCoaches, setSelectedMandatoryCoaches] = useState<Set<string>>(new Set())
    const [selectedAdditionalCoaches, setSelectedAdditionalCoaches] = useState<Set<string>>(new Set())
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [spontaneousLoading, setSpontaneousLoading] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        loadTodaysTraining()
        loadPlayers()
        loadCoaches()
    }, [])

    async function loadTodaysTraining() {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        // Suche nach Training von HEUTE
        const { data } = await supabase
            .from('trainings')
            .select('*')
            .eq('date', today)
            .maybeSingle()

        if (data) {
            setTodaysTraining(data)
            setDescription(data.description || '')
            await loadExistingAttendance(data.id)
            setIsEditing(true)
        }

        setLoading(false)
    }

    async function loadExistingAttendance(trainingId: string) {
        // Lade Spieler-Anwesenheit
        const { data: playerAttendance } = await supabase
            .from('attendance')
            .select('player_id')
            .eq('training_id', trainingId)
            .eq('is_present', true)

        if (playerAttendance && playerAttendance.length > 0) {
            const playerIds = playerAttendance.map(a => a.player_id).filter(Boolean)
            setSelectedPlayers(new Set(playerIds))
        }

        // Lade Trainer-Anwesenheit
        const { data: coachAttendance } = await supabase
            .from('coach_attendance')
            .select('coach_id, is_mandatory')
            .eq('training_id', trainingId)
            .eq('is_present', true)

        if (coachAttendance && coachAttendance.length > 0) {
            const mandatoryIds = coachAttendance
                .filter((a: any) => a.is_mandatory)
                .map((a: any) => a.coach_id)
                .filter(Boolean)
            const additionalIds = coachAttendance
                .filter((a: any) => !a.is_mandatory)
                .map((a: any) => a.coach_id)
                .filter(Boolean)
            setSelectedMandatoryCoaches(new Set(mandatoryIds))
            setSelectedAdditionalCoaches(new Set(additionalIds))
        }
    }

    const loadPlayers = async () => {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('active', true)
            .order('name')

        if (error) {
            console.error('Fehler beim Laden der Spieler:', error)
        } else if (data) {
            setPlayers(data)
        }
    }

    const loadCoaches = async () => {
        const { data, error } = await supabase
            .from('coaches')
            .select('*')
            .eq('active', true)
            .order('name')

        if (error) {
            console.error('Fehler beim Laden der Trainer:', error)
        } else if (data) {
            setCoaches(data)
        }
    }

    const toggleMandatoryCoach = (coachId: string) => {
        setSelectedMandatoryCoaches(prev => {
            const newSet = new Set(prev)
            if (newSet.has(coachId)) {
                newSet.delete(coachId)
            } else {
                if (newSet.size >= 2) return prev // Max 2 Pflichttrainer
                newSet.add(coachId)
            }
            return newSet
        })
    }

    const toggleAdditionalCoach = (coachId: string) => {
        setSelectedAdditionalCoaches(prev => {
            const newSet = new Set(prev)
            if (newSet.has(coachId)) {
                newSet.delete(coachId)
            } else {
                newSet.add(coachId)
            }
            return newSet
        })
    }

    function togglePlayer(playerId: string) {
        setSelectedPlayers(prev => {
            const newSet = new Set(prev)
            if (newSet.has(playerId)) {
                newSet.delete(playerId)
            } else {
                newSet.add(playerId)
            }
            return newSet
        })
    }

    function selectAll() {
        setSelectedPlayers(new Set(players.map(p => p.id)))
    }

    function deselectAll() {
        setSelectedPlayers(new Set())
    }

    async function createSpontaneousTraining() {
        const topic = await prompt({
            title: 'Spontanes Training erstellen',
            message: 'Beschreibung für heute (optional):',
            placeholder: 'z. B. Spontanes Spieltraining',
            confirmText: 'Erstellen',
            cancelText: 'Abbrechen',
        })
        if (topic === null) return

        setSpontaneousLoading(true)
        try {
            const today = new Date().toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('trainings')
                .insert({
                    date: today,
                    description: topic.trim() || 'Spontanes Training'
                })
                .select()
                .single()

            if (error) {
                toast.error('Fehler beim Erstellen: ' + error.message)
                return
            }

            if (data) {
                setTodaysTraining(data)
                setDescription(data.description || '')
                toast.success('Spontanes Training erfolgreich erstellt!')
            }
        } finally {
            setSpontaneousLoading(false)
        }
    }

    async function saveAttendance() {
        if (!todaysTraining) {
            toast.warning('Kein Training für heute geplant!')
            return
        }

        const totalCoaches = selectedMandatoryCoaches.size + selectedAdditionalCoaches.size
        if (selectedPlayers.size === 0 && totalCoaches === 0) {
            const confirmed = await confirm({
                title: 'Keine Auswahl',
                message: 'Keine Spieler oder Trainer ausgewählt. Wirklich speichern (= alle abwesend)?',
                confirmText: 'Trotzdem speichern',
                cancelText: 'Abbrechen',
                isDanger: false,
            })
            if (!confirmed) {
                return
            }
        }

        setSaving(true)

        try {
            // 1. Lösche alte Spieler-Anwesenheit für dieses Training
            await supabase
                .from('attendance')
                .delete()
                .eq('training_id', todaysTraining.id)

            // 2. Lösche alte Trainer-Anwesenheit
            await supabase
                .from('coach_attendance')
                .delete()
                .eq('training_id', todaysTraining.id)

            // 3. Speichere neue Spieler-Anwesenheit
            if (selectedPlayers.size > 0) {
                const attendanceData = Array.from(selectedPlayers).map(playerId => ({
                    training_id: todaysTraining.id,
                    player_id: playerId,
                    is_present: true
                }))

                const { error: playerError } = await supabase
                    .from('attendance')
                    .insert(attendanceData)

                if (playerError) throw playerError
            }

            // 4. Speichere neue Trainer-Anwesenheit
            const allCoachAttendanceData = [
                ...Array.from(selectedMandatoryCoaches).map(coachId => ({
                    training_id: todaysTraining.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: true
                })),
                ...Array.from(selectedAdditionalCoaches).map(coachId => ({
                    training_id: todaysTraining.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: false
                }))
            ]

            if (allCoachAttendanceData.length > 0) {
                const { error: coachError } = await supabase
                    .from('coach_attendance')
                    .insert(allCoachAttendanceData)

                if (coachError) throw coachError
            }

            // 5. Aktualisiere Beschreibung falls geändert
            if (description !== todaysTraining.description) {
                await supabase
                    .from('trainings')
                    .update({ description: description || null })
                    .eq('id', todaysTraining.id)
            }

            toast.success(`Anwesenheit ${isEditing ? 'aktualisiert' : 'gespeichert'}!`)

            if (onSuccess) {
                onSuccess()
            }
        } catch (error) {
            console.error('Fehler beim Speichern:', error)
            toast.error('Fehler beim Speichern der Anwesenheit')
        } finally {
            setSaving(false)
        }
    }

    return {
        todaysTraining,
        players,
        coaches,
        selectedPlayers,
        selectedMandatoryCoaches,
        selectedAdditionalCoaches,
        description,
        setDescription,
        loading,
        saving,
        spontaneousLoading,
        isEditing,
        toggleMandatoryCoach,
        toggleAdditionalCoach,
        togglePlayer,
        selectAll,
        deselectAll,
        createSpontaneousTraining,
        saveAttendance,
    }
}
