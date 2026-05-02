import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti' // <-- On importe les confettis !

function App() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const [selectedDay, setSelectedDay] = useState(null); 
  const [eventName, setEventName] = useState(""); 
  const [category, setCategory] = useState("party");
  const [events, setEvents] = useState([]);
  
  // États pour le GIF
  const [gifSearch, setGifSearch] = useState("");
  const [selectedGif, setSelectedGif] = useState(null);
  const [gifResults, setGifResults] = useState([]);

  useEffect(() => { fetchEvents(); }, []);

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('*').order('day', { ascending: true });
    if (data) setEvents(data);
  }

  // --- FONCTION RECHERCHE GIPHY (CORRIGÉE) ---
  const searchGifs = async () => {
    if (!gifSearch) return;
    try {
      // On utilise TA clé et on n'oublie pas le &q= avant la recherche
      const url = `https://api.giphy.com/v1/gifs/search?api_key=cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj&q=${gifSearch}&limit=4`;
      const res = await fetch(url);
      const { data } = await res.json();
      if (data) setGifResults(data);
    } catch (error) {
      console.error("Erreur Giphy:", error);
    }
  };

  // --- SAUVEGARDE + CONFETTI ---
  const handleSave = async () => {
    if (eventName.trim() !== "") {
      const { data, error } = await supabase
        .from('events')
        .insert([{ 
          day: selectedDay, 
          title: eventName, 
          category: category, 
          gif_url: selectedGif, 
          hype: 0 
        }])
        .select();

      if (!error) {
        // 🎉 L'EXPLOSION DE JOIE !
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF2E95', '#00F0FF', '#D1FF4B'] 
        });

        setEvents([...events, ...data]);
        setEventName("");
        setSelectedGif(null);
        setSelectedDay(null);
        setGifResults([]);
        setGifSearch("");
      } else {
        alert("Erreur Supabase : Vérifie que la colonne gif_url existe !");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0118] p-6 md:p-10 text-white font-sans">
      <header className="max-w-7xl mx-auto mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-6xl font-black text-[#D1FF4B] italic tracking-tighter">
            SOCIAL HUB<span className="text-[#FF2E95]">!</span>
          </h1>
          <p className="text-[#00F0FF] uppercase tracking-[0.4em] text-[10px] font-bold mt-2">
            Live Cloud & Vibes Active
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* GRILLE CALENDRIER */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
          {days.map((day) => {
            const dayEvents = events.filter(e => e.day === day);
            return (
              <div 
                key={day} 
                onClick={() => setSelectedDay(day)} 
                className="aspect-square bg-white/5 border border-white/10 rounded-[35px] p-4 hover:border-[#FF2E95] transition-all cursor-pointer relative overflow-hidden group"
              >
                <span className="text-xl font-black opacity-10 group-hover:opacity-100 transition-opacity">{day}</span>
                <div className="mt-2 space-y-2">
                  {dayEvents.map(e => (
                    <div key={e.id} className="relative group/item">
                      {e.gif_url && <img src={e.gif_url} className="w-full h-10 object-cover rounded-lg mb-1 shadow-lg" alt="vibe"/>}
                      <div className={`${e.category === 'party' ? 'bg-[#FF2E95]' : 'bg-[#00F0FF]'} text-[7px] font-black uppercase p-1 rounded-md truncate text-center`}>
                        {e.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* FEED LATÉRAL */}
        <div className="space-y-6">
          <h3 className="text-2xl font-black italic border-b border-white/10 pb-4 uppercase tracking-widest">Live Feed 🔥</h3>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {events.slice().reverse().map(e => (
              <div key={e.id} className="bg-white/5 border border-white/10 rounded-[30px] overflow-hidden shadow-2xl transition-transform hover:scale-[1.02]">
                {e.gif_url && <img src={e.gif_url} className="w-full h-40 object-cover" alt="vibes" />}
                <div className="p-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-[#00F0FF] uppercase tracking-widest">May {e.day}</span>
                    <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-full uppercase">{e.category}</span>
                  </div>
                  <h4 className="font-black text-lg mb-4 uppercase leading-tight">{e.title}</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[2px] bg-white/10"></div>
                    <span className="text-[#FF2E95] font-black text-xs italic">HOT EVENT</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* MODALE D'AJOUT */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-8 rounded-[50px] w-full max-w-xl shadow-[0_0_80px_rgba(255,46,149,0.3)]">
            <h3 className="text-4xl font-black mb-6 text-center uppercase italic">May {selectedDay} Vibes</h3>
            
            <input 
              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-xl font-bold mb-6 focus:border-[#D1FF4B] outline-none transition-all" 
              placeholder="What's happening?" 
              value={eventName} 
              onChange={(e) => setEventName(e.target.value)} 
            />
            
            {/* Recherche Giphy */}
            <div className="mb-6 bg-white/5 p-4 rounded-3xl border border-white/5">
              <label className="text-[10px] font-bold uppercase text-[#00F0FF] mb-3 block tracking-widest">Add a GIF Vibe</label>
              <div className="flex gap-2 mb-4">
                <input 
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-[#D1FF4B]" 
                  placeholder="Dance, techno, dinner..." 
                  value={gifSearch} 
                  onChange={(e) => setGifSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchGifs()}
                />
                <button onClick={searchGifs} className="bg-[#D1FF4B] text-black px-6 rounded-xl font-bold text-xs uppercase hover:scale-105 transition-transform">Search</button>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {gifResults.map(g => (
                  <img 
                    key={g.id} 
                    src={g.images.fixed_height_small.url} 
                    onClick={() => setSelectedGif(g.images.fixed_height.url)}
                    className={`h-20 w-full object-cover rounded-xl cursor-pointer transition-all ${selectedGif === g.images.fixed_height.url ? 'ring-4 ring-[#FF2E95] scale-95 opacity-100' : 'opacity-40 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-4 mb-8">
              <button onClick={() => setCategory("party")} className={`flex-1 py-4 rounded-2xl font-black uppercase transition-all ${category === 'party' ? 'bg-[#FF2E95] shadow-[0_0_20px_rgba(255,46,149,0.5)]' : 'bg-white/5 opacity-30'}`}>🎉 Party</button>
              <button onClick={() => setCategory("dinner")} className={`flex-1 py-4 rounded-2xl font-black uppercase transition-all ${category === 'dinner' ? 'bg-[#00F0FF] text-black shadow-[0_0_20px_rgba(0,240,255,0.5)]' : 'bg-white/5 opacity-30'}`}>🍽️ Dinner</button>
            </div>

            <button onClick={handleSave} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] shadow-xl uppercase tracking-widest text-lg hover:bg-white transition-all transform hover:scale-[1.02] active:scale-95">
              Broadcast Event
            </button>
            <button onClick={() => setSelectedDay(null)} className="w-full mt-4 text-white/20 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

