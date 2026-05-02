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
  const [readComments, setReadComments] = useState(JSON.parse(localStorage.getItem('read-comments')) || {});
  const [activeEvent, setActiveEvent] = useState(null); // Pour la carte flottante
  
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Ready to party ⚡️"
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  // --- DATA FETCH & REALTIME ---
  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase.channel('full-calendar-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user, readComments]);

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end);
    if (data) {
      setEvents(data);
      if (activeEvent) {
        const updated = data.find(e => e.id === activeEvent.id);
        if (updated) setActiveEvent(updated);
      }
    }
  }

  // --- ACTIONS ---
  const handleHype = async (e) => {
    await supabase.from('events').update({ hype: (e.hype || 0) + 1 }).eq('id', e.id);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.8 } });
  };

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
    await supabase.from('events').update({ comments: updatedComments, last_comment_at: new Date().toISOString() }).eq('id', event.id);
    setCommentInput("");
    setReadComments(prev => ({ ...prev, [event.id]: updatedComments.length }));
  };

  const handleSaveEvent = async () => {
    const data = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    if (editingEventId) await supabase.from('events').update(data).eq('id', editingEventId);
    else await supabase.from('events').insert([{ ...data, attendees: [{ name: user.name, avatar: user.avatar }] }]);
    setSelectedDay(null); setEditingEventId(null); setSelectedGif(null);
  };

  return (
    <div className="h-screen bg-[#0b0118] text-white font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="p-4 md:px-10 flex justify-between items-center border-b border-white/5 bg-[#0b0118]/80 backdrop-blur-md z-50">
        <h1 className="text-2xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon uppercase">Social Hub</h1>
        <div onClick={() => setIsEditingProfile(true)} className="flex items-center gap-3 bg-white/5 p-1 pr-4 rounded-full cursor-pointer hover:border-[#FF2E95] border border-transparent transition-all">
          <img src={user.avatar} className="w-8 h-8 rounded-full border border-white/10" alt="avatar" />
          <span className="text-[10px] font-black uppercase tracking-widest">{user.name || "Set Profile"}</span>
        </div>
      </header>

      {/* FULL CALENDAR VIEW */}
      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
        
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4 bg-white/5 p-3 rounded-2xl border border-white/5">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-xl font-black px-4">◀</button>
          <h2 className="text-xl font-black uppercase italic text-[#D1FF4B] tracking-widest">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-xl font-black px-4">▶</button>
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-cols-7 gap-1 border border-white/5 rounded-3xl overflow-hidden bg-white/5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="bg-[#1a0b2e] p-2 text-center text-[9px] font-black opacity-30 uppercase tracking-[0.2em]">{d}</div>
          ))}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={i} 
                onClick={() => isCurrent && (dayEvents.length > 0 ? setActiveEvent(dayEvents[0]) : setSelectedDay(day))}
                className={`relative min-h-0 p-2 border-[0.5px] border-white/5 transition-all flex flex-col gap-1 ${isCurrent ? 'bg-[#0e021f] hover:bg-white/5 cursor-pointer' : 'bg-black/20 opacity-20 pointer-events-none'} ${isToday ? 'ring-1 ring-inset ring-[#D1FF4B]' : ''}`}
              >
                <span className={`text-[10px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-20'}`}>{format(day, 'd')}</span>
                
                {/* Event Labels in Calendar */}
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                  {dayEvents.map(e => {
                    const unread = (e.comments?.length || 0) - (readComments[e.id] || 0);
                    return (
                      <div 
                        key={e.id} 
                        onClick={(e_stop) => { e_stop.stopPropagation(); setActiveEvent(e); }}
                        className="bg-[#FF2E95] text-[8px] font-black p-1.5 rounded-lg truncate uppercase shadow-lg flex items-center justify-between"
                      >
                        <span className="truncate">{e.title}</span>
                        <div className="flex gap-1 shrink-0">
                          {unread > 0 && <div className="w-2 h-2 bg-[#00F0FF] rounded-full animate-pulse" />}
                          {e.hype > 10 && <span>⚡️</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* FLOATING EVENT CARD (When an event is clicked) */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] w-full max-w-4xl max-h-[90vh] rounded-[50px] overflow-hidden flex flex-col md:flex-row shadow-2xl animate-in zoom-in-95">
            
            {/* Left: Media & Info */}
            <div className="md:w-1/2 relative h-64 md:h-auto border-r border-white/5 flex flex-col">
              <img src={activeEvent.recap_url || activeEvent.gif_url || `https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600`} className="absolute inset-0 w-full h-full object-cover opacity-40" />
              <div className="relative z-10 p-8 flex flex-col h-full bg-gradient-to-t from-[#1a0b2e] via-transparent">
                <button onClick={() => setActiveEvent(null)} className="self-start mb-auto bg-black/50 p-3 rounded-full hover:bg-white/10">✕</button>
                <div className="mt-auto">
                  <h3 className="text-4xl font-black uppercase tracking-tighter mb-2">{activeEvent.title}</h3>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeEvent.location)}`} target="_blank" className="text-[#D1FF4B] font-black text-xs uppercase mb-6 block">📍 {activeEvent.location}</a>
                  <div className="flex gap-4">
                    <button onClick={() => handleJoin(activeEvent)} className="flex-1 bg-[#FF2E95] py-4 rounded-2xl font-black uppercase text-xs">
                      {activeEvent.attendees?.[0]?.name === user.name ? 'You are Host' : activeEvent.attendees?.some(a => a.name === user.name) ? 'Leave' : 'Join Vibe'}
                    </button>
                    <button onClick={() => handleHype(activeEvent)} className="bg-white/10 px-6 rounded-2xl font-black">⚡️ {activeEvent.hype || 0}</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Chat Section */}
            <div className="md:w-1/2 p-8 flex flex-col bg-[#0b0118]">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#00F0FF]">Vibe Chat</h4>
                <div className="flex -space-x-2">
                   {activeEvent.attendees?.slice(0, 3).map((a, i) => <img key={i} src={a.avatar} className="w-6 h-6 rounded-full border-2 border-[#0b0118]" />)}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex gap-3 ${c.user === user.name ? 'flex-row-reverse' : ''}`}>
                    <img src={c.avatar} className="w-8 h-8 rounded-full border border-white/10" />
                    <div className={`p-3 rounded-2xl max-w-[80%] ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/10 rounded-tl-none'}`}>
                      <p className="text-[10px] font-bold mb-1">{c.text}</p>
                      <p className="text-[7px] opacity-40 uppercase font-black">{c.user} • {c.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
                <input className="bg-transparent flex-1 px-4 font-bold outline-none text-xs" placeholder="Message..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-6 py-3 rounded-xl uppercase text-[10px]">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile & Create Event Modals (Keep as before but match design) */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-8 rounded-[40px] w-full max-w-xl">
             <h3 className="text-2xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">New Vibe on {format(selectedDay, 'dd MMM')}</h3>
             <div className="space-y-4 mb-8">
               <input className="input-field" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <textarea className="input-field h-24 resize-none" placeholder="Details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Create Event</button>
             <button onClick={() => setSelectedDay(null)} className="w-full mt-4 text-[10px] opacity-30 uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-4">
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-sm">
              <div className="flex flex-col items-center gap-8 text-center">
                <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-[#FF2E95]" />
                <input className="input-field text-center font-black uppercase" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Save</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .shadow-neon { text-shadow: 0 0 15px rgba(209,255,75,0.6); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D1FF4B; border-radius: 10px; }
        .input-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 16px; font-weight: bold; color: white; width: 100%; outline: none; }
      `}</style>
    </div>
  )
}
export default App

