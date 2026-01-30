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
    coaches?: Coach;
}