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
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase.channel('ultimate-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user, readComments]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeEvent?.comments]);

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

  const handleHype = async (e) => {
    await supabase.from('events').update({ hype: (e.hype || 0) + 1 }).eq('id', e.id);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.8 }, colors: ['#D1FF4B', '#FF2E95'] });
  };

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isJoined = current.some(a => a.name === user.name);
    const updated = isJoined ? current.filter(a => a.name !== user.name) : [...current, { name: user.name, avatar: user.avatar }];
    await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this vibe forever?")) return;
    await supabase.from('events').delete().eq('id', id);
    setActiveEvent(null);
    fetchEvents();
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

  const addToCalendar = (event) => {
    const start = format(new Date(`${event.date}T${event.time || '20:00'}`), "yyyyMMdd'T'HHmmss");
    const end = format(new Date(`${event.date}T235900`), "yyyyMMdd'T'HHmmss");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-screen bg-[#0b0118] text-white font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="p-4 md:px-10 flex justify-between items-center border-b border-white/5 bg-[#0b0118]/80 backdrop-blur-md z-50">
        <h1 className="text-3xl font-black text-[#D1FF4B] italic tracking-tighter uppercase">Social Hub</h1>
        <div onClick={() => setIsEditingProfile(true)} className="flex items-center gap-3 bg-white/5 p-1 pr-4 rounded-full cursor-pointer hover:bg-[#FF2E95]/20 border border-white/10 transition-all">
          <img src={user.avatar} className="w-8 h-8 rounded-full border border-white/10 shadow-lg" alt="avatar" />
          <span className="text-[10px] font-black uppercase tracking-widest">{user.name || "Setup Profile"}</span>
        </div>
      </header>

      {/* CALENDAR MAIN */}
      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-gradient-to-b from-[#0b0118] to-[#120428]">
        <div className="flex items-center justify-between mb-4 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-125 transition-all">◀</button>
          <h2 className="text-2xl font-black uppercase italic text-[#D1FF4B] tracking-widest">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-125 transition-all">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-1.5 rounded-3xl overflow-hidden">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="bg-white/5 p-3 text-center text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">{d}</div>
          ))}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={i} 
                onClick={() => isCurrent && (dayEvents.length > 0 ? setActiveEvent(dayEvents[0]) : setSelectedDay(day))}
                className={`relative min-h-0 p-3 border border-white/5 transition-all flex flex-col gap-2 ${isCurrent ? 'bg-white/5 hover:bg-white/10 cursor-pointer' : 'opacity-10 pointer-events-none'} ${isToday ? 'bg-[#D1FF4B]/10 border-[#D1FF4B]/30' : ''}`}
              >
                <span className={`text-[11px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-30'}`}>{format(day, 'd')}</span>
                <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setActiveEvent(e); }} 
                      className={`p-2 rounded-xl text-[8px] font-black uppercase shadow-lg transition-all border ${e.hype > 15 ? 'bg-[#D1FF4B] text-black border-white' : 'bg-[#FF2E95] text-white border-white/10'}`}>
                      <div className="truncate mb-1">{e.title}</div>
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1.5">
                          {e.attendees?.slice(0, 3).map((a, idx) => <img key={idx} src={a.avatar} className="w-4 h-4 rounded-full border border-black/50" />)}
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

      {/* DETAILED EVENT OVERLAY */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e] border-2 border-white/10 w-full max-w-5xl h-[85vh] rounded-[50px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>
            
            {/* Left Info Column */}
            <div className="md:w-1/2 flex flex-col bg-[#0e021f] overflow-y-auto custom-scrollbar">
              <div className="relative h-72 shrink-0">
                <img src={activeEvent.recap_url || activeEvent.gif_url || `https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=800`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="bg-[#D1FF4B] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase mb-2 inline-block tracking-widest">{activeEvent.price || 'Free'}</span>
                      <h3 className="text-5xl font-black uppercase tracking-tighter leading-none text-white">{activeEvent.title}</h3>
                    </div>
                    <button onClick={() => addToCalendar(activeEvent)} className="bg-white/10 p-3 rounded-full hover:bg-[#00F0FF] transition-all" title="Add to Google Calendar">📅</button>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="flex gap-4">
                  <div className="flex-1 bg-white/5 p-5 rounded-3xl border border-white/5 text-center">
                    <p className="text-[9px] font-black uppercase opacity-40 text-[#00F0FF] mb-1">Time</p>
                    <p className="text-lg font-black">{activeEvent.time || '20:00'}</p>
                  </div>
                  <div className="flex-1 bg-white/5 p-5 rounded-3xl border border-white/5 text-center">
                    <p className="text-[9px] font-black uppercase opacity-40 text-[#00F0FF] mb-1">Place</p>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(activeEvent.location)}`} target="_blank" className="text-sm font-black truncate block hover:text-[#D1FF4B]">📍 {activeEvent.location}</a>
                  </div>
                </div>

                <p className="text-white/60 leading-relaxed font-medium">{activeEvent.description || "No description provided."}</p>

                <div className="flex items-center justify-between bg-white/5 p-5 rounded-3xl border border-white/10">
                  <div className="flex -space-x-3">
                    {activeEvent.attendees?.map((a, i) => <img key={i} src={a.avatar} className="w-12 h-12 rounded-full border-4 border-[#0e021f] shadow-xl" />)}
                  </div>
                  <button onClick={() => handleHype(activeEvent)} className="bg-[#D1FF4B] text-black px-6 py-3 rounded-2xl font-black hover:scale-105 transition-all">⚡️ {activeEvent.hype || 0}</button>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => handleJoin(activeEvent)} className={`flex-1 py-5 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl ${activeEvent.attendees?.some(a => a.name === user.name) ? 'bg-white/10' : 'bg-[#FF2E95]'}`}>
                    {activeEvent.attendees?.[0]?.name === user.name ? 'Hosting 👑' : activeEvent.attendees?.some(a => a.name === user.name) ? 'Leave' : 'Join'}
                  </button>
                  {activeEvent.attendees?.[0]?.name === user.name && (
                    <button onClick={() => deleteEvent(activeEvent.id)} className="bg-red-500/20 text-red-500 p-5 rounded-3xl hover:bg-red-500 hover:text-white transition-all">🗑️</button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Chat Column */}
            <div className="md:w-1/2 flex flex-col bg-[#0b0118] border-l border-white/5">
              <div className="p-8 border-b border-white/5 font-black uppercase text-xs tracking-widest text-[#00F0FF]">Live Discussion</div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] font-black uppercase opacity-40 mb-1 ml-2 mr-2">{c.user}</span>
                    <div className="flex gap-3 items-end">
                      {c.user !== user.name && <img src={c.avatar} className="w-8 h-8 rounded-full border border-white/10" />}
                      <div className={`p-4 rounded-3xl max-w-[280px] shadow-xl ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/5 rounded-tl-none border border-white/10'}`}>
                        <p className="text-sm font-bold leading-tight">{c.text}</p>
                        <p className="text-[7px] text-right mt-2 opacity-40 font-black">{c.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-8 bg-white/5 border-t border-white/5 flex gap-3">
                <input className="bg-transparent flex-1 font-bold outline-none text-sm text-white" placeholder="Message the crew..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={ev => ev.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-8 py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:scale-95 transition-all">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-xl" onClick={e => e.stopPropagation()}>
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">Broadcast Vibe</h3>
             <div className="space-y-4 mb-10">
               <input className="input-field" placeholder="Vibe Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Place" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                    <p className="text-[8px] font-black uppercase text-[#00F0FF] mb-2">Hour</p>
                    <input type="time" className="bg-transparent font-black w-full text-center outline-none" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                    <p className="text-[8px] font-black uppercase text-[#00F0FF] mb-2">Date</p>
                    <p className="font-black text-sm">{format(selectedDay, 'dd MMM')}</p>
                  </div>
               </div>
               <textarea className="input-field h-24 resize-none" placeholder="The details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-6 rounded-[30px] uppercase text-lg tracking-widest shadow-neon">Launch Vibe</button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-8 text-center">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#FF2E95] shadow-2xl" />
                <input className="input-field text-center font-black uppercase text-xl" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} />
                <textarea className="input-field h-24 resize-none text-center" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="Vibe curator bio..." />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Update Identity</button>
              </div>
           </div>
        </div>
      )}

      <style>{`.shadow-neon { box-shadow: 0 0 20px rgba(209,255,75,0.3); } .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #D1FF4B; border-radius: 10px; } .input-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 18px; font-weight: bold; color: white; width: 100%; outline: none; transition: all 0.3s; } .input-field:focus { border-color: #00F0FF; background: rgba(255,255,255,0.08); }`}</style>
    </div>
  )
}
export default App

