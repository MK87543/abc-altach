import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach, CoachAbsence, Training } from '../types/interfaces'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'

export interface TrainingWithCoaches extends Training {
    coach_attendance?: {
        coach_id: string
        is_mandatory: boolean
        coaches: { name: string }
    }[]
}

export function useTrainingPlanner() {
    const { toast } = useToast()
    const { confirm } = useConfirm()

    const [trainings, setTrainings] = useState<TrainingWithCoaches[]>([])
    const [coaches, setCoaches] = useState<Coach[]>([])
    const [absences, setAbsences] = useState<CoachAbsence[]>([])
    const [loadingData, setLoadingData] = useState(true)

    const existingDates = useMemo(() => {
        return new Set(trainings.map(t => t.date))
    }, [trainings])

    async function loadCoaches() {
        const { data } = await supabase
            .from('coaches')
            .select('*')
            .eq('active', true)
            .order('name')

        if (data) setCoaches(data)
    }

    async function loadAbsences() {
        try {
            const { data, error } = await supabase
                .from('coach_absences')
                .select('*')

            if (!error && data) {
                setAbsences(data as CoachAbsence[])
            } else {
                const cached = localStorage.getItem('abc_coach_absences_local')
                if (cached) {
                    try {
                        setAbsences(JSON.parse(cached))
                    } catch {
                        // ignore
                    }
                }
            }
        } catch {
            const cached = localStorage.getItem('abc_coach_absences_local')
            if (cached) {
                try {
                    setAbsences(JSON.parse(cached))
                } catch {
                    // ignore
                }
            }
        }
    }

    async function loadTrainings() {
        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('trainings')
            .select(`
                *,
                coach_attendance (
                    coach_id,
                    is_mandatory,
                    coaches ( name )
                )
            `)
            .gte('date', today)
            .order('date', { ascending: true })

        if (error) {
            console.error('Fehler beim Laden der Trainings:', error)
        } else if (data) {
            setTrainings(data as any)
        }
    }

    async function loadAll() {
        setLoadingData(true)
        await Promise.all([
            loadTrainings(),
            loadCoaches(),
            loadAbsences()
        ])
        setLoadingData(false)
    }

    useEffect(() => {
        loadAll()
    }, [])

    async function createSingleTraining(
        date: string,
        description: string,
        mandatoryCoachIds: string[],
        additionalCoachIds: string[]
    ): Promise<boolean> {
        if (!date) {
            toast.warning('Bitte wähle ein Datum aus.')
            return false
        }

        try {
            const { data: trainingData, error: trainingError } = await supabase
                .from('trainings')
                .insert({
                    date,
                    description: description.trim() || null
                })
                .select()
                .single()

            if (trainingError) {
                toast.error('Fehler beim Erstellen: ' + trainingError.message)
                return false
            }

            const allCoachInserts = [
                ...mandatoryCoachIds.map(coachId => ({
                    training_id: trainingData.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: true
                })),
                ...additionalCoachIds.map(coachId => ({
                    training_id: trainingData.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: false
                }))
            ]

            if (allCoachInserts.length > 0 && trainingData) {
                await supabase.from('coach_attendance').insert(allCoachInserts)
            }

            await loadTrainings()
            toast.success('Training erfolgreich geplant!')
            return true
        } catch (err) {
            console.error('Erstellen Fehler:', err)
            toast.error('Unerwarteter Fehler beim Erstellen.')
            return false
        }
    }

    async function updateTraining(
        id: string,
        description: string,
        mandatoryCoachIds: string[],
        additionalCoachIds: string[]
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('trainings')
                .update({ description: description.trim() || null })
                .eq('id', id)

            if (error) {
                toast.error('Fehler beim Aktualisieren: ' + error.message)
                return false
            }

            await supabase.from('coach_attendance').delete().eq('training_id', id)

            const allCoachInserts = [
                ...mandatoryCoachIds.map(coachId => ({
                    training_id: id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: true
                })),
                ...additionalCoachIds.map(coachId => ({
                    training_id: id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: false
                }))
            ]

            if (allCoachInserts.length > 0) {
                await supabase.from('coach_attendance').insert(allCoachInserts)
            }

            await loadTrainings()
            toast.success('Training aktualisiert!')
            return true
        } catch (err) {
            console.error('Update Fehler:', err)
            toast.error('Fehler beim Aktualisieren.')
            return false
        }
    }

    async function deleteTraining(id: string): Promise<boolean> {
        const confirmed = await confirm({
            title: 'Training löschen',
            message: 'Training wirklich löschen? Alle zugehörigen Anwesenheitsdaten gehen verloren.',
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            isDanger: true,
        })
        if (!confirmed) return false

        try {
            await supabase.from('attendance').delete().eq('training_id', id)
            await supabase.from('coach_attendance').delete().eq('training_id', id)

            const { error } = await supabase
                .from('trainings')
                .delete()
                .eq('id', id)

            if (error) {
                toast.error('Fehler beim Löschen: ' + error.message)
                return false
            } else {
                await loadTrainings()
                toast.success('Training gelöscht.')
                return true
            }
        } catch {
            toast.error('Fehler beim Löschen des Trainings.')
            return false
        }
    }

    return {
        trainings,
        coaches,
        absences,
        loadingData,
        existingDates,
        loadTrainings,
        createSingleTraining,
        updateTraining,
        deleteTraining
    }
}
