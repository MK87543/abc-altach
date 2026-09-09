export interface Player {
    id: string;
    name: string;
    active: boolean;
    created_at?: string;
}

export interface Coach {
    id: string;
    name: string;
    role?: string;
    active: boolean;
    created_at?: string;
}

export interface Training {
    id: string;
    date: string; // Format: YYYY-MM-DD
    description?: string;
    created_at?: string;
}

export interface Attendance {
    id: string;
    training_id: string;
    player_id: string;
    is_present: boolean;
    // Optional: Um Join-Daten abzubilden (wenn wir Daten verschachtelt laden)
    players?: Player;
}

export interface CoachAttendance {
    id: string;
    training_id: string;
    coach_id: string;
    is_present: boolean;
    is_mandatory: boolean;
    coaches?: Coach;
}

export type AbsenceType = 'single' | 'range' | 'recurring';

export interface CoachAbsence {
    id: string;
    coach_id: string;
    absence_type: AbsenceType;
    start_date: string; // YYYY-MM-DD
    end_date?: string | null; // YYYY-MM-DD
    recurring_day_of_week?: number | null; // 0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa
    recurring_days?: number[] | null;
    recurrence_interval?: number | null; // 1 = jede Woche, 2 = alle 2 Wochen
    reason?: string | null;
    created_at?: string;
    coaches?: Coach;
}