import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isPast
} from 'date-fns'

const GIPHY_API_KEY = "cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj";

function App() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [readComments, setReadComments] = useState(JSON.parse(localStorage.getItem('read-comments')) || {});
  
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Vibe Curator ⚡️"
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeChatEvent, setActiveChatEvent] = useState(null);
  const [commentInput, setCommentInput] = useState("");

  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "" });
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  // --- LOGIQUE LEADERBOARD ---
  const leaderboard = events
    .reduce((acc, event) => {
      const host = event.attendees?.[0]?.name || "Unknown";
      const hostAvatar = event.attendees?.[0]?.avatar;
      const existing = acc.find(u => u.name === host);
      if (existing) existing.score += (event.hype || 0);
      else acc.push({ name: host, avatar: hostAvatar, score: (event.hype || 0) });
      return acc;
    }, [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    fetchEvents();

    const channel = supabase.channel('alpha-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user]);

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end).order('date', { ascending: true });
    if (data) setEvents(data);
  }

  const handleHype = async (event) => {
    await supabase.from('events').update({ hype: (event.hype || 0) + 1 }).eq('id', event.id);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.8 } });
  };

  const handleSaveEvent = async () => {
    const eventData = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    if (editingEventId) await supabase.from('events').update(eventData).eq('id', editingEventId);
    else await supabase.from('events').insert([{ ...eventData, attendees: [{ name: user.name, avatar: user.avatar }] }]);
    setSelectedDay(null); setEditingEventId(null); setSelectedGif(null);
  };

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-8">
      
      {/* HEADER & LEADERBOARD */}
      <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-center gap-8">
        <div>
          <h1 className="text-6xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon mb-2">SOCIAL HUB!</h1>
          <div className="flex gap-4 items-center bg-white/5 p-3 rounded-2xl border border-white/10">
            <p className="text-[10px] font-black uppercase opacity-40">Top Kings:</p>
            {leaderboard.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <img src={u.avatar} className="w-6 h-6 rounded-full border border-[#D1FF4B]" />
                <span className="text-[10px] font-bold">{u.name} {i === 0 && '👑'}</span>
              </div>
            ))}
          </div>
        </div>

        <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-2 pr-6 rounded-full flex items-center gap-4 cursor-pointer hover:border-[#FF2E95] transition-all">
          <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-[#FF2E95]" alt="avatar" />
          <span className="font-black text-xs uppercase">{user.name || "Set Profile"}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        
        {/* CALENDAR (Identique) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[35px] border border-white/5 shadow-2xl">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">◀</button>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">▶</button>
          </div>
          <div className="grid grid-cols-7 gap-3">
            {eachDayOfInterval({ 
              start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
              end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
            }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`min-h-[110px] rounded-[25px] p-3 border transition-all ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95] hover:bg-white/10' : 'opacity-0 pointer-events-none'}`}>
                  <span className="text-[11px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {dayEvents.map(e => <div key={e.id} className="text-[7px] font-black bg-[#FF2E95] text-white px-2 py-1 rounded-md truncate uppercase">{e.title}</div>)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* FEED AVEC MAPS & RECAP */}
        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase text-[#00F0FF] italic tracking-widest border-b border-white/10 pb-4">Live Timeline</h3>
          {events.map(e => {
            const isPastEvent = isPast(new Date(e.date)) && !isSameDay(new Date(e.date), new Date());
            return (
              <div key={e.id} className={`bg-white/5 border-2 rounded-[40px] overflow-hidden group transition-all ${isPastEvent ? 'grayscale-[0.5] opacity-80 border-white/5' : 'border-white/10'}`}>
                
                {/* Photo Souvenir si passée, sinon GIF */}
                <img src={isPastEvent && e.recap_url ? e.recap_url : e.gif_url} className="w-full h-44 object-cover" alt="vibe" />
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xl font-black uppercase tracking-tighter">{e.title}</h4>
                    {!isPastEvent && (
                      <button onClick={() => handleHype(e)} className="bg-white/10 p-2 px-3 rounded-full flex items-center gap-2">
                        <span className="text-lg">⚡️</span>
                        <span className="font-black text-xs">{e.hype || 0}</span>
                      </button>
                    )}
                  </div>

                  {/* LIEN MAPS */}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`} target="_blank" className="text-[10px] font-black text-[#D1FF4B] hover:underline mb-4 block uppercase tracking-widest">
                    📍 {e.location || "Secret Place"}
                  </a>

                  {isPastEvent ? (
                    <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black uppercase opacity-40 mb-1 italic">Vibe Memories</p>
                      {e.recap_url ? <p className="text-[10px] font-bold italic opacity-60">"Great times..."</p> : <p className="text-[10px] italic opacity-40">No photos shared.</p>}
                    </div>
                  ) : (
                    <button onClick={() => {}} className="w-full bg-[#FF2E95] py-3 rounded-2xl text-[10px] font-black uppercase">Join the Crew</button>
                  )}
                  
                  {/* Bouton Edit pour ajouter le Recap URL après l'event */}
                  {e.attendees?.[0]?.name === user.name && (
                    <button onClick={() => { setEditingEventId(e.id); setSelectedDay(new Date(e.date)); setForm(e); setSelectedGif(e.gif_url); }} className="mt-4 w-full text-[8px] font-black uppercase opacity-20 hover:opacity-100 transition-opacity">Edit Vibe Settings</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* MODALE CREATE/EDIT (Inclut Recap URL) */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-8 rounded-[50px] w-full max-w-xl overflow-y-auto max-h-[90vh]">
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">{editingEventId ? "Update Vibe" : "Create Event"}</h3>
             <div className="space-y-4 mb-8">
               <input className="input-field" placeholder="Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <input className="input-field" placeholder="Exact Location (for Maps)" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               {editingEventId && (
                 <div className="bg-[#FF2E95]/10 p-4 rounded-2xl border border-[#FF2E95]/20">
                   <label className="text-[10px] font-black uppercase text-[#FF2E95] block mb-2 tracking-widest text-center">Post a Memory Photo (URL)</label>
                   <input className="input-field" placeholder="https://image-link.com/..." value={form.recap_url} onChange={e => setForm({...form, recap_url: e.target.value})} />
                 </div>
               )}
               {/* Giphy Search... (Garder le même code) */}
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest text-lg">Confirm Vibe</button>
             <button onClick={() => setSelectedDay(null)} className="w-full mt-4 text-[10px] opacity-30 uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      {/* MODALE PROFIL (Identique) */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[700] flex items-center justify-center p-4">
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[60px] w-full max-w-md shadow-2xl">
             <div className="flex flex-col items-center gap-8">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#FF2E95]" alt="preview" />
                <input className="input-field text-center text-xl uppercase font-black" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-6 rounded-[30px] uppercase">Save Identity</button>
             </div>
           </div>
        </div>
      )}

      <style>{`.input-field { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 18px; font-weight: bold; outline: none; width: 100%; color: white; }.shadow-neon { text-shadow: 0 0 20px rgba(209,255,75,0.5); }`}</style>
    </div>
  )
}
export default App

