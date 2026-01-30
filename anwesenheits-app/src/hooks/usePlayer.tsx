import { useState, useEffect } from 'react'
import { supabase } from './../lib/supabase';
import type { Player } from './../types/interfaces';


export function usePlayer({ }) {

    const [loading, setLoading] = useState(true);
    const [players, setPlayers] = useState<Player[]>([]);



    const fetchPlayers = async () => {
        setLoading(true);

        const { data, error } = await supabase.from('players').select('*').order('name', { ascending: true });

        if (error) {
            console.error('Fehler beim Laden der Spieler:', error);
        } else {
            console.log('Geladene Spieler:', data);
            setPlayers(data || []);
        }

        setLoading(false)

    }



    const addPlayer = async (name: string) => {
        const { data, error } = await supabase.from('players').insert([{ name, active: true }]).select();
        if (error) {
            console.log("error adding player")

        }


        if (data) {
            setPlayers([...players, ...data])
        }

    }


    useEffect(() => {
        fetchPlayers()
    }, [])

    return { players, loading, addPlayer, refreshPlayers: fetchPlayers }
}
