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

  // --- Funny Status Logic ---
  const getFunStatus = (joinedCount) => {
    if (joinedCount === 0) return "Ghost 👻";
    if (joinedCount < 3) return "Rookie Partyer 🐣";
    if (joinedCount < 8) return "Vibe Master 🔥";
    if (joinedCount < 15) return "Nightlife Legend 👑";
    return "God of the Night 🌌";
  };

  const joinedCount = events.filter(e => e.attendees?.some(a => a.name === user.name)).length;

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase.channel('party-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new.comments?.length > (payload.old?.comments?.length || 0)) {
           const lastMsg = payload.new.comments[payload.new.comments.length - 1];
           if (lastMsg.user !== user.name) setHasUnread(true);
        }
        fetchEvents();
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

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isJoined = current.some(a => a.name === user.name);
    const updated = isJoined ? current.filter(a => a.name !== user.name) : [...current, { name: user.name, avatar: user.avatar }];
    await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
    setActiveChatEvent({ ...event, comments: updatedComments });
    setCommentInput("");
    await supabase.from('events').update({ comments: updatedComments, last_comment_at: new Date().toISOString() }).eq('id', event.id);
    setReadComments(prev => ({ ...prev, [event.id]: updatedComments.length }));
  };

  const handleSaveEvent = async () => {
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
    <div className="h-screen overflow-hidden bg-[#0b0118] text-white font-sans flex flex-col">
      
      {/* HEADER */}
      <header className="p-6 md:px-12 flex justify-between items-center bg-[#0b0118]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div>
          <h1 className="text-4xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon uppercase">Social Hub</h1>
          <p className="text-[10px] font-bold text-[#FF2E95] uppercase tracking-[0.3em]">{getFunStatus(joinedCount)}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-1.5 pr-6 rounded-full flex items-center gap-3 cursor-pointer hover:border-[#FF2E95] transition-all">
            <img src={user.avatar} className="w-10 h-10 rounded-full border border-white/10" alt="avatar" />
            <span className="font-black text-[11px] uppercase tracking-tighter">{user.name || "Set Identity"}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: FIXED CALENDAR */}
        <div className="hidden lg:flex w-[55%] flex-col p-10 border-r border-white/5">
          <div className="flex items-center justify-between mb-10 bg-white/5 p-5 rounded-[30px] border border-white/5">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-125 transition-transform">◀</button>
            <h2 className="text-3xl font-black uppercase italic text-[#D1FF4B] tracking-tighter">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-125 transition-transform">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-4 h-full pb-6">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-[11px] font-black opacity-20 uppercase tracking-[0.2em]">{d}</div>
            ))}
            {eachDayOfInterval({ 
              start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
              end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
            }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`relative rounded-[30px] border transition-all p-4 ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95] hover:bg-white/10' : 'opacity-0'}`}>
                  <span className="text-[14px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {dayEvents.map(e => <div key={e.id} className="w-2.5 h-2.5 rounded-full bg-[#FF2E95] shadow-[0_0_10px_#FF2E95]" />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: SCROLLING FEED */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 custom-scrollbar pb-32">
          <h3 className="text-2xl font-black uppercase text-[#00F0FF] italic border-b border-white/10 pb-6 tracking-widest">Next Vibes</h3>
          
          {events.length === 0 && <p className="text-center py-20 opacity-20 italic font-black uppercase tracking-widest text-xs">Nothing planned yet...</p>}
          
          {events.map(e => {
            const isPastEvent = isPast(new Date(e.date)) && !isSameDay(new Date(e.date), new Date());
            const unreadCount = (e.comments?.length || 0) - (readComments[e.id] || 0);
            const isHost = e.attendees?.[0]?.name === user.name;
            const isJoined = e.attendees?.some(a => a.name === user.name);
            const displayImg = e.recap_url || e.gif_url || `https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600`;

            return (
              <div key={e.id} className={`bg-white/5 border-2 rounded-[60px] overflow-hidden group transition-all transform hover:-translate-y-2 ${isPastEvent ? 'opacity-40 grayscale' : 'border-white/10 hover:border-[#D1FF4B] shadow-2xl'}`}>
                <div className="relative h-56">
                  <img src={displayImg} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" alt="event" />
                  {isHost && <div className="absolute top-8 left-8 bg-[#D1FF4B] text-black text-[10px] font-black px-4 py-2 rounded-full uppercase italic shadow-2xl">Host 👑</div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0118] to-transparent opacity-90" />
                </div>
                
                <div className="p-10 -mt-20 relative z-10">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h4 className="text-4xl font-black uppercase tracking-tighter leading-none">{e.title}</h4>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`} target="_blank" className="text-[11px] font-black text-[#D1FF4B] uppercase tracking-[0.2em] mt-3 block hover:underline">📍 {e.location}</a>
                    </div>
                    <span className="text-2xl font-black text-[#00F0FF]">{e.price || 'Free'}</span>
                  </div>

                  <div className="flex justify-between items-center mb-8 bg-black/20 p-5 rounded-[30px] border border-white/5">
                    <div className="flex -space-x-3">
                      {e.attendees?.slice(0, 5).map((a, idx) => <img key={idx} src={a.avatar} className="w-12 h-12 rounded-full border-4 border-[#0b0118] bg-[#1a0b2e]" title={a.name} />)}
                      {e.attendees?.length > 5 && <div className="w-12 h-12 rounded-full bg-white/10 border-4 border-[#0b0118] flex items-center justify-center text-xs font-black">+{e.attendees.length - 5}</div>}
                    </div>
                    <button onClick={() => supabase.from('events').update({ hype: (e.hype || 0) + 1 }).eq('id', e.id)} className="flex items-center gap-3 bg-white/10 p-3 px-5 rounded-full hover:bg-[#D1FF4B] hover:text-black transition-all shadow-xl">
                      <span className="text-xl">⚡️</span>
                      <span className="text-sm font-black">{e.hype || 0}</span>
                    </button>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => !isHost && handleJoin(e)}
                      disabled={isHost}
                      className={`flex-1 py-5 rounded-[30px] text-xs font-black uppercase tracking-[0.2em] transition-all ${isHost ? 'bg-white/5 opacity-40 cursor-default' : isJoined ? 'bg-white/20 text-white' : 'bg-[#FF2E95] text-white shadow-[0_15px_30px_rgba(255,46,149,0.3)] active:scale-95'}`}
                    >
                      {isHost ? 'Hosting' : isJoined ? 'Leave Vibe' : 'Join the Vibe'}
                    </button>
                    <button onClick={() => setActiveChatEvent(e)} className="relative bg-white/10 p-5 rounded-[30px] text-3xl hover:bg-[#00F0FF] hover:text-black transition-all">
                      💬
                      {unreadCount > 0 && <div className="absolute -top-2 -right-2 bg-[#FF2E95] text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#0b0118] shadow-lg animate-bounce">{unreadCount}</div>}
                    </button>
                  </div>
                  
                  {isHost && (
                    <button onClick={() => {setEditingEventId(e.id); setSelectedDay(new Date(e.date)); setForm(e); setSelectedGif(e.gif_url);}} className="w-full mt-8 text-[10px] font-black uppercase opacity-20 hover:opacity-100 tracking-[0.5em] transition-all">
                      Edit Event
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .shadow-neon { text-shadow: 0 0 20px rgba(209,255,75,0.6); }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a0b2e; border-radius: 20px; border: 2px solid #D1FF4B; }
        .input-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 20px; font-weight: bold; color: white; width: 100%; outline: none; }
        .input-field:focus { border-color: #00F0FF; background: rgba(255,255,255,0.06); }
      `}</style>
    </div>
  )
}
export default App

