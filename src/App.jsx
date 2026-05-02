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

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase.channel('responsive-v6')
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
      : [...current, { name: user.name, avatar: user.avatar, bio: user.bio, has_ticket: false }];
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
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
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
    await supabase.from('events').insert([{ ...data, attendees: [{ name: user.name, avatar: user.avatar, bio: user.bio, has_ticket: false }] }]);
    setSelectedDay(null); setSelectedGif(null); setGifResults([]);
    setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "" });
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  return (
    <div className="h-screen bg-[#0b0118] text-white font-sans flex flex-col overflow-hidden">
      
      {/* HEADER - COMPACT */}
      <header className="p-3 md:px-10 flex justify-between items-center border-b border-white/5 bg-[#0b0118]/90 backdrop-blur-md z-50 shrink-0">
        <h1 className="text-2xl font-black text-[#D1FF4B] italic uppercase tracking-tighter">Social Hub</h1>
        <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-1 pr-4 rounded-full cursor-pointer hover:border-[#FF2E95] flex items-center gap-2 transition-all">
          <img src={user.avatar} className="w-8 h-8 rounded-full border border-white/10" alt="avatar" />
          <span className="text-[10px] font-black uppercase tracking-widest">{user.name || "Identity"}</span>
        </div>
      </header>

      {/* CALENDAR - ADAPTIVE HEIGHT */}
      <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-2 bg-white/5 p-2 rounded-2xl border border-white/10 shrink-0">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-110">◀</button>
          <h2 className="text-xl font-black uppercase italic text-[#D1FF4B] tracking-widest">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-110">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-1 rounded-2xl overflow-hidden border border-white/5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="bg-white/5 p-1 text-center text-[10px] font-black opacity-40 uppercase border-b border-white/5">{d}</div>
          ))}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={i} className={`relative p-2 border-[0.5px] border-white/5 flex flex-col gap-1 overflow-hidden ${isCurrent ? 'bg-white/5 hover:bg-white/10' : 'opacity-5 pointer-events-none'} ${isToday ? 'bg-[#D1FF4B]/10 ring-1 ring-inset ring-[#D1FF4B]/40' : ''}`} onClick={() => isCurrent && dayEvents.length === 0 && setSelectedDay(day)}>
                <div className="flex justify-between items-center shrink-0">
                  <span className={`text-[12px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-30'}`}>{format(day, 'd')}</span>
                  {isCurrent && <button onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }} className="text-[12px] opacity-20 hover:opacity-100 hover:text-[#D1FF4B]">+</button>}
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setActiveEvent(e); }} className={`p-1.5 rounded-lg text-[9px] font-black uppercase truncate border border-white/10 ${e.ticket_url ? 'bg-[#00F0FF] text-black' : e.hype > 15 ? 'bg-[#D1FF4B] text-black' : 'bg-[#FF2E95] text-white'}`}>
                      {e.ticket_url ? '🎫 ' : ''}{e.title}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* EVENT MODAL - OPTIMIZED FOR 13"/16" */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-2 md:p-4" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] w-full max-w-6xl h-full md:h-[90vh] rounded-3xl md:rounded-[50px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>
            
            {/* Left Info Column - Scroll only content */}
            <div className="md:w-[40%] flex flex-col bg-[#0e021f] h-1/2 md:h-full border-b md:border-b-0 md:border-r border-white/10">
              <div className="relative h-40 md:h-56 shrink-0">
                <img src={activeEvent.gif_url || `https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=800`} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] to-transparent" />
                <div className="absolute bottom-4 left-6">
                  <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white leading-tight">{activeEvent.title}</h3>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
                {activeEvent.ticket_url && <a href={activeEvent.ticket_url} target="_blank" className="block w-full bg-[#00F0FF] text-black text-center py-3 rounded-xl font-black uppercase text-xs">Buy Tickets 🎫</a>}
                
                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] font-black opacity-40 text-[#00F0FF]">Time</p><p className="font-black text-xs">{activeEvent.time}</p></div>
                  <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] font-black opacity-40 text-[#00F0FF]">Price</p><p className="font-black text-xs truncate">{activeEvent.price || 'Free'}</p></div>
                  <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5 flex items-center justify-center font-black text-xs">📍</div>
                </div>

                <p className="text-white/60 text-xs italic">"{activeEvent.description || "No description."}"</p>

                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase opacity-40 tracking-widest">Crew ({activeEvent.attendees?.length || 0})</p>
                  <div className="flex flex-wrap gap-2">
                    {activeEvent.attendees?.map((a, i) => (
                      <div key={i} className="group relative">
                        <img src={a.avatar} className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 ${a.has_ticket ? 'border-[#00F0FF]' : 'border-white/10'}`} />
                        {a.has_ticket && <div className="absolute -top-1 -right-1 bg-[#00F0FF] text-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">✓</div>}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#D1FF4B] text-black rounded-lg text-[7px] font-black uppercase opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">{a.name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 shrink-0">
                  {activeEvent.attendees?.some(a => a.name === user.name) ? (
                    <>
                      <button onClick={() => toggleTicketStatus(activeEvent)} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'bg-[#00F0FF] border-[#00F0FF] text-black' : 'border-[#00F0FF] text-[#00F0FF]'}`}>Ticket ✓</button>
                      <button onClick={() => handleJoin(activeEvent)} className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl font-black uppercase text-[10px] hover:text-red-500">Leave</button>
                    </>
                  ) : (
                    <button onClick={() => handleJoin(activeEvent)} className="flex-1 bg-[#FF2E95] text-white py-4 rounded-xl font-black uppercase text-xs">Join the Vibe</button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: CHAT - Takes full height */}
            <div className="flex-1 flex flex-col bg-[#0b0118] h-1/2 md:h-full overflow-hidden">
              <div className="p-4 border-b border-white/5 flex justify-between items-center shrink-0">
                  <span className="font-black uppercase text-[10px] tracking-widest text-[#00F0FF]">Live Discussion</span>
                  <button onClick={() => handleHype(activeEvent)} className="text-base">⚡️ {activeEvent.hype || 0}</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'}`}>
                    <span className="text-[7px] font-black uppercase opacity-30 mb-1 mx-2">{c.user}</span>
                    <div className="flex gap-2 items-end">
                      {c.user !== user.name && <img src={c.avatar} className="w-6 h-6 rounded-full" />}
                      <div className={`p-3 rounded-2xl max-w-[85%] ${c.user === user.name ? 'bg-[#00F0FF] text-black' : 'bg-white/5 border border-white/10'}`}>
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

      {/* CREATE EVENT MODAL */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-6 rounded-3xl w-full max-w-xl max-h-[95vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
             <h3 className="text-2xl font-black mb-4 text-[#D1FF4B] uppercase italic text-center">New Vibe</h3>
             <div className="space-y-3">
               <input className="input-field" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <input className="input-field text-[#00F0FF]" placeholder="🎫 Ticket Link (Optional)" value={form.ticket_url} onChange={e => setForm({...form, ticket_url: e.target.value})} />
               <div className="grid grid-cols-2 gap-2">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <textarea className="input-field h-16 resize-none" placeholder="Description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                 <input className="input-field mb-2" placeholder="Search GIF..." onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-2">
                   {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-12 w-full object-cover rounded-lg cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40'}`} />)}
                 </div>
               </div>
               <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-4 rounded-xl uppercase text-sm tracking-widest">Launch Vibe</button>
             </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-8 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-4 text-center">
                <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-[#FF2E95]" />
                <input className="input-field text-center font-black uppercase" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Username" />
                <textarea className="input-field h-20 resize-none text-center" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="Status" />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-4 rounded-xl uppercase text-xs">Update Identity</button>
              </div>
           </div>
        </div>
      )}

      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 3px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #D1FF4B; border-radius: 10px; } .input-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 12px; font-weight: bold; color: white; width: 100%; outline: none; font-size: 12px; }`}</style>
    </div>
  )
}
export default App

