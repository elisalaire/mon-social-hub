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
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Vibe Curator ⚡️"
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeChatEvent, setActiveChatEvent] = useState(null);
  const [commentInput, setCommentInput] = useState("");

  const [form, setForm] = useState({ title: "", price: "", location: "", description: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    fetchEvents();
    fetchAllTimeStats();

    const channel = supabase
      .channel('mega-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        const old = payload.old;
        const now = payload.new;

        if (payload.eventType === 'INSERT') addNotification(`🆕 NEW: "${now.title}"`);
        
        if (payload.eventType === 'UPDATE') {
          if (now.hype > old?.hype) addNotification(`🔥 HYPE UP: "${now.title}" is heating up!`);
          else if (now.comments?.length > old?.comments?.length) addNotification(`💬 CHAT: New message on "${now.title}"`);
          else if (now.attendees?.length > old?.attendees?.length) addNotification(`🙋‍♂️ JOIN: Someone joined "${now.title}"`);
        }
        fetchEvents();
        fetchAllTimeStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user]);

  const addNotification = (msg) => {
    setNotifications(prev => [{ id: Date.now(), msg, time: format(new Date(), 'HH:mm') }, ...prev].slice(0, 10));
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
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end).order('date', { ascending: true });
    if (data) setEvents(data);
  }

  const handleHype = async (event) => {
    await supabase.from('events').update({ hype: (event.hype || 0) + 1 }).eq('id', event.id);
    confetti({ particleCount: 30, origin: { y: 0.8 }, colors: ['#FF2E95', '#D1FF4B'] });
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { 
      user: user.name, 
      avatar: user.avatar, 
      text: commentInput, 
      time: format(new Date(), 'HH:mm') 
    };
    const updatedComments = [...(event.comments || []), newComment];
    await supabase.from('events').update({ comments: updatedComments }).eq('id', event.id);
    setCommentInput("");
  };

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const currentAttendees = event.attendees || [];
    const isAlreadyIn = currentAttendees.some(a => a.name === user.name);
    const updatedAttendees = isAlreadyIn 
      ? currentAttendees.filter(a => a.name !== user.name) 
      : [...currentAttendees, { name: user.name, avatar: user.avatar }];
    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
  };

  const handleSaveEvent = async () => {
    if (!form.title || !selectedDay) return;
    const eventData = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    if (editingEventId) await supabase.from('events').update(eventData).eq('id', editingEventId);
    else await supabase.from('events').insert([{ ...eventData, attendees: [{ name: user.name, avatar: user.avatar }] }]);
    setSelectedDay(null); setEditingEventId(null);
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-10">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-16 flex justify-between items-center">
        <h1 className="text-5xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon">SOCIAL HUB!</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button onClick={() => { setShowNotifs(!showNotifs); setHasUnread(false); }} className="p-4 bg-white/5 rounded-full relative">
              <span className="text-xl">🔔</span>
              {hasUnread && <div className="absolute top-0 right-0 w-4 h-4 bg-[#FF2E95] rounded-full animate-ping" />}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-4 w-72 bg-[#1a0b2e] border-2 border-[#D1FF4B] rounded-[30px] p-5 shadow-2xl z-[500]">
                {notifications.map(n => <div key={n.id} className="text-[11px] font-bold border-b border-white/5 py-2 uppercase italic">{n.msg}</div>)}
              </div>
            )}
          </div>
          <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-2 pr-6 rounded-full flex items-center gap-4 cursor-pointer hover:border-[#FF2E95] transition-all">
            <img src={user.avatar} className="w-10 h-10 rounded-full border border-white/10" alt="avatar" />
            <span className="font-black text-[11px] uppercase">{user.name || "Set Profile"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3">
          {/* CALENDAR (Identique) */}
          <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[35px] border border-white/5 shadow-2xl">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">◀</button>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">▶</button>
          </div>
          <div className="grid grid-cols-7 gap-3">
            {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`min-h-[110px] rounded-[25px] p-3 border transition-all ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95]' : 'opacity-0 pointer-events-none'}`}>
                  <span className="text-[11px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-col gap-1.5 mt-2">{dayEvents.map(e => <div key={e.id} className="text-[7px] font-black bg-[#FF2E95] text-white px-2 py-1 rounded-md truncate uppercase">{e.title}</div>)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* FEED AVEC HYPE & CHAT */}
        <div className="space-y-6">
          {events.map(e => (
            <div key={e.id} className={`bg-white/5 border-2 rounded-[40px] overflow-hidden relative transition-all ${e.hype > 10 ? 'border-[#D1FF4B] shadow-[0_0_20px_rgba(209,255,75,0.2)]' : 'border-white/10'}`}>
              {e.gif_url && <img src={e.gif_url} className="w-full h-40 object-cover opacity-70" alt="vibe" />}
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-xl font-black uppercase leading-none">{e.title}</h4>
                  <button onClick={() => handleHype(e)} className="bg-white/10 hover:bg-[#D1FF4B] hover:text-black p-2 px-3 rounded-full transition-all flex items-center gap-2">
                    <span className="text-lg">⚡️</span>
                    <span className="font-black text-xs">{e.hype || 0}</span>
                  </button>
                </div>

                <div className="flex -space-x-2 mb-6">
                  {e.attendees?.map((a, idx) => <img key={idx} src={a.avatar} className="w-8 h-8 rounded-full border-2 border-[#0b0118]" />)}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => handleJoin(e)} className="flex-1 bg-[#FF2E95] py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    {e.attendees?.some(a => a.name === user.name) ? 'Leave' : 'Join'}
                  </button>
                  <button onClick={() => setActiveChatEvent(e)} className="bg-white/10 p-3 rounded-2xl text-xl hover:bg-[#00F0FF] hover:text-black transition-colors">💬</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* CHAT MODAL (VIBE CHAT) */}
      {activeChatEvent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[800] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#00F0FF] p-8 rounded-[50px] w-full max-w-lg h-[80vh] flex flex-col">
            <div className="flex justify-between mb-6">
              <h3 className="text-2xl font-black uppercase italic text-[#00F0FF]">{activeChatEvent.title} Chat</h3>
              <button onClick={() => setActiveChatEvent(null)} className="text-white/40 uppercase font-black text-xs">Close</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
              {(activeChatEvent.comments || []).map((c, i) => (
                <div key={i} className={`flex gap-3 ${c.user === user.name ? 'flex-row-reverse' : ''}`}>
                  <img src={c.avatar} className="w-8 h-8 rounded-full bg-white/10" />
                  <div className={`p-3 rounded-2xl max-w-[80%] ${c.user === user.name ? 'bg-[#00F0FF] text-black' : 'bg-white/10'}`}>
                    <p className="text-[9px] font-black uppercase opacity-60 mb-1">{c.user}</p>
                    <p className="text-sm font-bold leading-tight">{c.text}</p>
                    <p className="text-[7px] text-right mt-1 opacity-40">{c.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input 
                className="input-field flex-1" 
                placeholder="Type a message..." 
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && postComment(activeChatEvent)}
              />
              <button onClick={() => postComment(activeChatEvent)} className="bg-[#00F0FF] text-black font-black px-6 rounded-2xl uppercase text-xs">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES CREATE & PROFILE (Gardées mais simplifiées) */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-8 rounded-[50px] w-full max-w-xl overflow-y-auto max-h-[90vh]">
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">Broadcast Vibe</h3>
             <div className="space-y-4 mb-8">
               <input className="input-field" placeholder="Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <input className="input-field" placeholder="Giphy Vibe Search..." onChange={e => searchGiphy(e.target.value)} />
               <div className="grid grid-cols-3 gap-2">
                  {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-16 w-full object-cover rounded-xl cursor-pointer border-2 ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent'}`} />)}
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Create Event</button>
             <button onClick={() => setSelectedDay(null)} className="w-full mt-4 text-[10px] opacity-30 uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[700] flex items-center justify-center p-4">
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[60px] w-full max-w-md">
             <div className="flex flex-col items-center gap-8">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#FF2E95]" alt="preview" />
                <input className="input-field text-center text-xl" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-6 rounded-[30px] uppercase">Save Identity</button>
             </div>
           </div>
        </div>
      )}

      <style>{`.input-field { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 18px; font-weight: bold; outline: none; width: 100%; color: white; }.shadow-neon { text-shadow: 0 0 20px rgba(209,255,75,0.5); }.custom-scrollbar::-webkit-scrollbar { width: 4px; }.custom-scrollbar::-webkit-scrollbar-thumb { background: #00F0FF; border-radius: 10px; }`}</style>
    </div>
  )
}
export default App

