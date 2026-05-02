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
  const [readComments, setReadComments] = useState(JSON.parse(localStorage.getItem('read-comments')) || {});
  const [activeEvent, setActiveEvent] = useState(null);
  const chatEndRef = useRef(null);
  
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Vibe curator ⚡️"
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase.channel('premium-v12')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user]);

  useEffect(() => {
    if (activeEvent) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [activeEvent?.comments]);

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

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isJoined = current.some(a => a.name === user.name);
    const updatedAttendees = isJoined 
      ? current.filter(a => a.name !== user.name) 
      : [...current, { name: user.name, avatar: user.avatar, bio: user.bio || "Just Vibe", has_ticket: false }];
    
    setActiveEvent({ ...event, attendees: updatedAttendees });
    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
  };

  const toggleTicketStatus = async (event) => {
    const updatedAttendees = event.attendees.map(a => 
      a.name === user.name ? { ...a, has_ticket: !a.has_ticket } : a
    );
    setActiveEvent({ ...event, attendees: updatedAttendees });
    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
    if (!event.attendees.find(a => a.name === user.name)?.has_ticket) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
    setActiveEvent({ ...event, comments: updatedComments });
    await supabase.from('events').update({ comments: updatedComments }).eq('id', event.id);
    setCommentInput("");
  };

  const handleSaveEvent = async () => {
    const data = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    if (editingEventId) {
      await supabase.from('events').update(data).eq('id', editingEventId);
    } else {
      await supabase.from('events').insert([{ ...data, attendees: [{ name: user.name, avatar: user.avatar, bio: user.bio, has_ticket: false }] }]);
    }
    setSelectedDay(null); setEditingEventId(null); setSelectedGif(null); setGifResults([]);
    setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "" });
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("🗑️ Are you sure you want to delete this event? This cannot be undone.")) return;
    await supabase.from('events').delete().eq('id', id);
    setActiveEvent(null);
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  const addToCalendar = (event) => {
    const start = format(new Date(`${event.date}T${event.time || '20:00'}`), "yyyyMMdd'T'HHmmss");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${start}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-screen bg-[#0b0118] text-white font-sans flex flex-col overflow-hidden selection:bg-[#D1FF4B] selection:text-black">
      
      {/* HEADER */}
      <header className="p-4 md:px-10 flex justify-between items-center border-b border-white/10 bg-[#0b0118]/80 backdrop-blur-xl z-50 shrink-0">
        <h1 className="text-2xl md:text-3xl font-black text-[#D1FF4B] italic tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(209,255,75,0.3)]">Social Hub</h1>
        <div onClick={() => setIsEditingProfile(true)} className="flex items-center gap-3 bg-white/5 p-1.5 pr-4 rounded-full cursor-pointer hover:bg-white/10 border border-white/10 transition-all active:scale-95 shadow-inner">
          <div className="bg-gradient-to-br from-[#D1FF4B] to-[#00F0FF] p-[2px] rounded-full">
            <img src={user.avatar} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1a0b2e]" alt="avatar" />
          </div>
          <span className="text-[10px] md:text-[12px] font-black uppercase tracking-widest">{user.name || "Identity"}</span>
        </div>
      </header>

      {/* CALENDAR */}
      <main className="flex-1 flex flex-col p-2 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 bg-white/5 p-2 md:p-4 rounded-2xl md:rounded-3xl border border-white/10 shrink-0 shadow-2xl backdrop-blur-sm">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl md:text-4xl font-black px-6 hover:scale-125 transition-all active:scale-90">◀</button>
          <h2 className="text-sm md:text-4xl font-black uppercase italic text-[#D1FF4B] tracking-widest text-center">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl md:text-4xl font-black px-6 hover:scale-125 transition-all active:scale-90">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-1 md:gap-2 rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 bg-white/[0.02]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="bg-white/5 py-2 md:py-4 text-center text-[10px] md:text-[12px] font-black opacity-40 uppercase tracking-[0.2em]">{d}</div>)}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={i} 
                className={`relative min-h-0 p-2 md:p-4 border-[0.5px] border-white/5 flex flex-col gap-1 md:gap-3 transition-all ${isCurrent ? 'bg-white/5 hover:bg-white/[0.08] cursor-pointer' : 'opacity-10 pointer-events-none'} ${isToday ? 'bg-[#D1FF4B]/10 ring-2 ring-inset ring-[#D1FF4B]/30' : ''}`}
                onClick={() => isCurrent && (dayEvents.length > 0 ? setActiveEvent(dayEvents[0]) : setSelectedDay(day))}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-[12px] md:text-[18px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-30'}`}>{format(day, 'd')}</span>
                  {isCurrent && <button onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }} className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-[#D1FF4B] hover:text-black transition-all text-[12px] md:text-[18px] font-black">+</button>}
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 md:space-y-2 custom-scrollbar">
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setActiveEvent(e); }} 
                      className={`p-2 md:p-3 rounded-lg md:rounded-2xl text-[9px] md:text-[11px] font-black uppercase shadow-xl transition-all border border-white/10 ${e.ticket_url ? 'bg-gradient-to-r from-[#00F0FF] to-[#0096FF] text-white' : e.hype > 15 ? 'bg-gradient-to-r from-[#D1FF4B] to-[#A3FF00] text-black' : 'bg-gradient-to-r from-[#FF2E95] to-[#B9005A] text-white'}`}>
                      <div className="truncate mb-1">{e.title}</div>
                      <div className="hidden md:flex -space-x-2">
                        {e.attendees?.slice(0, 4).map((a, idx) => (
                          <div key={idx} className="w-5 h-5 rounded-full bg-white/20 p-[1px] shadow-lg">
                            <img src={a.avatar} className="w-full h-full rounded-full" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* EVENT MODAL */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[100] flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e]/90 border-t md:border-2 border-white/20 w-full h-full md:h-[90vh] md:max-w-6xl md:rounded-[50px] overflow-hidden flex flex-col md:flex-row shadow-[0_0_100px_rgba(0,0,0,0.5)] relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            
            {/* Info Side */}
            <div className="flex-1 md:w-[45%] flex flex-col bg-white/[0.02] h-full md:border-r border-white/10 overflow-y-auto custom-scrollbar">
              <div className="relative h-60 md:h-80 shrink-0">
                <img src={activeEvent.gif_url || `https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=800`} className="w-full h-full object-cover" alt="visual" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] via-[#0e021f]/20 to-transparent" />
                
                {/* ADMIN ACTIONS - TOP RIGHT */}
                <div className="absolute top-6 right-6 flex gap-3 z-20">
                   {activeEvent.attendees?.[0]?.name === user.name && (
                     <div className="bg-black/40 backdrop-blur-md p-2 rounded-3xl border border-white/20 flex gap-2 shadow-2xl">
                        <button onClick={() => { setEditingEventId(activeEvent.id); setForm(activeEvent); setSelectedDay(new Date(activeEvent.date)); setSelectedGif(activeEvent.gif_url); setActiveEvent(null); }} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#D1FF4B] text-black hover:scale-105 active:scale-95 transition-all font-bold" title="Edit Event">✏️</button>
                        <button onClick={() => deleteEvent(activeEvent.id)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-500/80 text-white hover:bg-red-500 hover:scale-105 active:scale-95 transition-all" title="Delete Event">🗑️</button>
                     </div>
                   )}
                   <button onClick={() => setActiveEvent(null)} className="w-12 h-12 flex md:hidden items-center justify-center bg-black/40 backdrop-blur-md rounded-2xl text-white font-bold">✕</button>
                </div>

                <div className="absolute bottom-6 left-8 right-8">
                  {activeEvent.ticket_url && <span className="bg-[#00F0FF] text-black text-[9px] font-black px-4 py-1.5 rounded-full uppercase mb-3 inline-block tracking-widest shadow-neon-blue animate-pulse">Public Event</span>}
                  <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white leading-none drop-shadow-2xl">{activeEvent.title}</h3>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-8">
                {activeEvent.ticket_url && (
                  <a href={activeEvent.ticket_url} target="_blank" className="flex items-center justify-center gap-3 w-full bg-[#00F0FF] text-black text-center py-5 rounded-[25px] font-black uppercase tracking-widest text-sm shadow-[0_10px_30px_rgba(0,240,255,0.3)] hover:translate-y-[-2px] transition-all active:scale-95">Get Your Tickets 🎟️</a>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 p-4 rounded-3xl text-center border border-white/5 flex flex-col justify-center items-center"><p className="text-[9px] font-black uppercase opacity-40 text-[#00F0FF] mb-1">Time</p><p className="font-black text-lg">{activeEvent.time}</p></div>
                  <div className="bg-white/5 p-4 rounded-3xl text-center border border-white/5 flex flex-col justify-center items-center"><p className="text-[9px] font-black uppercase opacity-40 text-[#00F0FF] mb-1">Price</p><p className="font-black text-lg truncate">{activeEvent.price || 'Free'}</p></div>
                  <button onClick={() => addToCalendar(activeEvent)} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col items-center justify-center hover:bg-[#D1FF4B] hover:text-black transition-all group">
                    <p className="text-[9px] font-black uppercase opacity-40 group-hover:text-black">Add to</p><p className="text-[10px] font-black">📅 Cal</p>
                  </button>
                </div>

                <div className="relative">
                   <p className="text-white/80 font-medium leading-relaxed italic text-lg md:text-xl pl-4 border-l-4 border-[#D1FF4B]">"{activeEvent.description || "No description provided."}"</p>
                </div>
                
                <div>
                  <p className="text-[11px] font-black uppercase opacity-40 mb-4 tracking-[0.2em] flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#D1FF4B] rounded-full animate-ping"></span>
                    The Crew ({activeEvent.attendees?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {activeEvent.attendees?.map((a, i) => (
                      <div key={i} className="group relative">
                        <div className={`p-[3px] rounded-full transition-all duration-300 ${a.has_ticket ? 'bg-gradient-to-br from-[#00F0FF] to-[#0096FF] shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'bg-white/10 hover:bg-white/20 shadow-xl'}`}>
                           <img src={a.avatar} className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-[#1a0b2e] bg-[#1a0b2e] object-cover" alt={a.name} />
                           {a.has_ticket && <div className="absolute -top-1 -right-1 bg-[#00F0FF] text-black text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-bold border-2 border-[#1a0b2e] shadow-xl animate-bounce-slow">✓</div>}
                        </div>
                        {/* Tooltip Styling */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-4 py-3 bg-[#D1FF4B] text-black rounded-2xl text-[10px] font-black uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-[120] shadow-[0_10px_30px_rgba(0,0,0,0.5)] scale-90 group-hover:scale-100 origin-bottom">
                          <div className="text-[12px] mb-1 underline">{a.name}</div>
                          <div className="opacity-70 lowercase font-bold italic normal-case">{a.bio || "Just Vibe"}</div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[8px] border-transparent border-t-[#D1FF4B]"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  {activeEvent.attendees?.some(a => a.name === user.name) ? (
                    <>
                      <button onClick={() => toggleTicketStatus(activeEvent)} className={`flex-1 py-5 rounded-[25px] font-black uppercase text-xs tracking-widest border-2 transition-all active:scale-95 ${activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'bg-[#00F0FF] border-[#00F0FF] text-black shadow-neon-blue' : 'border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF]/10'}`}>
                        {activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'Ticket Secured ✓' : 'I Have My Ticket'}
                      </button>
                      <button onClick={() => handleJoin(activeEvent)} className="bg-white/5 border border-white/10 px-8 py-5 rounded-[25px] font-black uppercase text-xs opacity-50 hover:bg-red-500/20 hover:text-red-500 transition-all active:scale-90">Leave</button>
                    </>
                  ) : (
                    <button onClick={() => handleJoin(activeEvent)} className="flex-1 bg-gradient-to-r from-[#FF2E95] to-[#B9005A] text-white py-6 rounded-[25px] font-black uppercase tracking-[0.2em] shadow-xl hover:translate-y-[-2px] transition-all active:scale-95">Join the Vibe</button>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Side */}
            <div className="hidden md:flex flex-1 flex flex-col bg-[#0b0118] h-full overflow-hidden border-l border-white/10">
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
                  <span className="font-black uppercase text-xs tracking-[0.4em] text-[#00F0FF] flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#00F0FF] rounded-full animate-pulse"></span>
                    Live Feed
                  </span>
                  <button onClick={() => handleHype(activeEvent)} className="bg-white/5 px-5 py-2 rounded-full font-black flex items-center gap-2 hover:bg-[#D1FF4B] hover:text-black transition-all">⚡️ {activeEvent.hype || 0}</button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-chat-pattern">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'} group`}>
                    <span className="text-[10px] font-black uppercase opacity-30 mb-1.5 mx-2 group-hover:opacity-100 transition-opacity">{c.user} • {c.time}</span>
                    <div className="flex gap-3 items-end">
                      {c.user !== user.name && (
                         <div className="bg-white/10 p-[2px] rounded-full">
                           <img src={c.avatar} className="w-10 h-10 rounded-full" alt="avatar" />
                         </div>
                      )}
                      <div className={`p-4 rounded-[28px] max-w-[320px] shadow-2xl backdrop-blur-md ${c.user === user.name ? 'bg-gradient-to-br from-[#00F0FF] to-[#0096FF] text-black rounded-tr-none' : 'bg-white/10 rounded-tl-none border border-white/10 text-white'}`}>
                        <p className="text-[15px] font-bold leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-8 bg-white/[0.03] border-t border-white/10 flex gap-3 backdrop-blur-md">
                <input className="bg-white/5 flex-1 font-bold outline-none text-white text-base px-6 py-4 rounded-[25px] border border-white/10 focus:border-[#00F0FF] transition-all" placeholder="Send a message..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={ev => ev.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-8 py-4 rounded-[22px] uppercase text-[11px] tracking-widest shadow-[0_0_20px_rgba(209,255,75,0.2)] hover:bg-white active:scale-95 transition-all">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL - BEAUTIFIED */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[300] flex items-center justify-center p-2 md:p-4" onClick={() => { setSelectedDay(null); setEditingEventId(null); setSelectedGif(null); }}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-6 md:p-10 rounded-[40px] md:rounded-[60px] w-full max-w-2xl max-h-[95vh] overflow-y-auto custom-scrollbar shadow-[0_0_100px_rgba(209,255,75,0.1)] relative animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
             <h3 className="text-3xl md:text-4xl font-black mb-10 text-[#D1FF4B] uppercase italic text-center tracking-tighter">
               {editingEventId ? "✏️ Update Vibe" : "🚀 Launch New Vibe"}
             </h3>
             <div className="space-y-6">
               <div className="group">
                  <label className="text-[10px] font-black uppercase text-[#00F0FF] ml-4 mb-2 block opacity-60">Event Title</label>
                  <input className="input-premium" placeholder="Ex: Summer Roof Party" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               </div>

               <div className="group">
                  <label className="text-[10px] font-black uppercase text-[#00F0FF] ml-4 mb-2 block opacity-60">Ticket Link (Optional)</label>
                  <input className="input-premium border-[#00F0FF]/30 text-[#00F0FF]" placeholder="https://tickets.com/..." value={form.ticket_url} onChange={e => setForm({...form, ticket_url: e.target.value})} />
               </div>

               <div className="grid grid-cols-2 gap-4 md:gap-6">
                 <div>
                    <label className="text-[10px] font-black uppercase text-[#00F0FF] ml-4 mb-2 block opacity-60">Price</label>
                    <input className="input-premium" placeholder="Free / 20€" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-[#00F0FF] ml-4 mb-2 block opacity-60">Location</label>
                    <input className="input-premium" placeholder="City / Address" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 md:gap-6">
                  <div className="bg-white/5 p-6 rounded-[30px] border border-white/10 flex flex-col items-center">
                    <p className="text-[10px] font-black uppercase text-[#00F0FF] mb-3 tracking-widest opacity-60">Hour</p>
                    <input type="time" className="bg-transparent font-black w-full text-center outline-none text-white text-2xl" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                  </div>
                  <div className="bg-white/5 p-6 rounded-[30px] border border-white/10 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black uppercase text-[#00F0FF] mb-1 tracking-widest opacity-60">Date</p>
                    <p className="font-black text-2xl text-[#D1FF4B]">{format(selectedDay, 'dd MMM')}</p>
                  </div>
               </div>

               <div className="group">
                  <label className="text-[10px] font-black uppercase text-[#00F0FF] ml-4 mb-2 block opacity-60">Description</label>
                  <textarea className="input-premium h-32 resize-none pt-4" placeholder="Describe the energy..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               </div>

               <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 space-y-6">
                 <div className="text-center">
                    <p className="text-[11px] font-black uppercase text-[#D1FF4B] mb-1 tracking-[0.2em]">Visual Vibe Search</p>
                    <p className="text-[9px] opacity-40 font-bold">Pick a GIF that represents this event</p>
                 </div>
                 <input className="input-premium bg-black/20" placeholder="Search (ex: party, techno, beach)..." value={gifSearch} onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-3">
                   {gifResults.map(g => (
                     <img 
                       key={g.id} 
                       src={g.images.fixed_height_small.url} 
                       onClick={() => setSelectedGif(g.images.fixed_height.url)} 
                       className={`h-20 w-full object-cover rounded-2xl cursor-pointer border-4 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B] scale-105 shadow-neon' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-[1.02]'}`} 
                       alt="gif search result"
                     />
                   ))}
                 </div>
               </div>
             </div>
             
             <div className="mt-12 flex flex-col gap-4">
                <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-7 rounded-[30px] uppercase text-xl tracking-[0.2em] shadow-[0_15px_40px_rgba(209,255,75,0.2)] hover:bg-white hover:translate-y-[-3px] transition-all active:scale-95">
                  {editingEventId ? "Update Vibe Settings" : "Launch Broadcast"}
                </button>
                <button onClick={() => { setSelectedDay(null); setEditingEventId(null); }} className="w-full text-[11px] opacity-30 font-black uppercase tracking-[0.4em] hover:opacity-100 transition-opacity">Cancel</button>
             </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL - DESIGN REFRESH */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-4 animate-in fade-in duration-500" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-10 md:p-14 rounded-[60px] w-full max-w-sm shadow-[0_0_100px_rgba(255,46,149,0.1)] relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-10 text-center">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FF2E95] to-[#D1FF4B] rounded-full animate-spin-slow blur-xl opacity-40 group-hover:opacity-80 transition-opacity"></div>
                  <img src={user.avatar} className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#FF2E95] shadow-2xl relative bg-[#1a0b2e]" alt="profile preview" />
                </div>
                <div className="w-full space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-[#FF2E95] mb-2 block opacity-60">Your Nickname</label>
                    <input className="input-premium border-[#FF2E95]/30 focus:border-[#FF2E95] text-center" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Username" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-[#FF2E95] mb-2 block opacity-60">Status / Bio</label>
                    <textarea className="input-premium border-[#FF2E95]/30 focus:border-[#FF2E95] h-28 resize-none text-center pt-4" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="I am ready for..." />
                  </div>
                </div>
                <button onClick={() => { setIsEditingProfile(false); confetti({particleCount: 50, colors: ['#FF2E95', '#D1FF4B']}); }} className="w-full bg-gradient-to-r from-[#FF2E95] to-[#B9005A] text-white font-black py-6 rounded-[30px] uppercase tracking-widest shadow-xl hover:translate-y-[-2px] transition-all active:scale-95">Update Identity</button>
              </div>
           </div>
        </div>
      )}

      {/* --- CUSTOM CSS --- */}
      <style>{`
        .shadow-neon { filter: drop-shadow(0 0 10px #D1FF4B); }
        .shadow-neon-blue { shadow-box: 0 0 20px rgba(0,240,255,0.4); }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D1FF4B; }
        
        .input-premium {
          background: rgba(255,255,255,0.03);
          border: 2px solid rgba(255,255,255,0.08);
          border-radius: 25px;
          padding: 18px 24px;
          font-weight: 800;
          color: white;
          width: 100%;
          outline: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        }
        .input-premium:focus {
          background: rgba(255,255,255,0.06);
          border-color: #D1FF4B;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3), 0 0 20px rgba(209,255,75,0.1);
          transform: translateY(-2px);
        }
        .input-premium::placeholder { opacity: 0.3; text-transform: uppercase; font-size: 11px; letter-spacing: 0.1em; }
        
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .animate-bounce-slow { animation: bounce-slow 2s infinite ease-in-out; }
        
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </div>
  )
}
export default App

