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
  const [notifications, setNotifications] = useState(JSON.parse(localStorage.getItem('hub-notifs')) || []);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
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
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    localStorage.setItem('hub-notifs', JSON.stringify(notifications));
    fetchEvents();
    const channel = supabase.channel('master-final-v14').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents()).subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user]);

  useEffect(() => {
    if (activeEvent) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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
    const updatedAttendees = event.attendees.map(a => a.name === user.name ? { ...a, has_ticket: !a.has_ticket } : a);
    setActiveEvent({ ...event, attendees: updatedAttendees });
    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
    if (!event.attendees.find(a => a.name === user.name)?.has_ticket) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
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
    if (editingEventId) await supabase.from('events').update(data).eq('id', editingEventId);
    else await supabase.from('events').insert([{ ...data, attendees: [{ name: user.name, avatar: user.avatar, bio: user.bio, has_ticket: false }] }]);
    setSelectedDay(null); setEditingEventId(null); setSelectedGif(null); setGifResults([]);
    setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" });
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  return (
    <div className="h-screen bg-[#0b0118] text-white font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="p-4 md:px-10 flex justify-between items-center border-b border-white/5 bg-[#0b0118]/80 backdrop-blur-md z-50 shrink-0">
        <h1 className="text-3xl font-black text-[#D1FF4B] italic tracking-tighter uppercase">Social Hub</h1>
        <div className="flex items-center gap-4">
            <button onClick={() => setShowNotifCenter(!showNotifCenter)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 relative text-xl">🔔</button>
            <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-1 pr-4 rounded-full cursor-pointer hover:border-[#FF2E95] flex items-center gap-3 transition-all">
                <img src={user.avatar} className="w-10 h-10 rounded-full border border-white/10 shadow-lg" alt="avatar" />
                <span className="text-[12px] font-black uppercase tracking-widest">{user.name || "Identity"}</span>
            </div>
        </div>
      </header>

      {/* CALENDAR - GIANT VIEW FIX */}
      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-gradient-to-b from-[#0b0118] to-[#120428]">
        <div className="flex items-center justify-between mb-4 bg-white/5 p-4 rounded-3xl border border-white/10 shrink-0">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-4xl font-black px-6 hover:scale-125 transition-all">◀</button>
          <h2 className="text-2xl md:text-4xl font-black uppercase italic text-[#D1FF4B] tracking-widest">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-4xl font-black px-6 hover:scale-125 transition-all">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-2 rounded-3xl overflow-hidden border border-white/10">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="bg-white/5 p-4 text-center text-[12px] font-black opacity-30 uppercase tracking-[0.3em]">{d}</div>)}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={i} 
                className={`relative min-h-0 p-4 border border-white/5 transition-all flex flex-col gap-3 ${isCurrent ? 'bg-white/5 hover:bg-white/10 cursor-pointer' : 'opacity-10 pointer-events-none'} ${isToday ? 'bg-[#D1FF4B]/5 ring-2 ring-[#D1FF4B]/40' : ''}`}
                onClick={() => isCurrent && (dayEvents.length > 0 ? setActiveEvent(dayEvents[0]) : setSelectedDay(day))}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[18px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-30'}`}>{format(day, 'd')}</span>
                  {isCurrent && <button onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }} className="text-[18px] opacity-20 hover:opacity-100 hover:text-[#D1FF4B] font-black">+</button>}
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setActiveEvent(e); }} 
                      className={`p-3 rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all border border-white/10 ${e.is_public ? 'bg-[#00F0FF] text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : e.hype > 15 ? 'bg-[#D1FF4B] text-black' : 'bg-[#FF2E95] text-white'}`}>
                      <div className="truncate mb-1">{e.is_public ? '🎫 ' : ''}{e.title}</div>
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {e.attendees?.slice(0, 3).map((a, idx) => <img key={idx} src={a.avatar} className="w-4 h-4 rounded-full border border-black/50 bg-[#1a0b2e]" />)}
                        </div>
                        {((e.comments?.length || 0) - (readComments[e.id] || 0)) > 0 && <div className="w-1.5 h-1.5 bg-[#00F0FF] rounded-full animate-pulse ml-auto" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* EVENT OVERLAY - NO SCROLL FIX */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] w-full max-w-6xl h-[85vh] rounded-[50px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>
            
            {/* Left Side (Fixed/Compact Info) */}
            <div className="md:w-[45%] flex flex-col bg-[#0e021f] h-full border-r border-white/10">
              <div className="relative h-64 shrink-0">
                <img src={activeEvent.gif_url || `https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=800`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] to-transparent" />
                <div className="absolute top-6 right-6 flex gap-2">
                   <button onClick={() => { setEditingEventId(activeEvent.id); setForm(activeEvent); setSelectedDay(new Date(activeEvent.date)); setSelectedGif(activeEvent.gif_url); setActiveEvent(null); }} className="bg-black/50 p-3 rounded-full hover:bg-[#D1FF4B] hover:text-black transition-all">✏️</button>
                   <button onClick={() => { if(window.confirm("Delete?")) supabase.from('events').delete().eq('id', activeEvent.id).then(() => setActiveEvent(null)) }} className="bg-black/50 p-3 rounded-full hover:bg-red-500 transition-all">🗑️</button>
                </div>
                <div className="absolute bottom-6 left-8 right-8">
                  {activeEvent.is_public && <span className="bg-[#00F0FF] text-black text-[9px] font-black px-4 py-1 rounded-full uppercase mb-2 inline-block tracking-widest shadow-lg">Public Event</span>}
                  <h3 className="text-4xl font-black uppercase tracking-tighter text-white leading-none truncate">{activeEvent.title}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activeEvent.tags?.split(',').map((tag, idx) => <span key={idx} className="text-[8px] font-black bg-white/10 px-2 py-0.5 rounded-md uppercase text-[#D1FF4B]">#{tag.trim()}</span>)}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-8 flex flex-col justify-between overflow-hidden">
                <div className="space-y-4">
                  {activeEvent.is_public && (
                      <div className="grid grid-cols-2 gap-2">
                        {activeEvent.ticket_url && <a href={activeEvent.ticket_url} target="_blank" className="bg-[#00F0FF] text-black text-center py-3 rounded-xl font-black uppercase text-[10px]">Tickets 🎫</a>}
                        {activeEvent.event_url && <a href={activeEvent.event_url} target="_blank" className="bg-white/10 text-white text-center py-3 rounded-xl font-black uppercase text-[10px]">Info 🔗</a>}
                      </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 p-4 rounded-3xl text-center border border-white/5"><p className="text-[8px] font-black uppercase opacity-40 text-[#00F0FF] mb-1">Time</p><p className="font-black text-lg">{activeEvent.time}</p></div>
                    <div className="bg-white/5 p-4 rounded-3xl text-center border border-white/5"><p className="text-[8px] font-black uppercase opacity-40 text-[#00F0FF] mb-1">Price</p><p className="font-black text-lg truncate">{activeEvent.price || 'Free'}</p></div>
                    <button onClick={() => addToCalendar(activeEvent)} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex items-center justify-center hover:bg-[#D1FF4B] hover:text-black transition-all">📅</button>
                  </div>

                  <p className="text-white/60 font-medium leading-relaxed italic text-base line-clamp-3">"{activeEvent.description || "No description provided."}"</p>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/10"><p className="text-[8px] font-black uppercase opacity-40 text-[#00F0FF] mb-1">Location</p><p className="text-sm font-bold truncate">📍 {activeEvent.location}</p></div>

                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40 mb-3 tracking-widest">Crew ({activeEvent.attendees?.length || 0})</p>
                    <div className="flex flex-wrap gap-3 max-h-28 overflow-y-auto custom-scrollbar">
                      {activeEvent.attendees?.map((a, i) => (
                        <div key={i} className="group relative">
                          <div className={`p-[2px] rounded-full bg-white/5 ${a.has_ticket ? 'border-2 border-[#00F0FF]' : 'border-2 border-transparent'}`}>
                             <img src={a.avatar} className="w-12 h-12 rounded-full" alt={a.name} />
                             {a.has_ticket && <div className="absolute -top-1 -right-1 bg-[#00F0FF] text-black text-[8px] w-5 h-5 rounded-full flex items-center justify-center font-bold">✓</div>}
                          </div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#D1FF4B] text-black rounded-xl text-[10px] font-black uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-xl">
                            {a.name}: {a.bio || "Just Vibe"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto pt-4">
                  {activeEvent.attendees?.some(a => a.name === user.name) ? (
                    <>
                      <button onClick={() => toggleTicketStatus(activeEvent)} className={`flex-1 py-5 rounded-[25px] font-black uppercase text-xs tracking-widest border-2 transition-all ${activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'bg-[#00F0FF] border-[#00F0FF] text-black' : 'border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF]/10'}`}>Ticket Confirmed ✓</button>
                      <button onClick={() => handleJoin(activeEvent)} className="bg-white/5 border border-white/10 px-8 py-5 rounded-[25px] font-black uppercase text-xs opacity-50 hover:bg-red-500/20 hover:text-red-500 transition-all">Leave</button>
                    </>
                  ) : <button onClick={() => handleJoin(activeEvent)} className="flex-1 bg-[#FF2E95] text-white py-6 rounded-[25px] font-black uppercase tracking-[0.2em] shadow-xl">Join the Vibe</button>}
                </div>
              </div>
            </div>

            {/* Right Side (Chat) */}
            <div className="flex-1 flex flex-col bg-[#0b0118] h-full overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0">
                  <span className="font-black uppercase text-xs tracking-[0.4em] text-[#00F0FF]">Live Discussion</span>
                  <button onClick={() => handleHype(activeEvent)} className="text-xl hover:scale-125 transition-all">⚡️ {activeEvent.hype || 0}</button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] font-black uppercase opacity-30 mb-1 mx-2">{c.user}</span>
                    <div className="flex gap-4 items-end">
                      {c.user !== user.name && <img src={c.avatar} className="w-10 h-10 rounded-full border border-white/10 shadow-lg" />}
                      <div className={`p-4 rounded-3xl max-w-[300px] shadow-2xl ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/5 rounded-tl-none border border-white/10'}`}>
                        <p className="text-sm font-bold leading-tight">{c.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-8 bg-white/5 border-t border-white/5 flex gap-3 shrink-0">
                <input className="bg-transparent flex-1 font-bold outline-none text-white text-base" placeholder="Send a message..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={ev => ev.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-8 py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL - FULLY INCLUDED */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4" onClick={() => { setSelectedDay(null); setEditingEventId(null); setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" }); }}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">{editingEventId ? "✏️ Update Vibe" : "🚀 Launch New Vibe"}</h3>
             <div className="space-y-4 mb-8">
               <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                 <button onClick={() => setForm({...form, is_public: false})} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${!form.is_public ? 'bg-[#FF2E95] text-white' : 'opacity-40'}`}>Private</button>
                 <button onClick={() => setForm({...form, is_public: true})} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${form.is_public ? 'bg-[#00F0FF] text-black' : 'opacity-40'}`}>Public</button>
               </div>
               <input className="input-premium" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               {form.is_public && (
                 <div className="grid grid-cols-2 gap-4">
                   <input className="input-premium border-[#00F0FF]/30 text-[#00F0FF]" placeholder="Event Info Link" value={form.event_url} onChange={e => setForm({...form, event_url: e.target.value})} />
                   <input className="input-premium border-[#00F0FF]/30 text-[#00F0FF]" placeholder="Ticket Link" value={form.ticket_url} onChange={e => setForm({...form, ticket_url: e.target.value})} />
                 </div>
               )}
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-premium" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-premium" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <input className="input-premium" placeholder="Tags (Tech, House, Chill...)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} />
               <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                  <div className="text-center"><p className="text-[10px] font-black uppercase text-[#00F0FF] mb-2">Hour</p><input type="time" className="bg-transparent font-black w-full text-center outline-none text-white text-xl" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></div>
                  <div className="text-center flex flex-col justify-center"><p className="text-[10px] font-black uppercase text-[#00F0FF] mb-1">Date</p><p className="font-black text-lg text-[#D1FF4B]">{format(selectedDay, 'dd MMM')}</p></div>
               </div>
               <textarea className="input-premium h-24 resize-none" placeholder="Description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               <div className="bg-white/5 p-6 rounded-[35px] border border-white/10">
                 <input className="input-premium mb-4" placeholder="Search GIF..." onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-2">
                   {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-16 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40 hover:opacity-100'}`} />)}
                 </div>
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-6 rounded-[30px] uppercase text-xl tracking-widest shadow-neon">{editingEventId ? "Save Changes" : "Launch Vibe"}</button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[60px] w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-8 text-center">
                <img src={user.avatar} className="w-36 h-36 rounded-full border-4 border-[#FF2E95] shadow-xl" />
                <input className="input-premium text-center font-black uppercase text-xl" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Username" />
                <textarea className="input-premium h-24 resize-none text-center" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="Status / Bio" />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-6 rounded-[30px] uppercase tracking-widest">Update</button>
              </div>
           </div>
        </div>
      )}

      <style>{`.shadow-neon { box-shadow: 0 0 30px rgba(209,255,75,0.2); } .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #D1FF4B; border-radius: 10px; } .input-premium { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 18px; font-weight: bold; color: white; width: 100%; outline: none; transition: all 0.3s; }`}</style>
    </div>
  )
}
export default App

