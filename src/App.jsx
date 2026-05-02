import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay 
} from 'date-fns'

// --- CONFIG ---
const GIPHY_API_KEY = "cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj";

function App() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 
  const [events, setEvents] = useState([]);
  const [allTimeStats, setAllTimeStats] = useState({ hosted: 0, joined: 0 });
  
  // --- USER PROFILE ---
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Ready to vibe ⚡️",
    insta: "",
    badges: ["Member"]
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // --- FORM & GIPHY & EDITION ---
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    fetchEvents();
    fetchAllTimeStats();
  }, [currentMonth, user]);

  // --- STATS GLOBALES ---
  async function fetchAllTimeStats() {
    const { data } = await supabase.from('events').select('attendees');
    if (data) {
      const hosted = data.filter(e => e.attendees?.[0]?.name === user.name).length;
      const joined = data.filter(e => e.attendees?.some(a => a.name === user.name)).length;
      setAllTimeStats({ hosted, joined });
    }
  }

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end);
    if (data) setEvents(data);
  }

  // --- RECHERCHE GIPHY ---
  const searchGiphy = async (query) => {
    setGifSearch(query);
    if (query.length < 2) return;
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${query}&limit=6`);
      const { data } = await res.json();
      if (data) setGifResults(data);
    } catch (e) { console.error("Giphy error", e); }
  };

  // --- ACTIONS : DELETE / EDIT / JOIN ---
  const deleteEvent = async (id) => {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (!error) fetchEvents();
  };

  const openEditModal = (event) => {
    setEditingEventId(event.id);
    setSelectedDay(new Date(event.date));
    setForm({
      title: event.title,
      price: event.price,
      location: event.location,
      description: event.description
    });
    setSelectedGif(event.gif_url);
  };

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const participant = { name: user.name, avatar: user.avatar };
    const currentAttendees = event.attendees || [];
    const isAlreadyIn = currentAttendees.some(a => a.name === user.name);
    const updatedAttendees = isAlreadyIn 
      ? currentAttendees.filter(a => a.name !== user.name) 
      : [...currentAttendees, participant];

    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
    fetchEvents();
  };

  const handleSaveEvent = async () => {
    if (!form.title || !selectedDay) return;
    
    const eventData = { 
      ...form, 
      date: format(selectedDay, 'yyyy-MM-dd'), 
      gif_url: selectedGif 
    };

    if (editingEventId) {
      // UPDATE
      await supabase.from('events').update(eventData).eq('id', editingEventId);
    } else {
      // CREATE
      await supabase.from('events').insert([{ 
        ...eventData, 
        attendees: [{ name: user.name, avatar: user.avatar }] 
      }]);
    }
    
    confetti({ particleCount: 150, spread: 70 });
    setEditingEventId(null);
    setSelectedDay(null);
    setSelectedGif(null);
    setGifResults([]);
    setGifSearch("");
    setForm({ title: "", price: "", location: "", description: "" });
    fetchEvents();
    fetchAllTimeStats();
  };

  const getBadges = () => {
    let b = ["Member"];
    if (allTimeStats.hosted >= 1) b.push("Host");
    if (allTimeStats.hosted >= 3) b.push("Party Starter 🏆");
    if (allTimeStats.joined >= 5) b.push("Socialite 🔥");
    return b;
  };

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-10">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-16 flex flex-col md:flex-row justify-between items-center gap-8">
        <div>
          <h1 className="text-7xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon mb-4">SOCIAL HUB!</h1>
          <div className="flex flex-wrap gap-2">
            {getBadges().map(b => (
              <span key={b} className="bg-white/10 border border-white/20 text-[8px] font-black px-3 py-1 rounded-full uppercase text-[#00F0FF]">{b}</span>
            ))}
          </div>
        </div>
        
        <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-5 rounded-[40px] flex items-center gap-6 cursor-pointer hover:bg-white/10 transition-all border-l-4 border-l-[#FF2E95] min-w-[320px]">
          <img src={user.avatar} className="w-16 h-16 rounded-full border-2 border-[#D1FF4B]" alt="avatar" />
          <div>
            <h4 className="font-black text-xl uppercase tracking-tighter">{user.name || "Set Identity"}</h4>
            <div className="flex gap-4 mt-1">
              <span className="text-[9px] font-black opacity-40 uppercase">{allTimeStats.hosted} Hosted</span>
              <span className="text-[9px] font-black opacity-40 uppercase">{allTimeStats.joined} Joined</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        
        {/* CALENDRIER */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[30px] border border-white/5">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black hover:scale-125 transition-transform">◀</button>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black hover:scale-125 transition-transform">▶</button>
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
                    {dayEvents.map(e => (
                      <div key={e.id} className="text-[7px] font-black bg-[#FF2E95] text-white px-2 py-1 rounded-md truncate uppercase shadow-lg">
                        {e.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* FEED AVEC EDIT & DELETE */}
        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase text-[#00F0FF] italic tracking-widest border-b border-white/10 pb-4">Upcoming Vibes</h3>
          {events.map(e => (
            <div key={e.id} className="bg-white/5 border border-white/10 rounded-[35px] overflow-hidden group relative transition-all hover:border-[#D1FF4B]">
              
              {/* CONTROLES SI HOST */}
              {e.attendees?.[0]?.name === user.name && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  <button onClick={() => openEditModal(e)} className="bg-black/50 hover:bg-[#00F0FF] p-2 rounded-full transition-all text-xs">✏️</button>
                  <button onClick={() => deleteEvent(e.id)} className="bg-black/50 hover:bg-red-500 p-2 rounded-full transition-all text-xs">🗑️</button>
                </div>
              )}

              {e.gif_url && <img src={e.gif_url} className="w-full h-40 object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="vibe" />}
              <div className="p-6">
                <h4 className="text-xl font-black uppercase mb-4">{e.title}</h4>
                <div className="flex -space-x-2 mb-6">
                  {e.attendees?.map((a, idx) => (
                    <img key={idx} src={a.avatar} className="w-8 h-8 rounded-full border-2 border-[#0b0118] bg-[#1a0b2e]" title={a.name} />
                  ))}
                </div>
                <button onClick={() => handleJoin(e)} className="w-full bg-white/10 hover:bg-[#FF2E95] py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all">
                   {e.attendees?.some(a => a.name === user.name) ? 'Leave Vibe' : 'Join the Vibe 🙋‍♂️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODALE DUAL : ADD & EDIT */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-8 rounded-[50px] w-full max-w-xl overflow-y-auto max-h-[90vh] shadow-2xl">
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">
               {editingEventId ? "Update Vibe" : `Setup ${format(selectedDay, 'dd MMM')}`}
             </h3>
             
             <div className="space-y-4 mb-8">
               <input className="input-field w-full" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               
               <div className="bg-white/5 p-5 rounded-[30px] border border-white/10 space-y-4">
                 <p className="text-[10px] font-black uppercase text-[#00F0FF] tracking-widest">Giphy Vibe Search</p>
                 <input className="input-field w-full" placeholder="Techno, Chill, Rooftop..." value={gifSearch} onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-2">
                   {gifResults.map(g => (
                     <img 
                       key={g.id} 
                       src={g.images.fixed_height_small.url} 
                       onClick={() => setSelectedGif(g.images.fixed_height.url)}
                       className={`h-20 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40 hover:opacity-100'}`} 
                     />
                   ))}
                 </div>
               </div>
             </div>

             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest text-lg hover:bg-white transition-all">
                {editingEventId ? "Save Changes" : "Create Event"}
             </button>
             <button onClick={() => { setSelectedDay(null); setEditingEventId(null); setForm({title:"", price:"", location:"", description:""}); }} className="w-full mt-4 text-[10px] opacity-30 uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      {/* MODALE PROFIL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[55px] w-full max-w-md">
             <h3 className="text-3xl font-black mb-8 italic text-[#D1FF4B] text-center uppercase">My Identity</h3>
             <div className="flex flex-col items-center gap-6">
                <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-[#FF2E95] bg-[#0b0118]" alt="preview" />
                <input className="input-field w-full" placeholder="Username" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} />
                <input className="input-field w-full" placeholder="Bio / Status" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Save Identity</button>
             </div>
           </div>
        </div>
      )}

      <style>{`
        .input-field { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 16px; font-weight: bold; outline: none; font-size: 14px; transition: all 0.3s; }
        .input-field:focus { border-color: #FF2E95; }
        .shadow-neon { text-shadow: 0 0 20px rgba(209,255,75,0.5); }
      `}</style>
    </div>
  )
}

export default App

