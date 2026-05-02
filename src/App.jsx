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
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();
    const channel = supabase.channel('v15-final').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents()).subscribe();
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
    if (editingEventId) {
        const { error } = await supabase.from('events').update(data).eq('id', editingEventId);
        if (error) console.error(error);
    } else {
        await supabase.from('events').insert([{ ...data, attendees: [{ name: user.name, avatar: user.avatar, bio: user.bio, has_ticket: false }] }]);
    }
    setSelectedDay(null); setEditingEventId(null); setSelectedGif(null); setGifResults([]);
    setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" });
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    await supabase.from('events').delete().eq('id', id);
    setActiveEvent(null);
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  return (
    <div className="h-screen bg-[#0b0118] text-white font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="p-3 md:px-10 flex justify-between items-center border-b border-white/10 bg-[#0b0118]/80 backdrop-blur-xl z-50 shrink-0">
        <h1 className="text-xl md:text-2xl font-black text-[#D1FF4B] italic uppercase tracking-tighter">Social Hub</h1>
        <div onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 bg-white/5 p-1 pr-3 rounded-full cursor-pointer hover:bg-white/10 border border-white/10 transition-all">
          <img src={user.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full" alt="avatar" />
          <span className="text-[10px] font-black uppercase">{user.name || "Identity"}</span>
        </div>
      </header>

      {/* CALENDAR - FULL SCREEN / NO SCROLL */}
      <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-2 bg-white/5 p-2 rounded-2xl border border-white/10 shrink-0 shadow-lg">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-110 transition-all">◀</button>
          <h2 className="text-sm md:text-xl font-black uppercase italic text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-110 transition-all">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-1 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.01]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="bg-white/5 p-1 text-center text-[9px] font-black opacity-30 uppercase border-b border-white/5">{d}</div>)}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={i} 
                className={`relative min-h-0 p-1 md:p-2 border-[0.5px] border-white/5 flex flex-col gap-1 transition-all ${isCurrent ? 'bg-white/5 hover:bg-white/[0.06] cursor-pointer' : 'opacity-5 pointer-events-none'} ${isToday ? 'bg-[#D1FF4B]/5 ring-1 ring-inset ring-[#D1FF4B]/30' : ''}`}
                onClick={() => isCurrent && (dayEvents.length > 0 ? setActiveEvent(dayEvents[0]) : setSelectedDay(day))}
              >
                <div className="flex justify-between items-center shrink-0">
                  <span className={`text-[11px] md:text-[14px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-30'}`}>{format(day, 'd')}</span>
                  {isCurrent && <button onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }} className="text-[12px] opacity-20 hover:opacity-100 hover:text-[#D1FF4B]">+</button>}
                </div>
                <div className="flex-1 overflow-hidden space-y-1">
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setActiveEvent(e); }} className={`p-1 md:p-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase truncate border border-white/10 shadow-lg ${e.is_public ? 'bg-[#00F0FF] text-black' : e.hype > 15 ? 'bg-[#D1FF4B] text-black' : 'bg-[#FF2E95] text-white'}`}>
                      {e.is_public ? '🎫 ' : ''}{e.title}
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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-0 md:p-4" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e] border-0 md:border-2 border-white/10 w-full h-full md:h-[85vh] md:max-w-6xl md:rounded-[40px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>
            
            {/* Left Side: FIXED Content */}
            <div className="flex-1 md:w-[42%] flex flex-col bg-[#0e021f] h-full border-r border-white/10 overflow-hidden">
              <div className="relative h-44 md:h-52 shrink-0">
                <img src={activeEvent.gif_url || `https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=800`} className="w-full h-full object-cover" alt="visual" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] via-transparent" />
                
                {/* Admin Actions */}
                <div className="absolute top-4 right-4 flex gap-2">
                   <button onClick={() => { setEditingEventId(activeEvent.id); setForm(activeEvent); setSelectedDay(new Date(activeEvent.date)); setSelectedGif(activeEvent.gif_url); setActiveEvent(null); }} className="bg-black/50 p-2 rounded-xl border border-white/10 hover:bg-[#D1FF4B] hover:text-black transition-all">✏️</button>
                   <button onClick={() => deleteEvent(activeEvent.id)} className="bg-black/50 p-2 rounded-xl border border-white/10 hover:bg-red-500 transition-all">🗑️</button>
                </div>

                <div className="absolute bottom-4 left-6">
                  {activeEvent.is_public && <span className="bg-[#00F0FF] text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase mb-1 inline-block">Public Event</span>}
                  <h3 className="text-xl md:text-3xl font-black uppercase tracking-tighter text-white leading-none truncate">{activeEvent.title}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activeEvent.tags?.split(',').map((tag, idx) => <span key={idx} className="text-[7px] font-black bg-white/10 px-2 py-0.5 rounded-full uppercase text-[#D1FF4B]">#{tag.trim()}</span>)}
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-2 gap-2 shrink-0">
                   {activeEvent.is_public && activeEvent.ticket_url && <a href={activeEvent.ticket_url} target="_blank" className="bg-[#00F0FF] text-black text-center py-2 rounded-xl font-black uppercase text-[10px]">Tickets 🎫</a>}
                   {activeEvent.is_public && activeEvent.event_url && <a href={activeEvent.event_url} target="_blank" className="bg-white/10 text-white text-center py-2 rounded-xl font-black uppercase text-[10px]">Info Link 🔗</a>}
                </div>
                
                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] font-black uppercase opacity-40 text-[#00F0FF]">Time</p><p className="font-black text-xs">{activeEvent.time}</p></div>
                  <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] font-black uppercase opacity-40 text-[#00F0FF]">Price</p><p className="font-black text-xs truncate">{activeEvent.price || 'Free'}</p></div>
                  <button onClick={() => addToCalendar(activeEvent)} className="bg-white/5 p-2 rounded-xl border border-white/5 text-[9px] font-black hover:bg-[#D1FF4B] hover:text-black">📅 CAL</button>
                </div>

                <p className="text-white/60 text-xs italic line-clamp-2 shrink-0">"{activeEvent.description || "No description."}"</p>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5 shrink-0"><p className="text-xs font-bold truncate">📍 {activeEvent.location}</p></div>

                {/* CREW List - SCROLL ONLY HERE */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <p className="text-[9px] font-black uppercase opacity-40 mb-2">Crew ({activeEvent.attendees?.length || 0})</p>
                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-wrap gap-2 content-start pb-4">
                    {activeEvent.attendees?.map((a, i) => (
                      <div key={i} className="group relative">
                        <div className={`p-[2px] rounded-full bg-white/10 ${a.has_ticket ? 'border-2 border-[#00F0FF]' : 'border border-transparent'}`}>
                           <img src={a.avatar} className="w-8 h-8 md:w-10 md:h-10 rounded-full" alt={a.name} />
                           {a.has_ticket && <div className="absolute -top-1 -right-1 bg-[#00F0FF] text-black text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-bold">✓</div>}
                        </div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#D1FF4B] text-black rounded-lg text-[8px] font-black uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                          {a.name}: {a.bio || "Just Vibe"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 pt-2 border-t border-white/5">
                  {activeEvent.attendees?.some(a => a.name === user.name) ? (
                    <>
                      <button onClick={() => toggleTicketStatus(activeEvent)} className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] border-2 transition-all ${activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'bg-[#00F0FF] border-[#00F0FF] text-black' : 'border-[#00F0FF] text-[#00F0FF]'}`}>Status ✓</button>
                      <button onClick={() => handleJoin(activeEvent)} className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl font-black uppercase text-[9px] hover:text-red-500">Leave</button>
                    </>
                  ) : <button onClick={() => handleJoin(activeEvent)} className="flex-1 bg-[#FF2E95] text-white py-4 rounded-xl font-black uppercase text-xs">Join Vibe</button>}
                </div>
              </div>
            </div>

            {/* Right Side: Chat */}
            <div className="flex-1 flex flex-col bg-[#0b0118] h-full overflow-hidden">
              <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center shrink-0">
                  <span className="font-black uppercase text-[10px] tracking-widest text-[#00F0FF]">Discussion</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'}`}>
                    <span className="text-[7px] font-black uppercase opacity-30 mb-1 mx-2">{c.user}</span>
                    <div className="flex gap-2 items-end">
                      {c.user !== user.name && <img src={c.avatar} className="w-8 h-8 rounded-full shadow-lg" />}
                      <div className={`p-3 rounded-2xl max-w-[80%] ${c.user === user.name ? 'bg-[#00F0FF] text-black' : 'bg-white/5 border border-white/10'}`}>
                        <p className="text-xs font-bold leading-tight">{c.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-white/5 border-t border-white/10 flex gap-2 shrink-0">
                <input className="bg-transparent flex-1 font-bold outline-none text-white text-xs" placeholder="Message..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={ev => ev.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-4 py-2 rounded-xl uppercase text-[9px]">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-2" onClick={() => { setSelectedDay(null); setEditingEventId(null); setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" }); }}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-6 rounded-[40px] w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
             <h3 className="text-2xl font-black mb-6 text-[#D1FF4B] uppercase italic text-center">{editingEventId ? "✏️ Edit Vibe" : "🚀 New Vibe"}</h3>
             <div className="space-y-3">
               <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                 <button onClick={() => setForm({...form, is_public: false})} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${!form.is_public ? 'bg-[#FF2E95] text-white' : 'opacity-40'}`}>Private</button>
                 <button onClick={() => setForm({...form, is_public: true})} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${form.is_public ? 'bg-[#00F0FF] text-black' : 'opacity-40'}`}>Public</button>
               </div>
               <input className="input-premium" placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               {form.is_public && (
                 <div className="grid grid-cols-2 gap-2">
                   <input className="input-premium text-[#00F0FF]" placeholder="Event Link" value={form.event_url} onChange={e => setForm({...form, event_url: e.target.value})} />
                   <input className="input-premium text-[#00F0FF]" placeholder="Ticket Link" value={form.ticket_url} onChange={e => setForm({...form, ticket_url: e.target.value})} />
                 </div>
               )}
               <div className="grid grid-cols-2 gap-2">
                 <input className="input-premium" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-premium" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <input className="input-premium" placeholder="Tags (Tech, Chill...)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} />
               <div className="grid grid-cols-2 gap-2 bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
                  <div><p className="text-[8px] font-black uppercase text-[#00F0FF]">Hour</p><input type="time" className="bg-transparent font-black w-full text-center outline-none text-white text-xl" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></div>
                  <div className="flex flex-col justify-center"><p className="text-[8px] font-black uppercase text-[#00F0FF]">Date</p><p className="font-black text-sm text-[#D1FF4B]">{format(selectedDay, 'dd MMM')}</p></div>
               </div>
               <textarea className="input-premium h-20 resize-none" placeholder="Description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               <input className="input-premium" placeholder="Search GIF..." onChange={e => searchGiphy(e.target.value)} />
               <div className="grid grid-cols-3 gap-2">
                 {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-12 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40 hover:opacity-100'}`} />)}
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-4 mt-6 rounded-[25px] uppercase text-xl tracking-widest shadow-neon">Save Vibe</button>
          </div>
        </div>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-10 rounded-[60px] w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-6 text-center">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#FF2E95] shadow-xl" alt="p" />
                <input className="input-premium text-center" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Username" />
                <textarea className="input-premium h-24 resize-none text-center" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="Status" />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#FF2E95] text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl">Update</button>
              </div>
           </div>
        </div>
      )}

      <style>{`.shadow-neon { box-shadow: 0 0 30px rgba(209,255,75,0.2); } .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; } .input-premium { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 12px 18px; font-weight: 700; color: white; width: 100%; outline: none; transition: all 0.3s; font-size: 12px; } .input-premium:focus { border-color: #D1FF4B; background: rgba(255,255,255,0.06); }`}</style>
    </div>
  )
}
export default App

