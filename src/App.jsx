import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient' // On importe notre pont Cloud

function App() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  
  // --- ÉTATS ---
  const [selectedDay, setSelectedDay] = useState(null); 
  const [eventName, setEventName] = useState(""); 
  const [category, setCategory] = useState("party");
  const [events, setEvents] = useState([]); // Liste des événements chargés depuis le cloud

  // 1. CHARGEMENT INITIAL (On demande à Supabase les événements existants)
  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data, error } = await supabase
      .from('events') // Nom de ta table sur Supabase
      .select('*');
    
    if (error) {
      console.error("Erreur de chargement:", error);
    } else {
      setEvents(data);
    }
  }

  // 2. SAUVEGARDE DANS LE CLOUD
  const handleSave = async () => {
    if (eventName.trim() !== "") {
      const { data, error } = await supabase
        .from('events')
        .insert([{ 
          day: selectedDay, 
          title: eventName, 
          category: category, 
          hype: 0 
        }])
        .select();

      if (error) {
        alert("Erreur de sauvegarde ! Vérifie que ta table 'events' existe sur Supabase.");
        console.error(error);
      } else {
        // Si ça marche, on ajoute l'événement à l'écran
        setEvents([...events, ...data]);
        setEventName("");
        setSelectedDay(null);
      }
    }
  };

  // 3. AJOUTER DU HYPE (Mise à jour en direct)
  const addHype = async (id, currentHype) => {
    const { error } = await supabase
      .from('events')
      .update({ hype: currentHype + 1 })
      .eq('id', id);

    if (!error) {
      setEvents(events.map(e => e.id === id ? {...e, hype: currentHype + 1} : e));
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0118] p-10 font-sans text-white">
      <header className="max-w-7xl mx-auto mb-12">
        <h1 className="text-6xl font-black text-[#D1FF4B] italic tracking-tighter">
          SOCIAL HUB<span className="text-[#FF2E95]">!</span>
        </h1>
        <p className="text-[#00F0FF] text-xs font-bold uppercase tracking-[0.5em] mt-2 italic">
          Live Cloud Synchronization Active
        </p>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* GRILLE CALENDRIER */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {days.map((day) => {
            const dayEvents = events.filter(e => e.day === day);
            return (
              <div 
                key={day} 
                onClick={() => setSelectedDay(day)}
                className="aspect-square bg-white/5 border border-white/10 rounded-[35px] p-4 hover:border-[#FF2E95] transition-all cursor-pointer group"
              >
                <span className="text-xl font-black opacity-10 group-hover:opacity-100">{day}</span>
                <div className="mt-1 space-y-1">
                  {dayEvents.map(e => (
                    <div key={e.id} className={`${e.category === 'party' ? 'bg-[#FF2E95]' : 'bg-[#00F0FF]'} text-[7px] font-black uppercase p-1 rounded-lg truncate shadow-lg`}>
                      {e.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ACTIVITÉ RÉCENTE */}
        <div className="space-y-4">
          <h3 className="text-xl font-black uppercase border-b border-white/10 pb-4">Activity 🔥</h3>
          {events.length === 0 && <p className="opacity-20 italic">No cloud events found.</p>}
          {events.map(e => (
            <div key={e.id} className="bg-white/5 border border-white/10 p-5 rounded-[25px]">
              <h4 className="font-black text-sm uppercase">{e.title} (May {e.day})</h4>
              <button 
                onClick={() => addHype(e.id, e.hype)}
                className="mt-3 w-full bg-white/10 hover:bg-[#D1FF4B] hover:text-black py-2 rounded-xl text-[10px] font-black transition-all"
              >
                VOTE HYPE 🔥 {e.hype}
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* MODALE D'AJOUT */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-8 rounded-[45px] w-full max-w-md">
            <h3 className="text-3xl font-black mb-8 text-center uppercase">Add to May {selectedDay}</h3>
            
            <input 
              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-xl font-bold mb-6 focus:border-[#D1FF4B] outline-none"
              placeholder="Name of event..."
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />

            <div className="flex gap-4 mb-8">
              <button onClick={() => setCategory("party")} className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${category === 'party' ? 'bg-[#FF2E95] scale-105' : 'bg-white/5 opacity-40'}`}>🎉 Party</button>
              <button onClick={() => setCategory("dinner")} className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${category === 'dinner' ? 'bg-[#00F0FF] text-black scale-105' : 'bg-white/5 opacity-40'}`}>🍽️ Dinner</button>
            </div>

            <button 
              onClick={handleSave} 
              className="w-full bg-[#FF2E95] text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest hover:scale-105 transition-transform"
            >
              Broadcast to Cloud
            </button>
            <button onClick={() => setSelectedDay(null)} className="w-full mt-4 text-white/30 text-xs font-bold uppercase">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

