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
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    localStorage.setItem('hub-notifs', JSON.stringify(notifications));
    fetchEvents();

    const channel = supabase.channel('stable-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user, notifications]);

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

  const handleHype = async (e) => {
    await supabase.from('events').update({ hype: (e.hype || 0) + 1 }).eq('id', e.id);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.8 } });
  };

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isJoined = current.some(a => a.name === user.name);
    const updated = isJoined 
      ? current.filter(a => a.name !== user.name) 
      : [...current, { name: user.name, avatar: user.avatar, bio: user.bio, has_ticket: false }];
    await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
  };

  const toggleTicketStatus = async (event) => {
    const updated = event.attendees.map(a => 
      a.name === user.name ? { ...a, has_ticket: !a.has_ticket } : a
    );
    await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    await supabase.from('events').delete().eq('id', id);
    setActiveEvent(null);
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
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
      
      {/* HEADER */}
      <header className="p-4 md:px-10 flex justify-between items-center border-b border-white/5 bg-[#0b0118]/80 backdrop-blur-md z-50">
        <h1 className="text-3xl font-black text-[#D1FF4B] italic tracking-tighter uppercase">Social Hub</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowNotifCenter(!showNotifCenter)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 relative text-xl">🔔</button>
          <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-1 pr-4 rounded-full cursor-pointer hover:border-[#FF2E95] flex items-center gap-3 transition-all">
            <img src={user.avatar} className="w-9 h-9 rounded-full border border-white/10" alt="avatar" />
            <span className="text-[10px] font-black uppercase tracking-widest">{user.name || "Identity"}</span>
          </div>
        </div>
      </header>

      {/* CALENDAR */}
      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 bg-white/5 p-4 rounded-3xl border border-white/10">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black px-4 hover:scale-125 transition-all">◀</button>
          <h2 className="text-3xl font-black uppercase italic text-[#D1FF4B] tracking-widest">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black px-4 hover:scale-125 transition-all">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-2 rounded-3xl overflow-hidden border border-white/5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="bg-white/5 p-4 text-center text-[12px] font-black opacity-30 uppercase tracking-widest">{d}</div>)}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={i} className={`relative min-h-0 p-4 border border-white/5 flex flex-col gap-3 ${isCurrent ? 'bg-white/5 hover:bg-white/10' : 'opacity-10 pointer-events-none'} ${isToday ? 'bg-[#D1FF4B]/5 ring-1 ring-[#D1FF4B]/40' : ''}`} onClick={() => isCurrent && dayEvents.length === 0 && setSelectedDay(day)}>
                <div className="flex justify-between items-start">
                  <span className={`text-[14px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-30'}`}>{format(day, 'd')}</span>
                  {isCurrent && <button onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }} className="text-[14px] opacity-20 hover:opacity-100 hover:text-[#D1FF4B] font-black">+</button>}
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setActiveEvent(e); }} className={`p-3 rounded-2xl text-[10px] font-black uppercase border border-white/10 cursor-pointer ${e.ticket_url ? 'bg-[#00F0FF] text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]' : e.hype > 15 ? 'bg-[#D1FF4B] text-black' : 'bg-[#FF2E95] text-white'}`}>
                      <div className="truncate mb-1">{e.ticket_url ? '🎫 ' : ''}{e.title}</div>
                      <div className="flex -space-x-2">
                        {e.attendees?.slice(0, 3).map((a, idx) => <img key={idx} src={a.avatar} className="w-5 h-5 rounded-full border border-black/20" />)}
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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] w-full max-w-5xl h-[85vh] rounded-[50px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="md:w-1/2 flex flex-col bg-[#0e021f] overflow-y-auto custom-scrollbar">
              <div className="relative h-72 shrink-0">
                <img src={activeEvent.gif_url || `https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=800`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  {activeEvent.ticket_url && <span className="bg-[#00F0FF] text-black text-[9px] font-black px-4 py-1 rounded-full uppercase mb-2 inline-block tracking-[0.2em]">Public Event</span>}
                  <h3 className="text-5xl font-black uppercase tracking-tighter text-white leading-none">{activeEvent.title}</h3>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 p-4 rounded-3xl text-center"><p className="text-[8px] font-black uppercase opacity-40 text-[#00F0FF]">Time</p><p className="font-black">{activeEvent.time}</p></div>
                  <div className="bg-white/5 p-4 rounded-3xl text-center"><p className="text-[8px] font-black uppercase opacity-40 text-[#00F0FF]">Price</p><p className="font-black truncate">{activeEvent.price}</p></div>
                  <div className="bg-white/5 p-4 rounded-3xl text-center flex items-center justify-center"><p className="font-black text-xl">📍</p></div>
                </div>
                
                {activeEvent.ticket_url && (
                  <a href={activeEvent.ticket_url} target="_blank" className="block w-full bg-[#00F0FF] text-black text-center py-5 rounded-3xl font-black uppercase tracking-widest text-sm hover:scale-[0.98] transition-all">Buy Tickets Here 🎟️</a>
                )}

                <p className="text-white/60 font-medium leading-relaxed">{activeEvent.description}</p>
                
                <div>
                  <p className="text-[10px] font-black uppercase opacity-40 mb-3 tracking-widest">The Crew</p>
                  <div className="flex flex-wrap gap-3">
                    {activeEvent.attendees?.map((a, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 group relative">
                        <img src={a.avatar} className={`w-12 h-12 rounded-full border-2 ${a.has_ticket ? 'border-[#00F0FF] ring-2 ring-[#00F0FF]/20' : 'border-white/10'}`} />
                        {a.has_ticket && <span className="absolute -top-1 -right-1 text-[10px]">✅</span>}
                        <div className="absolute bottom-full mb-2 bg-[#D1FF4B] text-black p-2 rounded-xl text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 pointer-events-none">{a.name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  {activeEvent.attendees?.some(a => a.name === user.name) && (
                    <button onClick={() => toggleTicketStatus(activeEvent)} className={`flex-1 py-4 rounded-3xl font-black uppercase text-xs tracking-widest border-2 transition-all ${activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF]' : 'border-white/10 hover:border-[#00F0FF]'}`}>
                      {activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'Ticket Secured ✅' : 'I got my ticket'}
                    </button>
                  )}
                  <button onClick={() => handleJoin(activeEvent)} className={`px-8 py-4 rounded-3xl font-black uppercase text-xs ${activeEvent.attendees?.some(a => a.name === user.name) ? 'bg-white/10' : 'bg-[#FF2E95]'}`}>
                    {activeEvent.attendees?.some(a => a.name === user.name) ? 'Leave' : 'Join'}
                  </button>
                </div>
              </div>
            </div>
            {/* Chat Column */}
            <div className="md:w-1/2 flex flex-col bg-[#0b0118] border-l border-white/5 h-full overflow-hidden">
              <div className="p-8 border-b border-white/5 font-black uppercase text-xs tracking-widest text-[#00F0FF]">Live Feed</div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'}`}>
                    <div className="flex gap-3 items-end">
                      {c.user !== user.name && <img src={c.avatar} className="w-8 h-8 rounded-full border border-white/10" />}
                      <div className={`p-4 rounded-3xl max-w-[280px] ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/5 rounded-tl-none border border-white/10'}`}>
                        <p className="text-sm font-bold">{c.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-8 bg-white/5 border-t border-white/5 flex gap-3">
                <input className="bg-transparent flex-1 font-bold outline-none text-white" placeholder="Say something..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={ev => ev.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-6 py-3 rounded-2xl uppercase text-[10px]">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-neon" onClick={e => e.stopPropagation()}>
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">Plan a Vibe</h3>
             <div className="space-y-4 mb-8">
               <input className="input-field" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <input className="input-field" placeholder="Ticket Link (Optional for public events)" value={form.ticket_url} onChange={e => setForm({...form, ticket_url: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <textarea className="input-field h-24 resize-none" placeholder="Description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               
               <div className="bg-white/5 p-6 rounded-[35px] border border-white/10">
                 <input className="input-field mb-4" placeholder="Search GIF..." onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-2">
                   {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-16 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40'}`} />)}
                 </div>
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-6 rounded-[30px] uppercase text-xl tracking-widest shadow-neon">Launch Vibe</button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[60px] w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-8 text-center">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#FF2E95]" />
                <input className="input-field text-center font-black uppercase text-xl" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Name" />
                <textarea className="input-field h-24 resize-none text-center" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="Bio/Status" />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest shadow-xl">Save Identity</button>
              </div>
           </div>
        </div>
      )}

      <style>{`.shadow-neon { box-shadow: 0 0 30px rgba(209,255,75,0.2); } .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #D1FF4B; border-radius: 10px; } .input-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 18px; font-weight: bold; color: white; width: 100%; outline: none; }`}</style>
    </div>
  )
}
export default App

