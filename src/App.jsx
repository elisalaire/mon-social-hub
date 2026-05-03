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
  const [activeEvent, setActiveEvent] = useState(null);
  const chatEndRef = useRef(null);
  
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Vibe curator ⚡️",
    location: "Paris",
    social: "@instagram"
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
    fetchEvents();
    const channel = supabase.channel('fix-pro-v17').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents()).subscribe();
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

  const handleSaveEvent = async () => {
    const dataToSave = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    if (editingEventId) {
      const { data, error } = await supabase.from('events').update(dataToSave).eq('id', editingEventId).select();
      if (!error && data) setActiveEvent(data[0]); 
    } else {
      await supabase.from('events').insert([{ ...dataToSave, attendees: [{ name: user.name, avatar: user.avatar, bio: user.bio, has_ticket: false }] }]);
    }
    setSelectedDay(null); setEditingEventId(null); setSelectedGif(null);
    setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" });
  };

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isJoined = current.some(a => a.name === user.name);
    const updatedAttendees = isJoined 
      ? current.filter(a => a.name !== user.name) 
      : [...current, { name: user.name, avatar: user.avatar, bio: user.bio, has_ticket: false }];
    
    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
  };

  const toggleTicketStatus = async (event) => {
    const updatedAttendees = event.attendees.map(a => a.name === user.name ? { ...a, has_ticket: !a.has_ticket } : a);
    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
    if (!event.attendees.find(a => a.name === user.name)?.has_ticket) confetti({ particleCount: 60, spread: 50 });
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
    await supabase.from('events').update({ comments: updatedComments }).eq('id', event.id);
    setCommentInput("");
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
        <h1 className="text-2xl font-black text-[#D1FF4B] italic uppercase tracking-tighter">Social Hub</h1>
        <div onClick={() => setIsEditingProfile(true)} className="flex items-center gap-3 bg-white/5 p-1 pr-4 rounded-full cursor-pointer border border-white/10 hover:border-[#FF2E95] transition-all">
          <img src={user.avatar} className="w-9 h-9 rounded-full border border-white/10" alt="avatar" />
          <span className="text-[11px] font-black uppercase tracking-widest">{user.name || "Set Identity"}</span>
        </div>
      </header>

      {/* CALENDAR */}
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4 bg-white/5 p-4 rounded-3xl border border-white/10 shrink-0">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-110 transition-all">◀</button>
          <h2 className="text-xl md:text-3xl font-black uppercase italic text-[#D1FF4B] tracking-widest">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-110 transition-all">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-1 md:gap-2 rounded-3xl overflow-hidden border border-white/10 bg-white/[0.01]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="bg-white/5 p-2 text-center text-[10px] font-black opacity-30 uppercase">{d}</div>)}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={i} className={`relative min-h-0 p-2 border border-white/5 flex flex-col gap-1 transition-all ${isCurrent ? 'bg-white/5 hover:bg-white/10 cursor-pointer' : 'opacity-5 pointer-events-none'} ${isToday ? 'bg-[#D1FF4B]/5 ring-1 ring-[#D1FF4B]/30' : ''}`} onClick={() => isCurrent && (dayEvents.length > 0 ? setActiveEvent(dayEvents[0]) : setSelectedDay(day))}>
                <div className="flex justify-between items-start shrink-0">
                  <span className={`text-[14px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-20'}`}>{format(day, 'd')}</span>
                  {isCurrent && <span className="text-[14px] opacity-0 group-hover:opacity-100 text-[#D1FF4B]">+</span>}
                </div>
                <div className="flex-1 overflow-hidden space-y-1">
                  {dayEvents.map(e => (
                    <div key={e.id} className={`p-1.5 rounded-lg text-[8px] font-black uppercase truncate border border-white/10 shadow-lg ${e.is_public ? 'bg-[#00F0FF] text-black' : 'bg-[#FF2E95] text-white'}`}>
                      {e.title}
                      {/* JUSTE MILIEU : Mini avatars en ligne pour éviter le scroll vertical */}
                      <div className="flex -space-x-1 mt-1">
                        {e.attendees?.slice(0, 3).map((a, idx) => <img key={idx} src={a.avatar} className="w-3.5 h-3.5 rounded-full ring-1 ring-black" />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* EVENT OVERLAY */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e] border border-white/10 w-full max-w-6xl h-[90vh] rounded-[40px] overflow-hidden flex flex-col md:flex-row relative shadow-2xl" onClick={e => e.stopPropagation()}>
            
            {/* SIDEBAR GAUCHE */}
            <div className="md:w-[42%] flex flex-col bg-[#0e021f] h-full border-r border-white/10 overflow-hidden">
              <div className="relative h-56 shrink-0">
                <img src={activeEvent.gif_url || 'https://images.unsplash.com/photo-1514525253361-bee8718a74a2?w=800'} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] to-transparent" />
                <div className="absolute top-4 right-4 flex gap-2">
                   <button onClick={() => { setEditingEventId(activeEvent.id); setForm(activeEvent); setSelectedDay(new Date(activeEvent.date)); setSelectedGif(activeEvent.gif_url); setActiveEvent(null); }} className="bg-black/60 p-2.5 rounded-full border border-white/10 hover:bg-[#D1FF4B] hover:text-black transition-all">✏️</button>
                   <button onClick={() => { if(window.confirm("Delete?")) supabase.from('events').delete().eq('id', activeEvent.id).then(() => setActiveEvent(null)) }} className="bg-black/60 p-2.5 rounded-full border border-white/10 hover:bg-red-500 transition-all">🗑️</button>
                </div>
                <div className="absolute bottom-4 left-6 right-6">
                  {activeEvent.is_public && <span className="bg-[#00F0FF] text-black text-[8px] font-black px-3 py-1 rounded-full uppercase mb-2 inline-block tracking-tighter">Public Event</span>}
                  <h3 className="text-3xl font-black uppercase text-white leading-tight truncate">{activeEvent.title}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {activeEvent.tags?.split(',').map((tag, idx) => <span key={idx} className="text-[7px] font-black bg-white/10 px-2 py-0.5 rounded-full uppercase text-[#D1FF4B]">#{tag.trim()}</span>)}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  {activeEvent.ticket_url && <a href={activeEvent.ticket_url} target="_blank" className="bg-[#00F0FF] text-black text-center py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest">Tickets 🎫</a>}
                  {activeEvent.event_url && <a href={activeEvent.event_url} target="_blank" className="bg-white/10 text-white text-center py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest">Site Web 🔗</a>}
                </div>

                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] font-black uppercase text-[#00F0FF] mb-0.5">Hour</p><p className="font-black text-sm">{activeEvent.time}</p></div>
                  <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] font-black uppercase text-[#00F0FF] mb-0.5">Price</p><p className="font-black text-sm truncate">{activeEvent.price || 'Free'}</p></div>
                  <div className="bg-white/5 p-2 rounded-xl text-center border border-white/5"><p className="text-[7px] font-black uppercase text-[#00F0FF] mb-0.5">Date</p><p className="font-black text-sm">{format(new Date(activeEvent.date), 'dd MMM')}</p></div>
                </div>

                <p className="text-white/50 text-xs italic line-clamp-2 shrink-0 leading-relaxed">"{activeEvent.description || "No description provided."}"</p>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 shrink-0"><p className="text-[11px] font-bold truncate">📍 {activeEvent.location}</p></div>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <p className="text-[9px] font-black uppercase opacity-30 mb-2 tracking-widest">Crew ({activeEvent.attendees?.length || 0})</p>
                  <div className="flex-1 overflow-y-auto flex flex-wrap gap-2.5 content-start custom-scrollbar pr-2">
                    {activeEvent.attendees?.map((a, i) => (
                      <div key={i} className="group relative">
                        {/* DEGRADE & STATUS RESTORED */}
                        <div className={`p-[2px] rounded-full transition-all ${a.has_ticket ? 'bg-gradient-to-tr from-[#00F0FF] to-[#D1FF4B]' : 'bg-white/10'}`}>
                           <img src={a.avatar} className="w-10 h-10 rounded-full border-2 border-[#0e021f]" />
                           {a.has_ticket && <div className="absolute -top-1 -right-1 bg-[#00F0FF] text-black text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-black ring-2 ring-[#0e021f]">✓</div>}
                        </div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-[#D1FF4B] text-black rounded-lg text-[8px] font-black uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-black/10">
                          {a.name}: {a.bio || "Vibing"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-white/5 shrink-0">
                  {activeEvent.attendees?.some(a => a.name === user.name) ? (
                    <>
                      <button onClick={() => toggleTicketStatus(activeEvent)} className={`flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'bg-[#00F0FF] border-[#00F0FF] text-black' : 'border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF]/5'}`}>
                        {activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'Ticket Ready ✓' : 'Confirm Ticket?'}
                      </button>
                      <button onClick={() => handleJoin(activeEvent)} className="bg-white/5 border border-white/10 px-4 py-3.5 rounded-xl font-black uppercase text-[9px] hover:text-red-500 transition-all">Leave</button>
                    </>
                  ) : <button onClick={() => handleJoin(activeEvent)} className="flex-1 bg-[#FF2E95] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] shadow-lg active:scale-95 transition-all">Join the Crew</button>}
                </div>
              </div>
            </div>

            {/* CHAT */}
            <div className="flex-1 flex flex-col bg-[#0b0118] h-full overflow-hidden">
              <div className="p-5 border-b border-white/5 bg-black/20 flex justify-between items-center shrink-0">
                  <span className="font-black uppercase text-[10px] tracking-[0.3em] text-[#00F0FF]">Live Chat</span>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'}`}>
                    <span className="text-[7px] font-black uppercase opacity-30 mb-1 mx-2">{c.user} • {c.time}</span>
                    <div className="flex gap-3 items-end">
                      {c.user !== user.name && <img src={c.avatar} className="w-8 h-8 rounded-full border border-white/10" />}
                      <div className={`p-3.5 rounded-2xl max-w-[85%] ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/5 border border-white/10 rounded-tl-none'}`}>
                        <p className="text-[13px] font-bold leading-tight">{c.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-6 bg-white/5 border-t border-white/10 flex gap-2 shrink-0">
                <input className="bg-transparent flex-1 font-bold outline-none text-white text-sm" placeholder="Say something..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={ev => ev.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-6 py-3 rounded-xl uppercase text-[9px] tracking-widest shadow-lg">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE EDIT PROFIL COMPLETE */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-8 rounded-[40px] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-6">
                <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-[#FF2E95] shadow-neon-pink" />
                <div className="w-full space-y-3">
                  <input className="input-premium" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Nickname" />
                  <textarea className="input-premium h-20 resize-none" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="Status / Motto" />
                  <input className="input-premium" value={user.location} onChange={e => setUser({...user, location: e.target.value})} placeholder="Location (City)" />
                  <input className="input-premium" value={user.social} onChange={e => setUser({...user, social: e.target.value})} placeholder="Instagram / X Handle" />
                </div>
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#FF2E95] text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-all">Update Identity</button>
              </div>
           </div>
        </div>
      )}

      {/* MODALE CREATE / EDIT EVENT */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-2" onClick={() => { setSelectedDay(null); setEditingEventId(null); setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" }); }}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-8 rounded-[40px] w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
             <h3 className="text-2xl font-black mb-6 text-[#D1FF4B] uppercase italic text-center">{editingEventId ? "✏️ Edit Vibe" : "🚀 New Vibe"}</h3>
             <div className="space-y-3">
               <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                 <button onClick={() => setForm({...form, is_public: false})} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${!form.is_public ? 'bg-[#FF2E95] text-white' : 'opacity-40'}`}>Private</button>
                 <button onClick={() => setForm({...form, is_public: true})} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${form.is_public ? 'bg-[#00F0FF] text-black' : 'opacity-40'}`}>Public</button>
               </div>
               <input className="input-premium" placeholder="Event Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-3">
                 <input className="input-premium text-[#00F0FF]" placeholder="Event Website" value={form.event_url} onChange={e => setForm({...form, event_url: e.target.value})} />
                 <input className="input-premium text-[#00F0FF]" placeholder="Ticket Link" value={form.ticket_url} onChange={e => setForm({...form, ticket_url: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <input className="input-premium" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-premium" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <input className="input-premium" placeholder="Tags (ex: Tech, House, Chill)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} />
               <div className="grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                  <div><p className="text-[8px] font-black uppercase text-[#00F0FF]">Time</p><input type="time" className="bg-transparent font-black w-full text-center outline-none text-xl" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></div>
                  <div className="flex flex-col justify-center"><p className="text-[8px] font-black uppercase text-[#00F0FF]">Date</p><p className="font-black text-sm text-[#D1FF4B]">{format(selectedDay, 'dd MMM')}</p></div>
               </div>
               <textarea className="input-premium h-20 resize-none" placeholder="Add some details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               <input className="input-premium mb-2" placeholder="Search a GIF..." onChange={e => searchGiphy(e.target.value)} />
               <div className="grid grid-cols-3 gap-2">
                 {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-14 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40'}`} />)}
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 mt-6 rounded-[25px] uppercase tracking-widest shadow-neon active:scale-95 transition-all">Save Changes</button>
          </div>
        </div>
      )}

      <style>{`
        .shadow-neon { box-shadow: 0 0 20px rgba(209,255,75,0.15); }
        .shadow-neon-pink { box-shadow: 0 0 20px rgba(255,46,149,0.2); }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .input-premium { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 14px; font-weight: 700; color: white; width: 100%; outline: none; transition: all 0.3s; font-size: 13px; }
        .input-premium:focus { border-color: #D1FF4B; background: rgba(255,255,255,0.06); }
      `}</style>
    </div>
  )
}
export default App

