import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const [selectedDay, setSelectedDay] = useState(null); 
  const [eventName, setEventName] = useState(""); 
  const [category, setCategory] = useState("party");
  const [events, setEvents] = useState([]);
  
  // Nouveaux états pour le GIF
  const [gifSearch, setGifSearch] = useState("");
  const [selectedGif, setSelectedGif] = useState(null);
  const [gifResults, setGifResults] = useState([]);

  useEffect(() => { fetchEvents(); }, []);

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('*').order('day', { ascending: true });
    if (data) setEvents(data);
  }

const searchGifs = async () => {
    if (!gifSearch) return; // Sécurité : n'envoie rien si le champ est vide

    try {
      // J'ai mis une nouvelle clé API ci-dessous
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj=${gifSearch}&limit=4`);
      const { data } = await res.json();
      
      if (data) {
        setGifResults(data);
      }
    } catch (error) {
      console.error("Erreur Giphy :", error);
    }
  };

  const handleSave = async () => {
    if (eventName.trim() !== "") {
      const { data, error } = await supabase
        .from('events')
        .insert([{ 
          day: selectedDay, 
          title: eventName, 
          category: category, 
          gif_url: selectedGif, // On enregistre l'URL du GIF
          hype: 0 
        }])
        .select();

      if (!error) {
        setEvents([...events, ...data]);
        setEventName("");
        setSelectedGif(null);
        setSelectedDay(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0118] p-6 md:p-10 text-white font-sans">
      <header className="max-w-7xl mx-auto mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-6xl font-black text-[#D1FF4B] italic">SOCIAL HUB<span className="text-[#FF2E95]">!</span></h1>
          <p className="text-[#00F0FF] uppercase tracking-[0.4em] text-[10px] font-bold">The Collaborative Experience</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* CALENDRIER */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
          {days.map((day) => {
            const dayEvents = events.filter(e => e.day === day);
            return (
              <div key={day} onClick={() => setSelectedDay(day)} className="aspect-square bg-white/5 border border-white/10 rounded-[35px] p-4 hover:border-[#FF2E95] transition-all cursor-pointer relative overflow-hidden group">
                <span className="text-xl font-black opacity-10">{day}</span>
                <div className="mt-2 space-y-2">
                  {dayEvents.map(e => (
                    <div key={e.id} className="relative group/item">
                      {e.gif_url && <img src={e.gif_url} className="w-full h-12 object-cover rounded-lg mb-1 opacity-80 group-hover/item:opacity-100 transition-all shadow-lg" alt="event gif"/>}
                      <div className={`${e.category === 'party' ? 'bg-[#FF2E95]' : 'bg-[#00F0FF]'} text-[7px] font-black uppercase p-1 rounded-md truncate`}>
                        {e.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* FEED LATÉRAL AVEC GIFS */}
        <div className="space-y-6">
          <h3 className="text-2xl font-black italic border-b border-white/10 pb-4">Live Feed 🔥</h3>
          <div className="space-y-6">
            {events.map(e => (
              <div key={e.id} className="bg-white/5 border border-white/10 rounded-[30px] overflow-hidden shadow-2xl transition-transform hover:scale-[1.02]">
                {e.gif_url && <img src={e.gif_url} className="w-full h-40 object-cover" alt="vibes" />}
                <div className="p-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-[#00F0FF] uppercase tracking-widest">May {e.day}</span>
                    <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-full uppercase">{e.category}</span>
                  </div>
                  <h4 className="font-black text-xl mb-4 uppercase">{e.title}</h4>
                  <button className="w-full bg-[#FF2E95] text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg">🔥 HYPE : {e.hype}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* MODALE AVEC RECHERCHE GIPHY */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-8 rounded-[50px] w-full max-w-xl shadow-[0_0_80px_rgba(255,46,149,0.3)]">
            <h3 className="text-4xl font-black mb-6 text-center uppercase italic">May {selectedDay} Vibes</h3>
            
            <input className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-xl font-bold mb-6 focus:border-[#D1FF4B] outline-none" placeholder="Event Name..." value={eventName} onChange={(e) => setEventName(e.target.value)} />
            
            {/* Recherche Giphy */}
            <div className="mb-6">
              <label className="text-[10px] font-bold uppercase text-[#00F0FF] mb-2 block">Set the tone with a GIF</label>
              <div className="flex gap-2 mb-4">
                <input className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm outline-none" placeholder="Search a vibe (ex: Dance, Food...)" value={gifSearch} onChange={(e) => setGifSearch(e.target.value)} />
                <button onClick={searchGifs} className="bg-white/10 px-4 rounded-xl font-bold text-xs hover:bg-white/20">Search</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {gifResults.map(g => (
                  <img 
                    key={g.id} 
                    src={g.images.fixed_height_small.url} 
                    onClick={() => setSelectedGif(g.images.fixed_height.url)}
                    className={`h-20 w-full object-cover rounded-xl cursor-pointer transition-all ${selectedGif === g.images.fixed_height.url ? 'ring-4 ring-[#D1FF4B] scale-95' : 'opacity-40 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-4 mb-8">
              <button onClick={() => setCategory("party")} className={`flex-1 py-4 rounded-2xl font-black uppercase transition-all ${category === 'party' ? 'bg-[#FF2E95]' : 'bg-white/5 opacity-30'}`}>🎉 Party</button>
              <button onClick={() => setCategory("dinner")} className={`flex-1 py-4 rounded-2xl font-black uppercase transition-all ${category === 'dinner' ? 'bg-[#00F0FF] text-black' : 'bg-white/5 opacity-30'}`}>🍽️ Dinner</button>
            </div>

            <button onClick={handleSave} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] shadow-xl uppercase tracking-widest text-lg hover:bg-white transition-colors">Broadcast Event</button>
            <button onClick={() => setSelectedDay(null)} className="w-full mt-4 text-white/20 text-[10px] font-bold uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

