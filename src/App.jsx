import React, { useState, useEffect, useRef } from 'react'
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [readComments, setReadComments] = useState(JSON.parse(localStorage.getItem('read-comments')) || {});
  const chatEndRef = useRef(null);

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

  // --- REALTIME ENGINE ---
  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase
      .channel('mega-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const old = payload.old;
          const now = payload.new;

          // Notif Nouveau Message (si ce n'est pas nous)
          if (now.comments?.length > (old?.comments?.length || 0)) {
            const lastMsg = now.comments[now.comments.length - 1];
            if (lastMsg.user !== user.name) {
              addNotification(`💬 ${lastMsg.user}: "${lastMsg.text.substring(0, 20)}..."`);
            }
          }
          // Notif Hype
          if (now.hype > (old?.hype || 0)) addNotification(`🔥 "${now.title}" is HYPED!`);
        }
        if (payload.eventType === 'INSERT') addNotification(`🆕 New Event: ${payload.new.title}`);
        
        fetchEvents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user, readComments]);

  // Scroll auto en bas du chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatEvent?.comments]);

  const addNotification = (msg) => {
    setNotifications(prev => [{ id: Date.now(), msg, time: format(new Date(), 'HH:mm') }, ...prev].slice(0, 10));
    setHasUnread(true);
  };

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end).order('date', { ascending: true });
    if (data) {
      setEvents(data);
      // Mettre à jour le chat ouvert s'il y a de nouveaux messages
      if (activeChatEvent) {
        const updated = data.find(e => e.id === activeChatEvent.id);
        if (updated) setActiveChatEvent(updated);
      }
    }
  }

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;

    const newComment = { 
      user: user.name, 
      avatar: user.avatar, 
      text: commentInput, 
      time: format(new Date(), 'HH:mm') 
    };

    // MISE À JOUR INSTANTANÉE (Optimistic UI)
    const updatedComments = [...(event.comments || []), newComment];
    setActiveChatEvent({ ...event, comments: updatedComments });
    setCommentInput("");

    // ENVOI SUPABASE
    await supabase.from('events').update({ 
      comments: updatedComments,
      last_comment_at: new Date().toISOString() 
    }).eq('id', event.id);

    setReadComments(prev => ({ ...prev, [event.id]: updatedComments.length }));
  };

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isAlreadyIn = current.some(a => a.name === user.name);
    const updated = isAlreadyIn ? current.filter(a => a.name !== user.name) : [...current, { name: user.name, avatar: user.avatar }];
    await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
  };

  const handleHype = async (event) => {
    await supabase.from('events').update({ hype: (event.hype || 0) + 1 }).eq('id', event.id);
    confetti({ particleCount: 30, origin: { y: 0.8 } });
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
              {hasUnread && <div className="absolute top-0 right-0 w-4 h-4 bg-[#FF2E95] rounded-full animate-bounce" />}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-4 w-72 bg-[#1a0b2e] border-2 border-[#D1FF4B] rounded-[30px] p-5 shadow-2xl z-[500]">
                {notifications.map(n => <div key={n.id} className="text-[11px] font-bold border-b border-white/5 py-2 uppercase italic">{n.msg}</div>)}
              </div>
            )}
          </div>
          <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-2 pr-6 rounded-full flex items-center gap-4 cursor-pointer hover:border-[#FF2E95]">
            <img src={user.avatar} className="w-10 h-10 rounded-full bg-black border border-white/10 shadow-lg" alt="avatar" />
            <span className="font-black text-[11px] uppercase tracking-tighter">{user.name || "Set Identity"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3">
          {/* CALENDAR */}
          <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[35px] border border-white/5">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">◀</button>
            <h2 className="text-3xl font-black uppercase italic text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">▶</button>
          </div>
          <div className="grid grid-cols-7 gap-3">
            {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`min-h-[110px] rounded-[25px] p-3 border transition-all ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95]' : 'opacity-0'}`}>
                  <span className="text-[11px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-col gap-1.5 mt-2">{dayEvents.map(e => <div key={e.id} className="text-[7px] font-black bg-[#FF2E95] text-white px-2 py-1 rounded-md truncate uppercase">{e.title}</div>)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* FEED */}
        <div className="space-y-6">
          {events.map(e => {
            const unreadCount = (e.comments?.length || 0) - (readComments[e.id] || 0);
            return (
              <div key={e.id} className={`bg-white/5 border-2 rounded-[40px] overflow-hidden group transition-all ${e.hype > 10 ? 'border-[#D1FF4B] shadow-neon' : 'border-white/10'}`}>
                {e.gif_url && <img src={e.gif_url} className="w-full h-40 object-cover opacity-70" alt="vibe" />}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-xl font-black uppercase tracking-tighter leading-none">{e.title}</h4>
                    <button onClick={() => handleHype(e)} className="bg-white/10 hover:bg-[#D1FF4B] hover:text-black p-2 px-3 rounded-full flex items-center gap-2 transition-all">
                      <span className="text-lg">⚡️</span>
                      <span className="font-black text-xs">{e.hype || 0}</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleJoin(e)} className="flex-1 bg-[#FF2E95] py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                      {e.attendees?.some(a => a.name === user.name) ? 'Leave' : 'Join'}
                    </button>
                    <button onClick={() => { setActiveChatEvent(e); setReadComments(prev => ({ ...prev, [e.id]: e.comments?.length || 0 })); }} className="relative bg-white/10 p-3 rounded-2xl text-xl hover:bg-[#00F0FF] hover:text-black transition-colors">
                      💬
                      {unreadCount > 0 && <div className="absolute -top-1 -right-1 bg-[#FF2E95] text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0b0118]">{unreadCount}</div>}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* CHAT MODAL */}
      {activeChatEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[800] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#00F0FF] p-8 rounded-[50px] w-full max-w-lg h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
              <h3 className="text-2xl font-black uppercase italic text-[#00F0FF]">{activeChatEvent.title}</h3>
              <button onClick={() => setActiveChatEvent(null)} className="text-white/40 uppercase font-black text-[10px]">Close</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
              {(activeChatEvent.comments || []).map((c, i) => (
                <div key={i} className={`flex gap-3 ${c.user === user.name ? 'flex-row-reverse' : ''}`}>
                  <img src={c.avatar} className="w-8 h-8 rounded-full border border-white/10 shadow-lg" />
                  <div className={`p-3 rounded-2xl max-w-[80%] ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/10 rounded-tl-none'}`}>
                    <p className="text-[8px] font-black uppercase opacity-60 mb-1">{c.user}</p>
                    <p className="text-sm font-bold leading-tight">{c.text}</p>
                    <p className="text-[7px] text-right mt-1 opacity-40 font-black">{c.time}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
              <input 
                className="bg-transparent flex-1 px-4 font-bold outline-none text-sm" 
                placeholder="Message..." 
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && postComment(activeChatEvent)}
              />
              <button onClick={() => postComment(activeChatEvent)} className="bg-[#00F0FF] text-black font-black px-6 py-3 rounded-xl uppercase text-[10px] tracking-widest active:scale-95 transition-transform">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE PROFIL (Gardée pour l'édition) */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[900] flex items-center justify-center p-4">
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[60px] w-full max-w-sm">
             <div className="flex flex-col items-center gap-8">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#FF2E95]" alt="preview" />
                <input className="input-field text-center text-xl" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} />
                <button onClick={() => { setIsEditingProfile(false); confetti({ particleCount: 30 }); }} className="w-full bg-[#D1FF4B] text-black font-black py-6 rounded-[30px] uppercase tracking-widest text-lg hover:scale-105 transition-transform">Save Identity</button>
             </div>
           </div>
        </div>
      )}

      {/* MODALE CREATE EVENT (Simplifiée) */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-8 rounded-[40px] w-full max-w-xl">
             <h3 className="text-2xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">New Vibe on {format(selectedDay, 'dd MMM')}</h3>
             <div className="space-y-4 mb-8">
               <input className="input-field" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <input className="input-field" placeholder="GIF Vibe Search..." onChange={e => searchGiphy(e.target.value)} />
               <div className="grid grid-cols-3 gap-2">
                 {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-20 w-full object-cover rounded-xl cursor-pointer border-2 ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40'}`} alt="gif" />)}
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Create Event</button>
             <button onClick={() => setSelectedDay(null)} className="w-full mt-4 text-[10px] opacity-30 uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      <style>{`.input-field { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 18px; font-weight: bold; outline: none; width: 100%; color: white; }.shadow-neon { box-shadow: 0 0 30px rgba(209,255,75,0.3); border-color: #D1FF4B; }.custom-scrollbar::-webkit-scrollbar { width: 5px; }.custom-scrollbar::-webkit-scrollbar-thumb { background: #00F0FF; border-radius: 10px; }`}</style>
    </div>
  )
}
export default App

