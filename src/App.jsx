import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay 
} from 'date-fns'

const GIPHY_API_KEY = "cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj";

function App() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 
  const [events, setEvents] = useState([]);
  const [allTimeStats, setAllTimeStats] = useState({ hosted: 0, joined: 0 });
  
  // --- NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // --- USER PROFILE ---
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Exploring the Hub ⚡️",
    badges: ["Member"]
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // --- FORM & GIPHY ---
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    fetchEvents();
    fetchAllTimeStats();

    // --- REALTIME SUBSCRIPTION ---
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          addNotification(`🚀 New Vibe created: ${payload.new.title}`);
        }
        if (payload.eventType === 'UPDATE') {
          addNotification(`🙋‍♂️ Update on "${payload.new.title}"`);
        }
        fetchEvents();
        fetchAllTimeStats();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentMonth, user]);

  const addNotification = (msg) => {
    setNotifications(prev => [{ id: Date.now(), msg, time: new Date() }, ...prev].slice(0, 5));
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
    const eventData = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };

    if (editingEventId) {
      await supabase.from('events').update(eventData).eq('id', editingEventId);
    } else {
      await supabase.from('events').insert([{ ...eventData, attendees: [{ name: user.name, avatar: user.avatar }] }]);
    }
    
    confetti({ particleCount: 150 });
    setEditingEventId(null);
    setSelectedDay(null);
    setForm({ title: "", price: "", location: "", description: "" });
  };

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-10">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-16 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start">
          <h1 className="text-7xl font-black text-[#D1FF4B] italic tracking-tighter mb-4 shadow-neon">SOCIAL HUB!</h1>
          <div className="flex gap-2">
            {allTimeStats.hosted >= 1 && <span className="bg-[#FF2E95] text-white text-[8px] font-black px-3 py-1 rounded-full uppercase">Host</span>}
            {allTimeStats.joined >= 5 && <span className="bg-[#00F0FF] text-black text-[8px] font-black px-3 py-1 rounded-full uppercase">Socialite</span>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* NOTIFICATION BELL */}
          <div className="relative">
            <button 
              onClick={() => { setShowNotifs(!showNotifs); setHasUnread(false); }}
              className="bg-white/5 border border-white/10 p-4 rounded-full hover:bg-white/10 transition-all relative"
            >
              <span className="text-xl">🔔</span>
              {hasUnread && <div className="absolute top-0 right-0 w-4 h-4 bg-[#FF2E95] rounded-full border-2 border-[#0b0118] animate-bounce" />}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-4 w-72 bg-[#1a0b2e] border border-[#D1FF4B] rounded-[30px] p-5 shadow-2xl z-[200]">
                <h4 className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest">Recent Activity</h4>
                <div className="space-y-4">
                  {notifications.length === 0 && <p className="text-xs opacity-20 italic">No news yet...</p>}
                  {notifications.map(n => (
                    <div key={n.id} className="text-[11px] font-bold border-b border-white/5 pb-2 leading-tight">
                      {n.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PROFILE CARD */}
          <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-5 rounded-[40px] flex items-center gap-6 cursor-pointer hover:bg-white/10 transition-all border-l-4 border-l-[#FF2E95] min-w-[280px]">
            <img src={user.avatar} className="w-14 h-14 rounded-full border-2 border-[#D1FF4B]" alt="avatar" />
            <div>
              <h4 className="font-black text-lg uppercase tracking-tighter">{user.name || "Set Identity"}</h4>
              <p className="text-[9px] font-black opacity-40 uppercase tracking-widest">{allTimeStats.joined} Vibes Joined</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* CALENDAR */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[35px] border border-white/5 shadow-2xl">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">◀</button>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-4">
            {eachDayOfInterval({ 
              start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
              end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
            }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`min-h-[120px] rounded-[30px] p-4 border transition-all ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95] hover:bg-white/10 active:scale-95' : 'opacity-0 pointer-events-none'}`}>
                  <span className="text-[12px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-col gap-2 mt-3">
                    {dayEvents.map(e => (
                      <div key={e.id} className="text-[8px] font-black bg-[#FF2E95] text-white px-2 py-1.5 rounded-xl truncate uppercase shadow-lg">
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
          <h3 className="text-xl font-black uppercase text-[#00F0FF] italic tracking-widest border-b border-white/10 pb-4">Timeline</h3>
          {events.map(e => (
            <div key={e.id} className="bg-white/5 border border-white/10 rounded-[40px] overflow-hidden group relative transition-all hover:border-[#D1FF4B]">
              {e.attendees?.[0]?.name === user.name && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  <button onClick={() => { setEditingEventId(e.id); setSelectedDay(new Date(e.date)); setForm({title:e.title, price:e.price, location:e.location, description:e.description}); }} className="bg-black/50 hover:bg-[#00F0FF] p-2 rounded-full text-xs">✏️</button>
                  <button onClick={() => supabase.from('events').delete().eq('id', e.id)} className="bg-black/50 hover:bg-red-500 p-2 rounded-full text-xs">🗑️</button>
                </div>
              )}
              {e.gif_url && <img src={e.gif_url} className="w-full h-44 object-cover opacity-80" alt="vibe" />}
              <div className="p-7">
                <h4 className="text-xl font-black uppercase mb-4 tracking-tighter">{e.title}</h4>
                <div className="flex -space-x-3 mb-8">
                  {e.attendees?.map((a, idx) => (
                    <img key={idx} src={a.avatar} className="w-10 h-10 rounded-full border-4 border-[#0b0118] bg-[#1a0b2e]" />
                  ))}
                </div>
                <button onClick={() => handleJoin(e)} className="w-full bg-white/10 hover:bg-[#FF2E95] py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all">
                   {e.attendees?.some(a => a.name === user.name) ? 'Leave Vibe' : 'Join Vibe'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODALS (Keep existing Profile & Event Modals) */}
      {/* ... Add Giphy search inside the event modal as before ... */}
    </div>
  )
}
export default App

