import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isPast
} from 'date-fns'

const GIPHY_API_KEY = "cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj";

function App() {
  // --- STATES ---
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
    bio: "Ready to make moves ⚡️"
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeChatEvent, setActiveChatEvent] = useState(null);
  const [commentInput, setCommentInput] = useState("");
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  // --- FUN STATUS LOGIC ---
  const joinedCount = events.filter(e => e.attendees?.some(a => a.name === user.name)).length;
  const getFunStatus = (count) => {
    if (count === 0) return "Ghost 👻";
    if (count < 3) return "Rookie Partyer 🐣";
    if (count < 8) return "Vibe Master 🔥";
    if (count < 15) return "Nightlife Legend 👑";
    return "God of the Night 🌌";
  };

  // --- REALTIME ENGINE ---
  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase.channel('party-hub-final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        // Force refresh for any change (Hype, Join, Comment)
        fetchEvents();
        
        // Notification logic
        if (payload.eventType === 'UPDATE' && payload.new.comments?.length > (payload.old?.comments?.length || 0)) {
           const lastMsg = payload.new.comments[payload.new.comments.length - 1];
           if (lastMsg.user !== user.name) setHasUnread(true);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user, readComments]);

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end).order('date', { ascending: true });
    if (data) setEvents(data);
  }

  // --- ACTIONS ---
  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isJoined = current.some(a => a.name === user.name);
    const updated = isJoined ? current.filter(a => a.name !== user.name) : [...current, { name: user.name, avatar: user.avatar }];
    await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
  };

  const handleHype = async (event) => {
    const newHype = (event.hype || 0) + 1;
    await supabase.from('events').update({ hype: newHype }).eq('id', event.id);
    confetti({ 
      particleCount: 40, 
      spread: 70, 
      origin: { y: 0.8 }, 
      colors: ['#D1FF4B', '#FF2E95', '#00F0FF'] 
    });
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
    
    // Optimistic UI Update
    setActiveChatEvent({ ...event, comments: updatedComments });
    setCommentInput("");

    await supabase.from('events').update({ 
      comments: updatedComments, 
      last_comment_at: new Date().toISOString() 
    }).eq('id', event.id);
    
    setReadComments(prev => ({ ...prev, [event.id]: updatedComments.length }));
  };

  const handleSaveEvent = async () => {
    if (!form.title || !selectedDay) return;
    const eventData = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    if (editingEventId) await supabase.from('events').update(eventData).eq('id', editingEventId);
    else await supabase.from('events').insert([{ ...eventData, attendees: [{ name: user.name, avatar: user.avatar }] }]);
    
    setSelectedDay(null); setEditingEventId(null); setSelectedGif(null);
    setForm({ title: "", price: "", location: "", description: "", recap_url: "" });
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#0b0118] text-white font-sans flex flex-col">
      
      {/* HEADER */}
      <header className="p-5 md:px-10 flex justify-between items-center bg-[#0b0118]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div>
          <h1 className="text-3xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon uppercase">Social Hub</h1>
          <p className="text-[9px] font-bold text-[#FF2E95] uppercase tracking-[0.2em]">{getFunStatus(joinedCount)}</p>
        </div>
        
        <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-1 pr-5 rounded-full flex items-center gap-3 cursor-pointer hover:border-[#FF2E95] transition-all">
          <img src={user.avatar} className="w-9 h-9 rounded-full border border-white/10" alt="avatar" />
          <span className="font-black text-[10px] uppercase tracking-tighter">{user.name || "Set Identity"}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: FIXED CALENDAR */}
        <div className="hidden lg:flex w-[40%] flex-col p-8 border-r border-white/5 bg-[#0e021f]">
          <div className="flex items-center justify-between mb-8 bg-white/5 p-4 rounded-[25px] border border-white/5">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-xl font-black hover:scale-125 transition-transform">◀</button>
            <h2 className="text-xl font-black uppercase italic text-[#D1FF4B] tracking-tighter">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-xl font-black hover:scale-125 transition-transform">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-3 h-full pb-10">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-[10px] font-black opacity-20 uppercase tracking-widest">{d}</div>
            ))}
            {eachDayOfInterval({ 
              start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
              end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
            }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`relative rounded-[25px] border transition-all p-3 ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95] hover:bg-white/10' : 'opacity-0 pointer-events-none'}`}>
                  <span className="text-[12px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {dayEvents.map(e => <div key={e.id} className="w-2 h-2 rounded-full bg-[#FF2E95] shadow-[0_0_8px_#FF2E95]" />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: SCROLLING GRID FEED */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar pb-32">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-xl font-black uppercase text-[#00F0FF] italic tracking-widest">Upcoming Vibes</h3>
            <span className="text-[10px] font-black opacity-30 uppercase">{events.length} Vibes</span>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {events.map(e => {
              const isPastEvent = isPast(new Date(e.date)) && !isSameDay(new Date(e.date), new Date());
              const unreadCount = (e.comments?.length || 0) - (readComments[e.id] || 0);
              const isHost = e.attendees?.[0]?.name === user.name;
              const isJoined = e.attendees?.some(a => a.name === user.name);
              const displayImg = (isPastEvent && e.recap_url) ? e.recap_url : (e.gif_url || `https://images.unsplash.com/photo-1514525253361-bee8718a300c?q=80&w=500`);

              return (
                <div key={e.id} className={`bg-white/5 border-2 rounded-[40px] overflow-hidden group transition-all flex flex-col ${isPastEvent ? 'opacity-40 grayscale' : 'border-white/10 hover:border-[#D1FF4B] shadow-xl'}`}>
                  <div className="relative h-40">
                    <img src={displayImg} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" alt="vibe" />
                    {isHost && <div className="absolute top-4 left-4 bg-[#D1FF4B] text-black text-[8px] font-black px-3 py-1 rounded-full uppercase shadow-2xl">Host 👑</div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b0118] via-transparent to-transparent opacity-80" />
                  </div>
                  
                  <div className="p-6 -mt-10 relative z-10 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="text-xl font-black uppercase tracking-tighter leading-tight truncate">{e.title}</h4>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`} target="_blank" className="text-[9px] font-black text-[#D1FF4B] uppercase tracking-widest mt-2 block truncate hover:underline">📍 {e.location}</a>
                      </div>
                      <span className="text-sm font-black text-[#00F0FF] shrink-0">{e.price || 'Free'}</span>
                    </div>

                    <div className="flex justify-between items-center mb-6 bg-black/20 p-3 rounded-[20px] border border-white/5">
                      <div className="flex -space-x-2">
                        {e.attendees?.slice(0, 3).map((a, idx) => <img key={idx} src={a.avatar} className="w-8 h-8 rounded-full border-2 border-[#0b0118] bg-[#1a0b2e]" />)}
                        {e.attendees?.length > 3 && <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#0b0118] flex items-center justify-center text-[8px] font-black">+{e.attendees.length - 3}</div>}
                      </div>
                      <button onClick={() => handleHype(e)} className="flex items-center gap-2 bg-white/5 p-1.5 px-3 rounded-full hover:bg-[#D1FF4B] hover:text-black transition-all shadow-lg active:scale-90">
                        <span className="text-xs">⚡️</span>
                        <span className="text-[10px] font-black">{e.hype || 0}</span>
                      </button>
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <button 
                        onClick={() => !isHost && handleJoin(e)}
                        disabled={isHost}
                        className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${isHost ? 'bg-white/5 opacity-40' : isJoined ? 'bg-white/20' : 'bg-[#FF2E95] shadow-[0_10px_20px_rgba(255,46,149,0.2)] active:scale-95'}`}
                      >
                        {isHost ? 'Hosting' : isJoined ? 'Leave' : 'Join'}
                      </button>
                      <button onClick={() => {setActiveChatEvent(e); setReadComments(p => ({...p, [e.id]: e.comments?.length || 0}))}} className="relative bg-white/10 p-3 rounded-2xl text-lg hover:bg-[#00F0FF] hover:text-black transition-all">
                        💬
                        {unreadCount > 0 && <div className="absolute -top-1 -right-1 bg-[#FF2E95] text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0b0118] shadow-lg animate-bounce">{unreadCount}</div>}
                      </button>
                    </div>
                    
                    {isHost && (
                      <button onClick={() => {setEditingEventId(e.id); setSelectedDay(new Date(e.date)); setForm(e); setSelectedGif(e.gif_url);}} className="w-full mt-4 text-[7px] font-black uppercase opacity-20 hover:opacity-100 tracking-[0.4em]">
                        Edit Event
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* MODALS SECTION */}
      {/* Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[900] flex items-center justify-center p-4">
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-sm shadow-2xl">
             <div className="flex flex-col items-center gap-8">
                <img src={user.avatar} className="w-28 h-28 rounded-full border-4 border-[#FF2E95] shadow-2xl" alt="preview" />
                <div className="w-full space-y-4 text-center">
                  <input className="input-field text-center uppercase" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Username" />
                  <textarea className="input-field h-24 resize-none text-center" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="What's your vibe?" />
                </div>
                <button onClick={() => {setIsEditingProfile(false); confetti({particleCount: 50})}} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest text-lg hover:scale-105 transition-transform">Confirm Identity</button>
             </div>
           </div>
        </div>
      )}

      {/* Chat Modal */}
      {activeChatEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[800] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#00F0FF] p-8 rounded-[50px] w-full max-w-lg h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase italic text-[#00F0FF] truncate mr-4">{activeChatEvent.title} Chat</h3>
              <button onClick={() => setActiveChatEvent(null)} className="text-white/40 uppercase font-black text-[10px] p-2 hover:text-white">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
              {(activeChatEvent.comments || []).map((c, i) => (
                <div key={i} className={`flex gap-3 ${c.user === user.name ? 'flex-row-reverse' : ''}`}>
                  <img src={c.avatar} className="w-8 h-8 rounded-full border border-white/10" alt="user" />
                  <div className={`p-3 rounded-2xl max-w-[80%] shadow-lg ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/10 rounded-tl-none'}`}>
                    <p className="text-[8px] font-black uppercase opacity-60 mb-1">{c.user}</p>
                    <p className="text-sm font-bold leading-tight">{c.text}</p>
                    <p className="text-[7px] text-right mt-1 opacity-40 font-black">{c.time}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
              <input className="bg-transparent flex-1 px-4 font-bold outline-none text-sm text-white" placeholder="Say something lit..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && postComment(activeChatEvent)} />
              <button onClick={() => postComment(activeChatEvent)} className="bg-[#00F0FF] text-black font-black px-6 py-3 rounded-xl uppercase text-[10px]">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-8 rounded-[50px] w-full max-w-xl overflow-y-auto max-h-[90vh] shadow-2xl">
             <h3 className="text-2xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">{editingEventId ? "Update Vibe" : "Broadcasting New Vibe"}</h3>
             <div className="space-y-4 mb-8">
               <input className="input-field" placeholder="Vibe Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <textarea className="input-field h-24 resize-none" placeholder="Details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               <div className="bg-white/5 p-4 rounded-[25px] space-y-4">
                 <input className="input-field" placeholder="Search GIF theme..." onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-2">
                   {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-16 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40'}`} alt="gif" />)}
                 </div>
               </div>
               {editingEventId && (
                 <input className="input-field" placeholder="Recap Photo URL (After Party)" value={form.recap_url} onChange={e => setForm({...form, recap_url: e.target.value})} />
               )}
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest text-lg hover:bg-white transition-all">Broadcast Vibe</button>
             <button onClick={() => {setSelectedDay(null); setEditingEventId(null);}} className="w-full mt-4 text-[10px] opacity-30 uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      {/* STYLES */}
      <style>{`
        .shadow-neon { text-shadow: 0 0 15px rgba(209,255,75,0.6); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a0b2e; border-radius: 20px; border: 2px solid #D1FF4B; }
        .input-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 16px; font-weight: bold; color: white; width: 100%; outline: none; transition: all 0.2s; }
        .input-field:focus { border-color: #00F0FF; background: rgba(255,255,255,0.06); }
      `}</style>
    </div>
  
}

export default App

