-- ==============================================================================
-- ABC Altach Badminton - Supabase RLS Fix & Coach Absences Migration
-- WICHTIG: Dieses Skript löscht KEINE vorhandenen Daten!
-- ==============================================================================

-- 1. Tabelle für Trainer-Abwesenheiten und Urlaub erstellen (falls noch nicht existent)
CREATE TABLE IF NOT EXISTS public.coach_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    absence_type TEXT NOT NULL CHECK (absence_type IN ('single', 'range', 'recurring')),
    start_date DATE NOT NULL,
    end_date DATE, -- optional bei Zeitraum oder Enddatum für Wiederholungen
    recurring_day_of_week INTEGER CHECK (recurring_day_of_week BETWEEN 0 AND 6), -- 0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa
    recurring_days INTEGER[] DEFAULT '{}',
    reason TEXT, -- z.B. "Urlaub", "Beruflich", "Jeden Dienstag keine Zeit"
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indizes für schnelle Performance
CREATE INDEX IF NOT EXISTS idx_coach_absences_coach_id ON public.coach_absences(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_absences_dates ON public.coach_absences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_coach_absences_recurring ON public.coach_absences(recurring_day_of_week);

-- 2. Row Level Security (RLS) auf ALLEN Tabellen aktivieren
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_absences ENABLE ROW LEVEL SECURITY;

-- 3. Bestehende Policies sicher entfernen, um Duplikate oder Konflikte zu vermeiden
DROP POLICY IF EXISTS "Allow authenticated full access on players" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated select on players" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated insert on players" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated update on players" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated delete on players" ON public.players;

DROP POLICY IF EXISTS "Allow authenticated full access on coaches" ON public.coaches;
DROP POLICY IF EXISTS "Allow authenticated select on coaches" ON public.coaches;
DROP POLICY IF EXISTS "Allow authenticated insert on coaches" ON public.coaches;
DROP POLICY IF EXISTS "Allow authenticated update on coaches" ON public.coaches;
DROP POLICY IF EXISTS "Allow authenticated delete on coaches" ON public.coaches;

DROP POLICY IF EXISTS "Allow authenticated full access on trainings" ON public.trainings;
DROP POLICY IF EXISTS "Allow authenticated select on trainings" ON public.trainings;
DROP POLICY IF EXISTS "Allow authenticated insert on trainings" ON public.trainings;
DROP POLICY IF EXISTS "Allow authenticated update on trainings" ON public.trainings;
DROP POLICY IF EXISTS "Allow authenticated delete on trainings" ON public.trainings;

DROP POLICY IF EXISTS "Allow authenticated full access on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow authenticated select on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow authenticated insert on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow authenticated update on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow authenticated delete on attendance" ON public.attendance;

DROP POLICY IF EXISTS "Allow authenticated full access on coach_attendance" ON public.coach_attendance;
DROP POLICY IF EXISTS "Allow authenticated select on coach_attendance" ON public.coach_attendance;
DROP POLICY IF EXISTS "Allow authenticated insert on coach_attendance" ON public.coach_attendance;
DROP POLICY IF EXISTS "Allow authenticated update on coach_attendance" ON public.coach_attendance;
DROP POLICY IF EXISTS "Allow authenticated delete on coach_attendance" ON public.coach_attendance;

DROP POLICY IF EXISTS "Allow authenticated full access on coach_absences" ON public.coach_absences;
DROP POLICY IF EXISTS "Allow authenticated select on coach_absences" ON public.coach_absences;
DROP POLICY IF EXISTS "Allow authenticated insert on coach_absences" ON public.coach_absences;
DROP POLICY IF EXISTS "Allow authenticated update on coach_absences" ON public.coach_absences;
DROP POLICY IF EXISTS "Allow authenticated delete on coach_absences" ON public.coach_absences;

-- 4. Vollständige RLS-Policies für die 'authenticated' Rolle erstellen
-- Da alle Trainer denselben Login nutzen ("all login with the same user"),
-- erhält jede authentifizierte Sitzung vollen Zugriff auf die Vereinsdaten.

-- PLAYERS
CREATE POLICY "Allow authenticated full access on players"
    ON public.players
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- COACHES
CREATE POLICY "Allow authenticated full access on coaches"
    ON public.coaches
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- TRAININGS
CREATE POLICY "Allow authenticated full access on trainings"
    ON public.trainings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ATTENDANCE
CREATE POLICY "Allow authenticated full access on attendance"
    ON public.attendance
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- COACH_ATTENDANCE
CREATE POLICY "Allow authenticated full access on coach_attendance"
    ON public.coach_attendance
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- COACH_ABSENCES
CREATE POLICY "Allow authenticated full access on coach_absences"
    ON public.coach_absences
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Berechtigungen für Tabellen sicherstellen
GRANT ALL ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.coaches TO authenticated;
GRANT ALL ON TABLE public.trainings TO authenticated;
GRANT ALL ON TABLE public.attendance TO authenticated;
GRANT ALL ON TABLE public.coach_attendance TO authenticated;
GRANT ALL ON TABLE public.coach_absences TO authenticated;

-- Anonyme / unauthentifizierte Zugriffe entziehen (Schutz vor unbefugtem Zugriff von außen)
REVOKE ALL ON TABLE public.players FROM anon;
REVOKE ALL ON TABLE public.coaches FROM anon;
REVOKE ALL ON TABLE public.trainings FROM anon;
REVOKE ALL ON TABLE public.attendance FROM anon;
REVOKE ALL ON TABLE public.coach_attendance FROM anon;
REVOKE ALL ON TABLE public.coach_absences FROM anon;
