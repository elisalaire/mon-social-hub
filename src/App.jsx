import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay 
} from 'date-fns'

const GIPHY_API_KEY = "cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj";

function App() {
  // --- STATES ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 
  const [events, setEvents] = useState([]);
  const [allTimeStats, setAllTimeStats] = useState({ hosted: 0, joined: 0 });
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Exploring the Hub ⚡️"
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [form, setForm] = useState({ title: "", price: "", location: "", description: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  // --- REALTIME & FETCH ---
  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    fetchEvents();
    fetchAllTimeStats();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          addNotification(`🚀 New Vibe: ${payload.new.title}`);
        }
        if (payload.eventType === 'UPDATE') {
          const attendees = payload.new.attendees || [];
          const lastPerson = attendees.length > 0 ? attendees[attendees.length - 1].name : "Someone";
          addNotification(`✨ ${lastPerson} interacted with "${payload.new.title}"`);
        }
        fetchEvents();
        fetchAllTimeStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user]);

  const addNotification = (msg) => {
    setNotifications(prev => [{ id: Date.now(), msg, time: format(new Date(), 'HH:mm') }, ...prev].slice(0, 8));
    setHasUnread(true);
  };

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

  const searchGiphy = async (query) => {
    setGifSearch(query);
    if (query.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${query}&limit=6`);
    const { data } = await res.json();
    if (data) setGifResults(data);
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
  };

  const handleSaveEvent = async () => {
    if (!form.title || !selectedDay) return;
    const eventData = { 
      ...form, 
      date: format(selectedDay, 'yyyy-MM-dd'), 
      gif_url: selectedGif 
    };

    if (editingEventId) {
      await supabase.from('events').update(eventData).eq('id', editingEventId);
    } else {
      // IMPORTANT: On initialise attendees avec le créateur
      await supabase.from('events').insert([{ 
        ...eventData, 
        attendees: [{ name: user.name, avatar: user.avatar }] 
      }]);
    }
    
    confetti({ particleCount: 150 });
    setEditingEventId(null);
    setSelectedDay(null);
    setSelectedGif(null);
    setForm({ title: "", price: "", location: "", description: "" });
  };

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-10">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-16 flex flex-col md:flex-row justify-between items-center gap-8">
        <h1 className="text-6xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon">SOCIAL HUB!</h1>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <button onClick={() => { setShowNotifs(!showNotifs); setHasUnread(false); }} className="p-4 bg-white/5 rounded-full border border-white/10 relative hover:bg-white/10 transition-all">
              <span className="text-xl">🔔</span>
              {hasUnread && <div className="absolute top-0 right-0 w-4 h-4 bg-[#FF2E95] rounded-full border-2 border-[#0b0118] animate-pulse" />}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-4 w-72 bg-[#1a0b2e] border-2 border-[#D1FF4B] rounded-[30px] p-5 shadow-2xl z-[200]">
                <h4 className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest">Recent Activity</h4>
                <div className="space-y-3">
                  {notifications.length === 0 && <p className="text-xs opacity-20 italic">Nothing new yet...</p>}
                  {notifications.map(n => (
                    <div key={n.id} className="text-[11px] font-bold border-b border-white/5 pb-2">
                      <span className="text-[#00F0FF] mr-2">{n.time}</span> {n.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-4 rounded-full flex items-center gap-4 cursor-pointer hover:bg-white/10 border-l-4 border-l-[#FF2E95]">
            <img src={user.avatar} className="w-10 h-10 rounded-full bg-black border border-white/20" alt="avatar" />
            <div>
              <p className="font-black text-xs uppercase leading-none">{user.name || "Set Identity"}</p>
              <p className="text-[9px] font-bold text-[#00F0FF] uppercase opacity-60">Level {allTimeStats.joined}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* CALENDAR */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[35px] border border-white/5">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">◀</button>
            <h2 className="text-3xl font-black uppercase italic text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
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

        {/* FEED */}
        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase text-[#00F0FF] italic tracking-widest border-b border-white/10 pb-4">Live Vibes</h3>
          {events.map(e => (
            <div key={e.id} className="bg-white/5 border border-white/10 rounded-[35px] overflow-hidden group relative transition-all hover:border-[#D1FF4B]">
              {e.attendees?.[0]?.name === user.name && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  <button onClick={() => { setEditingEventId(e.id); setSelectedDay(new Date(e.date)); setForm({title:e.title, price:e.price, location:e.location, description:e.description}); setSelectedGif(e.gif_url); }} className="bg-black/50 hover:bg-[#00F0FF] p-2 rounded-full text-xs transition-colors">✏️</button>
                  <button onClick={() => supabase.from('events').delete().eq('id', e.id)} className="bg-black/50 hover:bg-red-500 p-2 rounded-full text-xs transition-colors">🗑️</button>
                </div>
              )}
              {e.gif_url && <img src={e.gif_url} className="w-full h-40 object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="vibe" />}
              <div className="p-6">
                <h4 className="text-xl font-black uppercase mb-4 tracking-tighter">{e.title}</h4>
                <div className="flex -space-x-3 mb-8">
                  {e.attendees?.map((a, idx) => (
                    <img key={idx} src={a.avatar} className="w-10 h-10 rounded-full border-4 border-[#0b0118] bg-[#1a0b2e]" title={a.name} />
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

      {/* EVENT MODAL */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-8 rounded-[50px] w-full max-w-xl overflow-y-auto max-h-[90vh] shadow-2xl">
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">
               {editingEventId ? "Edit Vibe" : `Setup ${format(selectedDay, 'dd MMM')}`}
             </h3>
             <div className="space-y-4 mb-8">
               <input className="input-field w-full" placeholder="Vibe Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <div className="bg-white/5 p-5 rounded-[30px] border border-white/10 space-y-4">
                 <p className="text-[10px] font-black uppercase text-[#00F0FF] tracking-widest text-center">Set the GIF Vibe</p>
                 <input className="input-field w-full" placeholder="Search Giphy..." value={gifSearch} onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-2">
                   {gifResults.map(g => (
                     <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-20 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40'}`} alt="gif" />
                   ))}
                 </div>
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest text-lg hover:bg-white transition-all">
                {editingEventId ? "Save Changes" : "Broadcast Event"}
             </button>
             <button onClick={() => { setSelectedDay(null); setEditingEventId(null); setForm({title:"", price:"", location:"", description:""}); }} className="w-full mt-4 text-[10px] opacity-30 uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[55px] w-full max-w-md">
             <div className="flex flex-col items-center gap-6">
                <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-[#FF2E95] bg-[#0b0118]" alt="preview" />
                <input className="input-field w-full text-center" placeholder="Username" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Save Identity</button>
             </div>
           </div>
        </div>
      )}

      <style>{`
        .input-field { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 16px; font-weight: bold; outline: none; font-size: 14px; width: 100%; color: white; }
        .input-field:focus { border-color: #FF2E95; background: rgba(255,255,255,0.08); }
        .shadow-neon { text-shadow: 0 0 20px rgba(209,255,75,0.5); }
      `}</style>
    </div>
  )
}
export default App

